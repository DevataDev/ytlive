package models

import (
	"context"
	"fmt"
	"math"
	"os"
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
	worker := &StreamWorker{
		StreamID:   streamID,
		CancelFunc: cancel,
		Status:     "live",
	}
	AddWorker(worker)

	go func() {
		baseDelay := time.Second * 2
		maxDelay := time.Minute
		attempt := 0

		for {
			select {
			case <-ctx.Done():
				fmt.Println("StreamWorker context cancelled for", streamID)
				return
			default:
			}

			var cmd *exec.Cmd
			if maxBitrate != nil {
				cmd = exec.CommandContext(ctx, "ffmpeg",
					"-re", "-nostdin", "-stream_loop", "-1", "-threads", "1", "-i", filePath,
					"-threads", "1",
					"-c:v", "copy",
					"-c:a", "copy",
					"-preset", "veryfast", "-maxrate", fmt.Sprintf("%dk", *maxBitrate), "-bufsize", fmt.Sprintf("%dk", 2*(*maxBitrate)),
					"-f", "flv",
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
					"rtmp://a.rtmp.youtube.com/live2/"+streamKey,
				)
			}

			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			worker.Cmd = cmd

			fmt.Println("Starting FFmpeg for stream:", streamID)
			err := cmd.Start()
			if err != nil {
				fmt.Println("Failed to start FFmpeg:", err)
			} else {
				err = cmd.Wait()
				if ctx.Err() != nil {
					fmt.Println("Context cancelled during FFmpeg run for", streamID)
					// make sure ffmpeg process is terminated
					if worker.Cmd != nil && worker.Cmd.Process != nil {
						_ = worker.Cmd.Process.Signal(syscall.SIGTERM)
					}
					return
				}

				fmt.Println("FFmpeg exited for stream", streamID, "with error:", err)
			}

			// Start stats monitor goroutine
			stopChan := make(chan struct{})
			worker.StopChan = stopChan // Store stopChan in worker
			go func() {
				worker.MonitorFFmpegStats(stopChan)
			}()

			// Exponential backoff before restart
			sleep := time.Duration(float64(baseDelay) * math.Pow(2, float64(attempt)))
			if sleep > maxDelay {
				sleep = maxDelay
			}
			fmt.Printf("Restarting FFmpeg for stream %s in %v...\n", streamID, sleep)
			time.Sleep(sleep)
			if attempt < 6 {
				attempt++
			}
		}
	}()
	// Return immediately after spawning goroutine
	return worker, 0, nil
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
	if worker.StopChan != nil {
		close(worker.StopChan)
	}
	// Remove worker from map

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
