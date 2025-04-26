package models

import (
	"context"
	"fmt"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

type StreamWorker struct {
	StreamID   string
	Cmd        *exec.Cmd
	CancelFunc context.CancelFunc
	Status     string // "live", "scheduled", "stopped", etc.
	Stats      StreamStats
	StopChan   chan struct{} // Added StopChan field
}

type StreamStats struct {
	CPUPercent float64
	RSSBytes   uint64
}

var (
	Workers   = make(map[string]*StreamWorker)
	WorkersMu sync.RWMutex
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
	// Example FFmpeg command (customize as needed)
	// Replace with your actual FFmpeg command to stream to YouTube
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1",
		"-i", filePath,
		"-threads", "1",
		"-preset", "ultrafast",
		"-pix_fmt", "yuv420p", "-f", "flv",
		"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
	)
	fmt.Println("FFmpeg command:", cmd)
	if maxBitrate != nil {
		cmd = exec.CommandContext(ctx, "ffmpeg",
			"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1", "-i", filePath,
			"-threads", "1",
			"-preset", "veryfast", "-maxrate", fmt.Sprintf("%dk", *maxBitrate), "-bufsize", fmt.Sprintf("%dk", 2*(*maxBitrate)),
			"-pix_fmt", "yuv420p", "-f", "flv",
			"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
		)
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, 0, err
	}
	worker := &StreamWorker{
		StreamID:   streamID,
		Cmd:        cmd,
		CancelFunc: cancel,
		Status:     "live",
	}
	AddWorker(worker)

	// Start stats monitor goroutine
	stopChan := make(chan struct{})
	worker.StopChan = stopChan // Store stopChan in worker
	go func() {
		worker.MonitorFFmpegStats(stopChan)
	}()
	return worker, cmd.Process.Pid, nil
}

// StopStreamWorker stops the FFmpeg process for the stream and removes the worker.
func StopStreamWorker(streamID string) error {
	worker, ok := GetWorker(streamID)
	if !ok {
		return nil // Already stopped
	}
	if worker.CancelFunc != nil {
		worker.CancelFunc()
	}
	if worker.Cmd != nil && worker.Cmd.Process != nil {
		_ = worker.Cmd.Process.Signal(syscall.SIGTERM)
		// Wait for process to exit, then kill if still alive
		done := make(chan error, 1)
		go func() {
			done <- worker.Cmd.Wait()
		}()
		select {
		case <-done:
			// exited gracefully
		case <-time.After(5 * time.Second):
			_ = worker.Cmd.Process.Kill()
			<-done // ensure Wait() returns
		}
	}
	// Close stopChan to stop stats monitor goroutine
	close(worker.StopChan)
	RemoveWorker(streamID)
	return nil
}

// MonitorFFmpegStats monitors CPU and memory usage for the FFmpeg process
func (w *StreamWorker) MonitorFFmpegStats(stopChan <-chan struct{}) {
	pid := w.Cmd.Process.Pid
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
