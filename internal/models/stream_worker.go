package models

import (
	"context"
	"fmt"
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
)

type StreamWorker struct {
	StreamID   string
	Cmd        *exec.Cmd
	CancelFunc context.CancelFunc
	Status     string // "live", "scheduled", "stopped", etc.
	Stats      StreamStats
	StopChan   chan struct{} // Added StopChan field
	stopOnce   sync.Once
	FfmpegPID  *int
	FilePath   string
	StreamKey  string
	MaxBitrate *int
	DB         *gorm.DB
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

// StartStreamWorker starts an FFmpeg process for the stream and registers the worker.
func StartStreamWorker(streamID, filePath, streamKey string, maxBitrate *int) (*StreamWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	worker := &StreamWorker{
		StreamID:   streamID,
		CancelFunc: cancel,
		Status:     "live",
	}

	var cmd *exec.Cmd
	if maxBitrate != nil {
		//ffmpeg -re -stream_loop -1 -i ombay.mp4 -c copy -f flv -drop_pkts_on_overflow 1 -attempt_recovery 1 -recover_any_error 1
		cmd = exec.CommandContext(ctx, "ffmpeg",
			"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1", "-i", filePath,
			"-threads", "1",
			"-c:v", "copy",
			"-c:a", "copy",
			"-preset", "ultrafast", "-maxrate", fmt.Sprintf("%dk", *maxBitrate), "-bufsize", fmt.Sprintf("%dk", 2*(*maxBitrate)),
			"-f", "flv",
			"-drop_pkts_on_overflow", "1", "-attempt_recovery", "1", "-recover_any_error", "1",
			"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
		)
	} else {
		cmd = exec.CommandContext(ctx, "ffmpeg",
			"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1",
			"-i", filePath,
			"-c:v", "copy",
			"-c:a", "copy",
			"-threads", "1",
			"-preset", "ultrafast",
			"-f", "flv",
			"-drop_pkts_on_overflow", "1", "-attempt_recovery", "1", "-recover_any_error", "1",
			"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
		)
	}

	worker.Cmd = cmd
	err := cmd.Start()
	if err != nil {
		fmt.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	worker.FfmpegPID = &cmd.Process.Pid

	// Start stats monitor goroutine
	stopChan := make(chan struct{})
	worker.StopChan = stopChan
	go func() {
		worker.MonitorFFmpegStats(stopChan)
	}()

	AddWorker(worker)
	// Return immediately after spawning goroutine
	return worker, cmd.Process.Pid, nil
}

// StopStreamWorker stops the FFmpeg process for the stream and removes the worker.
func StopStreamWorker(streamID string) error {
	worker, ok := GetWorker(streamID)
	if !ok {
		return nil // Already stopped
	}

	// update worker status
	worker.Status = "stopped" // prevent double restart
	// chceck if context still active
	if worker.CancelFunc != nil {
		fmt.Println("Cancelling context for stream", streamID)
		worker.CancelFunc()
		fmt.Println("Context cancelled for stream", streamID)
		select {
		case <-time.After(5 * time.Second):
			fmt.Println("Timeout waiting for FFmpeg to exit after cancel, forcing kill...")
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
			fmt.Println("FFmpeg process killed for stream", streamID)
		}
	}
	fmt.Println("Killing FFmpeg process for stream", streamID)
	if worker.Cmd != nil && worker.Cmd.Process != nil {
		_ = worker.Cmd.Process.Signal(syscall.SIGTERM)
		fmt.Println("FFmpeg process signalled for stream", streamID)
		// Wait for process to exit, then kill if still alive, timeout after 5 seconds
		done := make(chan error, 1)
		go func() {
			done <- worker.Cmd.Wait()
			fmt.Println("FFmpeg process exited for stream", streamID)
		}()
		select {
		case <-done:
			fmt.Println("FFmpeg process exited for stream", streamID)
			// exited gracefully
		case <-time.After(5 * time.Second):
			if worker.Cmd != nil && worker.Cmd.Process != nil {
				_ = worker.Cmd.Process.Kill()
				fmt.Println("FFmpeg process killed for stream", streamID)
			} else {
				// exec kill -9 <pid> if its linux
				if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
					_ = exec.Command("kill", "-9", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				} else if runtime.GOOS == "windows" {
					_ = exec.Command("taskkill", "/F", "/PID", fmt.Sprintf("%d", worker.Cmd.Process.Pid)).Run()
				}
				fmt.Println("FFmpeg process killed for stream", streamID)
			}
			<-done // ensure Wait() returns
		}
	}

	// Close stopChan to stop stats monitor goroutine
	if worker.StopChan != nil {
		fmt.Println("Closing stopChan for stream", streamID)
		worker.stopOnce.Do(func() { close(worker.StopChan) })
	}
	// Remove worker from map
	if worker != nil {
		fmt.Println("Removing worker for stream", streamID)
		RemoveWorker(streamID)
	}
	return nil
}

// MonitorFFmpegStats monitors CPU and memory usage for the FFmpeg process
func (w *StreamWorker) MonitorFFmpegStats(stopChan <-chan struct{}) {
	pid := w.Cmd.Process.Pid
	fmt.Println("Monitoring FFmpeg stats for stream", w.StreamID, "with PID", pid)
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
			if !isProcessAliveAndNotDefunct(pid) {
				fmt.Println("FFmpeg process stopped for stream", w.StreamID)
				// restart stream worker
				// how to prevent double restart?
				// check if worker is already restarting
				// lock
				// restart only for live stream
				if w.Status != "live" {
					return
				}
				RestartLock.Lock()
				StopStreamWorker(w.StreamID)
				StartStreamWorkerWithDatabase(w.StreamID, w.FilePath, w.StreamKey, w.MaxBitrate, w.DB)
				RestartLock.Unlock()
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

func StartStreamWorkerWithDatabase(streamID, filePath, streamKey string, maxBitrate *int, database *gorm.DB) (*StreamWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	worker := &StreamWorker{
		StreamID:   streamID,
		CancelFunc: cancel,
		Status:     "live",
		FilePath:   filePath,
		StreamKey:  streamKey,
		MaxBitrate: maxBitrate,
		DB:         database,
	}

	var cmd *exec.Cmd
	if maxBitrate != nil {
		cmd = exec.CommandContext(ctx, "ffmpeg",
			"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1", "-i", filePath,
			"-threads", "1",
			"-c:v", "copy",
			"-c:a", "copy",
			"-preset", "ultrafast", "-maxrate", fmt.Sprintf("%dk", *maxBitrate), "-bufsize", fmt.Sprintf("%dk", 2*(*maxBitrate)),
			"-f", "flv",
			"-drop_pkts_on_overflow", "1", "-attempt_recovery", "1", "-recover_any_error", "1",
			"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
		)
	} else {
		cmd = exec.CommandContext(ctx, "ffmpeg",
			"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1",
			"-i", filePath,
			"-c:v", "copy",
			"-c:a", "copy",
			"-threads", "1",
			"-preset", "ultrafast",
			"-f", "flv",
			"-drop_pkts_on_overflow", "1", "-attempt_recovery", "1", "-recover_any_error", "1",
			"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
		)
	}

	worker.Cmd = cmd
	// start cmd
	err := cmd.Start()
	if err != nil {
		fmt.Println("Failed to start FFmpeg:", err)
		return nil, 0, err
	}

	// update database
	database.Model(&Stream{}).Where("id = ?", streamID).Updates(map[string]interface{}{
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
	fmt.Println("FFmpeg process started for stream", streamID, "with PID", cmd.Process.Pid)
	return worker, cmd.Process.Pid, nil
}

func (w *StreamWorker) GetFFmpegPID() int32 {
	return int32(w.Cmd.Process.Pid)
}

func IsProcessRunning(pid int) bool {
	if process, err := os.FindProcess(pid); err == nil && process != nil {
		// check if process is exists
		if err := process.Signal(syscall.Signal(0)); err == nil {
			return isProcessAliveAndNotDefunct(pid)
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
func isProcessAliveAndNotDefunct(pid int) bool {
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
	fmt.Println("Setting drive progress for", driveLink, progress)
	driveProgressMap[driveLink] = progress
	fmt.Println("Drive progress set for", driveProgressMap)
}

// GetDriveProgress gets the progress/status for a drive link
func GetDriveProgress(driveLink string) (map[string]interface{}, bool) {
	driveProgressMu.RLock()
	defer driveProgressMu.RUnlock()
	fmt.Println("Getting drive progress for", driveLink, driveProgressMap)
	if driveProgressMap == nil {
		fmt.Println("Drive progress map is nil")
		return nil, false
	}
	if _, ok := driveProgressMap[driveLink]; !ok {
		fmt.Println("Drive progress not found for", driveLink)
		return nil, false
	}
	progress, ok := driveProgressMap[driveLink]

	if ok {
		fmt.Println("Drive progress found for", driveLink, progress)
		if progress == nil {
			fmt.Println("Drive progress is nil for", driveLink)
			return nil, false
		}
	}
	return progress, ok
}

// ClearDriveProgress clears the progress/status for a drive link
func ClearDriveProgress(driveLink string) {
	driveProgressMu.Lock()
	defer driveProgressMu.Unlock()
	delete(driveProgressMap, driveLink)
}
