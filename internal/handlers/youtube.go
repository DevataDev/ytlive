package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"windsorf-youtube-live/internal/broadcast"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"
	"windsorf-youtube-live/internal/youtube"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"gorm.io/gorm"
)

type YoutubeHandler struct {
	DB            *gorm.DB
	Config        *configuration.Config
	YoutubeClient *youtube.YoutubeClient
}

func NewYoutubeHandler(db *gorm.DB, config *configuration.Config) *YoutubeHandler {
	// listen to create broadcast event
	youtubeClient := youtube.NewYoutubeClient(config)
	broadcast.Bus.AddListener("youtube", broadcast.CreateBroadcast, func(e broadcast.Event) {
		streamKey := e.Data.(map[string]interface{})["stream_key"].(string)
		channelID := e.Data.(map[string]interface{})["channel_id"].(string)
		title := e.Data.(map[string]interface{})["title"].(string)
		accessToken := e.Data.(map[string]interface{})["access_token"].(string)
		refreshToken := e.Data.(map[string]interface{})["refresh_token"].(string)

		youtubeClient.HandleCreateYoutubeLiveBroadcast(channelID, accessToken, title, streamKey, refreshToken)
	})
	return &YoutubeHandler{
		DB:            db,
		Config:        config,
		YoutubeClient: youtubeClient,
	}
}

// ListChannels lists YouTube channels connected by the authenticated user
func (h *YoutubeHandler) ListChannels(c *gin.Context) {
	userID := c.GetString("user_id") // Assumes user_id is set in context
	var channels []models.Channels
	if err := h.DB.Where("user_id = ?", userID).Find(&channels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

// StartYouTubeOAuth redirects user to Google OAuth consent screen
func (h *YoutubeHandler) StartYouTubeOAuth(c *gin.Context) {
	userID := c.GetString("user_id")
	state := base64.StdEncoding.EncodeToString([]byte(userID)) // In production, use a secure random state
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}
	url := h.YoutubeClient.YoutubeOauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	c.JSON(http.StatusOK, gin.H{"auth_url": url})
}

// YouTubeOAuthCallback handles the OAuth callback and saves channel info
func (h *YoutubeHandler) YouTubeOAuthCallback(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")
	userID, err := base64.StdEncoding.DecodeString(state)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode state: " + err.Error()})
		return
	}
	token, err := h.YoutubeClient.Exchange(code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token: " + err.Error()})
		return
	}

	fmt.Println("Access token", token.AccessToken)
	fmt.Println("Refresh token", token.RefreshToken)

	// Fetch channel info from YouTube API
	ytResp, err := h.YoutubeClient.FetchYouTubeChannel(token.AccessToken, token.RefreshToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channel info: " + err.Error()})
		return
	}

	// check if there is a channel with the same channel id
	var channel models.Channels
	h.DB.Where("channel_id = ?", ytResp.ID).Find(&channel)
	if channel.ID != "" {
		channel.AccessToken = &token.AccessToken
		channel.RefreshToken = &token.RefreshToken
		channel.UserId = string(userID)
		if err := h.DB.Save(&channel).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update channel: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Channel updated"})
		return
	}

	// Save channel to DB
	channel = models.Channels{
		ID:           generateULID(),
		ChannelID:    ytResp.ID,
		ChannelName:  ytResp.Snippet.Title,
		AccessToken:  &token.AccessToken,
		RefreshToken: &token.RefreshToken,
		UserId:       string(userID),
	}
	if err := h.DB.Create(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Channel created"})
}

func (h *YoutubeHandler) DeleteChannel(c *gin.Context) {
	userID := c.GetString("user_id")
	var channel models.Channels
	id := c.Param("id")
	if err := h.DB.Where("user_id = ? AND id = ? AND deleted_at IS NULL", userID, id).Find(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if err := h.DB.Delete(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *YoutubeHandler) ListStreamsByChannel(c *gin.Context) {
	userID := c.GetString("user_id")
	channelID := c.Param("id")
	var channel models.Channels
	if err := h.DB.Where("user_id = ? AND id = ? AND deleted_at IS NULL", userID, channelID).Find(&channel).Error; err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	accessToken := channel.AccessToken
	refreshToken := channel.RefreshToken
	if accessToken == nil || refreshToken == nil {
		c.JSON(500, gin.H{"error": "Access token or refresh token is nil"})
		return
	}
	fmt.Println("Access token", *accessToken)
	fmt.Println("Refresh token", *refreshToken)

	streamListResp, err := h.YoutubeClient.FetchYouTubeStreamList(*accessToken, *refreshToken)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if streamListResp == nil {
		c.JSON(200, gin.H{"streams": []string{}})
		return
	}

	if len(streamListResp.Items) == 0 {
		c.JSON(200, gin.H{"streams": []string{}})
		return
	}
	var streams []map[string]interface{}
	for _, stream := range streamListResp.Items {
		streams = append(streams, map[string]interface{}{
			"id":         stream.ID,
			"title":      stream.Snippet.Title,
			"stream_key": stream.CDN.IngestionInfo.StreamName,
		})
	}
	c.JSON(200, gin.H{"streams": streams})
}

func (h *YoutubeHandler) CreateYoutubeLiveBroadcast(c *gin.Context) {
	userID := c.GetString("user_id")

	var req youtube.CreateBroacastRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.ChannelID == "" || req.StreamTitle == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var channel models.Channels
	if err := h.DB.Where("user_id = ? AND (channel_id = ? OR id = ?)", userID, req.ChannelID, req.ChannelID).Find(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.YoutubeClient.HandleCreateYoutubeLiveBroadcast(channel.ChannelID, *channel.AccessToken, req.StreamTitle, req.StreamKey, *channel.RefreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
