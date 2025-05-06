package tiktok

import (
	"fmt"
	"io"
	"math/rand"
	"net/url"
	"strings"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/tiktok/sign"

	"github.com/imroc/req/v3"
)

type TikTokClientIface interface {
	GetRoomIdFromUser(username string) (string, error)
	GetRoomInfo(roomID string) (map[string]interface{}, error)
	CheckRoomIsAlive(roomID string) (bool, error)
	GetUserAgent() string
	ParseRoomInfoForLiveUrl(roomInfo map[string]interface{}) (string, error)
	GetRoomIdFromUserWithAPI(username string) (string, error)
}

type Client struct {
	httpClient       *req.Client
	userAgent        string
	region           string
	location         LocationPreset
	device           DevicePreset
	screen           ScreenPreset
	cookie           string
	lastRTT          string
	config           configuration.Config
	tokenManager     *sign.TokenManager
	signatureManager *sign.SignatureManager
	bogusManager     *sign.BogusManager
}

func NewClient(config configuration.Config) *Client {
	devicePreset := GetRandomDevicePreset()
	locationPreset, _ := GetLocationPreset("ID")
	screenPreset := GetRandomScreenPreset()
	lastRTT := fmt.Sprintf("%d", rand.Intn(100)+100)

	return &Client{
		httpClient:       req.ImpersonateChrome(),
		userAgent:        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		region:           "ID",
		location:         locationPreset,
		device:           devicePreset,
		screen:           screenPreset,
		cookie:           "",
		lastRTT:          lastRTT,
		config:           config,
		tokenManager:     sign.NewTokenManager(config),
		signatureManager: sign.NewSignatureManager(),
		bogusManager:     &sign.BogusManager{},
	}
}

func (c *Client) WithRegion(region string) *Client {
	c.region = strings.ToUpper(region)
	locationPreset, _ := GetLocationPreset(region)
	c.location = locationPreset
	return c
}

func (c *Client) WithUserAgent(userAgent string) *Client {
	c.userAgent = userAgent
	return c
}

func (c *Client) WithCookie(cookie string) *Client {
	c.cookie = cookie
	return c
}

func (c *Client) WithProxy(proxy string) *Client {
	c.httpClient.SetProxyURL(proxy)
	return c
}

func (c *Client) FormatUrl(baseUrl string, endpoint string, params map[string]string) string {
	var fullUrl string
	fullUrl = fmt.Sprintf("%s%s", baseUrl, endpoint)

	var queryParams = url.Values{}
	for key, value := range params {
		queryParams.Add(key, value)
	}

	fullUrl += "?" + queryParams.Encode()

	return fullUrl
}

func (c *Client) formatDefaultMinGetParams() map[string]string {
	return c.formatParams(minGetParams, map[string]string{
		"app_language": c.location.Lang,
	})
}

func (c *Client) formatDefaultGetParams() map[string]string {
	isLogin := "false"
	if c.cookie != "" {
		isLogin = "true"
	}
	return c.formatParams(defaultGETParams, map[string]string{
		"app_language":     c.location.Lang,
		"browser_language": c.location.Lang,
		"browser_name":     c.device.BrowserName,
		"browser_version":  c.device.BrowserVersion,
		"browser_platform": c.device.BrowserPlatform,
		"os":               c.device.OS,
		"screen_height":    fmt.Sprintf("%d", c.screen.ScreenHeight),
		"screen_width":     fmt.Sprintf("%d", c.screen.ScreenWidth),
		"tz_name":          c.location.TZName,
		"user_is_login":    isLogin,
	})
}

func (c *Client) formatDefaultWsClientParams() map[string]string {
	mergedParams := mergeMaps(defaultWsClientParams, defaultWsClientParamsAppend)
	return c.formatParams(mergedParams, map[string]string{
		"app_language":     c.location.Lang,
		"browser_language": c.location.Lang,
		"browser_name":     c.device.BrowserName,
		"browser_version":  c.device.BrowserVersion,
		"browser_platform": c.device.BrowserPlatform,
		"os":               c.device.OS,
		"screen_height":    fmt.Sprintf("%d", c.screen.ScreenHeight),
		"screen_width":     fmt.Sprintf("%d", c.screen.ScreenWidth),
		"tz_name":          c.location.TZName,
		"last_rtt":         c.lastRTT,
	})
}

func (c *Client) formatParams(params map[string]string, values map[string]string) map[string]string {
	// Make a copy of the map to avoid concurrent map access
	formattedParams := make(map[string]string, len(params))
	for key, value := range params {
		formattedParams[key] = value
	}
	// looping and replace %s with value
	for key, value := range formattedParams {
		if strings.Contains(value, "%s") {
			formattedParams[key] = strings.Replace(value, "%s", values[key], -1)
		}
	}
	return formattedParams
}

func (c *Client) formatRequestHeaders() map[string]string {
	var headers = defaultRequestHeaders
	// looping and replace %s with value
	for key, value := range headers {
		if strings.Contains(value, "%s") {
			headers[key] = strings.Replace(value, "%s", c.userAgent, -1)
		}
	}
	return headers
}

func (c *Client) SignUrl(url string, userAgent string) (string, string, string, error) {
	msToken := c.tokenManager.GenRealMsToken(userAgent)
	ttwid, _ := c.tokenManager.GenTtwid(c.cookie)
	odinTT, _ := c.tokenManager.GenOdinTT()
	signature := c.signatureManager.GenerateSignature(url, userAgent)

	newUrl := c.bogusManager.AppendQueryParams(url, map[string]string{
		"msToken": msToken,
	})

	xbStr, err := c.bogusManager.XbStrToEndpoint(userAgent, newUrl)
	if err != nil {
		return "", "", "", err
	}

	newUrl = c.bogusManager.AppendQueryParams(xbStr, map[string]string{
		"_signature": signature,
	})
	return newUrl, ttwid, odinTT, nil
}

func (c *Client) Get(url string, isSign bool) (*req.Response, error) {
	req := c.httpClient.R()
	req.SetHeaders(c.formatRequestHeaders())
	if c.cookie != "" {
		req.SetHeader("Cookie", c.cookie)
	}

	var signedUrl string

	if isSign {
		signedUrl, _, _, _ = c.SignUrl(url, c.userAgent)
	} else {
		signedUrl = url
	}

	return req.Get(signedUrl)
}

func (c *Client) Post(url string, body io.Reader, isSign bool) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	req := c.httpClient.R()
	req.SetHeaders(defaultRequestHeaders)
	if c.cookie != "" {
		req.SetHeader("Cookie", c.cookie)
	}

	var signedUrl string

	if isSign {
		signedUrl, _, _, _ = c.SignUrl(url, c.userAgent)
	} else {
		signedUrl = url
	}

	return req.SetBody(body).Post(signedUrl)
}

func (c *Client) Put(url string, body io.Reader) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	req := c.httpClient.R()
	req.SetHeaders(defaultRequestHeaders)
	if c.cookie != "" {
		req.SetHeader("Cookie", c.cookie)
	}

	return req.SetBody(body).Put(url)
}

func (c *Client) Delete(url string, isSign bool) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	req := c.httpClient.R()
	req.SetHeaders(defaultRequestHeaders)
	if c.cookie != "" {
		req.SetHeader("Cookie", c.cookie)
	}

	return req.Delete(url)
}

func (c *Client) Head(url string) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	req := c.httpClient.R()
	req.SetHeaders(defaultRequestHeaders)
	if c.cookie != "" {
		req.SetHeader("Cookie", c.cookie)
	}

	return req.Head(url)
}

func (c *Client) GetUserAgent() string {
	return c.userAgent
}

// Error represents a TikTok API error
type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *Error) Error() string {
	return e.Message
}
