package handlers

import (
	"net/url"
	"strings"
	"windsorf-youtube-live/internal/tiktok"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TiktokHandler struct {
	DB           *gorm.DB
	TikTokClient *tiktok.Client
}

func (h *TiktokHandler) GetRoomFromUser(c *gin.Context) {
	user := c.Query("user")
	if user == "" {
		c.JSON(400, gin.H{"error": "user is required"})
		return
	}

	roomID, err := h.TikTokClient.GetRoomIdFromUser(user)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"room_id": roomID})
}

func (h *TiktokHandler) GetRoomInfo(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	roomInfo, err := h.TikTokClient.GetRoomInfo(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, roomInfo)
}

func (h *TiktokHandler) CheckRoomIsAlive(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	isAlive, err := h.TikTokClient.CheckRoomIsAlive(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"is_alive": isAlive})
}

func (h *TiktokHandler) GetLiveUrl(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	liveUrl, err := h.TikTokClient.GetLiveUrl(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	// how to decode \u0026
	liveUrl = strings.ReplaceAll(liveUrl, "\\u0026", "&")
	urlDecoded, err := url.QueryUnescape(liveUrl)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"live_url": urlDecoded})
}
