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
	
	// Get the stream with its media files
	var stream models.Stream
	if err := h.DB.Preload("MediaFiles").First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Stream not found"})
		return
	}

	// Check if there are any media files
	if len(stream.MediaFiles) == 0 {
		c.JSON(400, gin.H{"error": "No media files found for this stream"})
		return
	}

	// For now, download the first media file
	// You might want to add logic to handle multiple files or let the client choose which one to download
	mediaFile := stream.MediaFiles[0]
	c.FileAttachment(mediaFile.FilePath, mediaFile.FileName)
}
