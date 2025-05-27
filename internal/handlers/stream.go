package handlers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/job"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/redisutil"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

type StreamHandler struct {
	DB          *gorm.DB
	Config      *configuration.Config
	RedisPubSub *redisutil.RedisPubSub
}

// PUT /api/streams/:id/maxbitrate
func (h *StreamHandler) SetMaxBitrate(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		MaxBitrate *int `json:"MaxBitrate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.MaxBitrate = req.MaxBitrate
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update max bitrate"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Max bitrate updated"})
}

// GET /api/streams/:id/logs
func (h *StreamHandler) GetStreamLogs(c *gin.Context) {
	userId := c.GetString("user_id")
	if userId == "" {
		c.AbortWithStatusJSON(401, gin.H{"error": "unauthorized"})
		return
	}
	streamId := c.Param("id")
	if streamId == "" {
		c.AbortWithStatusJSON(400, gin.H{"error": "missing stream_id"})
		return
	}
	// Get RedisPubSub from context or config
	var redisPubSub *redisutil.RedisPubSub
	if config, exists := c.Get("config"); exists {
		redisPubSub = &redisutil.RedisPubSub{Config: config.(*configuration.Config)}
		if redisPubSub.InitRedis() != nil {
			c.AbortWithStatusJSON(500, gin.H{"error": "Redis connection failed"})
			return
		}
	} else if rp, exists := c.Get("redis"); exists {
		redisPubSub = rp.(*redisutil.RedisPubSub)
	} else {
		c.AbortWithStatusJSON(500, gin.H{"error": "Redis not initialized"})
		return
	}
	count := int64(100) // default number of logs
	if c.Query("count") != "" {
		if n, err := strconv.ParseInt(c.Query("count"), 10, 64); err == nil && n > 0 {
			count = n
		}
	}
	channel := "ffmpeg-logs:stream:" + streamId
	logs, err := redisPubSub.GetFFmpegLogs(c.Request.Context(), channel, count)
	if err != nil {
		c.AbortWithStatusJSON(500, gin.H{"error": "Failed to fetch logs: " + err.Error()})
		return
	}
	c.JSON(200, gin.H{"logs": logs})
}

// GET /api/streams - list streams for current user
func (h *StreamHandler) ListStreams(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Parse pagination params
	page := 1
	perPage := 5
	if p := c.Query("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := c.Query("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 {
			perPage = n
		}
	}

	var total int64
	h.DB.Model(&models.Stream{}).Where("user_id = ?", userID).Count(&total)

	var streams []models.Stream
	if err := h.DB.Preload("MediaFiles").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&streams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch streams"})
		return
	}

	// Get file sizes for all media files
	for i := range streams {
		for j := range streams[i].MediaFiles {
			if fi, err := os.Stat(streams[i].MediaFiles[j].FilePath); err == nil {
				streams[i].MediaFiles[j].FileSize = fi.Size()
			}
		}
	}

	var countLive, countScheduled int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&countLive)
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&countScheduled)

	// Prepare response
	resp := make([]map[string]interface{}, 0, len(streams))
	for _, s := range streams {
		mediaFiles := make([]map[string]interface{}, len(s.MediaFiles))
		for i, mf := range s.MediaFiles {
			mediaFiles[i] = map[string]interface{}{
				"ID":        mf.ID,
				"FileName":  mf.FileName,
				"FilePath":  mf.FilePath,
				"FileSize":  mf.FileSize,
				"MediaType": mf.MediaType,
				"MimeType":  mf.MimeType,
				"IsPrimary": mf.IsPrimary,
				"Order":     mf.Order,
				"CreatedAt": mf.CreatedAt,
				"UpdatedAt": mf.UpdatedAt,
			}
		}

		item := map[string]interface{}{
			"ID":               s.ID,
			"Name":             s.Name,
			"Status":           s.Status,
			"ScheduledAt":      s.ScheduledAt,
			"ScheduledStartAt": s.ScheduledStartAt,
			"ScheduledEndAt":   s.ScheduledEndAt,
			"StartedAt":        s.StartedAt,
			"StoppedAt":        s.StoppedAt,
			"StreamKey":        s.StreamKey,
			"MaxBitrate":       s.MaxBitrate,
			"UserID":           s.UserID,
			"RTMPUrl":          s.RTMPUrl,
			"LoopVideo":        s.LoopVideo,
			"LoopCount":        s.LoopCount,
			"FfmpegPID":        s.FfmpegPID,
			"CreatedAt":        s.CreatedAt,
			"UpdatedAt":        s.UpdatedAt,
			"MediaFiles":       mediaFiles,
		}
		resp = append(resp, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"streams":        resp,
		"page":           page,
		"per_page":       perPage,
		"total":          total,
		"countLive":      countLive,
		"countScheduled": countScheduled,
	})
}

// POST /api/streams - create a new stream for current user
func (h *StreamHandler) CreateStream(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req struct {
		Name       string `json:"name"`
		MaxBitrate *int   `json:"maxBitrate"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Generate a new stream ID
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	streamID := ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()

	stream := models.Stream{
		ID:         streamID,
		Name:       req.Name,
		Status:     "stopped",
		UserID:     userID.(string),
		MaxBitrate: req.MaxBitrate,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Start a transaction
	tx := h.DB.Begin()

	// Create the stream
	if err := tx.Create(&stream).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream: " + err.Error()})
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	// Return the created stream with empty media files array
	response := map[string]interface{}{
		"ID":         stream.ID,
		"Name":       stream.Name,
		"Status":     stream.Status,
		"UserID":     stream.UserID,
		"MaxBitrate": stream.MaxBitrate,
		"CreatedAt":  stream.CreatedAt,
		"UpdatedAt":  stream.UpdatedAt,
		"MediaFiles": []interface{}{}, // Empty array for media files
	}

	c.JSON(http.StatusCreated, response)
}

// POST /api/streams/:id/start
func (h *StreamHandler) StartStream(c *gin.Context) {
	id := c.Param("id")
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	if stream.Status == "scheduled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This stream has been scheduled and cannot be started manually."})
		return
	}
	// Existing logic to start the stream (call your StartStreamWorker, update status, etc.)
	// ...
	c.JSON(http.StatusOK, gin.H{"message": "Stream started"})
}

// PUT /api/streams/:id/schedule
func (h *StreamHandler) SetSchedule(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ScheduledAt string `json:"ScheduledAt"`
		StoppedAt   string `json:"StoppedAt"`
		Timezone    string `json:"Timezone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	if req.ScheduledAt == "" || req.StoppedAt == "" {
		// update stream scheduledStartAt and scheduledEndAt to null
		stream.ScheduledStartAt = nil
		stream.ScheduledEndAt = nil
		stream.ScheduledAt = nil
		defaultLoopCount := -1
		stream.LoopCount = &defaultLoopCount
		stream.LoopVideo = false
		if err := h.DB.Save(&stream).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stream"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Stream scheduler removed"})
		return
	}

	// convert start and end from local time to utc
	timezone := req.Timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid timezone"})
		return
	}
	start, err1 := time.ParseInLocation("2006-01-02T15:04", req.ScheduledAt, loc)
	end, err2 := time.ParseInLocation("2006-01-02T15:04", req.StoppedAt, loc)
	scheduledAt := time.Now().UTC()

	// reduce the time from local timezone to utc
	start = start.UTC()
	end = end.UTC()
	now := time.Now().UTC()

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date/time format"})
		return
	}
	if start.Before(now) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start time cannot be earlier than the current time"})
		return
	}
	if end.Before(start) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End time cannot be earlier than start time"})
		return
	}
	stream.ScheduledStartAt = &start
	stream.ScheduledEndAt = &end
	stream.ScheduledAt = &scheduledAt
	defaultLoopCount := -1
	stream.LoopCount = &defaultLoopCount
	stream.Status = "scheduled"
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule stream"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream scheduled"})
}

// PUT /api/streams/:id/duration
func (h *StreamHandler) SetDuration(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		DurationHours int `json:"DurationHours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.DurationHours < 0 || req.DurationHours > 24 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Duration must be between 0 and 24 hours"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.ScheduledStartAt = nil
	if req.DurationHours == 0 {
		stream.ScheduledEndAt = nil // Unlimited
	} else {
		end := time.Now().UTC().Add(time.Duration(req.DurationHours) * time.Hour)
		stream.ScheduledEndAt = &end
		stream.ScheduledStartAt = nil
		current := time.Now().UTC()
		stream.ScheduledAt = &current
		defaultLoopCount := -1
		stream.LoopCount = &defaultLoopCount
	}
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set duration"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream duration set"})
}

// PUT /api/streams/:id/rename
func (h *StreamHandler) RenameFile(c *gin.Context) {
	streamID := c.Param("id")

	var req struct {
		Name     string `json:"name"`
		FileName string `json:"FileName"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	// Use FileName if provided (for frontend compatibility), otherwise use name
	newName := req.FileName
	if newName == "" {
		newName = req.Name
	}

	if newName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: name is required"})
		return
	}

	// Start a transaction
	tx := h.DB.Begin()

	// Update the stream name
	if err := tx.Model(&models.Stream{}).
		Where("id = ?", streamID).
		Update("name", newName).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stream name"})
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stream renamed successfully"})
}

// PUT /api/streams/:id/loop
func (h *StreamHandler) SetLoopVideo(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		LoopVideo bool `json:"LoopVideo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.LoopVideo = req.LoopVideo
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update loop video setting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Loop video setting updated"})
}

// PUT /api/streams/:id/loopcount
func (h *StreamHandler) SetLoopCount(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		LoopCount int `json:"LoopCount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.LoopCount < -1 {
		req.LoopCount = -1
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.LoopCount = &req.LoopCount
	stream.LoopVideo = true
	// remove scheduled start and end
	stream.ScheduledStartAt = nil
	stream.ScheduledEndAt = nil
	stream.ScheduledAt = nil

	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set loop count"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Loop count updated"})
}

// PUT /api/streams/:id/rtmpurl
func (h *StreamHandler) SetRTMPUrl(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		RTMPUrl string `json:"RTMPUrl"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.RTMPUrl == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.RTMPUrl = req.RTMPUrl
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set RTMP URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "RTMP URL updated"})
}

// POST /api/streams/:id/clone
func (h *StreamHandler) CloneStream(c *gin.Context) {
	// Get the original stream ID from URL
	originalID := c.Param("id")

	// Start a transaction
	tx := h.DB.Begin()

	// 1. Get the original stream with its media files
	var orig models.Stream
	if err := tx.Preload("MediaFiles").First(&orig, "id = ?", originalID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// 2. Generate a new stream ID
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	newStreamID := ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()

	// 3. Create a copy of the stream with a new ID
	clone := models.Stream{
		ID:         newStreamID,
		Name:       fmt.Sprintf("%s (Copy)", orig.Name),
		Status:     "stopped",
		UserID:     orig.UserID,
		MaxBitrate: orig.MaxBitrate,
		RTMPUrl:    orig.RTMPUrl,
		LoopVideo:  orig.LoopVideo,
		LoopCount:  orig.LoopCount,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// 4. Save the cloned stream
	if err := tx.Create(&clone).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cloned stream"})
		return
	}

	// 5. Clone media files if they exist
	if len(orig.MediaFiles) > 0 {
		for _, origMedia := range orig.MediaFiles {
			// Generate new media file ID
			newMediaID := ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()

			// Create a new file name with timestamp
			ext := filepath.Ext(origMedia.FileName)
			newFileName := fmt.Sprintf("%s_clone_%d%s",
				strings.TrimSuffix(origMedia.FileName, ext),
				time.Now().UnixNano(),
				ext,
			)

			// Create the new file path in the same directory
			newFilePath := filepath.Join(filepath.Dir(origMedia.FilePath), newFileName)

			// Copy the file
			if err := copyFile(origMedia.FilePath, newFilePath); err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy media file"})
				return
			}

			// Create new media file record
			newMedia := models.MediaFile{
				ID:        newMediaID,
				StreamID:  newStreamID,
				FileName:  newFileName,
				FilePath:  newFilePath,
				FileSize:  origMedia.FileSize,
				MediaType: origMedia.MediaType,
				MimeType:  origMedia.MimeType,
				IsPrimary: origMedia.IsPrimary,
				Order:     origMedia.Order,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}

			if err := tx.Create(&newMedia).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create media file record"})
				return
			}
		}
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Stream cloned successfully",
		"id":      newStreamID,
	})
}

// ServeVideoPreview serves a video file for preview, requires JWT auth
func (h *StreamHandler) ServeVideoPreview(c *gin.Context) {
	// Authenticate user via JWT (middleware should already do this)
	file := c.Query("file")
	if file == "" {
		c.JSON(400, gin.H{"error": "file parameter required"})
		return
	}
	// Only allow safe file paths (no directory traversal)
	if strings.Contains(file, "..") {
		c.JSON(400, gin.H{"error": "invalid file path"})
		return
	}
	// Build full path
	videoPath := filepath.Join("uploads", filepath.Clean("/"+file))
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		c.JSON(404, gin.H{"error": "file not found"})
		return
	}
	c.File(videoPath)
}

func (h *StreamHandler) ServeVideoPreviewByID(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}
	// Find stream in DB
	var stream models.Stream
	db := h.DB
	err := db.Where("id = ?", streamID).First(&stream).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}

	// find video media file in db and use the first one
	var mediaFile models.MediaFile
	err = db.Where("stream_id = ? AND media_type = ?", streamID, "video").First(&mediaFile).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "video file not found"})
		return
	}
	file := mediaFile.FilePath

	// Instead of serving the file directly, redirect to the static uploads URL
	cleanFile := strings.TrimLeft(file, "/")
	c.Redirect(302, "/"+cleanFile)
}

func (h *StreamHandler) ServeAudioPreviewByID(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}
	// Find stream in DB
	var stream models.Stream
	db := h.DB
	err := db.Where("id = ?", streamID).First(&stream).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}

	// find audio media file in db and use the first one
	var mediaFile models.MediaFile
	err = db.Where("stream_id = ? AND media_type = ?", streamID, "audio").First(&mediaFile).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "audio file not found"})
		return
	}
	file := mediaFile.FilePath

	// Instead of serving the file directly, redirect to the static uploads URL
	// Assuming uploads are served at /uploads/ and file is relative to uploads dir
	// Remove leading slashes from file path if present
	cleanFile := strings.TrimLeft(file, "/")
	c.Redirect(302, "/"+cleanFile)
}

func (h *StreamHandler) startStreaming(stream *models.Stream) {
	job.RestartLock.Lock()
	_, _, err := job.StartStreamWorkerWithDatabase(stream.ID, stream.StreamKey, stream.MaxBitrate, stream.RTMPUrl, stream.LoopVideo, stream.LoopCount, h.DB, h.RedisPubSub)
	job.RestartLock.Unlock()
	if err == nil {
		log.Println("Stream", stream.ID, "started successfully.")
		h.DB.Model(&stream).Updates(map[string]interface{}{
			"Status":    "live",
			"StartedAt": time.Now(),
		})
		// send websocket message
		BroadcastStreamListUpdate()
	}
}

// GET /api/streams/upload/progress
// Register the progress endpoint in your router setup (main.go):
// router.GET("/api/streams/upload/progress", streamHandler.GetDriveUploadProgress)
func (h *StreamHandler) GetDriveUploadProgress(c *gin.Context) {
	driveLink := c.Query("driveLink")
	if driveLink == "" {
		driveLink = c.PostForm("driveLink")
	}
	if driveLink == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing driveLink param"})
		return
	}
	// Use a simple in-memory map for demo; replace with Redis/db for production
	progress, ok := job.GetDriveProgress(driveLink)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"progress": 0, "status": "Starting..."})
		return
	}
	c.JSON(http.StatusOK, progress)
}

func (h *StreamHandler) SaveStreamKey(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		StreamKey string `json:"stream_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request."})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found."})
		return
	}
	stream.StreamKey = req.StreamKey
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update stream key."})
		return
	}

	// // find stream key on channel
	// if stream.StreamKey != "" && stream.ChannelId == "" {
	// 	var channel []models.Channels
	// 	if err := h.DB.Where("user_id = ? AND deleted_at IS NULL", c.GetString("user_id")).Find(&channel).Error; err != nil {
	// 		c.JSON(500, gin.H{"error": err.Error()})
	// 		return
	// 	}

	// 	// looping untul find stream key
	// 	for _, ch := range channel {
	// 		if _, err := findYoutubeStreamKey(*ch.AccessToken, req.StreamKey); err != nil {
	// 			continue
	// 		}
	// 		stream.ChannelId = ch.ChannelID
	// 		if err := h.DB.Model(&models.Stream{}).Where("id = ?", id).Update("channel_id", ch.ID).Error; err != nil {
	// 			c.JSON(500, gin.H{"error": err.Error()})
	// 			return
	// 		}
	// 	}
	// }
	c.JSON(200, gin.H{"success": true})
}

func (h *StreamHandler) UpdateStreamChannelId(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ChannelId string `json:"channel_id"`
		StreamKey string `json:"stream_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request."})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found."})
		return
	}

	stream.ChannelID = &req.ChannelId
	stream.StreamKey = req.StreamKey
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update channel id."})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

func (h *StreamHandler) StartStreamBackground(c *gin.Context) {
	// Get stream ID from URL
	id := c.Param("id")

	// Start a transaction
	tx := h.DB.Begin()

	// 1. Get the stream with its media files
	var stream models.Stream
	if err := tx.Preload("MediaFiles").First(&stream, "id = ?", id).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// 2. Check if stream is already live
	if stream.Status == "live" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream is already live"})
		return
	}

	// 3. Check for required fields
	if stream.StreamKey == "" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream key is required"})
		return
	}

	// 4. Check if there are any media files associated with the stream
	if len(stream.MediaFiles) == 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "No media files found for this stream"})
		return
	}

	// 5. Check if primary media file exists
	var primaryMedia *models.MediaFile
	for i, mf := range stream.MediaFiles {
		if mf.IsPrimary {
			primaryMedia = &stream.MediaFiles[i]
			break
		}
	}

	// If no primary media is set, use the first one
	if primaryMedia == nil {
		primaryMedia = &stream.MediaFiles[0]
	}

	// 6. Check if media file exists
	if _, err := os.Stat(primaryMedia.FilePath); os.IsNotExist(err) {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Media file not found: " + primaryMedia.FilePath})
		return
	}

	// 7. Check for duplicate stream key in live or scheduled streams
	var existingStream models.Stream
	err := tx.Where("stream_key = ? AND status IN (?) AND id != ?",
		stream.StreamKey, []string{"live", "scheduled"}, stream.ID).
		First(&existingStream).Error

	if err == nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Another stream with this stream key is already live or scheduled",
		})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking for duplicate streams"})
		return
	}

	// 8. Handle scheduled streams
	if stream.ScheduledStartAt != nil && stream.ScheduledStartAt.After(time.Now()) {
		stream.Status = "scheduled"
		if err := tx.Save(&stream).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule stream"})
			return
		}

		// Commit the transaction
		if err := tx.Commit().Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
			return
		}

		// Start a goroutine to handle the scheduled start
		go func(streamID string) {
			time.Sleep(time.Until(*stream.ScheduledStartAt))

			// Start a new transaction for the scheduled start
			tx := h.DB.Begin()
			var s models.Stream
			if err := tx.Preload("MediaFiles").First(&s, "id = ?", streamID).Error; err != nil {
				tx.Rollback()
				log.Printf("Error fetching stream for scheduled start: %v", err)
				return
			}

			if s.Status == "scheduled" {
				startedAt := time.Now()
				s.Status = "live"
				s.StartedAt = &startedAt

				if err := tx.Save(&s).Error; err != nil {
					tx.Rollback()
					log.Printf("Failed to update stream status to live: %v", err)
					return
				}

				// Start the actual streaming process
				if err := tx.Commit().Error; err != nil {
					log.Printf("Failed to commit scheduled start transaction: %v", err)
					return
				}

				// Start the streaming process (this would be your actual streaming logic)
				redisPubSub, _ := c.Get("redis")
				h.RedisPubSub = redisPubSub.(*redisutil.RedisPubSub)
				h.startStreaming(&s)
			} else {
				tx.Rollback()
			}
		}(stream.ID)

		c.JSON(http.StatusOK, gin.H{
			"message": "Stream scheduled to start at " + stream.ScheduledStartAt.Format(time.RFC3339),
			"status":  "scheduled",
		})
		return
	}

	// 9. Start the stream immediately
	startedAt := time.Now()
	stream.Status = "live"
	stream.StartedAt = &startedAt

	if err := tx.Save(&stream).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start stream"})
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	redisPubSub, _ := c.Get("redis")
	h.RedisPubSub = redisPubSub.(*redisutil.RedisPubSub)

	// Start the streaming process (this would be your actual streaming logic)
	go h.startStreaming(&stream)

	c.JSON(http.StatusOK, gin.H{
		"message": "Stream started successfully",
		"status":  "live",
	})
}

func (h *StreamHandler) StopStreamBackground(c *gin.Context) {
	id := c.Param("id")
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found."})
		return
	}
	if stream.Status != "live" {
		c.JSON(400, gin.H{"error": "Stream is not live."})
		return
	}
	err := job.StopStreamWorker(stream.ID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to stop stream."})
		return
	}
	h.DB.Model(&stream).Updates(map[string]interface{}{
		"status":      "stopped",
		"stopped_at":  time.Now(),
		"ffmpeg_p_id": nil,
	})
	// Broadcast to all ws clients
	userID, _ := c.Get("user_id")
	go func() {
		BroadcastStreamListUpdate()
		BroadcastDashboardStreams(h.DB, userID.(string))
	}()
	c.JSON(200, gin.H{"success": true})
}

func (h *StreamHandler) DeleteStream(c *gin.Context) {
	id := c.Param("id")
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found."})
		return
	}
	// Optionally: stop the stream if it's live
	if stream.Status == "live" {
		_ = job.StopStreamWorker(stream.ID)
	}
	// Remove video file if exists
	// list all media files
	var mediaFiles []models.MediaFile
	if err := h.DB.Where("stream_id = ?", id).Find(&mediaFiles).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to list media files."})
		return
	}
	for _, mediaFile := range mediaFiles {
		if mediaFile.FilePath != "" {
			_ = os.Remove(mediaFile.FilePath)
		}
	}

	if err := h.DB.Delete(&stream).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete stream."})
		return
	}
	userID, _ := c.Get("user_id")
	go func() {
		BroadcastStreamListUpdate()
		BroadcastDashboardStreams(h.DB, userID.(string))
	}()
	c.JSON(200, gin.H{"success": true})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func sanitizeFileName(fileName string) string {
	normalized := strings.ReplaceAll(fileName, " ", "-")
	normalized = strings.ReplaceAll(normalized, "/", "-")
	normalized = strings.ReplaceAll(normalized, "\\", "-")
	normalized = strings.ReplaceAll(normalized, ".mp4", "")
	return normalized
}
