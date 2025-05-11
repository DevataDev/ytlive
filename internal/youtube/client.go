package youtube

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	"net/http"
	"net/url"
	"time"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type YoutubeClient struct {
	Config             *configuration.Config
	YoutubeOauthConfig *oauth2.Config
	DB                 *gorm.DB
}

func NewYoutubeClient(config *configuration.Config) *YoutubeClient {
	return &YoutubeClient{
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

func (h *YoutubeClient) UpdateTokenInDB(oldRefreshToken string, accessToken string, refreshToken string) error {
	if accessToken == "" {
		fmt.Println("Invalid token for update in DB", accessToken, refreshToken, oldRefreshToken)
		return nil
	}
	if oldRefreshToken == "" {
		fmt.Println("Invalid refresh token for update in DB", oldRefreshToken)
		return nil
	}
	if h.DB == nil {
		fmt.Println("Invalid DB for update in DB")
		return nil
	}
	var channel models.Channels
	if err := h.DB.Where("refresh_token = ?", oldRefreshToken).Find(&channel).Error; err != nil {
		fmt.Println("Failed to get channel for refresh token", oldRefreshToken, "with error", err.Error())
		return err
	}
	channel.AccessToken = &accessToken
	if refreshToken != "" {
		channel.RefreshToken = &refreshToken
	}
	if err := h.DB.Save(&channel).Error; err != nil {
		fmt.Println("Failed to update channel in DB", channel.ID, "with error", err.Error())
		return err
	}
	return nil
}

// handler should have access to RefreshYouTubeAccessToken and DB for updating tokens

func (h *YoutubeClient) DoWithAutoRefresh(
	req *http.Request,
	accessToken string,
	refreshToken string,
	updateTokenFunc func(newAccessToken string, newRefreshToken string, oldRefreshToken string),
) (*http.Response, error) {
	fmt.Println("DoWithAutoRefresh", accessToken, " ", refreshToken)
	if accessToken == "" {
		return nil, errors.New("access token is empty, please re-login")
	}
	// 1. Do the request with the current access token
	req.Header.Set("Authorization", "Bearer "+accessToken)
	client := h.YoutubeOauthConfig.Client(context.Background(), &oauth2.Token{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	})
	resp, _ := client.Do(req)

	// 2. If token expired/invalid, refresh and retry ONCE
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		fmt.Println("Token expired/invalid for channel", refreshToken)
		if refreshToken == "" {
			return nil, errors.New("refresh token is empty, please re-login")
		}
		newAccessToken, newRefreshToken, oldRefreshToken, err := h.RefreshYouTubeAccessToken(refreshToken)
		if err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}
		// Optionally update the token in DB or memory
		if updateTokenFunc != nil {
			updateTokenFunc(newAccessToken, newRefreshToken, oldRefreshToken)
		}
		// Retry request with new token
		req2 := req.Clone(req.Context())
		req2.Header.Set("Authorization", "Bearer "+newAccessToken)
		return h.YoutubeOauthConfig.Client(context.Background(), &oauth2.Token{
			AccessToken:  newAccessToken,
			RefreshToken: newRefreshToken,
		}).Do(req2)
	}

	fmt.Println("Request successful for channel", resp)
	// 3. Return the original response
	return resp, nil
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

func (h *YoutubeClient) FetchYouTubeChannel(accessToken string, refreshToken string) (*ytChannelResp, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", nil)
	resp, err := h.DoWithAutoRefresh(req, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
		h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
	})
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

func (h *YoutubeClient) HandleCreateYoutubeLiveBroadcast(channelID string, accessToken string, streamTitle string, streamKey string, refreshToken string) error {
	request, err := http.NewRequest("POST", "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&part=status&part=contentDetails", nil)
	if err != nil {
		return err
	}

	body := map[string]interface{}{
		"snippet": map[string]interface{}{
			"title":              streamTitle,
			"scheduledStartTime": time.Now().Format("2006-01-02 15:04:05"),
			"description":        streamTitle,
		},
		"status": map[string]interface{}{
			"privacyStatus":           "public",
			"selfDeclaredMadeForKids": false,
		},
		"contentDetails": map[string]interface{}{
			"enableLowLatency": true,
			"enableAutoStart":  true,
			"enableAutoStop":   true,
		},
	}
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	resp, err := h.DoWithAutoRefresh(request, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
		h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
	})
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
	streamListResp, err := h.FetchYouTubeStreamList(accessToken, refreshToken)
	if err != nil {
		return err
	}

	if len(streamListResp.Items) == 0 {
		return nil
	}

	// find stream with streamKey
	for _, stream := range streamListResp.Items {
		if stream.CDN.IngestionInfo.StreamName == streamKey && streamKey != "" {
			// bind stream to broadcast
			request, err := http.NewRequest("POST", "https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=snippet&id="+apiResp.ID+"&streamId="+stream.ID, nil)
			if err != nil {
				return err
			}
			resp, err := h.DoWithAutoRefresh(request, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
				h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
			})
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			bodyString, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}

			// parse as LiveBroadcast
			var liveBroadcast LiveBroadcast
			if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&liveBroadcast); err != nil {
				return err
			}
			return nil
		}
	}
	stream := streamListResp.Items[0]

	request, err = http.NewRequest("POST", "https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=snippet&id="+apiResp.ID+"&streamId="+stream.ID, nil)
	if err != nil {
		return err
	}
	resp, err = h.DoWithAutoRefresh(request, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
		h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	bodyString, err = io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	// parse as LiveBroadcast
	var liveBroadcast LiveBroadcast
	if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&liveBroadcast); err != nil {
		return err
	}
	return nil
}

func (h *YoutubeClient) HandleCreateYoutubeLiveStream(channelID string, accessToken string, refreshToken string, streamTitle string) error {
	body := map[string]interface{}{
		"snippet": map[string]interface{}{
			"title":              streamTitle,
			"scheduledStartTime": time.Now().Format("2006-01-02 15:04:05"),
			"description":        "Watch " + streamTitle + " live stream",
		},
		"status": map[string]interface{}{
			"privacyStatus": "public",
		},
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}

	request, err := http.NewRequest("POST", "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet&part=cdn&part=contentDetails&part=status", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	resp, err := h.DoWithAutoRefresh(request, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
		h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	bodyString, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var apiResp LiveStream
	if err := json.NewDecoder(bytes.NewReader(bodyString)).Decode(&apiResp); err != nil {
		return err
	}

	// get stream list
	_, err = h.FetchYouTubeStreamList(accessToken, refreshToken)
	if err != nil {
		return err
	}

	return nil
}

func (h *YoutubeClient) getTokenSource(accessToken string, refreshToken string) oauth2.TokenSource {
	config := &oauth2.Config{
		ClientID:     h.Config.Youtube.ClientId,
		ClientSecret: h.Config.Youtube.ClientSecret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{"https://www.googleapis.com/auth/youtube"},
		RedirectURL:  h.Config.Youtube.RedirectURL,
	}
	token := &oauth2.Token{RefreshToken: refreshToken, AccessToken: accessToken}
	return config.TokenSource(context.Background(), token)
}

func (h *YoutubeClient) RefreshYouTubeAccessToken(refreshToken string) (string, string, string, error) {
	data := url.Values{}
	data.Set("client_id", h.Config.Youtube.ClientId)
	data.Set("client_secret", h.Config.Youtube.ClientSecret)
	data.Set("refresh_token", refreshToken)
	data.Set("grant_type", "refresh_token")

	resp, err := http.PostForm("https://oauth2.googleapis.com/token", data)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", err
	}

	var result struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		TokenType    string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", "", "", err
	}

	return result.AccessToken, result.RefreshToken, refreshToken, nil
}

func (h *YoutubeClient) FetchYouTubeStreamList(accessToken string, refreshToken string) (*LiveStreamListResponse, error) {
	req, _ := http.NewRequest("GET", "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet&part=cdn&part=contentDetails&part=status&mine=true&maxResults=1000", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := h.DoWithAutoRefresh(req, accessToken, refreshToken, func(newAccessToken string, newRefreshToken string, oldRefreshToken string) {
		fmt.Println("Updating token in DB for fetch youtube stream list", oldRefreshToken, newAccessToken, newRefreshToken)
		h.UpdateTokenInDB(oldRefreshToken, newAccessToken, newRefreshToken)
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var apiResp LiveStreamListResponse
	bodyString, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if err := json.NewDecoder(bytes.NewReader([]byte(string(bodyString)))).Decode(&apiResp); err != nil {
		return nil, err
	}
	if len(apiResp.Items) == 0 {
		return nil, nil
	}
	return &apiResp, nil
}

func (h *YoutubeClient) FindYoutubeStreamKey(accessToken string, refreshToken string, streamKey string) (string, error) {
	streamListResp, err := h.FetchYouTubeStreamList(accessToken, refreshToken)
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

func (h *YoutubeClient) Exchange(code string) (*oauth2.Token, error) {
	return h.YoutubeOauthConfig.Exchange(context.Background(), code)
}

func (h *YoutubeClient) AuthCodeURL(state string, accessType oauth2.AuthCodeOption) string {
	return h.YoutubeOauthConfig.AuthCodeURL(state, accessType)
}
