package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/tiktok/sign"

	"github.com/gin-gonic/gin"
)

type TiktokSignRequest struct {
	Url       string `json:"url"`
	UserAgent string `json:"user_agent"`
}

type TiktokSignHandler struct {
	TokenManager     *sign.TokenManager
	BogusManager     *sign.BogusManager
	SignatureManager *sign.SignatureManager
	Cookie           string
}

func NewTiktokSignHandler(config *configuration.Config) *TiktokSignHandler {
	return &TiktokSignHandler{
		TokenManager:     sign.NewTokenManager(*config),
		BogusManager:     &sign.BogusManager{},
		SignatureManager: sign.NewSignatureManager(),
		Cookie:           config.TikTok.Cookie,
	}
}

func (h *TiktokSignHandler) Sign(c *gin.Context) {
	var req TiktokSignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	if req.Url == "" || req.UserAgent == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	msToken := h.TokenManager.GenRealMsToken(req.UserAgent)
	ttwid, _ := h.TokenManager.GenTtwid(h.Cookie)
	odinTT, _ := h.TokenManager.GenOdinTT()
	signature := h.SignatureManager.GenerateSignature(req.Url, req.UserAgent)

	newUrl := h.BogusManager.AppendQueryParams(req.Url, map[string]string{
		"msToken": msToken,
	})

	xbStr, err := h.BogusManager.XbStrToEndpoint(req.UserAgent, newUrl)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to generate endpoint",
		})
		return
	}

	// newUrl := req.Url

	// newUrl = removeQueryParams(newUrl, []string{"X-Bogus", "_signature", "ms_token", "X-Gnarly"})

	// msToken := h.TokenManager.GenRealMsToken(req.UserAgent)
	// ttwid, _ := h.TokenManager.GenTtwid(h.Cookie)
	// odinTT, _ := h.TokenManager.GenOdinTT()
	// verifyFp := h.GenerateVerifyFp()
	// newUrl = fmt.Sprintf("%s&ms_token=%s&verifyFp=%s", endpoint, msToken, verifyFp)
	fmt.Println("signature", signature)
	newUrl = h.BogusManager.AppendQueryParams(xbStr, map[string]string{
		"_signature": signature,
	})

	c.JSON(http.StatusOK, gin.H{
		"msToken":   msToken,
		"ttwid":     ttwid,
		"odinTT":    odinTT,
		"signature": signature,
		"url":       newUrl,
		"success":   true,
		"message":   "Sign success",
	})
}

func removeQueryParams(destinationUrl string, params []string) string {
	// mustRemoveParams := []string{"X-Bogus", "X-Gnarly", "msToken"}

	parsedUrl, err := url.Parse(destinationUrl)
	if err != nil {
		return destinationUrl
	}

	for _, param := range params {
		parsedUrl.Query().Del(param)
	}

	return parsedUrl.String()
}

func (h *TiktokSignHandler) GenerateVerifyFp() string {
	// You can uncomment this line to always return a fixed token
	// return "verify_5b161567bda98b6a50c0414d99909d4b"

	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	e := len(chars)

	// base36-encoded timestamp
	now := time.Now().UnixNano() / int64(time.Millisecond)
	_ = strings.ToLower(fmt.Sprintf("%x", now)) // base16
	n36 := strconv.FormatInt(now, 36)           // base36 string

	r := make([]string, 36)
	r[8] = "_"
	r[13] = "_"
	r[18] = "_"
	r[23] = "_"
	r[14] = "4"

	for i := 0; i < 36; i++ {
		if r[i] != "" {
			continue
		}
		idx := rand.Intn(e)
		if i == 19 {
			idx = (rand.Intn(4) | 8) & 0xf // set bits: 8, 9, 10, or 11
		}
		r[i] = string(chars[idx])
	}

	return "verify_" + n36 + "_" + strings.Join(r, "")
}
