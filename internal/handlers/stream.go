package handlers

import (
	"net/http"
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
	var countLive, countScheduled int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&countLive)
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&countScheduled)
	c.JSON(http.StatusOK, gin.H{"streams": streams, "page": 1, "per_page": 10, "total": len(streams), "countLive": countLive, "countScheduled": countScheduled})
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
