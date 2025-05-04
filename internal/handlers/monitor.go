package handlers

import (
	"net/http"
	"time"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MonitorHandler struct {
	DB *gorm.DB
}

func (h *MonitorHandler) ListMonitors(c *gin.Context) {
	var userId string
	if c.GetString("user_id") != "" {
		userId = c.GetString("user_id")
	}

	var monitors []models.Monitor
	if err := h.DB.Where("user_id = ?", userId).Find(&monitors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch monitors"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitors": monitors})
}

func (h *MonitorHandler) AddMonitor(c *gin.Context) {
	var req struct {
		UniqueId string `json:"unique_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var monitor models.Monitor
	if err := h.DB.Where("unique_id = ?", req.UniqueId).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	monitor = models.Monitor{
		ID:        generateULID(),
		UniqueId:  req.UniqueId,
		UserId:    c.GetString("user_id"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := h.DB.Create(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) RemoveMonitor(c *gin.Context) {
	var req struct {
		UniqueId string `json:"unique_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var monitor models.Monitor
	if err := h.DB.Where("unique_id = ?", req.UniqueId).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	if err := h.DB.Delete(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) UpdateMonitor(c *gin.Context) {
	var req struct {
		UniqueId string `json:"unique_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var monitor models.Monitor
	if err := h.DB.Where("unique_id = ?", req.UniqueId).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	monitor = models.Monitor{
		ID:        generateULID(),
		UniqueId:  req.UniqueId,
		UserId:    c.GetString("user_id"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := h.DB.Create(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}
