package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/imroc/req/v3"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type YoutubeHandler struct {
	DB                 *gorm.DB
	Config             *configuration.Config
	YoutubeOauthConfig *oauth2.Config
	HttpClient         *req.Client
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
		HttpClient: req.NewClient(),
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
	url := h.YoutubeOauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
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

func (h *YoutubeHandler) CreateYoutubeLiveBroadcast(c *gin.Context) {
	userID := c.GetString("user_id")

	var req CreateBroacastRequest
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

	if err := CreateYoutubeLiveBroadcast(channel.ChannelID, *channel.AccessToken, req.StreamTitle, req.StreamKey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
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

type CreateBroacastRequest struct {
	StreamKey   string `json:"stream_key"`
	StreamTitle string `json:"stream_title"`
	ChannelID   string `json:"channel_id"`
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

type ytStreamAPIResp struct {
	Items []LiveBroadcast `json:"items"`
}

type LiveBroadcast struct {
	Kind                string                            `json:"kind"`
	Etag                string                            `json:"etag"`
	ID                  string                            `json:"id"`
	Snippet             LiveBroadcastSnippet              `json:"snippet"`
	Status              LiveBroadcastStatus               `json:"status"`
	ContentDetails      LiveBroadcastContentDetails       `json:"contentDetails"`
	Statistics          LiveBroadcastStatistics           `json:"statistics"`
	MonetizationDetails *LiveBroadcastMonetizationDetails `json:"monetizationDetails,omitempty"`
}

type LiveBroadcastSnippet struct {
	PublishedAt        string                            `json:"publishedAt"`
	ChannelId          string                            `json:"channelId"`
	Title              string                            `json:"title"`
	Description        string                            `json:"description"`
	Thumbnails         map[string]LiveBroadcastThumbnail `json:"thumbnails"`
	ScheduledStartTime string                            `json:"scheduledStartTime"`
	ScheduledEndTime   string                            `json:"scheduledEndTime"`
	ActualStartTime    string                            `json:"actualStartTime"`
	ActualEndTime      string                            `json:"actualEndTime"`
	IsDefaultBroadcast bool                              `json:"isDefaultBroadcast"`
	LiveChatId         string                            `json:"liveChatId"`
}

type LiveBroadcastThumbnail struct {
	Url    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

type LiveBroadcastStatus struct {
	LifeCycleStatus         string `json:"lifeCycleStatus"`
	PrivacyStatus           string `json:"privacyStatus"`
	RecordingStatus         string `json:"recordingStatus"`
	MadeForKids             bool   `json:"madeForKids"`
	SelfDeclaredMadeForKids bool   `json:"selfDeclaredMadeForKids"`
}

type LiveBroadcastContentDetails struct {
	BoundStreamId               string                     `json:"boundStreamId"`
	BoundStreamLastUpdateTimeMs string                     `json:"boundStreamLastUpdateTimeMs"`
	MonitorStream               LiveBroadcastMonitorStream `json:"monitorStream"`
	EnableEmbed                 bool                       `json:"enableEmbed"`
	EnableDvr                   bool                       `json:"enableDvr"`
	RecordFromStart             bool                       `json:"recordFromStart"`
	EnableClosedCaptions        bool                       `json:"enableClosedCaptions"`
	ClosedCaptionsType          string                     `json:"closedCaptionsType"`
	Projection                  string                     `json:"projection"`
	EnableLowLatency            bool                       `json:"enableLowLatency"`
	LatencyPreference           string                     `json:"latencyPreference"`
	EnableAutoStart             bool                       `json:"enableAutoStart"`
	EnableAutoStop              bool                       `json:"enableAutoStop"`
}

type LiveBroadcastMonitorStream struct {
	EnableMonitorStream    bool   `json:"enableMonitorStream"`
	BroadcastStreamDelayMs int    `json:"broadcastStreamDelayMs"`
	EmbedHtml              string `json:"embedHtml"`
}

type LiveBroadcastStatistics struct {
	TotalChatCount uint64 `json:"totalChatCount"`
}

type LiveBroadcastMonetizationDetails struct {
	CuepointSchedule LiveBroadcastCuepointSchedule `json:"cuepointSchedule"`
}

type LiveBroadcastCuepointSchedule struct {
	Enabled            bool   `json:"enabled"`
	PauseAdsUntil      string `json:"pauseAdsUntil"`
	ScheduleStrategy   string `json:"scheduleStrategy"`
	RepeatIntervalSecs int    `json:"repeatIntervalSecs"`
}

type LiveStream struct {
	Kind           string                   `json:"kind"`
	Etag           string                   `json:"etag"`
	ID             string                   `json:"id"`
	Snippet        LiveStreamSnippet        `json:"snippet"`
	CDN            LiveStreamCDN            `json:"cdn"`
	Status         LiveStreamStatus         `json:"status"`
	ContentDetails LiveStreamContentDetails `json:"contentDetails"`
}

type LiveStreamSnippet struct {
	PublishedAt     string `json:"publishedAt"`
	ChannelId       string `json:"channelId"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	IsDefaultStream bool   `json:"isDefaultStream"`
}

type LiveStreamCDN struct {
	IngestionType string                  `json:"ingestionType"`
	IngestionInfo LiveStreamIngestionInfo `json:"ingestionInfo"`
	Resolution    string                  `json:"resolution"`
	FrameRate     string                  `json:"frameRate"`
}

type LiveStreamIngestionInfo struct {
	StreamName             string `json:"streamName"`
	IngestionAddress       string `json:"ingestionAddress"`
	BackupIngestionAddress string `json:"backupIngestionAddress"`
}

type LiveStreamStatus struct {
	StreamStatus string                 `json:"streamStatus"`
	HealthStatus LiveStreamHealthStatus `json:"healthStatus"`
}

type LiveStreamHealthStatus struct {
	Status                string                         `json:"status"`
	LastUpdateTimeSeconds uint64                         `json:"lastUpdateTimeSeconds"`
	ConfigurationIssues   []LiveStreamConfigurationIssue `json:"configurationIssues"`
}

type LiveStreamConfigurationIssue struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Reason      string `json:"reason"`
	Description string `json:"description"`
}

type LiveStreamContentDetails struct {
	ClosedCaptionsIngestionUrl string `json:"closedCaptionsIngestionUrl"`
	IsReusable                 bool   `json:"isReusable"`
}

type LiveStreamListResponse struct {
	Kind     string       `json:"kind"`
	Etag     string       `json:"etag"`
	PageInfo PageInfo     `json:"pageInfo"`
	Items    []LiveStream `json:"items"`
}

type PageInfo struct {
	TotalResults   int `json:"totalResults"`
	ResultsPerPage int `json:"resultsPerPage"`
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

func CreateYoutubeLiveBroadcast(channelID string, accessToken string, streamTitle string, streamKey string) error {
	client := req.NewClient()
	req := client.R()
	req.SetHeaders(map[string]string{
		"Authorization": "Bearer " + accessToken,
	})
	req.SetBody(map[string]interface{}{
		"snippet": map[string]interface{}{
			"title":              streamTitle,
			"scheduledStartTime": time.Now().Format("2006-01-02 15:04:05"),
			"description":        "Watch " + streamTitle + " live stream",
		},
		"status": map[string]interface{}{
			"privacyStatus": "public",
		},
	})
	resp, err := req.Post("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&part=status&part=contentDetails")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	bodyString, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	// parse as LiveBroadcast
	var apiResp LiveBroadcast
	if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&apiResp); err != nil {
		return err
	}

	// get live streams list
	streamListResp, err := fetchYouTubeStreamList(accessToken)
	if err != nil {
		return err
	}

	if len(streamListResp.Items) == 0 {
		return nil
	}

	fmt.Println(apiResp)

	// find stream with streamKey
	for _, stream := range streamListResp.Items {
		fmt.Println(stream)
		if stream.CDN.IngestionInfo.StreamName == streamKey && streamKey != "" {

			resp, err := req.Get("https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=snippet&id=" + apiResp.ID + "&streamId=" + stream.ID)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			bodyString, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}

			fmt.Println(bodyString)
			// parse as LiveBroadcast
			var apiResp LiveBroadcast
			if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&apiResp); err != nil {
				return err
			}
			fmt.Println(apiResp)
			return nil
		} else {
			// use the first stream
			req.SetBody(map[string]interface{}{
				"boundStreamId": streamListResp.Items[0].ID,
			})
			resp, err := req.Post("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&part=status&part=contentDetails&part=cdn&part=monitorStream")
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			bodyString, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}
			// parse as LiveBroadcast
			var apiResp LiveBroadcast
			if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&apiResp); err != nil {
				return err
			}
			return nil
		}
	}

	return nil
}

func CreateYoutubeLiveStream(channelID string, accessToken string, streamTitle string) error {
	client := req.NewClient()
	req := client.R()
	req.SetHeaders(map[string]string{
		"Authorization": "Bearer " + accessToken,
	})
	req.SetBody(map[string]interface{}{
		"snippet": map[string]interface{}{
			"title":              streamTitle,
			"scheduledStartTime": time.Now().Format("2006-01-02 15:04:05"),
		},
		"status": map[string]interface{}{
			"privacyStatus": "public",
		},
	})
	resp, err := req.Post("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet&part=cdn&part=contentDetails&part=status")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var apiResp ytChannelsAPIResp
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return err
	}

	// get stream list
	streamListResp, err := fetchYouTubeStreamList(accessToken)
	if err != nil {
		return err
	}

	if len(apiResp.Items) == 0 {
		return nil
	}

	if len(streamListResp.Items) == 0 {
		return nil
	}

	return nil
}

func refreshToken(refreshToken string) (string, error) {
	return "", nil
}

func fetchYouTubeStreamList(accessToken string) (*LiveStreamListResponse, error) {
	fmt.Println("Fetching YouTube stream list , accessToken: ", accessToken)
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet&part=cdn&part=contentDetails&part=status&mine=true", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var apiResp LiveStreamListResponse
	bodyString, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	fmt.Println(string(bodyString))

	if err := json.NewDecoder(bytes.NewReader([]byte(string(bodyString)))).Decode(&apiResp); err != nil {
		return nil, err
	}
	if len(apiResp.Items) == 0 {
		return nil, nil
	}
	return &apiResp, nil
}

func findYoutubeStreamKey(accessToken string, streamKey string) (string, error) {
	streamListResp, err := fetchYouTubeStreamList(accessToken)
	if err != nil {
		return "", err
	}
	if len(streamListResp.Items) == 0 {
		return "", nil
	}
	for _, stream := range streamListResp.Items {
		if stream.CDN.IngestionInfo.StreamName == streamKey {
			return stream.ID, nil
		}
	}
	return "", nil
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
	streamListResp, err := fetchYouTubeStreamList(*accessToken)
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
