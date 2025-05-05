package models

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"sync"
	"time"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/tiktok"

	"github.com/shirou/gopsutil/v3/process"
	"gorm.io/gorm"
)

type MirrorWorker struct {
	MirrorID     string
	CancelFunc   context.CancelFunc
	Status       string
	DB           *gorm.DB
	RTMPUrl      string
	StreamKey    string
	LiveUrl      string
	UserAgent    string
	RoomID       string
	Cmd          *exec.Cmd
	StopChan     chan struct{}
	TiktokClient tiktok.TikTokClientIface
}

var (
	MirrorWorkers     = make(map[string]*MirrorWorker)
	MirrorWorkersMu   sync.RWMutex
	MirrorRestartLock sync.Mutex
)

func (w *MirrorWorker) MonitorFFmpegStats(stopChan <-chan struct{}) {
	pid := w.Cmd.Process.Pid
	fmt.Println("Monitoring FFmpeg stats for mirror", w.MirrorID, "with PID", pid)
	if pid == 0 {
		return
	}
	_, err := process.NewProcess(int32(pid))
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
				fmt.Println("FFmpeg process stopped for mirror from monitoring", w.MirrorID)
				// restart stream worker
				// how to prevent double restart?
				// check if worker is already restarting
				// lock
				if w.Status != "live" {
					if w.Status == "user_stopped" {
						// update database
						w.DB.Model(&Mirror{}).Where("id = ?", w.MirrorID).Updates(map[string]interface{}{
							"Status":    "stopped",
							"StoppedAt": time.Now().UTC(),
						})
						w.Status = "stopped"
						RemoveMirrorWorker(w.MirrorID)
						return
					}
					return
				}

				// check if room is still alive

				isAlive, err := w.TiktokClient.CheckRoomIsAlive(w.RoomID)
				if err != nil {
					fmt.Println("Failed to check if room is still alive for mirror", w.MirrorID, "with error", err)
					return
				}
				if !isAlive {
					fmt.Println("Room is not alive for mirror", w.MirrorID)
					w.Status = "stopped"
					// Delete from database
					w.DB.Delete(&Mirror{}, w.MirrorID)
					StopMirrorWorkerWithDatabase(w.MirrorID, w.DB, false)
					RemoveMirrorWorker(w.MirrorID)
					return
				}

				// check
				MirrorRestartLock.Lock()
				StopMirrorWorkerWithDatabase(w.MirrorID, w.DB, false)
				StartMirrorWorkerWithDatabase(w.MirrorID, w.TiktokClient, w.DB)
				MirrorRestartLock.Unlock()
				broadcast.Bus.Broadcast(broadcast.RefreshMirror, nil)
				return
			}

			time.Sleep(1 * time.Second)
		}
	}
}

func StartMirrorWorkerWithDatabase(mirrorID string, tiktokClient tiktok.TikTokClientIface, database *gorm.DB) (*MirrorWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	// get mirror from database
	var mirror Mirror
	database.Where("id = ?", mirrorID).First(&mirror)

	if mirror.ID == "" {
		// cancel context
		cancel()
		return nil, 0, errors.New("mirror not found")
	}

	worker := &MirrorWorker{
		MirrorID:     mirrorID,
		CancelFunc:   cancel,
		Status:       "live",
		DB:           database,
		RTMPUrl:      mirror.RtmpUrl,
		StreamKey:    mirror.StreamKey,
		LiveUrl:      mirror.LiveUrl,
		UserAgent:    mirror.UserAgent,
		RoomID:       mirror.RoomId,
		TiktokClient: tiktokClient,
	}

	var cmd *exec.Cmd
	args := buildMirrorFfmpegArgs(worker.RTMPUrl, worker.StreamKey, worker.LiveUrl, worker.UserAgent)
	cmd = exec.CommandContext(ctx, args[0], args[1:]...)

	worker.Cmd = cmd

	// start cmd
	err := cmd.Start()
	if err != nil {
		fmt.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	// update database
	database.Model(&Mirror{}).Where("id = ?", mirrorID).Updates(map[string]interface{}{
		"Status":    "live",
		"StartedAt": time.Now().UTC(),
		"FFmpegPID": cmd.Process.Pid,
	})

	// Start stats monitor goroutine
	stopChan := make(chan struct{})
	worker.StopChan = stopChan
	go func() {
		worker.MonitorFFmpegStats(stopChan)
	}()

	AddMirrorWorker(worker)

	fmt.Println("FFmpeg process started for mirror", mirrorID, "with PID", cmd.Process.Pid)

	return worker, cmd.Process.Pid, nil
}

func StopMirrorWorkerWithDatabase(mirrorID string, database *gorm.DB, userStop bool) error {
	// get mirror from database
	var mirror Mirror
	database.Where("id = ?", mirrorID).First(&mirror)

	if mirror.ID == "" {
		return errors.New("mirror not found")
	}

	// cancel context
	worker := MirrorWorkers[mirrorID]
	if worker != nil {
		worker.CancelFunc()
	}

	if userStop {
		if worker != nil {
			worker.Status = "user_stopped"
		}
	}

	// update database
	database.Model(&Mirror{}).Where("id = ?", mirrorID).Updates(map[string]interface{}{
		"Status":    "stopped",
		"StoppedAt": time.Now().UTC(),
	})

	return nil
}

func AddMirrorWorker(worker *MirrorWorker) {
	MirrorWorkersMu.Lock()
	defer MirrorWorkersMu.Unlock()
	MirrorWorkers[worker.MirrorID] = worker
}

func RemoveMirrorWorker(mirrorID string) {
	MirrorWorkersMu.Lock()
	defer MirrorWorkersMu.Unlock()
	delete(MirrorWorkers, mirrorID)
}

func GetMirrorWorker(mirrorID string) *MirrorWorker {
	MirrorWorkersMu.RLock()
	defer MirrorWorkersMu.RUnlock()
	return MirrorWorkers[mirrorID]
}

func buildMirrorFfmpegArgs(rtmpUrl string, streamKey string, liveUrl string, userAgent string) []string {
	var args []string

	var fullRtmpUrl string
	var ffmpegUserAgent string
	if userAgent != "" {
		ffmpegUserAgent = userAgent
	} else {
		ffmpegUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
	}
	fmt.Println("FFmpeg User Agent:", ffmpegUserAgent)
	if rtmpUrl != "" {
		if rtmpUrl[len(rtmpUrl)-1] != '/' {
			fullRtmpUrl = rtmpUrl + "/" + streamKey
		} else {
			fullRtmpUrl = rtmpUrl + streamKey
		}
	} else {
		fullRtmpUrl = "rtmp://a.rtmp.youtube.com/live2/" + streamKey
	}
	//ffmpeg -re -nostdin -analyzeduration 1000000 -probesize 1000000 -threads 1 -i 'https://pull-f5-sg01.tiktokcdn.com/stage/stream-7499923488564972308_uhd.flv?expire=1747425676&sign=d57ecea2f98d6bffae20e8cce705c386' -user_agent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36' -c copy -f flv rtmp://a.rtmp.youtube.com/live2/tycm-hmay-0vqr-43ra-d4qp
	args = append(args, "ffmpeg")
	args = append(args, "-re")
	args = append(args, "-nostdin")
	args = append(args, "-analyzeduration", "1000000")
	args = append(args, "-probesize", "1000000")
	args = append(args, "-threads", "1")
	args = append(args, "-i", liveUrl)
	args = append(args, "-user_agent", ffmpegUserAgent)
	args = append(args, "-c:v", "copy")
	args = append(args, "-c:a", "aac")
	//set audio bitrate to 128k
	args = append(args, "-b:a", "128k")
	//-filter:a "loudnorm=i=-14"
	args = append(args, "-af", "highpass=f=100, lowpass=f=3000, afftdn=nf=-25, dynaudnorm")
	args = append(args, "-f", "flv")
	args = append(args, "-flvflags", "no_duration_filesize")
	args = append(args, "-drop_pkts_on_overflow", "1")
	args = append(args, "-attempt_recovery", "1")
	args = append(args, "-recover_any_error", "1")

	args = append(args, fullRtmpUrl)
	return args
}
