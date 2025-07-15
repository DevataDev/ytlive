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

func (w *StreamWorker) CheckIfAnyFfmpegProcessIsRunning(streamKey string) bool {
	// list all ffmpeg process
	if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		// Create command to find ffmpeg processes
		cmd := exec.Command("pgrep", "-f", "ffmpeg.*"+streamKey)

		// Capture the output
		output, err := cmd.CombinedOutput()
		if err != nil {
			// pgrep returns non-zero exit status when no processes are found
			// So we only log the error if it's not the "no processes found" case
			if exitErr, ok := err.(*exec.ExitError); !ok || exitErr.ExitCode() != 1 {
				log.Printf("Error checking for ffmpeg processes: %v", err)
			}
			return false
		}

		// If we got any output, it means there are matching processes
		return len(output) > 0
	} else if runtime.GOOS == "windows" {
		// Windows implementation
		cmd := exec.Command("tasklist", "/FI", "IMAGENAME eq ffmpeg.exe")
		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("Error checking for ffmpeg processes: %v", err)
			return false
		}
		// Check if the output contains ffmpeg.exe
		return strings.Contains(strings.ToLower(string(output)), "ffmpeg.exe")
	}

	// Unsupported OS
	return false
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
	var streamMediaFiles []models.StreamMediaFile
	if err := database.Preload("MediaFile").Where("stream_id = ?", streamID).Find(&streamMediaFiles).Error; err != nil {
		return nil, 0, err
	}

	// Deduplicate media files
	var uniqueMediaFileIDs = make(map[string]bool)
	var uniqueStreamMediaFiles []models.StreamMediaFile

	for _, smf := range streamMediaFiles {
		if !uniqueMediaFileIDs[smf.MediaFileID] {
			uniqueMediaFileIDs[smf.MediaFileID] = true
			uniqueStreamMediaFiles = append(uniqueStreamMediaFiles, smf)
		}
	}

	streamMediaFiles = uniqueStreamMediaFiles

	// Separate video and audio files
	for _, smf := range streamMediaFiles {
		switch smf.MediaFile.MediaType {
		case "video":
			worker.Videos = append(worker.Videos, smf.MediaFile)
		case "audio":
			worker.Audio = append(worker.Audio, smf.MediaFile)
		}
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
	log.Printf("Getting channel info for user_id: %s, channel_id: %s\n", stream.UserID, stream.ChannelID)
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

		// if description is nil, use the default description
		var description string
		if stream.Description != nil {
			description = *stream.Description
		} else {
			description = "Watch live stream " + stream.Name
		}

		if accessToken != "" && stream.Status == "stopped" {
			log.Println("Broadcasting stream start event for stream", streamID)
			broadcast.Bus.Broadcast(broadcast.CreateBroadcast, map[string]interface{}{
				"stream_id":     streamID,
				"stream_key":    streamKey,
				"channel_id":    channel.ChannelID,
				"user_id":       channel.UserId,
				"title":         stream.Name,
				"description":   description,
				"access_token":  accessToken,
				"refresh_token": refreshToken,
			})
		}
	}

	if worker.CheckIfAnyFfmpegProcessIsRunning(streamKey) {
		log.Println("FFmpeg process is already running for stream", streamID)
		return nil, 0, errors.New("FFmpeg process is already running for stream " + streamID)
	}

	var cmd *exec.Cmd
	var args []string
	// check if stream only have video files only then used the previous buildFfmpegArgs function
	if len(worker.Audio) == 0 {
		if len(worker.Videos) == 0 {
			return nil, 0, errors.New("no video found")
		}
		videoFilePath := worker.Videos[0].FilePath
		args = buildFfmpegArgs(maxBitrate, loopVideo, videoFilePath, streamKey, rtmpUrl, loopCount)
	} else {
		if len(worker.Videos) == 0 {
			return nil, 0, errors.New("no video found")
		}
		args = buildFfmpegArgsWithMediaFiles(maxBitrate, loopVideo, worker.Videos, worker.Audio, streamKey, rtmpUrl, loopCount)
	}

	log.Println("FFmpeg command (stream id: ", streamID, "):", strings.Join(args, " "))

	cmd = exec.CommandContext(ctx, args[0], args[1:]...)

	worker.Cmd = cmd

	stderr, _ := cmd.StderrPipe()

	// start cmd
	err := cmd.Start()
	if err != nil {
		log.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	// should we waiting here ?
	go func() {
		concatPath := filepath.Join("data", "ffmpeg_concat", "audio_concat_"+strings.ToLower(streamKey)+".txt")
		if err := cmd.Wait(); err != nil {
			// Check if this is a normal exit after completing the requested loops
			isNormalCompletion := false
			if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 255 && loopCount != nil {
				// When using -stream_loop with a count, FFmpeg exits with 255 when done
				log.Printf("FFmpeg completed %d loops for stream %s with error: %v\n", *loopCount, streamID, err)
				// Update database
				if database != nil {
					database.Model(&models.Stream{}).Where("stream_key = ?", streamKey).Update("status", "stopped")
				}
				isNormalCompletion = true
			} else if err.Error() == "signal: killed" {
				// Handle killed signal
				log.Println("FFmpeg process killed by signal for stream", streamID)
				worker.Logger.Write([]byte("FFmpeg process killed by signal\n"))
				// Update database
				if database != nil {
					database.Model(&models.Stream{}).Where("stream_key = ?", streamKey).Update("status", "stopped")
				}
				os.Remove(concatPath)
				return
			}

			if !isNormalCompletion {
				log.Printf("FFmpeg process ended with error for stream %s: %v\n", streamID, err)
				worker.Logger.Write([]byte("FFmpeg process ended with error: " + err.Error() + "\n"))
			}

			StopStreamWorker(streamID, false)
			RemoveWorker(streamID)

			if isNormalCompletion {
				broadcast.Bus.Broadcast(broadcast.RefreshStream, nil)
			}
			// Only restart if this was a normal completion with loopVideo true
			if loopVideo && !isNormalCompletion && !worker.CheckIfAnyFfmpegProcessIsRunning(streamKey) {
				log.Printf("Restarting stream %s after an errorr\n", streamID)
				RestartLock.Lock()
				StartStreamWorkerWithDatabase(streamID, streamKey, maxBitrate, rtmpUrl, loopVideo, loopCount, database, redisPubSub)
				RestartLock.Unlock()
			}
		} else {
			// Normal successful completion
			log.Println("FFmpeg process completed successfully for stream", streamID)
			worker.Logger.Write([]byte("FFmpeg process completed successfully\n"))
			// delete concat file
			concatPath := filepath.Join("data", "ffmpeg_concat", "audio_concat_"+strings.ToLower(streamKey)+".txt")
			os.Remove(concatPath)
			StopStreamWorker(streamID, false)
			RemoveWorker(streamID)
			// update database
			if database != nil {
				database.Model(&models.Stream{}).Where("stream_key = ?", streamKey).Update("status", "stopped")
			}
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
			if len(audio) > 0 {
				// When audio is present, loop video infinitely and let audio control duration
				args = append(args, "-stream_loop", "-1")
			} else {
				// When no audio, respect the loop count for video
				loopCountVal := "-1"
				if loopCount != nil {
					loopCountVal = fmt.Sprintf("%d", *loopCount)
				}
				args = append(args, "-stream_loop", loopCountVal)
			}
		}
		args = append(args, "-i", videos[0].FilePath)
	}

	// Handle audio inputs with loop support
	// audioInputs := make([]string, 0)
	var validAudioFiles []models.MediaFile
	if len(audio) > 0 {
		// First, filter out any audio files that don't exist
		for _, audioFile := range audio {
			if _, err := os.Stat(audioFile.FilePath); err == nil {
				validAudioFiles = append(validAudioFiles, audioFile)
			} else {
				log.Printf("Warning: Audio file not found, skipping: %s", audioFile.FilePath)
			}
		}

		if len(validAudioFiles) == 0 {
			// No valid audio files, skip audio processing
			log.Println("No valid audio files found, skipping audio processing")
		} else {
			// Create a dedicated directory for concat files if it doesn't exist
			concatDir := filepath.Join("data", "ffmpeg_concat")
			// Ensure the directory exists
			if err := os.MkdirAll(concatDir, 0755); err != nil {
				log.Printf("Error creating concat directory: %v", err)
				return nil
			}

			// Create a persistent concat file
			concatFilename := fmt.Sprintf("audio_concat_%s.txt", strings.ToLower(streamKey))
			concatPath := filepath.Join(concatDir, concatFilename)

			// Ensure the file doesn't exist first
			if _, err := os.Stat(concatPath); err == nil {
				// File exists, remove it first
				if err := os.Remove(concatPath); err != nil {
					log.Printf("Error removing existing concat file: %v", err)
					return nil
				}
			}

			// Create the file with 0666 permissions (read/write for all)
			file, err := os.OpenFile(concatPath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0666)
			if err != nil {
				log.Printf("Error creating concat file: %v", err)
				return nil
			}

			// Explicitly set permissions in case umask modified them
			if err := file.Chmod(0666); err != nil {
				log.Printf("Warning: Failed to set file permissions (continuing anyway): %v", err)
			}

			//adding the ffconcat header
			if _, err := fmt.Fprintf(file, "ffconcat version 1.0\n"); err != nil {
				log.Printf("Error writing to concat file: %v", err)
				file.Close()
				os.Remove(concatPath)
				return nil
			}

			// Write file list to concat file with absolute paths
			for _, audioFile := range validAudioFiles {
				absPath, err := filepath.Abs(audioFile.FilePath)
				if err != nil {
					log.Printf("Error getting absolute path for %s: %v", audioFile.FilePath, err)
					continue
				}
				log.Println("Using absolute path for concat file:", absPath)
				// Use proper escaping for file paths in the concat file
				if _, err := fmt.Fprintf(file, "file '%s'\n", strings.ReplaceAll(absPath, "'", "'\\''")); err != nil {
					log.Printf("Error writing to concat file: %v", err)
					file.Close()
					os.Remove(concatPath)
					return nil
				}
			}

			absPathConcatFile, err := filepath.Abs(concatPath)
			if err != nil {
				log.Printf("Error getting absolute path for concat file: %v", err)
				os.Remove(concatPath)
				return nil
			}
			// add in the last line to the concat file
			if _, err := fmt.Fprintf(file, "file '%s'\n", strings.ReplaceAll(absPathConcatFile, "'", "'\\''")); err != nil {
				log.Printf("Error writing to concat file: %v", err)
				file.Close()
				os.Remove(concatPath)
				return nil
			}

			// Ensure all data is written to disk
			if err := file.Sync(); err != nil {
				log.Printf("Error syncing concat file: %v", err)
				file.Close()
				os.Remove(concatPath)
				return nil
			}

			// Close the file so FFmpeg can read it
			if err := file.Close(); err != nil {
				log.Printf("Error closing concat file: %v", err)
				os.Remove(concatPath)
				return nil
			}

			// Verify the file is readable by all
			if err := os.Chmod(concatPath, 0666); err != nil {
				log.Printf("Warning: Failed to set final file permissions (continuing anyway): %v", err)
			}

			// Add concat demuxer with loop count from settings
			loopCountVal := "-1"
			if loopCount != nil {
				loopCountVal = fmt.Sprintf("%d", *loopCount)
			}
			if !filepath.IsAbs(concatPath) {
				absPath, err := filepath.Abs(concatPath)
				if err != nil {
					log.Printf("Error getting absolute path for concat file: %v", err)
					os.Remove(concatPath)
					return nil
				}
				concatPath = absPath
			}

			// Log the concat file path and permissions for debugging
			if fileInfo, err := os.Stat(concatPath); err == nil {
				log.Printf("Using concat file: %s (size: %d bytes, mode: %s)\n",
					concatPath, fileInfo.Size(), fileInfo.Mode().String())
			} else {
				log.Printf("Error getting concat file info: %v\n", err)
			}

			// Handle audio inputs
			if len(validAudioFiles) > 0 {
				if loopVideo {
					// If we have exactly one audio file,
					if len(validAudioFiles) == 1 {
						// For a single file, use it directly with stream_loop
						audioFile := validAudioFiles[0].FilePath
						log.Printf("Using single audio file directly with stream_loop: %s\n", audioFile)
						args = append(args, "-stream_loop", loopCountVal, "-i", audioFile)
					} else {
						// For multiple files, use concat protocol with | separator
						var escapedFiles []string
						for _, f := range validAudioFiles {
							escapedFiles = append(escapedFiles, strings.ReplaceAll(f.FilePath, "'", "'\\''"))
						}
						concatInput := "concat:" + strings.Join(escapedFiles, "|")
						log.Printf("Using concat protocol for %d audio files\n", len(validAudioFiles))
						args = append(args, "-stream_loop", loopCountVal, "-i", concatInput)

						// Ensure consistent audio format for the output
						args = append(args, "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-ac", "2")
					}
				} else {
					// For non-looping, just add the audio files directly
					for _, audioFile := range validAudioFiles {
						args = append(args, "-i", audioFile.FilePath)
					}
				}
			}

			// Schedule the file for cleanup when the stream ends or fails
			// The file will be removed when the stream is stopped or encounters an error
			// You can also implement a periodic cleanup of old concat files if needed
			// audioInputs = append(audioInputs, fmt.Sprintf("%d", len(videos))) // Single input for all audio files
			// } else {
			// 	// Original behavior without loop - only add existing files
			// 	for i, audioFile := range validAudioFiles {
			// 		absPath, err := filepath.Abs(audioFile.FilePath)
			// 		if err != nil {
			// 			log.Printf("Error getting absolute path for %s: %v", audioFile.FilePath, err)
			// 			continue
			// 		}
			// 		args = append(args, "-i", absPath)
			// 		audioInputs = append(audioInputs, fmt.Sprintf("%d", len(videos)+i)) // Account for video input
			// 	}
			// }
		}
	}

	// Map video stream (always use copy)
	if len(videos) > 0 {
		args = append(args, "-map", "0:v:0", "-c:v", "copy")
	}

	// Handle audio mapping based on whether we're looping or not
	if len(audio) > 0 {
		// Only add -shortest if we're not looping the video
		// or if we have a specific loop count for the audio
		if !loopVideo || loopCount != nil {
			args = append(args, "-shortest")
		}
		// Add error resilience options
		// args = append(args, "-reconnect", "1", "-reconnect_at_eof", "1", "-reconnect_streamed", "1")

		// For MP3 files, we've already added the format conversion
		// For WAV files, ensure proper format
		if !strings.HasSuffix(audio[0].FilePath, ".mp3") {
			args = append(args, "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-ac", "2")
		}

		if loopVideo {
			// Handle audio mapping based on input type
			audioIndex := "0"
			if len(videos) > 0 {
				// If we have video, audio is the second input (index 1)
				audioIndex = "1"
			}

			args = append(args, "-map", fmt.Sprintf("%s:a:0", audioIndex))

			// Only transcode if needed (non-MP3 files)
			if len(validAudioFiles) > 0 && !strings.HasSuffix(validAudioFiles[0].FilePath, ".mp3") {
				args = append(args, "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-ac", "2")
			} else {
				args = append(args, "-c:a", "libmp3lame", "-ar", "44100", "-b:a", "128k", "-ac", "2")
			}
			log.Println("streaming with audio")
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

				// Map the filtered audio (only for non-MP3 files)
				if len(audio) > 0 && !strings.HasSuffix(audio[0].FilePath, ".mp3") {
					args = append(args, "-map", "[a]")
				}

				// Encode audio
				if len(audio) > 0 {
					if !strings.HasSuffix(audio[0].FilePath, ".mp3") {
						args = append(args, "-c:a", "aac", "-ar", "44100", "-b:a", "128k", "-ac", "2")
					} else {
						args = append(args, "-c:a", "copy")
					}
				}
			}
		}
	} else {
		// No audio then assume the video has audio
		args = append(args, "-c:a", "copy")
	}

	fullRtmpUrl = strings.TrimSpace(fullRtmpUrl)
	// Add output options
	args = append(args,
		"-f", "flv",
		"-flvflags", "no_duration_filesize",
		// "-ignore_io_errors", "1",
		// "-fflags", "nobuffer+fastseek+flush_packets",
		"-flags", "low_delay",
		"-drop_pkts_on_overflow", "1",
		"-attempt_recovery", "1",
		"-recover_any_error", "1",
		fullRtmpUrl)

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
