package job

import (
	"bufio"
	"context"
	"errors"
	"log"
	"os/exec"
	"sync"
	"time"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/redisutil"
	"windsorf-youtube-live/internal/tiktok"
	"windsorf-youtube-live/internal/youtube"

	"github.com/shirou/gopsutil/v3/process"
	"gopkg.in/natefinch/lumberjack.v2"
	"gorm.io/gorm"
)

type MirrorWorker struct {
	MirrorID      string
	CancelFunc    context.CancelFunc
	Status        string
	DB            *gorm.DB
	RTMPUrl       string
	StreamKey     string
	LiveUrl       string
	UserAgent     string
	RoomID        string
	Cmd           *exec.Cmd
	StopChan      chan struct{}
	TiktokClient  tiktok.TikTokClientIface
	YoutubeClient *youtube.YoutubeClient
	RedisPubSub   *redisutil.RedisPubSub
	Logger        *lumberjack.Logger
}

var (
	MirrorWorkers     = make(map[string]*MirrorWorker)
	MirrorWorkersMu   sync.RWMutex
	MirrorRestartLock sync.Mutex
)

func (w *MirrorWorker) GetWorkerStatus() string {
	return w.Status
}

func (w *MirrorWorker) GetFFmpegPID() int32 {
	return int32(w.Cmd.Process.Pid)
}

func (w *MirrorWorker) IsQueued() bool {
	return w.Status == "queued"
}

func (w *MirrorWorker) MonitorFFmpegStats(stopChan <-chan struct{}) {
	pid := w.Cmd.Process.Pid
	log.Println("Monitoring FFmpeg stats for mirror", w.MirrorID, "with PID", pid)
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
				log.Println("FFmpeg process stopped for mirror from monitoring", w.MirrorID)
				// restart stream worker
				// how to prevent double restart?
				// check if worker is already restarting
				// lock
				if w.Status != "live" {
					if w.Status == "user_stopped" {
						// update database
						w.DB.Model(&models.Mirror{}).Where("id = ?", w.MirrorID).Updates(map[string]interface{}{
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
					log.Println("Failed to check if room is still alive for mirror", w.MirrorID, "with error", err)
					return
				}
				if !isAlive {
					log.Println("Room is not alive for mirror", w.MirrorID)
					w.Status = "stopped"
					// Delete from database
					w.DB.Delete(&models.Mirror{}, w.MirrorID)
					StopMirrorWorkerWithDatabase(w.MirrorID, w.DB, false)
					RemoveMirrorWorker(w.MirrorID)
					return
				}

				// check
				MirrorRestartLock.Lock()
				StopMirrorWorkerWithDatabase(w.MirrorID, w.DB, false)
				StartMirrorWorkerWithDatabase(w.MirrorID, w.TiktokClient, w.DB, w.RedisPubSub)
				MirrorRestartLock.Unlock()
				broadcast.Bus.Broadcast(broadcast.RefreshMirror, nil)
				return
			}

			time.Sleep(1 * time.Second)
		}
	}
}

func StartMirrorWorkerWithDatabase(mirrorID string, tiktokClient tiktok.TikTokClientIface, database *gorm.DB, redisPubSub *redisutil.RedisPubSub) (*MirrorWorker, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	// get mirror from database
	var mirror models.Mirror
	database.Where("id = ?", mirrorID).First(&mirror)

	if mirror.ID == "" {
		// cancel context
		cancel()
		return nil, 0, errors.New("mirror not found")
	}

	// Prevent duplicate StreamKey in live mirrors
	if mirror.StreamKey != "" {
		var existingMirror models.Mirror
		err := database.Where("stream_key = ? AND status = ? AND id != ?", mirror.StreamKey, "live", mirror.ID).First(&existingMirror).Error
		if err == nil {
			cancel()
			return nil, 0, errors.New("Another mirror with this StreamKey is already live.")
		}
	}

	// check if streamKey have been used by another mirror and FFmpeg is running
	var data models.Mirror
	var status string = "live"
	if mirror.StreamKey != "" {
		log.Println("Checking if stream key is used by another mirror", mirror.StreamKey, mirror.RoomId)
		database.Where("stream_key = ? AND room_id != ? AND status = 'live'", mirror.StreamKey, mirror.RoomId).First(&data)
		if data.ID != "" {
			log.Println("Stream key is used by another mirror", mirror.StreamKey, mirror.RoomId)
			// check if FFmpeg is running
			if data.FFmpegPID != nil && IsProcessAliveAndNotDefunct(*data.FFmpegPID) {
				log.Println("FFmpeg is running for another mirror", mirror.StreamKey, mirror.RoomId)
				status = "queued"
				// update database
				mirror.Status = "queued"
				mirror.FFmpegPID = nil
				if err := database.Save(&mirror).Error; err != nil {
					log.Println("Failed to update mirror for mirror", mirrorID, "with error", err)
				}
			}
		}
	}

	worker := &MirrorWorker{
		MirrorID:     mirrorID,
		CancelFunc:   cancel,
		Status:       status,
		DB:           database,
		RTMPUrl:      mirror.RtmpUrl,
		StreamKey:    mirror.StreamKey,
		LiveUrl:      mirror.LiveUrl,
		UserAgent:    mirror.UserAgent,
		RoomID:       mirror.RoomId,
		TiktokClient: tiktokClient,
		RedisPubSub:  redisPubSub,
		Logger: &lumberjack.Logger{
			Filename:   "./logs/ffmpeg-mirror-" + mirrorID + ".log",
			MaxSize:    15,
			MaxBackups: 2,
			MaxAge:     2,
		},
	}

	if status == "queued" {
		AddMirrorWorker(worker)
		return worker, 0, nil
	}

	// get channel info
	var channel models.Channels
	if err := database.Where("user_id = ? AND (channel_id = ? OR id = ?)", mirror.UserId, mirror.ChannelId, mirror.ChannelId).Find(&channel).Error; err != nil {
		return nil, 0, err
	}

	if channel.ID != "" {
		var title string
		if mirror.Title != "" {
			title = mirror.Title
		} else {
			title = "Watch " + mirror.DisplayName + " Live"
		}
		accessToken := ""
		if channel.AccessToken != nil {
			accessToken = *channel.AccessToken
		}
		refreshToken := ""
		if channel.RefreshToken != nil {
			refreshToken = *channel.RefreshToken
		}
		// create the event broadcast first
		broadcast.Bus.Broadcast(broadcast.CreateBroadcast, map[string]interface{}{
			"stream_id":     mirrorID,
			"stream_key":    mirror.StreamKey,
			"channel_id":    channel.ChannelID,
			"user_id":       channel.UserId,
			"title":         title,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		})
	}

	// check if room is still alive
	isAlive, err := tiktokClient.CheckRoomIsAlive(mirror.RoomId)
	if err != nil {
		log.Println("Failed to check if room is still alive for mirror", mirrorID, "with error", err)
		// if in database status not stopped, update to stopped
		if mirror.Status != "stopped" {
			timeNow := time.Now().UTC()
			mirror.Status = "stopped"
			mirror.StoppedAt = &timeNow
			if err := database.Save(&mirror).Error; err != nil {
				log.Println("Failed to update mirror for mirror", mirrorID, "with error", err)
			}
		}
		cancel()
		return nil, 0, err
	}
	if !isAlive {
		log.Println("Room is not alive for mirror", mirrorID)
		if mirror.Status != "stopped" {
			timeNow := time.Now().UTC()
			mirror.Status = "stopped"
			mirror.StoppedAt = &timeNow
			if err := database.Save(&mirror).Error; err != nil {
				log.Println("Failed to update mirror for mirror", mirrorID, "with error", err)
			}
			// delete from mirror workers
			RemoveMirrorWorker(mirrorID)
			// delete from database
			database.Delete(&models.Mirror{}, mirrorID)
			// broadcast to all ws clients
			broadcast.Bus.Broadcast(broadcast.RefreshMirror, nil)
		}
		// cancel context
		cancel()
		return nil, 0, errors.New("room is not alive anymore")
	}

	var cmd *exec.Cmd
	args := buildMirrorFfmpegArgs(worker.RTMPUrl, worker.StreamKey, worker.LiveUrl, worker.UserAgent)
	cmd = exec.CommandContext(ctx, args[0], args[1:]...)

	worker.Cmd = cmd

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	// start cmd
	err = cmd.Start()
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
				channel := "ffmpeg-logs:mirror:" + mirrorID
				worker.RedisPubSub.PublishFFmpegLog(context.Background(), channel, line)
				if _, err := worker.Logger.Write([]byte(line)); err != nil {
					log.Println("Failed to write log:", err)
				}
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
				channel := "ffmpeg-logs:mirror:" + mirrorID
				worker.RedisPubSub.PublishFFmpegLog(context.Background(), channel, line)
				if _, err := worker.Logger.Write([]byte(line)); err != nil {
					log.Println("Failed to write log:", err)
				}
			}
		}
	}()

	// update database
	timeNow := time.Now().UTC()
	mirror.Status = "live"
	mirror.StartedAt = &timeNow
	mirror.FFmpegPID = &cmd.Process.Pid
	if err := database.Save(&mirror).Error; err != nil {
		log.Println("Failed to update mirror for mirror", mirrorID, "with error", err)
	}

	// Start stats monitor goroutine
	stopChan := make(chan struct{})
	worker.StopChan = stopChan
	go func() {
		worker.MonitorFFmpegStats(stopChan)
	}()

	AddMirrorWorker(worker)

	return worker, cmd.Process.Pid, nil
}

func StopMirrorWorkerWithDatabase(mirrorID string, database *gorm.DB, userStop bool) error {
	// get mirror from database
	var mirror models.Mirror
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
	timeNow := time.Now().UTC()
	mirror.Status = "stopped"
	mirror.StoppedAt = &timeNow
	if err := database.Save(&mirror).Error; err != nil {
		log.Println("Failed to update mirror for mirror", mirrorID, "with error", err)
	}

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
	args = append(args, "-fflags", "+genpts")
	args = append(args, "-hide_banner")
	args = append(args, "-loglevel", "info")
	args = append(args, "-stats_period", "1")
	// args = append(args, "-progress", "pipe:1")
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
