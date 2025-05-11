package workers

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"sync"
	"time"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"github.com/oklog/ulid/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"gorm.io/gorm"
)

type RefresherTokenWorker struct {
	YoutubeOAuthConfig *oauth2.Config
	DB                 *gorm.DB
	QueueLock          sync.Mutex
}

func NewRefresherTokenWorker(cfg *configuration.Config, db *gorm.DB) *RefresherTokenWorker {
	return &RefresherTokenWorker{
		YoutubeOAuthConfig: &oauth2.Config{
			ClientID:     cfg.Youtube.ClientId,
			ClientSecret: cfg.Youtube.ClientSecret,
			Scopes:       []string{"https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/userinfo.email"},
			Endpoint:     google.Endpoint,
		},
		DB: db,
	}
}

func (w *RefresherTokenWorker) Run() {
	log.Println("RefresherTokenWorker is running")
	for {
		var channels []models.Channels
		// find channels where refresh_token is not null and refresh_token is not empty
		w.DB.Where("refresh_token IS NOT NULL AND refresh_token != ''").Find(&channels)
		for _, channel := range channels {
			if channel.ExpiresAt != nil {
				gapBeetweenExpiresAtInSeconds := time.Until(*channel.ExpiresAt).Seconds()
				minutesGap := gapBeetweenExpiresAtInSeconds / 60
				if minutesGap > 10 {
					continue
				}
			}
			w.QueueLock.Lock()
			log.Println("Refreshing token for channel", channel.ID)
			data := url.Values{}
			data.Set("client_id", w.YoutubeOAuthConfig.ClientID)
			data.Set("client_secret", w.YoutubeOAuthConfig.ClientSecret)
			data.Set("refresh_token", *channel.RefreshToken)
			data.Set("grant_type", "refresh_token")

			resp, err := http.PostForm("https://oauth2.googleapis.com/token", data)
			if err != nil {
				log.Println("Failed to refresh token for channel", channel.ID, err)
				// need unlock ?
				w.QueueLock.Unlock()
				continue
			}
			defer resp.Body.Close()
			body, err := ioutil.ReadAll(resp.Body)
			log.Println(string(body))
			if err != nil {
				log.Println("Failed to read response body for channel", channel.ID, err)
				// need unlock ?
				w.QueueLock.Unlock()
				continue
			}
			var result struct {
				AccessToken  string  `json:"access_token"`
				RefreshToken *string `json:"refresh_token"`
				ExpiresIn    int     `json:"expires_in"`
				TokenType    string  `json:"token_type"`
			}
			if err := json.Unmarshal(body, &result); err != nil {
				log.Println("Failed to unmarshal response body for channel", channel.ID, err)
				// need unlock ?
				w.QueueLock.Unlock()
				continue
			}
			if result.AccessToken == "" {
				log.Println("Failed to refresh token for channel", channel.ID, "access token is empty")
				// need unlock ?
				w.QueueLock.Unlock()
				continue
			}
			if result.RefreshToken != nil && *result.RefreshToken != "" && *result.RefreshToken != *channel.RefreshToken {
				channel.RefreshToken = result.RefreshToken
			}

			log.Println(result)

			newExpires := time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)
			channel.ExpiresAt = &newExpires
			channel.AccessToken = &result.AccessToken
			if channel.ID == "" {
				entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
				ms := ulid.Timestamp(time.Now())
				id, _ := ulid.New(ms, entropy)
				channel.ID = id.String()
			}
			// update expires_at
			if err := w.DB.Save(&channel).Error; err != nil {
				log.Println("Failed to update channel", channel.ID, "access token and expires at", err)
				// need unlock ?
				w.QueueLock.Unlock()
				continue
			}
			log.Println("Refreshed token for channel", channel.ID, " with new access token", result.AccessToken, " and expires at", newExpires)
			w.QueueLock.Unlock()
		}
		time.Sleep(60 * time.Second)
	}
}
