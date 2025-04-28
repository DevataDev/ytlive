package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type StreamHandler struct {
	DB *gorm.DB
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

// GET /api/streams - list streams for current user
func (h *StreamHandler) ListStreams(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var streams []models.Stream
	if err := h.DB.Where("user_id = ?", userID).Find(&streams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch streams"})
		return
	}
	// Add file size info for each stream
	for i, s := range streams {
		if s.FilePath != nil && *s.FilePath != "" {
			videoPath := "." + filepath.Clean("/"+*s.FilePath)
			if fi, err := os.Stat(videoPath); err == nil {
				streams[i].FileName = s.FileName // ensure not empty
				if streams[i].FilePath == nil {
					streams[i].FilePath = s.FilePath
				}
				// Add as a new field (FileSizeBytes)
				if fs, ok := fi.Size(), true; ok {
					// Attach to stream as a map
					c.Set("file_size_"+s.ID, fs)
				}
			}
		}
	}
	var countLive, countScheduled int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&countLive)
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&countScheduled)
	// Build response with file size
	resp := make([]map[string]interface{}, 0, len(streams))
	for _, s := range streams {
		item := map[string]interface{}{
			"ID": s.ID,
			"FileName": s.FileName,
			"FilePath": s.FilePath,
			"Status": s.Status,
			"GoogleDriveLink": s.GoogleDriveLink,
			"ScheduledAt": s.ScheduledAt,
			"ScheduledStartAt": s.ScheduledStartAt,
			"ScheduledEndAt": s.ScheduledEndAt,
			"StartedAt": s.StartedAt,
			"StoppedAt": s.StoppedAt,
			"StreamKey": s.StreamKey,
			"MaxBitrate": s.MaxBitrate,
			"UserId": s.UserId,
		}
		if s.FilePath != nil && *s.FilePath != "" {
			if fs, ok := c.Get("file_size_"+s.ID); ok {
				item["FileSizeBytes"] = fs
			}
		}
		resp = append(resp, item)
	}
	c.JSON(http.StatusOK, gin.H{"streams": resp, "page": 1, "per_page": 10, "total": len(streams), "countLive": countLive, "countScheduled": countScheduled})
}

// POST /api/streams - create a new stream for current user
func (h *StreamHandler) CreateStream(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var req struct {
		FileName        string  `json:"FileName"`
		FilePath        *string `json:"FilePath"`
		GoogleDriveLink *string `json:"GoogleDriveLink"`
		MaxBitrate      *int    `json:"MaxBitrate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	stream := models.Stream{
		FileName:        req.FileName,
		FilePath:        req.FilePath,
		GoogleDriveLink: req.GoogleDriveLink,
		Status:          "stopped",
		MaxBitrate:      req.MaxBitrate,
		UserId:          userID.(string),
	}
	if err := h.DB.Create(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"stream": stream})
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
	}
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set duration"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream duration set"})
}

// PUT /api/streams/:id/rename
func (h *StreamHandler) RenameFile(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		FileName string `json:"FileName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.FileName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.FileName = req.FileName
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename file"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "File renamed"})
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

// ServeVideoPreviewByID serves a video file for preview by stream ID, requires JWT auth
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
	if stream.FilePath == nil || *stream.FilePath == "" {
		c.JSON(404, gin.H{"error": "no file for this stream"})
		return
	}
	file := *stream.FilePath
	if strings.Contains(file, "..") {
		c.JSON(400, gin.H{"error": "invalid file path"})
		return
	}
	videoPath := "." + filepath.Clean("/"+file)
	fmt.Println(videoPath)
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		c.JSON(404, gin.H{"error": "file not found"})
		return
	}
	c.File(videoPath)
}
