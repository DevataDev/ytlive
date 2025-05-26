package handlers

import (
	"os"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/sys/unix"
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
	// Get disk usage of the root filesystem
	var stat unix.Statfs_t
	wd, err := os.Getwd()
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get current working directory"})
		return
	}

	err = unix.Statfs(wd, &stat)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get disk usage"})
		return
	}

	// Calculate total and used space in bytes
	totalSpace := int64(stat.Blocks) * int64(stat.Bsize)
	usedSpace := totalSpace - (int64(stat.Bavail) * int64(stat.Bsize))
	usedPercent := float64(usedSpace) / float64(totalSpace) * 100

	c.JSON(200, gin.H{
		"total":        totalSpace,
		"used":         usedSpace,
		"free":         int64(stat.Bavail) * int64(stat.Bsize),
		"used_percent": usedPercent,
	})
}
