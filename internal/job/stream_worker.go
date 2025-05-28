package job

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
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

	"gopkg.in/natefinch/lumberjack.v2"
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
	Videos      []models.MediaFile
	Audio       []models.MediaFile
	StreamKey   string
	MaxBitrate  *int
	RTMPUrl     string
	LoopVideo   bool
	LoopCount   *int
	DB          *gorm.DB
	RedisPubSub *redisutil.RedisPubSub
	Logger      *lumberjack.Logger
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
func StopStreamWorker(streamID string, isByUser bool) error {
	worker, ok := GetWorker(streamID)
	if !ok {
		log.Println("Stream", streamID, "not found.")
		return nil // Already stopped
	}

	if worker.LoopVideo && isByUser {
		// prevent the monitoring restarting it
		log.Println("Receiving stop request from user, preventing restart")
		worker.LoopVideo = false
	}

	// update worker status
	worker.Status = "stopped" // prevent double restart
	log.Println("Stopping stream", streamID, "with status", worker.Status)
	// chceck if context still active
	if worker.CancelFunc != nil {
		log.Println("Cancelling context for stream", streamID)
		worker.CancelFunc()
		log.Println("Context cancelled for stream", streamID)
		// Wait for 5 seconds before forcing kill
		time.Sleep(5 * time.Second)
		log.Println("Timeout waiting for FFmpeg to exit after cancel, forcing kill...")
		// Force kill logic here (e.g., kill process)
		if worker.Cmd != nil && worker.Cmd.Process != nil {
			_ = worker.Cmd.Process.Kill()
		}
		log.Println("FFmpeg process killed for stream", streamID)

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

func StartStreamWorkerWithDatabase(streamID, streamKey string, maxBitrate *int, rtmpUrl string, loopVideo bool, loopCount *int, database *gorm.DB, redisPubSub *redisutil.RedisPubSub) (*StreamWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	worker := &StreamWorker{
		StreamID:    streamID,
		CancelFunc:  cancel,
		Status:      "live",
		StreamKey:   streamKey,
		MaxBitrate:  maxBitrate,
		DB:          database,
		RedisPubSub: redisPubSub,
		LoopVideo:   loopVideo,
		LoopCount:   loopCount,
		Logger: &lumberjack.Logger{
			Filename:   "./logs/ffmpeg-" + streamID + ".log",
			MaxSize:    15,
			MaxBackups: 2,
			MaxAge:     2,
		},
	}

	// find media files
	if err := database.Where("stream_id = ? AND media_type = 'video'", streamID).Find(&worker.Videos).Error; err != nil {
		return nil, 0, err
	}
	if err := database.Where("stream_id = ? AND media_type = 'audio'", streamID).Find(&worker.Audio).Error; err != nil {
		return nil, 0, err
	}

	// if no video or audio, return error
	if len(worker.Videos) == 0 && len(worker.Audio) == 0 {
		return nil, 0, errors.New("no video or audio found")
	}

	var stream models.Stream
	if err := database.Where("id = ?", worker.StreamID).Find(&stream).Error; err != nil {
		return nil, 0, err
	}

	// get channel info
	var channel models.Channels
	if err := database.Where("user_id = ? AND (channel_id = ? OR id = ?)", stream.UserID, stream.ChannelID, stream.ChannelID).Find(&channel).Error; err != nil {
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
				"title":         stream.Name,
				"access_token":  accessToken,
				"refresh_token": refreshToken,
			})
		}
	}

	var cmd *exec.Cmd
	args := buildFfmpegArgsWithMediaFiles(maxBitrate, loopVideo, worker.Videos, worker.Audio, streamKey, rtmpUrl, loopCount)

	cmd = exec.CommandContext(ctx, args[0], args[1:]...)

	worker.Cmd = cmd

	stderr, _ := cmd.StderrPipe()

	// start cmd
	err := cmd.Start()
	if err != nil {
		log.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	//should we waiting here ?
	go func() {
		if err := cmd.Wait(); err != nil {
			log.Printf("FFmpeg process ended with error: %v", err)
			// if signal killed then do not restart
			// Handle process completion (e.g., notify channels, cleanup)
			StopStreamWorker(streamID, false)
			RemoveWorker(streamID)
			if err.Error() == "signal: killed" {
				log.Println("FFmpeg process killed by signal for stream", streamID)
				worker.Logger.Write([]byte("FFmpeg process killed by signal\n"))
				return
			}
			// write error to log
			worker.Logger.Write([]byte("FFmpeg process ended with error: " + err.Error() + "\n"))
			//restart stream worker
			if loopVideo {
				RestartLock.Lock()
				StartStreamWorkerWithDatabase(streamID, streamKey, maxBitrate, rtmpUrl, loopVideo, loopCount, database, redisPubSub)
				RestartLock.Unlock()
				broadcast.Bus.Broadcast(broadcast.RefreshStream, nil)
			}
		} else {
			log.Println("FFmpeg process completed successfully")
			worker.Logger.Write([]byte("FFmpeg process completed successfully\n"))
			StopStreamWorker(streamID, false)
			RemoveWorker(streamID)
			// update database
			database.Model(&models.Stream{}).Where("id = ?", streamID).Updates(map[string]interface{}{
				"Status": "stopped",
			})
		}
	}()

	//fmpeg stderr logger
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
				logWithNewLine := line + "\n"
				if _, err := worker.Logger.Write([]byte(logWithNewLine)); err != nil {
					log.Println("Failed to write log:", err)
				}
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

	// // Start stats monitor goroutine
	// stopChan := make(chan struct{})
	// worker.StopChan = stopChan
	// go func() {
	// 	worker.MonitorFFmpegStats(stopChan)
	// }()

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

func buildFfmpegArgsWithMediaFiles(maxBitrate *int, loopVideo bool, videos []models.MediaFile, audio []models.MediaFile, streamKey string, rtmpUrl string, loopCount *int) []string {
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

	args = append(args, "ffmpeg", "-re", "-nostdin", "-fflags", "+genpts", "-hide_banner",
		"-loglevel", "info", "-stats_period", "1")

	// Add video input (only first video if multiple provided)
	if len(videos) > 0 {
		// Handle stream loop if needed - must be before the input it applies to
		if loopVideo {
			loopCountVal := -1 // Infinite loop by default
			if loopCount != nil {
				loopCountVal = *loopCount
			}
			args = append(args, "-stream_loop", fmt.Sprintf("%d", loopCountVal))
		}
		args = append(args, "-i", videos[0].FilePath)
	}

	// Handle audio inputs with loop support
	audioInputs := make([]string, 0)
	if len(audio) > 0 {
		// First, filter out any audio files that don't exist
		var validAudioFiles []models.MediaFile
		for _, audioFile := range audio {
			if _, err := os.Stat(audioFile.FilePath); err == nil {
				validAudioFiles = append(validAudioFiles, audioFile)
			} else {
				log.Printf("Warning: Audio file not found, skipping: %s", audioFile.FilePath)
			}
		}

		if len(validAudioFiles) == 0 {
			// No valid audio files, skip audio processing
			log.Println("No valid audio files found, skipping audio")
		} else if loopVideo {
			// Create a temporary concat file for audio files
			tempFile, err := os.CreateTemp("", "audio_concat_*.txt")
			if err != nil {
				log.Printf("Error creating concat file: %v", err)
				return nil
			}

			// Write file list to concat file with absolute paths
			for _, audioFile := range validAudioFiles {
				absPath, err := filepath.Abs(audioFile.FilePath)
				if err != nil {
					log.Printf("Error getting absolute path for %s: %v", audioFile.FilePath, err)
					continue
				}
				fmt.Fprintf(tempFile, "file '%s'\n", strings.ReplaceAll(absPath, "'", "'\\''"))
			}

			// Ensure all data is written to disk
			if err := tempFile.Sync(); err != nil {
				log.Printf("Error syncing temp file: %v", err)
			}

			// Close the file so FFmpeg can read it
			if err := tempFile.Close(); err != nil {
				log.Printf("Error closing temp file: %v", err)
			}

			// Add concat demuxer with loop
			loopCountVal := "-1"
			if loopCount != nil {
				loopCountVal = fmt.Sprintf("%d", *loopCount)
			}

			args = append(args, "-f", "concat", "-safe", "0", "-stream_loop", loopCountVal, "-i", tempFile.Name())
			audioInputs = append(audioInputs, fmt.Sprintf("%d", len(videos))) // Single input for all audio files
		} else {
			// Original behavior without loop - only add existing files
			for i, audioFile := range validAudioFiles {
				absPath, err := filepath.Abs(audioFile.FilePath)
				if err != nil {
					log.Printf("Error getting absolute path for %s: %v", audioFile.FilePath, err)
					continue
				}
				args = append(args, "-i", absPath)
				audioInputs = append(audioInputs, fmt.Sprintf("%d", len(videos)+i)) // Account for video input
			}
		}
	}

	// Map video stream (always use copy)
	if len(videos) > 0 {
		args = append(args, "-map", "0:v:0", "-c:v", "copy")
	}

	// Handle audio mapping based on whether we're looping or not
	if len(audio) > 0 {
		if loopVideo {
			// For looped audio, we have a single concat input
			if len(videos) > 0 {
				// Video + looped audio
				args = append(args, "-map", "1:a:0", "-c:a", "aac", "-b:a", "128k")
			} else {
				// Audio only with loop
				args = append(args, "-map", "0:a:0", "-c:a", "aac", "-b:a", "128k")
			}
		} else {
			// Original behavior for non-looped audio
			if len(audio) == 1 {
				// Single audio - map directly
				if len(videos) > 0 {
					args = append(args, "-map", "1:a:0")
				} else {
					args = append(args, "-map", "0:a:0")
				}
				args = append(args, "-c:a", "aac", "-b:a", "128k")
			} else {
				// Multiple audio files - concatenate them
				var filterComplex strings.Builder
				startIdx := len(videos)

				// Add all audio inputs to filter
				for i := 0; i < len(audio); i++ {
					filterComplex.WriteString(fmt.Sprintf("[%d:a:0]", startIdx+i))
				}

				// Concatenate audios
				filterComplex.WriteString(fmt.Sprintf("concat=n=%d:v=0:a=1[a]", len(audio)))

				// Add filter complex to args
				filterStr := filterComplex.String()
				log.Println("Using audio filter complex (audio will be re-encoded):", filterStr)
				args = append(args, "-filter_complex", filterStr)

				// Map the filtered audio
				args = append(args, "-map", "[a]")

				// Encode audio
				args = append(args, "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-ac", "2")
			}
		}
	} else {
		// No audio
		args = append(args, "-an")
	}

	// Add output options
	args = append(args,
		"-f", "flv",
		"-drop_pkts_on_overflow", "1",
		"-attempt_recovery", "1",
		"-recover_any_error", "1",
		fullRtmpUrl)

	log.Println("FFmpeg command (video is NEVER re-encoded):", strings.Join(args, " "))
	return args
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

// KillFFmpegProcess kills the FFmpeg process for a stream
func KillFFmpegProcess(pid int) {
	if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		_ = exec.Command("kill", "-9", fmt.Sprintf("%d", pid)).Run()
	} else if runtime.GOOS == "windows" {
		_ = exec.Command("taskkill", "/F", "/PID", fmt.Sprintf("%d", pid)).Run()
	}
}
