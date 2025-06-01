package handlers

import (
	"context"
	"os"
	"strconv"
	"time"

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
	var total int64
	h.DB.Model(&models.Stream{}).Where("user_id = ?", userID).Count(&total)
	c.JSON(200, gin.H{"started": started, "scheduled": scheduled, "total": total})
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
// GetRecentActivities returns recent activities for the current user
func (h *DashboardHandler) GetRecentActivities(c *gin.Context) {
	userID, _ := c.Get("user_id")

	// Get query parameters with defaults
	limit := 10
	if l := c.Query("limit"); l != "" {
		if lInt, err := strconv.Atoi(l); err == nil && lInt > 0 {
			limit = lInt
		}
	}

	// Get activities from database
	activities, err := models.GetRecentActivities(h.DB, userID.(string), limit)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch activities"})
		return
	}

	// Format activities for the frontend
	formattedActivities := make([]map[string]interface{}, len(activities))
	for i, activity := range activities {
		// Determine icon based on activity type
		icon := "bi-activity"
		switch activity.Type {
		case models.ActivityTypeStreamStarted:
			icon = "bi-play-circle"
		case models.ActivityTypeStreamStopped:
			icon = "bi-stop-circle"
		case models.ActivityTypeStreamScheduled:
			icon = "bi-calendar-event"
		case models.ActivityTypeStreamError:
			icon = "bi-exclamation-triangle"
		case models.ActivityTypeVideoUploaded:
			icon = "bi-upload"
		case models.ActivityTypeVideoProcessed:
			icon = "bi-check-circle"
		}

		// Format the activity for the frontend
		formattedActivities[i] = map[string]interface{}{
			"id":          activity.ID,
			"event":       activity.Title,
			"description": activity.Description,
			"status":      string(activity.Status),
			"timestamp":   activity.CreatedAt.Format(time.RFC3339),
			"icon":        icon,
		}
	}

	c.JSON(200, gin.H{
		"success":    true,
		"activities": formattedActivities,
	})
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
	if err := h.DB.Where("deleted_at IS NULL").Find(&mediaFiles).Error; err != nil {
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
