package handlers

import (
	"net/http"

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
