package handlers

import (
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
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
