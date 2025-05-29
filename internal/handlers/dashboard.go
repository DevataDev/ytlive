package handlers

import (
	"context"
	"os"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v3/disk"
	"gorm.io/gorm"
)

type DashboardHandler struct {
	DB *gorm.DB
}

func (h *DashboardHandler) GetDashboardStreamMetrics(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var started, scheduled int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&started)
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&scheduled)
	c.JSON(200, gin.H{"started": started, "scheduled": scheduled})
}

func (h *DashboardHandler) GetDashboardSystemMetrics(c *gin.Context) {
	var cpu, memory, upload, download float64
	cpu = 11.5
	memory = 42.3
	upload = 120.5
	download = 340.8
	c.JSON(200, gin.H{"cpu": cpu, "memory": memory, "upload": upload, "download": download})
}

// GetStorageInfo returns information about system disk usage
func (h *DashboardHandler) GetStorageInfo(c *gin.Context) {
	// Get the current working directory
	wd, err := os.Getwd()
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get current working directory"})
		return
	}

	// Get disk usage using cross-platform library
	usage, err := disk.UsageWithContext(context.Background(), wd)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get disk usage: " + err.Error()})
		return
	}

	var fileCounts map[string]interface{}
	fileCounts = map[string]interface{}{
		"videos": 0,
		"audio":  0,
	}

	// Get file from media files
	var mediaFiles []models.MediaFile
	if err := h.DB.Find(&mediaFiles).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch media files"})
		return
	}
	for _, mediaFile := range mediaFiles {
		if mediaFile.MediaType == "video" {
			fileCounts["videos"] = fileCounts["videos"].(int) + 1
		} else if mediaFile.MediaType == "audio" {
			fileCounts["audio"] = fileCounts["audio"].(int) + 1
		}
	}

	c.JSON(200, gin.H{
		"total":        usage.Total,
		"used":         usage.Used,
		"free":         usage.Free,
		"used_percent": usage.UsedPercent,
		"fileCounts":   fileCounts,
	})
}
