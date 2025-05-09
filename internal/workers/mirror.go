package workers

import (
	"fmt"
	"time"
	"windsorf-youtube-live/internal/handlers"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/tiktok"

	"gorm.io/gorm"
)

type MirrorWorker struct {
	DB           *gorm.DB
	TiktokClient *tiktok.Client
}

func NewMirrorWorker(db *gorm.DB, tiktokClient *tiktok.Client) *MirrorWorker {
	return &MirrorWorker{
		DB:           db,
		TiktokClient: tiktokClient,
	}
}

func (w *MirrorWorker) StartMirrorRoomIsAliveChecker() {
	fmt.Println("Starting mirror room is alive checker...")
	for {
		time.Sleep(1 * time.Minute)
		fmt.Println("Checking room is alive...")
		var streamsToCheck []models.Mirror
		w.DB.Where("(status = ? or status = ?) AND room_id IS NOT NULL", "live", "stopped", "queued").Find(&streamsToCheck)
		fmt.Println("Found", len(streamsToCheck), "mirror to check.")
		roomIds := make([]string, len(streamsToCheck))
		for i, stream := range streamsToCheck {
			roomIds[i] = stream.RoomId
		}
		isAliveMap, err := w.TiktokClient.CheckMultipleRoomIsAlive(roomIds)
		if err != nil {
			fmt.Println("Failed to check room is alive for room", roomIds, ":", err)
			continue
		}

		// update database
		for _, stream := range streamsToCheck {
			if isAliveMap[stream.RoomId] {
				w.DB.Model(&stream).Updates(map[string]interface{}{
					"is_alive": true,
				})
			} else {
				// stop stream worker
				if stream.Status == "stopped" {
					w.DB.Model(&stream).Updates(map[string]interface{}{
						"is_alive": false,
					})
					// delete from database
					w.DB.Delete(&stream)
					models.MirrorRestartLock.Lock()
					models.StopMirrorWorkerWithDatabase(stream.ID, w.DB, false)
					models.RemoveMirrorWorker(stream.ID)
					models.MirrorRestartLock.Unlock()
					// send websocket message
					handlers.BroadcastMirrorRoomIsAliveUpdate(isAliveMap)
					// send broadcast message
					handlers.BroadcastMirrorUpdateList()
					continue
				}
				models.MirrorRestartLock.Lock()
				_ = models.StopMirrorWorkerWithDatabase(stream.ID, w.DB, false) // Ensures ffmpeg is killed
				models.RemoveMirrorWorker(stream.ID)
				models.MirrorRestartLock.Unlock()
				w.DB.Model(&stream).Updates(map[string]interface{}{
					"status":   "stopped",
					"is_alive": false,
				})
				// delete from database
				w.DB.Delete(&stream)
				// send broadcast message
				handlers.BroadcastMirrorUpdateList()
			}
		}

		// send websocket message
		handlers.BroadcastMirrorRoomIsAliveUpdate(isAliveMap)
	}
}

func (w *MirrorWorker) StartQueueChecker() {
	fmt.Println("Starting queue checker...")
	for {
		time.Sleep(1 * time.Minute)
		fmt.Println("Checking queue...")
		var mirrorsToCheck []models.Mirror
		w.DB.Where("status = ?", "queued").Find(&mirrorsToCheck)
		fmt.Println("Found", len(mirrorsToCheck), "mirrors to check.")
		for _, mirror := range mirrorsToCheck {
			// check if stream key is used by another mirror
			if mirror.StreamKey != "" {
				var data models.Mirror
				w.DB.Where("stream_key = ? AND room_id != ? AND status = 'live'", mirror.StreamKey, mirror.RoomId).First(&data)
				if data.ID != "" {
					fmt.Println("Stream key is used by another mirror", mirror.StreamKey, mirror.RoomId)
					// check if FFmpeg is running
					if data.FFmpegPID != nil && models.IsProcessAliveAndNotDefunct(*data.FFmpegPID) {
						fmt.Println("FFmpeg is running for another mirror", mirror.StreamKey, mirror.RoomId)
						// update database
						w.DB.Model(&mirror).Updates(map[string]interface{}{
							"status":     "queued",
							"ffmpeg_pid": nil,
						})
						continue
					} else {
						if data.FFmpegPID != nil && !models.IsProcessAliveAndNotDefunct(*data.FFmpegPID) {
							fmt.Println("FFmpeg is not running for another mirror", mirror.StreamKey, mirror.RoomId)
							// update database
							models.StopMirrorWorkerWithDatabase(data.ID, w.DB, false)
							models.RemoveMirrorWorker(data.ID)
							// update old mirror
							w.DB.Model(&data).Updates(map[string]interface{}{
								"status":     "stopped",
								"ffmpeg_pid": nil,
							})
							//start stream worker
							models.StartMirrorWorkerWithDatabase(mirror.ID, w.TiktokClient, w.DB)
						}
					}
				}
			}
		}
	}
}
