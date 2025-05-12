package job

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/process"
	"gorm.io/gorm"

	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/redisutil"
)

type StreamWorker struct {
	StreamID    string
	Cmd         *exec.Cmd
	CancelFunc  context.CancelFunc
	Status      string // "live", "scheduled", "stopped", etc.
	Stats       StreamStats
	StopChan    chan struct{} // Added StopChan field
	stopOnce    sync.Once
	FfmpegPID   *int
	FilePath    string
	StreamKey   string
	MaxBitrate  *int
	RTMPUrl     string
	LoopVideo   bool
	LoopCount   *int
	DB          *gorm.DB
	RedisPubSub *redisutil.RedisPubSub
}

type StreamStats struct {
	CPUPercent float64
	RSSBytes   uint64
}

var (
	Workers          = make(map[string]*StreamWorker)
	WorkersMu        sync.RWMutex
	RestartLock      sync.Mutex
	driveProgressMu  sync.RWMutex
	driveProgressMap = make(map[string]map[string]interface{}) // driveLink -> progress/status map
)

// AddWorker safely adds a worker to the map
func AddWorker(worker *StreamWorker) {
	WorkersMu.Lock()
	defer WorkersMu.Unlock()
	Workers[worker.StreamID] = worker
}

// RemoveWorker safely removes a worker from the map
func RemoveWorker(streamID string) {
	WorkersMu.Lock()
	defer WorkersMu.Unlock()
	delete(Workers, streamID)
}

// GetWorker safely retrieves a worker by stream ID
func GetWorker(streamID string) (*StreamWorker, bool) {
	WorkersMu.RLock()
	defer WorkersMu.RUnlock()
	w, ok := Workers[streamID]
	return w, ok
}

// StopStreamWorker stops the FFmpeg process for the stream and removes the worker.
func StopStreamWorker(streamID string) error {
	worker, ok := GetWorker(streamID)
	if !ok {
		log.Println("Stream", streamID, "not found.")
		return nil // Already stopped
	}

	// update worker status
	worker.Status = "stopped" // prevent double restart
	log.Println("Stopping stream", streamID, "with status", worker.Status)
	// chceck if context still active
	if worker.CancelFunc != nil {
		log.Println("Cancelling context for stream", streamID)
		worker.CancelFunc()
		log.Println("Context cancelled for stream", streamID)
		select {
		case <-time.After(5 * time.Second):
			log.Println("Timeout waiting for FFmpeg to exit after cancel, forcing kill...")
			// Force kill logic here (e.g., kill process)
			if worker.Cmd != nil && worker.Cmd.Process != nil {
				_ = worker.Cmd.Process.Kill()
			}

			// if still alive, kill using os kill
			if worker.Cmd != nil && worker.Cmd.Process != nil {
				if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
					_ = exec.Command("kill", "-9", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				} else if runtime.GOOS == "windows" {
					_ = exec.Command("taskkill", "/F", "/PID", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				}
			}
			log.Println("FFmpeg process killed for stream", streamID)
		}
	}
	log.Println("Killing FFmpeg process for stream", streamID)
	if worker.Cmd != nil && worker.Cmd.Process != nil {
		_ = worker.Cmd.Process.Signal(syscall.SIGTERM)
		log.Println("FFmpeg process signalled for stream", streamID)
		// Wait for process to exit, then kill if still alive, timeout after 5 seconds
		done := make(chan error, 1)
		go func() {
			done <- worker.Cmd.Wait()
			log.Println("FFmpeg process exited for stream", streamID)
		}()
		select {
		case <-done:
			log.Println("FFmpeg process exited for stream", streamID)
			// exited gracefully
		case <-time.After(5 * time.Second):
			if worker.Cmd != nil && worker.Cmd.Process != nil {
				_ = worker.Cmd.Process.Kill()
				log.Println("FFmpeg process killed for stream", streamID)
			} else {
				// exec kill -9 <pid> if its linux
				if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
					_ = exec.Command("kill", "-9", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				} else if runtime.GOOS == "windows" {
					_ = exec.Command("taskkill", "/F", "/PID", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				}
				log.Println("FFmpeg process killed for stream", streamID)
			}
			<-done // ensure Wait() returns
		}
	}

	// Close stopChan to stop stats monitor goroutine
	if worker.StopChan != nil {
		log.Println("Closing stopChan for stream", streamID)
		worker.stopOnce.Do(func() { close(worker.StopChan) })
	}
	// Remove worker from map
	if worker != nil {
		log.Println("Removing worker for stream", streamID)
		RemoveWorker(streamID)
	}
	return nil
}

// MonitorFFmpegStats monitors CPU and memory usage for the FFmpeg process
func (w *StreamWorker) MonitorFFmpegStats(stopChan <-chan struct{}) {
	pid := w.Cmd.Process.Pid
	log.Println("Monitoring FFmpeg stats for stream", w.StreamID, "with PID", pid)
	if pid == 0 {
		return
	}
	proc, err := process.NewProcess(int32(pid))
	if err != nil {
		return
	}
	for {
		select {
		case <-stopChan:
			return
		default:
			// check if process is still running
			if !IsProcessAliveAndNotDefunct(pid) {
				log.Println("FFmpeg process stopped for stream from monitoring", w.StreamID)
				if !w.LoopVideo {
					// update stream status to stopped
					w.DB.Model(&models.Stream{}).Where("id = ?", w.StreamID).Updates(map[string]interface{}{
						"Status": "stopped",
					})
					RestartLock.Lock()
					StopStreamWorker(w.StreamID)
					RemoveWorker(w.StreamID)
					RestartLock.Unlock()
					log.Println("Stream", w.StreamID, "stopped successfully, because loop video is false")
					broadcast.Bus.Broadcast(broadcast.RefreshStream, nil)
					return
				}
				log.Println("Restarting stream From Monitoring", w.StreamID, "with status", w.Status)
				if w.Status != "live" {
					log.Println("Stream", w.StreamID, "is not live, skipping restart")
					return
				}
				RestartLock.Lock()
				StopStreamWorker(w.StreamID)
				StartStreamWorkerWithDatabase(w.StreamID, w.FilePath, w.StreamKey, w.MaxBitrate, w.RTMPUrl, w.LoopVideo, w.LoopCount, w.DB, w.RedisPubSub)
				RestartLock.Unlock()
				broadcast.Bus.Broadcast(broadcast.RefreshStream, nil)
				log.Println("Stream", w.StreamID, "restarted successfully")
				return
			}
			cpu, _ := proc.CPUPercent()
			mem, _ := proc.MemoryInfo()
			w.Stats.CPUPercent = cpu
			if mem != nil {
				w.Stats.RSSBytes = mem.RSS
			}
			time.Sleep(1 * time.Second)
		}
	}
}

func StartStreamWorkerWithDatabase(streamID, filePath, streamKey string, maxBitrate *int, rtmpUrl string, loopVideo bool, loopCount *int, database *gorm.DB, redisPubSub *redisutil.RedisPubSub) (*StreamWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	worker := &StreamWorker{
		StreamID:    streamID,
		CancelFunc:  cancel,
		Status:      "live",
		FilePath:    filePath,
		StreamKey:   streamKey,
		MaxBitrate:  maxBitrate,
		DB:          database,
		RedisPubSub: redisPubSub,
	}

	var stream models.Stream
	if err := database.Where("id = ?", worker.StreamID).Find(&stream).Error; err != nil {
		return nil, 0, err
	}

	// get channel info
	var channel models.Channels
	if err := database.Where("user_id = ? AND (channel_id = ? OR id = ?)", stream.UserId, stream.ChannelId, stream.ChannelId).Find(&channel).Error; err != nil {
		return nil, 0, err
	}

	if channel.ID != "" {
		// create the event broadcast first
		accessToken := ""
		if channel.AccessToken != nil {
			accessToken = *channel.AccessToken
		}
		refreshToken := ""
		if channel.RefreshToken != nil {
			refreshToken = *channel.RefreshToken
		}

		if accessToken != "" {
			broadcast.Bus.Broadcast(broadcast.CreateBroadcast, map[string]interface{}{
				"stream_id":     streamID,
				"stream_key":    streamKey,
				"channel_id":    channel.ChannelID,
				"user_id":       channel.UserId,
				"title":         "Watch Me Live",
				"access_token":  accessToken,
				"refresh_token": refreshToken,
			})
		}
	}

	var cmd *exec.Cmd
	args := buildFfmpegArgs(maxBitrate, loopVideo, filePath, streamKey, rtmpUrl, loopCount)

	cmd = exec.CommandContext(ctx, args[0], args[1:]...)

	worker.Cmd = cmd

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	// start cmd
	err := cmd.Start()
	if err != nil {
		log.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	// Start goroutines to capture and publish logs
	go func() {
		scanner := bufio.NewScanner(stdout)
		scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
			for i := 0; i < len(data); i++ {
				if data[i] == '\n' || data[i] == '\r' {
					// Return the line without the delimiter
					return i + 1, data[:i], nil
				}
			}
			if atEOF && len(data) > 0 {
				return len(data), data, nil
			}
			return 0, nil, nil
		})
		for scanner.Scan() {
			line := scanner.Text()
			if worker.RedisPubSub != nil {
				channel := "ffmpeg-logs:stream:" + streamID
				worker.RedisPubSub.PublishFFmpegLog(context.Background(), channel, line)
			}
		}
	}()
	go func() {
		scanner := bufio.NewScanner(stderr)
		scanner.Split(func(data []byte, atEOF bool) (advance int, token []byte, err error) {
			for i := 0; i < len(data); i++ {
				if data[i] == '\n' || data[i] == '\r' {
					// Return the line without the delimiter
					return i + 1, data[:i], nil
				}
			}
			if atEOF && len(data) > 0 {
				return len(data), data, nil
			}
			return 0, nil, nil
		})
		for scanner.Scan() {
			line := scanner.Text()
			if worker.RedisPubSub != nil {
				channel := "ffmpeg-logs:stream:" + streamID
				worker.RedisPubSub.PublishFFmpegLog(context.Background(), channel, line)
			}
		}
	}()

	// update database
	database.Model(&models.Stream{}).Where("id = ?", streamID).Updates(map[string]interface{}{
		"Status":    "live",
		"StartedAt": time.Now().UTC(),
		"FfmpegPID": &cmd.Process.Pid,
	})

	worker.FfmpegPID = &cmd.Process.Pid

	// Start stats monitor goroutine
	stopChan := make(chan struct{})
	worker.StopChan = stopChan
	go func() {
		worker.MonitorFFmpegStats(stopChan)
	}()

	AddWorker(worker)
	log.Println("FFmpeg process started for stream", streamID, "with PID", cmd.Process.Pid)
	return worker, cmd.Process.Pid, nil
}

func (w *StreamWorker) GetFFmpegPID() int32 {
	return int32(w.Cmd.Process.Pid)
}

func IsProcessRunning(pid int) bool {
	if process, err := os.FindProcess(pid); err == nil && process != nil {
		// check if process is exists
		if err := process.Signal(syscall.Signal(0)); err == nil {
			return IsProcessAliveAndNotDefunct(pid)
		}
		return false
	}
	return false
}

func isDefunct(pid int) (bool, error) {
	out, err := exec.Command("ps", "-o", "stat=", "-p", strconv.Itoa(pid)).Output()
	if err != nil {
		return false, err
	}
	stat := strings.TrimSpace(string(out))
	// 'Z' anywhere in the stat means zombie
	return strings.Contains(stat, "Z"), nil
}

// Returns true if the process exists, is running, and is NOT defunct/zombie
func IsProcessAliveAndNotDefunct(pid int) bool {
	proc, err := process.NewProcess(int32(pid))
	if err != nil {
		// Process does not exist
		return false
	}

	_, err = proc.Status()
	if err != nil {
		// Could not get status, treat as not running
		return false
	}
	// status can be "running", "sleep", "idle", "zombie", etc.
	// check in status []string if it contains "zombie"
	if defunct, _ := isDefunct(pid); defunct {
		return false
	}
	return true
}

// SetDriveProgress sets the progress or status for a drive link
func SetDriveProgress(driveLink string, progress map[string]interface{}) {
	driveProgressMu.Lock()
	defer driveProgressMu.Unlock()
	log.Println("Setting drive progress for", driveLink, progress)
	driveProgressMap[driveLink] = progress
	log.Println("Drive progress set for", driveProgressMap)
}

// GetDriveProgress gets the progress/status for a drive link
func GetDriveProgress(driveLink string) (map[string]interface{}, bool) {
	driveProgressMu.RLock()
	defer driveProgressMu.RUnlock()
	log.Println("Getting drive progress for", driveLink, driveProgressMap)
	if driveProgressMap == nil {
		log.Println("Drive progress map is nil")
		return nil, false
	}
	if _, ok := driveProgressMap[driveLink]; !ok {
		log.Println("Drive progress not found for", driveLink)
		return nil, false
	}
	progress, ok := driveProgressMap[driveLink]

	if ok {
		log.Println("Drive progress found for", driveLink, progress)
		if progress == nil {
			log.Println("Drive progress is nil for", driveLink)
			return nil, false
		}
	}
	return progress, ok
}

func buildFfmpegArgs(maxBitrate *int, loopVideo bool, filePath string, streamKey string, rtmpUrl string, loopCount *int) []string {
	var args []string
	var fullRtmpUrl string
	if rtmpUrl != "" {
		if rtmpUrl[len(rtmpUrl)-1] != '/' {
			fullRtmpUrl = rtmpUrl + "/" + streamKey
		} else {
			fullRtmpUrl = rtmpUrl + streamKey
		}
	} else {
		fullRtmpUrl = "rtmp://a.rtmp.youtube.com/live2/" + streamKey
	}
	args = append(args, "ffmpeg")
	args = append(args, "-re")
	args = append(args, "-nostdin")
	args = append(args, "-fflags", "+genpts")
	args = append(args, "-hide_banner")
	args = append(args, "-loglevel", "info")
	args = append(args, "-stats_period", "1")
	// args = append(args, "-progress", "pipe:1")
	var loopingCount int
	if loopVideo {
		if loopCount == nil {
			loopingCount = (-1)
		} else {
			loopingCount = *loopCount
		}
		args = append(args, "-stream_loop", fmt.Sprintf("%d", loopingCount))
	}
	args = append(args, "-threads", "1")
	args = append(args, "-i", filePath)
	args = append(args, "-c:v", "copy")
	args = append(args, "-c:a", "copy")
	args = append(args, "-threads", "1")
	args = append(args, "-preset", "ultrafast")
	args = append(args, "-f", "flv")
	args = append(args, "-drop_pkts_on_overflow", "1")
	args = append(args, "-attempt_recovery", "1")
	args = append(args, "-recover_any_error", "1")
	args = append(args, fullRtmpUrl)
	return args
}

// ClearDriveProgress clears the progress/status for a drive link
func ClearDriveProgress(driveLink string) {
	driveProgressMu.Lock()
	defer driveProgressMu.Unlock()
	delete(driveProgressMap, driveLink)
}
