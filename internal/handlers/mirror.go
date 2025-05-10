package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/job"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/tiktok"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

type MirrorHandler struct {
	DB     *gorm.DB
	TikTok tiktok.TikTokClientIface
	Bus    *broadcast.LocalBroadcast
}

func checkAllNumber(str string) bool {
	for _, c := range str {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// GET /api/mirrors
func (h *MirrorHandler) ListMirrors(c *gin.Context) {
	var userId string
	if c.GetString("user_id") != "" {
		userId = c.GetString("user_id")
	}

	var mirrors []models.Mirror
	if err := h.DB.Where("user_id = ?", userId).Find(&mirrors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch mirrors"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"mirrors": mirrors})
}

// POST /api/mirrors
func (h *MirrorHandler) AddMirror(c *gin.Context) {
	var req struct {
		TikTok string `json:"tiktok"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.TikTok == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid TikTok username/URL"})
		return
	}

	// check if all number then it's room id
	var roomID string
	if checkAllNumber(req.TikTok) {
		roomID = req.TikTok
	} else {
		// Extract username from URL or use as is
		username := extractTikTokUsername(req.TikTok)
		if username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid TikTok username or URL"})
			return
		}

		// Get RoomId from TikTok API (call tiktok.GetRoomIdFromUser)
		extractedRoomId, err := h.TikTok.GetRoomIdFromUserWithAPI(username)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get Room ID: " + err.Error()})
			return
		}
		roomID = extractedRoomId
	}

	// Get Room Info (for DisplayName, LiveUrl, etc)
	roomInfo, err := h.TikTok.GetRoomInfo(roomID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get room info: " + err.Error()})
		return
	}

	if roomInfo == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room info is nil"})
		return
	}

	// check if room already exists
	var mirror models.Mirror
	if err := h.DB.Where("room_id = ?", roomID).First(&mirror).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room already exists"})
		return
	}

	// check if room is Alive
	isAlive, err := h.TikTok.CheckRoomIsAlive(roomID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to check room is alive: " + err.Error()})
		return
	}
	if !isAlive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Room is not alive"})
		return
	}

	liveUrl, err := h.TikTok.ParseRoomInfoForLiveUrl(roomInfo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to get live url: " + err.Error()})
		return
	}

	var displayName string
	if _, ok := roomInfo["owner"]; ok {
		displayName = roomInfo["owner"].(map[string]interface{})["display_id"].(string)
	} else {
		displayName = "Room ID " + roomID
	}

	var title string
	if _, ok := roomInfo["title"]; ok {
		title = roomInfo["title"].(string)
	} else {
		title = "Watch " + displayName + " live stream"
	}

	// Compose Mirror model
	mirror = models.Mirror{
		ID:          generateULID(),
		RoomId:      roomID,
		DisplayName: displayName,
		LiveUrl:     liveUrl,
		RtmpUrl:     "rtmp://a.rtmp.youtube.com/live2/",
		IsAlive:     isAlive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		StreamKey:   "",
		Status:      "stopped",
		Title:       title,
		UserId:      c.GetString("user_id"),
		UserAgent:   h.TikTok.GetUserAgent(),
	}

	if err := h.DB.Create(&mirror).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save mirror"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Mirror added", "mirror": mirror})
}

// StartMirror handles POST /api/mirrors/:id/start
func (h *MirrorHandler) StartMirror(c *gin.Context) {
	id := c.Param("id")
	var mirror models.Mirror
	if err := h.DB.First(&mirror, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Mirror not found"})
		return
	}
	if mirror.Status == "live" {
		c.JSON(400, gin.H{"error": "Mirror is already live"})
		return
	}
	if mirror.StreamKey == "" || !mirror.IsAlive {
		c.JSON(400, gin.H{"error": "Cannot start: StreamKey missing or mirror is not alive"})
		return
	}
	_, _, err := job.StartMirrorWorkerWithDatabase(mirror.ID, h.TikTok, h.DB)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "started"})
}

// StopMirror handles POST /api/mirrors/:id/stop
func (h *MirrorHandler) StopMirror(c *gin.Context) {
	id := c.Param("id")
	var mirror models.Mirror
	if err := h.DB.First(&mirror, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Mirror not found"})
		return
	}
	if mirror.Status != "live" {
		c.JSON(400, gin.H{"error": "Mirror is not live"})
		return
	}
	err := job.StopMirrorWorkerWithDatabase(mirror.ID, h.DB, true)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "stopped"})
}

// DeleteMirror handles DELETE /api/mirrors/:id
func (h *MirrorHandler) DeleteMirror(c *gin.Context) {
	id := c.Param("id")
	var mirror models.Mirror
	if err := h.DB.First(&mirror, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Mirror not found"})
		return
	}
	// Stop the worker if running
	_ = job.StopMirrorWorkerWithDatabase(mirror.ID, h.DB, true)
	if err := h.DB.Delete(&mirror).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "deleted"})
}

// UpdateMirrorRTMPUrl handles PUT /api/mirrors/:id/rtmp-url
func (h *MirrorHandler) UpdateMirrorRTMPUrl(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		RTMPUrl string `json:"rtmp_url"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}
	if req.RTMPUrl == "" {
		c.JSON(400, gin.H{"error": "RTMP URL cannot be empty"})
		return
	}
	if err := h.DB.Model(&models.Mirror{}).Where("id = ?", id).Update("rtmp_url", req.RTMPUrl).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "rtmp_url updated"})
}

// UpdateMirrorStreamKey handles PUT /api/mirrors/:id/stream-key
func (h *MirrorHandler) UpdateMirrorStreamKey(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		StreamKey string `json:"stream_key"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}
	if req.StreamKey == "" {
		c.JSON(400, gin.H{"error": "Stream Key cannot be empty"})
		return
	}
	var mirror models.Mirror
	if err := h.DB.First(&mirror, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Mirror not found"})
		return
	}
	if err := h.DB.Model(&models.Mirror{}).Where("id = ?", id).Update("stream_key", req.StreamKey).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	// // find stream key on channel
	// if mirror.StreamKey != "" && mirror.ChannelId == "" {
	// 	var channel []models.Channels
	// 	if err := h.DB.Where("user_id = ? AND deleted_at IS NULL", c.GetString("user_id")).Find(&channel).Error; err != nil {
	// 		c.JSON(500, gin.H{"error": err.Error()})
	// 		return
	// 	}

	// 	// looping untul find stream key
	// 	for _, ch := range channel {
	// 		if _, err := findYoutubeStreamKey(*ch.AccessToken, req.StreamKey); err != nil {
	// 			continue
	// 		}
	// 		mirror.ChannelId = ch.ChannelID
	// 		if err := h.DB.Model(&models.Mirror{}).Where("id = ?", id).Update("channel_id", ch.ID).Error; err != nil {
	// 			c.JSON(500, gin.H{"error": err.Error()})
	// 			return
	// 		}
	// 	}
	// }
	c.JSON(200, gin.H{"status": "stream_key updated"})
}

func (h *MirrorHandler) UpdateMirrorChannelId(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ChannelId string `json:"channel_id"`
		StreamKey string `json:"stream_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request."})
		return
	}
	var mirror models.Mirror
	if err := h.DB.First(&mirror, "id = ?", id).Error; err != nil {
		c.JSON(404, gin.H{"error": "Mirror not found."})
		return
	}
	mirror.ChannelId = req.ChannelId
	mirror.StreamKey = req.StreamKey
	if err := h.DB.Save(&mirror).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to update channel id."})
		return
	}
	c.JSON(200, gin.H{"success": true})
}

func (h *MirrorHandler) AddMirrorFromBroadcast(username string, userID string, rtmpUrl string, streamKey string, channelId string) {
	var roomID string
	if checkAllNumber(username) {
		roomID = username
	} else {
		// Extract username from URL or use as is
		username := extractTikTokUsername(username)
		if username == "" {
			return
		}

		// Get RoomId from TikTok API (call tiktok.GetRoomIdFromUser)
		extractedRoomId, err := h.TikTok.GetRoomIdFromUserWithAPI(username)
		if err != nil {
			return
		}
		roomID = extractedRoomId
	}

	// Get Room Info (for DisplayName, LiveUrl, etc)
	roomInfo, err := h.TikTok.GetRoomInfo(roomID)
	if err != nil {
		return
	}

	if roomInfo == nil {
		return
	}

	// check if room already exists
	var mirror models.Mirror
	if err := h.DB.Where("room_id = ?", roomID).First(&mirror).Error; err == nil {
		return
	}

	// check if room is Alive
	isAlive, err := h.TikTok.CheckRoomIsAlive(roomID)
	if err != nil {
		return
	}
	if !isAlive {
		return
	}

	liveUrl, err := h.TikTok.ParseRoomInfoForLiveUrl(roomInfo)
	if err != nil {
		return
	}

	var displayName string
	if _, ok := roomInfo["owner"]; ok {
		displayName = roomInfo["owner"].(map[string]interface{})["display_id"].(string)
	} else {
		displayName = "Room ID " + roomID
	}

	fmt.Println("DisplayName: " + displayName)
	fmt.Println("LiveUrl: " + liveUrl)
	fmt.Println("RoomINfo: ", roomInfo)

	var title string
	if _, ok := roomInfo["title"]; ok {
		title = roomInfo["title"].(string)
	} else {
		title = "Watch " + displayName + " live stream"
	}

	destinationRtmpUrl := "rtmp://a.rtmp.youtube.com/live2/"

	if rtmpUrl != "" {
		destinationRtmpUrl = rtmpUrl
	}

	// Compose Mirror model
	mirror = models.Mirror{
		ID:          generateULID(),
		RoomId:      roomID,
		DisplayName: displayName,
		LiveUrl:     liveUrl,
		RtmpUrl:     destinationRtmpUrl,
		IsAlive:     isAlive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		StreamKey:   streamKey,
		Status:      "stopped",
		UserId:      userID,
		Title:       title,
		UserAgent:   h.TikTok.GetUserAgent(),
	}

	if err := h.DB.Create(&mirror).Error; err != nil {
		fmt.Println("Failed to save mirror: " + err.Error())
		return
	}

	_, _, err = job.StartMirrorWorkerWithDatabase(mirror.ID, h.TikTok, h.DB)
	if err != nil {
		fmt.Println("Failed to start mirror worker: " + err.Error())
		return
	}
}

func extractTikTokUsername(input string) string {
	input = strings.TrimSpace(input)
	if input == "" {
		return ""
	}
	if strings.Contains(input, "tiktok.com/") {
		parts := strings.Split(input, "/")
		for i := len(parts) - 1; i >= 0; i-- {
			if parts[i] != "" && parts[i][0] != '@' {
				return parts[i]
			}
		}
	}
	// if starts with @ remove it
	if strings.HasPrefix(input, "@") {
		return input[1:]
	}
	return input
}

func generateULID() string {
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	id, _ := ulid.New(ms, entropy)
	return id.String()
}
