package tiktok

import (
	"io"
	"strings"

	"github.com/imroc/req/v3"
)

const (
	WebcastURL = "https://webcast.tiktok.com"
	BaseURL    = "https://www.tiktok.com"
)

type TikTokClientIface interface {
	GetRoomIdFromUser(username string) (string, error)
	GetRoomInfo(roomID string) (map[string]interface{}, error)
	CheckRoomIsAlive(roomID string) (bool, error)
	GetUserAgent() string
	ParseRoomInfoForLiveUrl(roomInfo map[string]interface{}) (string, error)
}

type Client struct {
	httpClient *req.Client
	userAgent  string
	region     string
	cookie     string
}

func NewClient() *Client {
	return &Client{
		httpClient: req.NewClient().ImpersonateChrome(),
		userAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
		region:     "US",
		cookie:     "",
	}
}

func (c *Client) WithRegion(region string) *Client {
	c.region = strings.ToUpper(region)
	return c
}

func (c *Client) WithUserAgent(userAgent string) *Client {
	c.userAgent = userAgent
	return c
}

func (c *Client) WithHttpClient(httpClient *req.Client) *Client {
	c.httpClient = httpClient
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

func (c *Client) Get(url string) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	if c.cookie != "" {
		c.httpClient.SetCommonHeader("Cookie", c.cookie)
	}

	c.httpClient.ImpersonateChrome()

	c.httpClient.SetCommonHeader("Accept", "application/json")
	c.httpClient.SetCommonHeader("Accept-Language", "en-US")
	c.httpClient.SetCommonHeader("Accept-Encoding", "gzip, deflate, br")
	c.httpClient.SetCommonHeader("Connection", "keep-alive")
	c.httpClient.SetCommonHeader("Referer", "https://www.tiktok.com/")
	c.httpClient.SetCommonHeader("Origin", "https://www.tiktok.com")

	return c.httpClient.R().Get(url)
}

func (c *Client) Post(url string, body io.Reader) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	if c.cookie != "" {
		c.httpClient.SetCommonHeader("Cookie", c.cookie)
	}

	c.httpClient.SetCommonHeader("Content-Type", "application/json")
	c.httpClient.SetCommonHeader("Accept", "application/json")
	c.httpClient.SetCommonHeader("Accept-Language", "en-US")
	c.httpClient.SetCommonHeader("Accept-Encoding", "gzip, deflate, br")
	c.httpClient.SetCommonHeader("Connection", "keep-alive")
	c.httpClient.SetCommonHeader("Referer", "https://www.tiktok.com/")
	c.httpClient.SetCommonHeader("Origin", "https://www.tiktok.com")

	// Set body

	return c.httpClient.R().SetBody(body).Post(url)
}

func (c *Client) Put(url string, body io.Reader) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	if c.cookie != "" {
		c.httpClient.SetCommonHeader("Cookie", c.cookie)
	}

	c.httpClient.SetCommonHeader("Content-Type", "application/json")
	c.httpClient.SetCommonHeader("Accept", "application/json")
	c.httpClient.SetCommonHeader("Accept-Language", "en-US")
	c.httpClient.SetCommonHeader("Accept-Encoding", "gzip, deflate, br")
	c.httpClient.SetCommonHeader("Connection", "keep-alive")
	c.httpClient.SetCommonHeader("Referer", "https://www.tiktok.com/")
	c.httpClient.SetCommonHeader("Origin", "https://www.tiktok.com")

	// Set body

	return c.httpClient.R().SetBody(body).Put(url)
}

func (c *Client) Delete(url string) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	if c.cookie != "" {
		c.httpClient.SetCommonHeader("Cookie", c.cookie)
	}

	c.httpClient.SetCommonHeader("Content-Type", "application/json")
	c.httpClient.SetCommonHeader("Accept", "application/json")
	c.httpClient.SetCommonHeader("Accept-Language", "en-US")
	c.httpClient.SetCommonHeader("Accept-Encoding", "gzip, deflate, br")
	c.httpClient.SetCommonHeader("Connection", "keep-alive")
	c.httpClient.SetCommonHeader("Referer", "https://www.tiktok.com/")
	c.httpClient.SetCommonHeader("Origin", "https://www.tiktok.com")

	return c.httpClient.R().Delete(url)
}

func (c *Client) Head(url string) (*req.Response, error) {
	c.httpClient.SetUserAgent(c.userAgent)
	if c.cookie != "" {
		c.httpClient.SetCommonHeader("Cookie", c.cookie)
	}

	c.httpClient.SetCommonHeader("Content-Type", "application/json")
	c.httpClient.SetCommonHeader("Accept", "application/json")
	c.httpClient.SetCommonHeader("Accept-Language", "en-US")
	c.httpClient.SetCommonHeader("Accept-Encoding", "gzip, deflate, br")
	c.httpClient.SetCommonHeader("Connection", "keep-alive")
	c.httpClient.SetCommonHeader("Referer", "https://www.tiktok.com/")
	c.httpClient.SetCommonHeader("Origin", "https://www.tiktok.com")

	return c.httpClient.R().Head(url)
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
