package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type YoutubeHandler struct {
	DB                 *gorm.DB
	Config             *configuration.Config
	YoutubeOauthConfig *oauth2.Config
}

func NewYoutubeHandler(db *gorm.DB, config *configuration.Config) *YoutubeHandler {
	return &YoutubeHandler{
		DB:     db,
		Config: config,
		YoutubeOauthConfig: &oauth2.Config{
			RedirectURL:  config.Youtube.RedirectURL,
			ClientID:     config.Youtube.ClientId,
			ClientSecret: config.Youtube.ClientSecret,
			Scopes:       []string{"https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/userinfo.email"},
			Endpoint:     google.Endpoint,
		},
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
	c.JSON(http.StatusOK, channels)
}

// StartYouTubeOAuth redirects user to Google OAuth consent screen
func (h *YoutubeHandler) StartYouTubeOAuth(c *gin.Context) {
	userID := c.GetString("user_id")
	state := userID // In production, use a secure random state
	url := h.YoutubeOauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	c.JSON(http.StatusOK, gin.H{"auth_url": url})
}

// YouTubeOAuthCallback handles the OAuth callback and saves channel info
func (h *YoutubeHandler) YouTubeOAuthCallback(c *gin.Context) {
	userID := c.GetString("user_id")
	state := c.Query("state")
	if state != userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid state"})
		return
	}
	code := c.Query("code")
	token, err := h.YoutubeOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token: " + err.Error()})
		return
	}
	// Fetch channel info from YouTube API
	ytResp, err := fetchYouTubeChannel(token.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch channel info: " + err.Error()})
		return
	}
	// Save channel to DB
	channel := models.Channels{
		ID:           ytResp.ID,
		ChannelID:    ytResp.ID,
		ChannelName:  ytResp.Snippet.Title,
		AccessToken:  &token.AccessToken,
		RefreshToken: &token.RefreshToken,
		UserId:       userID,
	}
	if err := h.DB.Create(&channel).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, channel)
}

type ytChannelResp struct {
	ID      string `json:"id"`
	Snippet struct {
		Title string `json:"title"`
	} `json:"snippet"`
}

type ytChannelsAPIResp struct {
	Items []ytChannelResp `json:"items"`
}

func fetchYouTubeChannel(accessToken string) (*ytChannelResp, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var apiResp ytChannelsAPIResp
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}
	if len(apiResp.Items) == 0 {
		return nil, nil
	}
	return &apiResp.Items[0], nil
}
