package workers

import (
	"fmt"
	"time"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/tiktok"

	"gorm.io/gorm"
)

type LiveWorker struct {
	TikTok     *tiktok.Client
	DB         *gorm.DB
	Bus        *broadcast.LocalBroadcast
	MonitorSet map[string]struct{}
}

func NewLiveWorker(tiktokClient *tiktok.Client, db *gorm.DB, bus *broadcast.LocalBroadcast) *LiveWorker {
	return &LiveWorker{
		TikTok:     tiktokClient,
		DB:         db,
		MonitorSet: make(map[string]struct{}),
		Bus:        bus,
	}
}

func (w *LiveWorker) CheckUserIsLive(user string) (bool, error) {
	return w.TikTok.CheckUserIsLive(user)
}

func (w *LiveWorker) StartUserMonitoring() {
	go func() {
		for {
			var monitors []models.Monitor
			if err := w.DB.Find(&monitors).Error; err != nil {
				fmt.Println("Failed to fetch monitors", err)
				return
			}
			for _, monitor := range monitors {
				if _, ok := w.MonitorSet[monitor.UniqueId]; ok {
					continue
				}
				w.MonitorSet[monitor.UniqueId] = struct{}{}
				if monitor.RtmpUrl == "" || monitor.StreamKey == "" {
					continue
				}
				w.StartLiveMonitoring(monitor.UniqueId, monitor.UserId, monitor.RtmpUrl, monitor.StreamKey, monitor.ID)
			}
			time.Sleep(1 * time.Minute)
		}
	}()
}

func (w *LiveWorker) StartLiveMonitoring(username string, userID string, rtmpUrl string, streamKey string, monitorID string) {
	fmt.Println("Starting live monitoring for user", username)
	go func() {
		for {
			isLive, err := w.CheckUserIsLive(username)
			if err != nil {
				fmt.Println("Failed to check if user is live for user", username, "with error", err)
				return
			}
			if isLive {
				fmt.Println("User is live for user", username)
				w.DB.Where("unique_id = ?", username).Update("is_live", true)
				w.Bus.Broadcast(broadcast.AddToMirror, broadcast.Event{
					Data: map[string]interface{}{
						"username":   username,
						"user_id":    userID,
						"rtmp_url":   rtmpUrl,
						"stream_key": streamKey,
					},
				})
				w.Bus.Broadcast(broadcast.RefreshMonitor, broadcast.Event{
					Data: map[string]interface{}{
						"id":        monitorID,
						"unique_id": username,
					},
				})
				// break loop
				return
			}
			time.Sleep(2 * time.Minute)
		}
	}()
}
