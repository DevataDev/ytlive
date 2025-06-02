package handlers

import (
	"log"
	"net/http"
	"strconv"
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

	var limit int
	var offset int
	if c.Query("limit") != "" {
		limit, _ = strconv.Atoi(c.Query("limit"))
	}
	if c.Query("offset") != "" {
		offset, _ = strconv.Atoi(c.Query("offset"))
	}

	var monitors []models.Monitor
	if err := h.DB.Where("user_id = ?", userId).Limit(limit).Offset(offset).Find(&monitors).Error; err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch monitors"})
		return
	}
	var total int64
	if err := h.DB.Where("user_id = ? AND deleted_at IS NULL", userId).Table("monitors").Count(&total).Error; err != nil {
		log.Println(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch monitors"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitors": monitors, "pagination": gin.H{"total": total, "limit": limit, "offset": offset}})
}

func (h *MonitorHandler) AddMonitor(c *gin.Context) {
	var req struct {
		UniqueId string `json:"unique_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.UniqueId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unique ID is required"})
		return
	}

	var monitor models.Monitor
	if err := h.DB.Where("unique_id = ?", req.UniqueId).First(&monitor).Error; err == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor already exists"})
		return
	}

	monitor = models.Monitor{
		ID:        generateULID(),
		UniqueId:  req.UniqueId,
		UserId:    c.GetString("user_id"),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		IsLive:    false,
		RtmpUrl:   "rtmp://a.rtmp.youtube.com/live2/",
		StreamKey: "",
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
	if err := h.DB.Where("(unique_id = ? OR id = ?)", req.UniqueId, req.UniqueId).First(&monitor).Error; err != nil {
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

func (h *MonitorHandler) UpdateMonitorRTMPUrl(c *gin.Context) {
	var req struct {
		RTMPUrl string `json:"rtmp_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	id := c.Param("id")

	var monitor models.Monitor
	if err := h.DB.Where("(unique_id = ? OR id = ?)", id, id).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	monitor.RtmpUrl = req.RTMPUrl
	if err := h.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) UpdateMonitorStreamKey(c *gin.Context) {
	var req struct {
		StreamKey string `json:"stream_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	id := c.Param("id")

	var monitor models.Monitor
	if err := h.DB.Where("(unique_id = ? OR id = ?)", id, id).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	monitor.StreamKey = req.StreamKey
	if err := h.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) UpdateMonitorChannelId(c *gin.Context) {
	var req struct {
		ChannelId string `json:"channel_id"`
		StreamKey string `json:"stream_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	id := c.Param("id")

	var monitor models.Monitor
	if err := h.DB.Where("(unique_id = ? OR id = ?)", id, id).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}
	monitor.ChannelId = req.ChannelId
	monitor.StreamKey = req.StreamKey

	if err := h.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) PauseMonitor(c *gin.Context) {
	var monitorId string
	if c.Param("id") != "" {
		monitorId = c.Param("id")
	}
	var monitor models.Monitor
	if err := h.DB.Where("(unique_id =? OR id =?)", monitorId, monitorId).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}

	monitor.Paused = true
	if err := h.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}

func (h *MonitorHandler) ResumeMonitor(c *gin.Context) {
	var monitorId string
	if c.Param("id") != "" {
		monitorId = c.Param("id")
	}
	var monitor models.Monitor
	if err := h.DB.Where("(unique_id =? OR id =?)", monitorId, monitorId).First(&monitor).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Monitor not found"})
		return
	}

	monitor.Paused = false
	if err := h.DB.Save(&monitor).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update monitor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"monitor": monitor})
}
