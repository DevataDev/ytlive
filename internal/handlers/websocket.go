package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os/exec"
	"sync"
	"time"

	"windsorf-youtube-live/internal/job"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for demo
	},
}

// --- Global for broadcasting ---
var streamListClients = make(map[*websocket.Conn]bool)
var streamListClientsMu sync.Mutex

func BroadcastStreamListUpdate() {
	streamListClientsMu.Lock()
	defer streamListClientsMu.Unlock()
	for c := range streamListClients {
		c.WriteJSON(map[string]interface{}{"type": "stream_update"})
	}
}

// Broadcast dashboard stream stats to all clients
func BroadcastDashboardStreams(db *gorm.DB, userID string) {
	var started, scheduled int64
	db.Model(&models.Stream{}).Where("status = ? AND user_id = ?", "live", userID).Count(&started)
	db.Model(&models.Stream{}).Where("status = ? AND user_id = ?", "scheduled", userID).Count(&scheduled)
	msg := map[string]interface{}{"type": "dashboard_streams", "started": started, "scheduled": scheduled}
	streamListClientsMu.Lock()
	for c := range streamListClients {
		c.WriteJSON(msg)
	}
	streamListClientsMu.Unlock()
}

var (
	lastNetBytesSent  uint64
	lastNetBytesRecv  uint64
	lastNetSampleTime int64
)

// Broadcast server metrics to all clients
func BroadcastDashboardMetrics() {
	cpuPercent, _ := cpu.Percent(0, false)
	memStats, _ := mem.VirtualMemory()
	netIO, _ := net.IOCounters(false)

	now := time.Now().UnixNano() / int64(time.Millisecond)
	uploadMbps := 0.0
	downloadMbps := 0.0
	if len(netIO) > 0 {
		if lastNetSampleTime > 0 {
			deltaTime := float64(now-lastNetSampleTime) / 1000.0 // seconds
			deltaSent := float64(netIO[0].BytesSent - lastNetBytesSent)
			deltaRecv := float64(netIO[0].BytesRecv - lastNetBytesRecv)
			if deltaTime > 0 {
				uploadMbps = (deltaSent * 8) / (deltaTime * 1e6) // bits to megabits
				downloadMbps = (deltaRecv * 8) / (deltaTime * 1e6)
			}
		}
		lastNetBytesSent = netIO[0].BytesSent
		lastNetBytesRecv = netIO[0].BytesRecv
		lastNetSampleTime = now
	}

	metrics := map[string]interface{}{
		"type":     "dashboard_metrics",
		"cpu":      0.0,
		"memory":   0.0,
		"upload":   uploadMbps,
		"download": downloadMbps,
	}
	if len(cpuPercent) > 0 {
		metrics["cpu"] = cpuPercent[0]
	}
	if memStats != nil {
		metrics["memory"] = memStats.UsedPercent
	}
	streamListClientsMu.Lock()
	for c := range streamListClients {
		c.WriteJSON(metrics)
	}
	streamListClientsMu.Unlock()
}

// Periodically broadcast per-stream stats to all clients
func BroadcastStreamStats() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		<-ticker.C
		stats := make(map[string]interface{})
		job.WorkersMu.Lock()
		for id, worker := range job.Workers {
			stats[id] = map[string]interface{}{
				"cpu": worker.Stats.CPUPercent,
				"mem": worker.Stats.RSSBytes,
			}
		}
		job.WorkersMu.Unlock()
		streamListClientsMu.Lock()
		for c := range streamListClients {
			c.WriteJSON(map[string]interface{}{
				"type":  "stream_stats",
				"stats": stats,
			})
		}
		streamListClientsMu.Unlock()
	}
}

func WebSocketHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	streamListClientsMu.Lock()
	streamListClients[conn] = true
	streamListClientsMu.Unlock()
	defer func() {
		streamListClientsMu.Lock()
		delete(streamListClients, conn)
		streamListClientsMu.Unlock()
	}()

	var procLock sync.Mutex
	type ffmpegCommand struct {
		action    string
		streamKey string
		videoName string
	}
	cmdChan := make(chan ffmpegCommand)

	// FFmpeg goroutine (per connection)
	go func() {
		var ffmpegCmd *exec.Cmd
		for cmd := range cmdChan {
			if cmd.action == "start" {
				procLock.Lock()
				if ffmpegCmd != nil && ffmpegCmd.Process != nil {
					conn.WriteMessage(websocket.TextMessage, []byte("Stream already running"))
					procLock.Unlock()
					continue
				}
				streamKey := cmd.streamKey
				videoName := cmd.videoName
				if streamKey == "" {
					conn.WriteMessage(websocket.TextMessage, []byte("Missing stream key"))
					procLock.Unlock()
					continue
				}
				if videoName == "" {
					conn.WriteMessage(websocket.TextMessage, []byte("Missing video file name"))
					procLock.Unlock()
					continue
				}
				ytURL := "rtmp://a.rtmp.youtube.com/live2/" + streamKey
				ffmpegCmd = exec.Command("ffmpeg",
					"-re", "-nostdin", "-stream_loop", "-1", "-i", videoName,
					"-c:v", "libx264", "-preset", "veryfast", "-maxrate", "3000k", "-bufsize", "6000k",
					"-pix_fmt", "yuv420p", "-g", "60", "-f", "flv", ytURL,
				)
				go func(localCmd *exec.Cmd) {
					err := localCmd.Run()
					if err != nil {
						conn.WriteMessage(websocket.TextMessage, []byte("FFmpeg error: "+err.Error()))
					} else {
						conn.WriteMessage(websocket.TextMessage, []byte("Stream ended"))
					}
					procLock.Lock()
					ffmpegCmd = nil
					procLock.Unlock()
				}(ffmpegCmd)
				conn.WriteMessage(websocket.TextMessage, []byte("Started streaming to YouTube"))
				procLock.Unlock()
			}
			if cmd.action == "stop" {
				procLock.Lock()
				if ffmpegCmd != nil && ffmpegCmd.Process != nil {
					err := ffmpegCmd.Process.Kill()
					if err != nil {
						conn.WriteMessage(websocket.TextMessage, []byte("Failed to stop stream: "+err.Error()))
					} else {
						conn.WriteMessage(websocket.TextMessage, []byte("Stopped streaming"))
					}
					ffmpegCmd = nil
				} else {
					conn.WriteMessage(websocket.TextMessage, []byte("No stream to stop"))
				}
				procLock.Unlock()
			}
		}
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// parse message
		var data map[string]interface{}
		err = json.Unmarshal(msg, &data)
		if err != nil {
			continue
		}

		// handle message
		action := data["action"]
		videoName, _ := data["videoName"].(string)
		if action == "start" {
			streamKey, _ := data["streamKey"].(string)
			cmdChan <- ffmpegCommand{action: "start", streamKey: streamKey, videoName: videoName}
		}

		if action == "stop" {
			cmdChan <- ffmpegCommand{action: "stop"}
		}

		// Echo message back (optional, can remove)
		conn.WriteMessage(websocket.TextMessage, msg)
	}

	close(cmdChan)
}

// WebSocketHandlerWithContext supports context cancellation (for graceful shutdown)
func WebSocketHandlerWithContext(ctx context.Context, c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	streamListClientsMu.Lock()
	streamListClients[conn] = true
	streamListClientsMu.Unlock()
	defer func() {
		streamListClientsMu.Lock()
		delete(streamListClients, conn)
		streamListClientsMu.Unlock()
	}()

	var procLock sync.Mutex
	type ffmpegCommand struct {
		action    string
		streamKey string
		videoName string
	}
	cmdChan := make(chan ffmpegCommand)

	// FFmpeg goroutine (per connection)
	go func() {
		var ffmpegCmd *exec.Cmd
		for {
			select {
			case <-ctx.Done():
				procLock.Lock()
				if ffmpegCmd != nil && ffmpegCmd.Process != nil {
					ffmpegCmd.Process.Kill()
				}
				procLock.Unlock()
				return
			case cmd, ok := <-cmdChan:
				if !ok {
					return
				}
				if cmd.action == "start" {
					procLock.Lock()
					if ffmpegCmd != nil && ffmpegCmd.Process != nil {
						conn.WriteMessage(websocket.TextMessage, []byte("Stream already running"))
						procLock.Unlock()
						continue
					}
					streamKey := cmd.streamKey
					videoName := cmd.videoName
					if streamKey == "" {
						conn.WriteMessage(websocket.TextMessage, []byte("Missing stream key"))
						procLock.Unlock()
						continue
					}
					if videoName == "" {
						conn.WriteMessage(websocket.TextMessage, []byte("Missing video file name"))
						procLock.Unlock()
						continue
					}
					ytURL := "rtmp://a.rtmp.youtube.com/live2/" + streamKey
					ffmpegCmd = exec.Command("ffmpeg",
						"-re", "-nostdin", "-stream_loop", "-1", "-i", videoName,
						"-c:v", "libx264", "-preset", "veryfast", "-maxrate", "3000k", "-bufsize", "6000k",
						"-pix_fmt", "yuv420p", "-g", "60", "-f", "flv", ytURL,
					)
					go func(localCmd *exec.Cmd) {
						err := localCmd.Run()
						if err != nil {
							conn.WriteMessage(websocket.TextMessage, []byte("FFmpeg error: "+err.Error()))
						} else {
							conn.WriteMessage(websocket.TextMessage, []byte("Stream ended"))
						}
						procLock.Lock()
						ffmpegCmd = nil
						procLock.Unlock()
					}(ffmpegCmd)
					conn.WriteMessage(websocket.TextMessage, []byte("Started streaming to YouTube"))
					procLock.Unlock()
				}
				if cmd.action == "stop" {
					procLock.Lock()
					if ffmpegCmd != nil && ffmpegCmd.Process != nil {
						err := ffmpegCmd.Process.Kill()
						if err != nil {
							conn.WriteMessage(websocket.TextMessage, []byte("Failed to stop stream: "+err.Error()))
						} else {
							conn.WriteMessage(websocket.TextMessage, []byte("Stopped streaming"))
						}
						ffmpegCmd = nil
					} else {
						conn.WriteMessage(websocket.TextMessage, []byte("No stream to stop"))
					}
					procLock.Unlock()
				}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			close(cmdChan)
			return
		default:
			_, msg, err := conn.ReadMessage()
			if err != nil {
				close(cmdChan)
				return
			}

			// parse message
			var data map[string]interface{}
			err = json.Unmarshal(msg, &data)
			if err != nil {
				continue
			}

			// handle message
			action := data["action"]
			videoName, _ := data["videoName"].(string)
			if action == "start" {
				streamKey, _ := data["streamKey"].(string)
				cmdChan <- ffmpegCommand{action: "start", streamKey: streamKey, videoName: videoName}
			}

			if action == "stop" {
				cmdChan <- ffmpegCommand{action: "stop"}
			}

			// Echo message back (optional, can remove)
			// conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
}

func BroadcastMirrorRoomIsAliveUpdate(isAliveMap map[string]bool) {
	streamListClientsMu.Lock()
	for c := range streamListClients {
		c.WriteJSON(map[string]interface{}{"type": "mirror_room_is_alive_update", "is_alive_map": isAliveMap})
	}
	streamListClientsMu.Unlock()
}

func BroadcastMirrorUpdateList() {
	streamListClientsMu.Lock()
	for c := range streamListClients {
		c.WriteJSON(map[string]interface{}{"type": "mirror_update_list"})
	}
	streamListClientsMu.Unlock()
}

func BroadcastMonitorUpdate(id string, uniqueId string, isLive bool) {
	streamListClientsMu.Lock()
	for c := range streamListClients {
		c.WriteJSON(map[string]interface{}{"type": "monitor_update", "id": id, "unique_id": uniqueId, "is_live": isLive})
	}
	streamListClientsMu.Unlock()
}
