package handlers

import (
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DownloadHandler struct {
	DB *gorm.DB
}

func (h *DownloadHandler) DownloadStream(c *gin.Context) {
	id := c.Param("id")
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found"})
		return
	}
	if stream.FileName == "" {
		c.JSON(400, gin.H{"error": "No file uploaded for this stream."})
		return
	}
	if stream.FilePath != nil {
		c.FileAttachment(*stream.FilePath, stream.FileName)
	} else {
		c.JSON(400, gin.H{"error": "No file path for this stream."})
	}
}
