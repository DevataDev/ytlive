package workers

import (
	"fmt"
	"time"
	"windsorf-youtube-live/internal/config"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/models"

	"gorm.io/gorm"
)

type StreamWorker struct {
	DB     *gorm.DB
	Config *config.Config
}

func NewStreamWorker(db *gorm.DB, config *config.Config) *StreamWorker {
	return &StreamWorker{
		DB:     db,
		Config: config,
	}
}

func (w *StreamWorker) StartMonitorStream() {
	fmt.Println("Starting stream scheduler...")
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		<-ticker.C
		now := time.Now().UTC()
		fmt.Println("Checking for scheduled streams...")
		// Start scheduled streams
		var streamsToStart []models.Stream
		w.DB.Where("status = ? AND scheduled_start_at <= ?", "scheduled", now).Find(&streamsToStart)
		fmt.Println("Found", len(streamsToStart), "scheduled streams to start.")
		for _, stream := range streamsToStart {
			if stream.StreamKey == "" || stream.FilePath == nil {
				fmt.Println("Stream", stream.ID, "has no stream key or file path, skipping.")
				continue // Do not start if no stream key or file path
			}
			// check start time
			if stream.ScheduledStartAt.After(now) {
				fmt.Println("Stream", stream.ID, "has not started yet, skipping. start time:", stream.ScheduledStartAt)
				continue
			}
			models.RestartLock.Lock()
			_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, stream.RTMPUrl, stream.LoopVideo, stream.LoopCount, w.DB)
			models.RestartLock.Unlock()
			if err == nil {
				fmt.Println("Stream", stream.ID, "started successfully.")
				w.DB.Model(&stream).Updates(map[string]interface{}{
					"Status":    "live",
					"StartedAt": now,
				})
				// send websocket message
				handlers.BroadcastStreamListUpdate()
			}
		}

		// Stop live streams whose end time has passed
		var streamsToStop []models.Stream
		w.DB.Where("status = ? AND scheduled_end_at IS NOT NULL", "live").Find(&streamsToStop)
		fmt.Println("Found", len(streamsToStop), "live streams to stop.")
		for _, stream := range streamsToStop {
			// check end time
			if stream.ScheduledEndAt.Before(now) {
				models.RestartLock.Lock()
				_ = models.StopStreamWorker(stream.ID) // Ensures ffmpeg is killed
				models.RestartLock.Unlock()
				// remove scheduled_at and scheduled_end_at
				w.DB.Model(&stream).Updates(map[string]interface{}{
					"Status":         "stopped",
					"StoppedAt":      now,
					"ScheduledAt":    nil,
					"ScheduledEndAt": nil,
				})
				// send websocket message
				handlers.BroadcastStreamListUpdate()
				fmt.Println("Stream", stream.ID, "stopped successfully.")
			}
		}
	}
}

func (w *StreamWorker) StartScheduledStream() {
	fmt.Println("Starting stream restart checker...")
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		<-ticker.C
		var streamsToRestart []models.Stream
		w.DB.Where("status = ? AND (started_at IS NOT NULL OR scheduled_start_at <= ?) AND (scheduled_end_at IS NULL OR scheduled_end_at > ?)", "live", time.Now().UTC(), time.Now().UTC()).Find(&streamsToRestart)
		fmt.Println("Found", len(streamsToRestart), "streams to restart.")
		for _, stream := range streamsToRestart {
			// check if ffmpeg is running by the pid
			if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
				// check if process is still running
				if models.IsProcessRunning(*stream.FfmpegPID) {
					fmt.Println("Stream", stream.ID, "is already running with PID", *stream.FfmpegPID)
					continue
				}
			}
			models.RestartLock.Lock()
			_ = models.StopStreamWorker(stream.ID) // Ensures ffmpeg is killed
			_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, stream.RTMPUrl, stream.LoopVideo, stream.LoopCount, w.DB)
			models.RestartLock.Unlock()
			if err != nil {
				fmt.Println("Failed to restart stream", stream.ID, ":", err)
				continue
			}
			// send websocket message
			handlers.BroadcastStreamListUpdate()
			fmt.Println("Stream", stream.ID, "restarted successfully.")
		}
	}
}

func (w *StreamWorker) StartOneTimeRestarter() {
	fmt.Println("Starting one time restarter...")
	var streamsToRestart []models.Stream
	w.DB.Where("status = ? AND (started_at IS NOT NULL OR scheduled_start_at <= ?)", "live", time.Now().UTC()).Find(&streamsToRestart)
	fmt.Println("Found", len(streamsToRestart), "streams to restart.")
	for _, stream := range streamsToRestart {
		// check if ffmpeg is running by the pid
		if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
			// check if process is still running
			if models.IsProcessRunning(*stream.FfmpegPID) {
				fmt.Println("Stream", stream.ID, "is already running with PID", *stream.FfmpegPID)
				continue
			}
		}
		// lock
		models.RestartLock.Lock()
		if stream.FfmpegPID != nil && *stream.FfmpegPID > 0 {
			fmt.Println("Stopping stream", stream.ID, "with PID", *stream.FfmpegPID)
			models.StopStreamWorker(stream.ID)
		}
		_, _, err := models.StartStreamWorkerWithDatabase(stream.ID, *stream.FilePath, stream.StreamKey, stream.MaxBitrate, stream.RTMPUrl, stream.LoopVideo, stream.LoopCount, w.DB)
		models.RestartLock.Unlock()

		if err != nil {
			fmt.Println("Failed to restart stream", stream.ID, ":", err)
			continue
		}

		// send websocket message
		handlers.BroadcastStreamListUpdate()
		fmt.Println("Stream", stream.ID, "restarted successfully.")
	}
}
