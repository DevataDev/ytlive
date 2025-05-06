package sign

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"
	"windsorf-youtube-live/internal/configuration"

	"github.com/imroc/req/v3"
)

type TokenManager struct {
	TokenConf  configuration.MsToken
	TtwidConf  configuration.Ttwid
	OdinTTConf configuration.OdinTT
	Proxies    configuration.Proxy
	HttpClient *req.Client
}

func NewTokenManager(config configuration.Config) *TokenManager {
	tiktokConf := config.TikTok

	client := req.NewClient().ImpersonateChrome()
	client.SetTimeout(10 * time.Second)
	client.SetUserAgent(tiktokConf.UserAgent)
	if tiktokConf.Proxy.Url != "" {
		client.SetProxyURL(tiktokConf.Proxy.Url)
	}

	return &TokenManager{
		TokenConf:  tiktokConf.MsToken,
		TtwidConf:  tiktokConf.Ttwid,
		OdinTTConf: tiktokConf.OdinTT,
		Proxies:    tiktokConf.Proxy,
		HttpClient: client,
	}
}

func ExtractStringMap(raw interface{}) map[string]string {
	result := make(map[string]string)
	if raw == nil {
		return result
	}
	for k, v := range raw.(map[string]interface{}) {
		result[k] = fmt.Sprintf("%v", v)
	}
	return result
}

func (tm *TokenManager) GenRealMsToken(userAgent string) string {
	payloadMap := map[string]interface{}{
		"magic":         tm.TokenConf.Magic,
		"version":       tm.TokenConf.Version,
		"dataType":      tm.TokenConf.DataType,
		"strData":       tm.TokenConf.StrData,
		"tspFromClient": time.Now().Unix(),
	}
	payload, _ := json.Marshal(payloadMap)

	req := tm.HttpClient.R()
	req.SetHeader("User-Agent", userAgent)
	req.SetHeader("Content-Type", "application/json")

	resp, err := req.SetBody(payload).Post(tm.TokenConf.Url)
	if err != nil {
		log.Println("Failed to request msToken:", err)
		return tm.GenFalseMsToken()
	}
	defer resp.Body.Close()

	for _, cookie := range resp.Cookies() {
		if cookie.Name == "msToken" {
			return cookie.Value
		}
	}

	log.Println("No msToken found in response, returning fake one")
	return tm.GenFalseMsToken()
}

func (tm *TokenManager) GenFalseMsToken() string {
	return RandStr(146) + "=="
}

func (tm *TokenManager) GenTtwid(cookie string) (string, error) {
	req := tm.HttpClient.R()
	req.SetHeader("Cookie", cookie)
	req.SetHeader("Content-Type", "text/plain")

	resp, err := req.SetBody(tm.TtwidConf.Data).Post(tm.TtwidConf.Url)
	if err != nil {
		return "", fmt.Errorf("ttwid request failed: %w", err)
	}
	defer resp.Body.Close()

	for _, c := range resp.Cookies() {
		if c.Name == "ttwid" {
			return c.Value, nil
		}
	}
	return "", errors.New("ttwid: validation failed, please update config")
}

func (tm *TokenManager) GenOdinTT() (string, error) {
	req := tm.HttpClient.R()
	resp, err := req.Get(tm.OdinTTConf.Url)
	if err != nil {
		return "", fmt.Errorf("odin_tt request failed: %w", err)
	}
	defer resp.Body.Close()

	for _, c := range resp.Cookies() {
		if c.Name == "odin_tt" {
			return c.Value, nil
		}
	}
	return "", errors.New("odin_tt: invalid response")
}

func RandStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	rand.Seed(time.Now().UnixNano())
	result := make([]byte, n)
	for i := range result {
		result[i] = letters[rand.Intn(len(letters))]
	}
	return string(result)
}
