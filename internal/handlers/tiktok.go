package handlers

import (
	"fmt"
	"log"
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

type FeedQueryResponse struct {
	Rooms    []tiktok.FeedRoomData `json:"rooms"`
	SearchID string                `json:"search_id"`
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

	offsetInt, _ := strconv.Atoi(offset)
	limitInt, _ := strconv.Atoi(limit)
	if offsetInt < 0 || limitInt < 0 {
		c.JSON(500, gin.H{"error": "offset and limit must be greater than 0"})
		return
	}

	isLoadMore := c.Query("is_load_more")
	var wrappedFeed *tiktok.WrappedFeedResponse
	var feedRoomData []tiktok.FeedRoomData
	var err error

	cacheKey := fmt.Sprintf("live_feed_%d_%d", offsetInt, limitInt)
	// check in cache first
	if isLoadMore != "true" {
		cacheData, err := h.Cache.Get(cacheKey)
		if err == nil {
			feedQueryResponse := cacheData.(FeedQueryResponse)
			c.JSON(200, gin.H{"rooms": feedQueryResponse.Rooms, "pagination": gin.H{"total": feedQueryResponse.Total, "has_more": feedQueryResponse.HasMore, "search_id": feedQueryResponse.SearchID}})
			return
		}
	} else {
		cacheData, err := h.Cache.Get("live_feed")
		if err == nil {
			feedQueryResponse := cacheData.(FeedQueryResponse)
			feedRoomData = feedQueryResponse.Rooms
		}
	}

	wrappedFeed, err = h.TikTokClient.GetLiveFeed(isLoadMore == "true")
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if isLoadMore == "true" {
		feedRoomData = append(feedRoomData, wrappedFeed.Rooms...)
	} else {
		feedRoomData = wrappedFeed.Rooms
	}

	feedQueryResponse := FeedQueryResponse{
		Rooms:    feedRoomData,
		SearchID: wrappedFeed.SearchID,
		Total:    wrappedFeed.Total,
		HasMore:  wrappedFeed.HasMore,
	}

	// set cache
	h.Cache.Set(cacheKey, feedQueryResponse, time.Now().Add(3*time.Minute))

	c.JSON(200, gin.H{"rooms": feedRoomData, "pagination": gin.H{"total": wrappedFeed.Total, "has_more": wrappedFeed.HasMore, "search_id": wrappedFeed.SearchID, "req_from": wrappedFeed.ReqFrom}})
}

func (h *TiktokHandler) Search(c *gin.Context) {
	offset := c.Query("offset")
	limit := c.Query("limit")
	page := c.Query("page")

	if offset == "" {
		offset = "0"
	}
	if limit == "" {
		limit = "12"
	}

	if page != "" {
		pageInt, _ := strconv.Atoi(page)
		offset = fmt.Sprintf("%d", (pageInt-1)*12)
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
	searchId, ok := requestBody["search_id"].(string)
	if !ok {
		searchId = ""
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

	searchRoomData, err = h.TikTokClient.SearchLive(keyword, offsetInt, limitInt, searchId)
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

func (h *TiktokHandler) GetSearch(c *gin.Context) {
	keyword := c.Query("query")
	if keyword == "" {
		c.JSON(400, gin.H{"error": "query is required"})
		return
	}

	limit := 20
	offset := 0

	page := c.Query("page")
	if page == "" {
		page = "1"
	}

	offsetQuery := c.Query("offset")
	if offsetQuery != "" {
		offset, _ = strconv.Atoi(offsetQuery)
	}

	limitQuery := c.Query("limit")
	if limitQuery != "" {
		limit, _ = strconv.Atoi(limitQuery)
	}

	loadMore := c.Query("is_load_more")
	if loadMore == "" {
		loadMore = "false"
	}

	searchType := c.Query("type")
	if searchType == "" {
		searchType = "user"
	}

	if loadMore == "true" {
		if offsetQuery == "" || limitQuery == "" {
			pageInt, _ := strconv.Atoi(page)
			offset = (pageInt - 1) * limit
		}
	}

	searchId := c.Query("search_id")
	if searchId == "" {
		searchId = ""
	}

	var searchQueryResponse SearchQueryResponse
	// check in cache first
	log.Println("search_id: ", searchId)
	log.Println("load_more: ", loadMore)
	log.Println("search_type: ", searchType)
	log.Println("offset: ", offset)
	log.Println("limit: ", limit)
	log.Println("keyword: ", keyword)
	cacheKey := fmt.Sprintf("search_%s_%d_%d", keyword, offset, limit)
	searchRoomData, err := h.Cache.Get(cacheKey)
	if err == nil {
		searchQueryResponse = searchRoomData.(SearchQueryResponse)
		c.JSON(200, gin.H{"rooms": searchQueryResponse.Rooms, "pagination": gin.H{"offset": searchQueryResponse.Offset, "limit": searchQueryResponse.Limit, "total": searchQueryResponse.Total, "has_more": searchQueryResponse.HasMore, "search_id": searchQueryResponse.SearchID}})
		return
	}

	if searchType == "user" {
		searchRoomData, err = h.TikTokClient.SearchLive(keyword, offset, limit, searchId)
	} else {
		searchRoomData, err = h.TikTokClient.SearchLive(keyword, offset, limit, searchId)
	}
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
		Offset:   offset,
		Limit:    limit,
		Total:    searchResponse.Cursor,
		HasMore:  searchResponse.HasMore > 0,
	}
	// set cache
	h.Cache.Set(cacheKey, searchQueryResponse, time.Now().Add(3*time.Minute))

	c.JSON(200, gin.H{"rooms": searchQueryResponse.Rooms, "pagination": gin.H{"offset": searchQueryResponse.Offset, "limit": searchQueryResponse.Limit, "total": searchQueryResponse.Total, "has_more": searchQueryResponse.HasMore, "search_id": searchQueryResponse.SearchID}})
}

func (h *TiktokHandler) GetSuggestedFeed(c *gin.Context) {
	// check in cache first
	isLoadMore := c.Query("is_load_more")
	var feedRoomData []tiktok.FeedRoomData

	if isLoadMore != "true" {
		cacheData, err := h.Cache.Get("suggested_feed")
		if err == nil {
			feedQueryResponse := cacheData.(FeedQueryResponse)
			c.JSON(200, gin.H{"rooms": feedQueryResponse.Rooms, "pagination": gin.H{"total": feedQueryResponse.Total, "has_more": feedQueryResponse.HasMore, "search_id": feedQueryResponse.SearchID}})
			return
		}
	} else {
		cacheData, err := h.Cache.Get("suggested_feed")
		feedQueryResponse := cacheData.(FeedQueryResponse)
		if err == nil {
			feedRoomData = feedQueryResponse.Rooms
		}
	}

	wrappedFeed, err := h.TikTokClient.GetSuggestedFeed(isLoadMore == "true")
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	if isLoadMore == "true" {
		feedRoomData = append(feedRoomData, wrappedFeed.Rooms...)
	}

	for _, room := range wrappedFeed.Rooms {
		room.LiveURL = room.GetLiveURL()
		feedRoomData = append(feedRoomData, room)
	}

	feedQueryResponse := FeedQueryResponse{
		Rooms:    feedRoomData,
		SearchID: wrappedFeed.SearchID,
		Total:    wrappedFeed.Total,
		HasMore:  wrappedFeed.HasMore,
	}

	// set cache
	h.Cache.Set("suggested_feed", feedQueryResponse, time.Now().Add(3*time.Minute))

	c.JSON(200, gin.H{"rooms": feedRoomData, "pagination": gin.H{"total": feedQueryResponse.Total, "has_more": feedQueryResponse.HasMore, "search_id": feedQueryResponse.SearchID}})

}
