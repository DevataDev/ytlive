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
