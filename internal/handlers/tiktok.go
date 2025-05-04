package handlers

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
	"windsorf-youtube-live/internal/tiktok"

	"windsorf-youtube-live/internal/cache"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TiktokHandler struct {
	DB           *gorm.DB
	TikTokClient *tiktok.Client
	Cache        *cache.InMemoryCache
}

type SearchQueryResponse struct {
	Rooms    []tiktok.LiveRoomData `json:"rooms"`
	SearchID string                `json:"search_id"`
	Offset   int                   `json:"offset"`
	Limit    int                   `json:"limit"`
	Total    int                   `json:"total"`
	HasMore  bool                  `json:"has_more"`
}

func (h *TiktokHandler) GetRoomFromUser(c *gin.Context) {
	user := c.Query("user")
	if user == "" {
		c.JSON(400, gin.H{"error": "user is required"})
		return
	}

	roomID, err := h.TikTokClient.GetRoomIdFromUser(user)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"room_id": roomID})
}

func (h *TiktokHandler) GetRoomInfo(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	roomInfo, err := h.TikTokClient.GetRoomInfo(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, roomInfo)
}

func (h *TiktokHandler) CheckRoomIsAlive(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	isAlive, err := h.TikTokClient.CheckRoomIsAlive(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"is_alive": isAlive})
}

func (h *TiktokHandler) GetLiveUrl(c *gin.Context) {
	roomID := c.Query("room_id")
	if roomID == "" {
		c.JSON(400, gin.H{"error": "room_id is required"})
		return
	}

	liveUrl, err := h.TikTokClient.GetLiveUrl(roomID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	// how to decode \u0026
	liveUrl = strings.ReplaceAll(liveUrl, "\\u0026", "&")
	urlDecoded, err := url.QueryUnescape(liveUrl)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"live_url": urlDecoded})
}

func (h *TiktokHandler) GetLiveFeed(c *gin.Context) {
	offset := c.Query("offset")
	limit := c.Query("limit")
	if offset == "" {
		offset = "0"
	}
	if limit == "" {
		limit = "6"
	}
	// check in cache first
	feedRoomData, err := h.Cache.Get("live_feed")
	if err == nil {
		c.JSON(200, gin.H{"rooms": feedRoomData})
		return
	}

	feedRoomData, err = h.TikTokClient.GetLiveFeed()
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	// set cache
	h.Cache.Set("live_feed", feedRoomData, time.Now().Add(3*time.Minute))

	c.JSON(200, gin.H{"rooms": feedRoomData})
}

func (h *TiktokHandler) Search(c *gin.Context) {
	offset := c.Query("offset")
	limit := c.Query("limit")
	if offset == "" {
		offset = "0"
	}
	if limit == "" {
		limit = "6"
	}
	// get keyword from json request body
	var requestBody map[string]interface{}
	if err := c.ShouldBindJSON(&requestBody); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}
	keyword := requestBody["keyword"].(string)
	if keyword == "" {
		c.JSON(400, gin.H{"error": "keyword is required"})
		return
	}

	var searchId string
	if c.Query("search_id") != "" {
		searchId = c.Query("search_id")
	}

	// convert offset and limit to int
	offsetInt, _ := strconv.Atoi(offset)
	limitInt, _ := strconv.Atoi(limit)

	var searchQueryResponse SearchQueryResponse
	// check in cache first
	cacheKey := fmt.Sprintf("search_%s_%d_%d", keyword, offsetInt, limitInt)
	searchRoomData, err := h.Cache.Get(cacheKey)
	if err == nil {
		searchQueryResponse = searchRoomData.(SearchQueryResponse)
		c.JSON(200, gin.H{"rooms": searchQueryResponse.Rooms, "pagination": gin.H{"offset": searchQueryResponse.Offset, "limit": searchQueryResponse.Limit, "total": searchQueryResponse.Total, "has_more": searchQueryResponse.HasMore, "search_id": searchQueryResponse.SearchID}})
		return
	}

	searchRoomData, err = h.TikTokClient.Search(keyword, offsetInt, limitInt, searchId)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var rooms []tiktok.LiveRoomData
	for _, room := range searchRoomData.(*tiktok.SearchResponse).Data {
		rooms = append(rooms, room.LiveInfo.ParsedRawData)
	}
	searchResponse := searchRoomData.(*tiktok.SearchResponse)
	searchQueryResponse = SearchQueryResponse{
		Rooms:    rooms,
		SearchID: searchResponse.LogPb.ImprID,
		Offset:   offsetInt,
		Limit:    limitInt,
		Total:    searchResponse.Cursor,
		HasMore:  searchResponse.HasMore > 0,
	}
	// set cache
	h.Cache.Set(cacheKey, searchQueryResponse, time.Now().Add(3*time.Minute))

	c.JSON(200, gin.H{"rooms": rooms, "pagination": gin.H{"offset": searchQueryResponse.Offset, "limit": searchQueryResponse.Limit, "total": searchQueryResponse.Total, "has_more": searchQueryResponse.HasMore, "search_id": searchQueryResponse.SearchID}})
}
