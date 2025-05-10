package workers

import (
	"fmt"
	"sync"
	"time"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/tiktok"

	"gorm.io/gorm"
)

type LiveWorker struct {
	TikTok       *tiktok.Client
	DB           *gorm.DB
	Bus          *broadcast.LocalBroadcast
	MonitorSet   map[string]struct{}
	MonitorSetMu sync.RWMutex
}

func NewLiveWorker(tiktokClient *tiktok.Client, db *gorm.DB, bus *broadcast.LocalBroadcast) *LiveWorker {
	return &LiveWorker{
		TikTok:     tiktokClient,
		DB:         db,
		MonitorSet: make(map[string]struct{}),
		Bus:        bus,
	}
}

func (w *LiveWorker) StopLiveMonitoring(monitorID string) {
	w.MonitorSetMu.Lock()
	delete(w.MonitorSet, monitorID)
	w.MonitorSetMu.Unlock()
}

func (w *LiveWorker) StopLiveMonitoringAll() {
	w.MonitorSetMu.Lock()
	w.MonitorSet = make(map[string]struct{})
	w.MonitorSetMu.Unlock()
}

func (w *LiveWorker) AddMonitor(id string) {
	w.MonitorSetMu.Lock()
	w.MonitorSet[id] = struct{}{}
	w.MonitorSetMu.Unlock()
}

func (w *LiveWorker) CheckUserIsLive(user string) (bool, error) {
	return w.TikTok.CheckUserIsLive(user)
}

func (w *LiveWorker) StartUserMonitoring() {
	go func() {
		for {
			fmt.Println("Starting user monitoring")
			var monitors []models.Monitor
			if err := w.DB.Find(&monitors).Error; err != nil {
				fmt.Println("Failed to fetch monitors", err)
				return
			}
			fmt.Println("Found", len(monitors), "monitors")
			for _, monitor := range monitors {
				w.MonitorSetMu.RLock()
				if _, ok := w.MonitorSet[monitor.ID]; ok {
					fmt.Println("Skipping monitor", monitor.UniqueId)
					w.MonitorSetMu.RUnlock()
					continue
				}
				if monitor.RtmpUrl == "" || monitor.StreamKey == "" {
					fmt.Println("Skipping monitor", monitor.UniqueId, "because rtmp url or stream key is empty")
					w.MonitorSetMu.RUnlock()
					continue
				}
				// if last checked is below than 5 minutes, skip
				if monitor.LastCheckedAt != nil && monitor.LastCheckedAt.Add(5*time.Minute).After(time.Now()) {
					fmt.Println("Skipping monitor", monitor.UniqueId, "because last checked is below than 5 minutes")
					w.MonitorSetMu.RUnlock()
					continue
				}
				w.MonitorSetMu.RUnlock()

				w.StartLiveMonitoring(monitor.UniqueId, monitor.UserId, monitor.RtmpUrl, monitor.StreamKey, monitor.ID)
			}
			time.Sleep(1 * time.Minute)
		}
	}()
}

func (w *LiveWorker) StartLiveMonitoring(username string, userID string, rtmpUrl string, streamKey string, monitorID string) {
	fmt.Println("Starting live monitoring for user", username)
	w.MonitorSetMu.Lock()
	w.MonitorSet[monitorID] = struct{}{}
	w.MonitorSetMu.Unlock()
	go func() {
		// break loop when user is live
		for {
			isLive, err := w.CheckUserIsLive(username)
			now := time.Now()
			if err != nil {
				fmt.Println("Failed to check if user is live for user", username, "with error", err)
				// set is_live to false
				monitorInDb := models.Monitor{}
				if err := w.DB.Where("unique_id = ?", username).First(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to get monitor for user", username, "with error", err)
					return
				}
				monitorInDb.IsLive = false
				monitorInDb.LastCheckedAt = &now
				if err := w.DB.Save(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to update monitor for user", username, "with error", err.Error())
				}
			}
			if isLive {
				fmt.Println("User is live for user", username)
				monitorInDb := models.Monitor{}
				if err := w.DB.Where("unique_id = ?", username).First(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to get monitor for user", username, "with error", err.Error())
					return
				}
				monitorInDb.IsLive = true
				monitorInDb.LastCheckedAt = &now
				if err := w.DB.Save(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to update monitor for user", username, "with error", err.Error())
				}

				var channelId string
				if monitorInDb.ChannelId != "" {
					channelId = monitorInDb.ChannelId
				} else {
					channelId = ""
				}

				w.Bus.Broadcast(broadcast.AddToMirror, map[string]interface{}{
					"username":   username,
					"user_id":    userID,
					"rtmp_url":   rtmpUrl,
					"stream_key": streamKey,
					"channel_id": channelId,
				})

				w.Bus.Broadcast(broadcast.RefreshMonitor, map[string]interface{}{
					"id":         monitorID,
					"unique_id":  username,
					"is_live":    true,
					"channel_id": channelId,
				})
				w.StopLiveMonitoring(monitorID)
				//break and stop go routine
				return
			} else {
				fmt.Println("User is not live for user", username)
				monitorInDb := models.Monitor{}
				if err := w.DB.Where("unique_id = ?", username).First(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to get monitor for user", username, "with error", err)
				}
				monitorInDb.IsLive = false
				monitorInDb.LastCheckedAt = &now
				if err := w.DB.Save(&monitorInDb).Error; err != nil {
					fmt.Println("Failed to update monitor for user", username, "with error", err.Error())
				}
			}
			time.Sleep(2 * time.Minute)
		}
	}()
}
