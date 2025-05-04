package tiktok

import (
	"encoding/json"
	"fmt"
)

type SearchResponse struct {
	StatusCode int `json:"status_code"`
	Data       []struct {
		LiveInfo struct {
			RawData  string `json:"raw_data"`
			RoomInfo struct {
				HasCommerceGoods bool `json:"has_commerce_goods"`
				IsBattle         bool `json:"is_battle"`
			} `json:"room_info"`
			ParsedRawData LiveRoomData `json:"-"`
		} `json:"live_info"`
	} `json:"data"`
	HasMore int `json:"has_more"`
	Cursor  int `json:"cursor"`
	Extra   struct {
		Now             int64         `json:"now"`
		Logid           string        `json:"logid"`
		FatalItemIds    []interface{} `json:"fatal_item_ids"`
		SearchRequestID string        `json:"search_request_id"`
		APIDebugInfo    interface{}   `json:"api_debug_info"`
	} `json:"extra"`
	LogPb struct {
		ImprID string `json:"impr_id"`
	} `json:"log_pb"`
	Backtrace string `json:"backtrace"`
}

func (l *SearchResponse) ParseRawData() {
	var parsedRawData LiveRoomData
	for i := range l.Data {
		if err := json.Unmarshal([]byte(l.Data[i].LiveInfo.RawData), &parsedRawData); err != nil {
			return
		}
		l.Data[i].LiveInfo.ParsedRawData = parsedRawData
	}
}

type LiveRoomData struct {
	Id            int64  `json:"id"`
	IdStr         string `json:"id_str"`
	Status        int    `json:"status"`
	OwnerUserId   int64  `json:"owner_user_id"`
	Title         string `json:"title"`
	UserCount     int    `json:"user_count"`
	OsType        int    `json:"os_type"`
	ClientVersion int    `json:"client_version"`
	Cover         struct {
		UrlList  []string `json:"url_list"`
		Uri      string   `json:"uri"`
		AvgColor string   `json:"avg_color"`
	} `json:"cover"`
	StreamUrl struct {
		RtmpPullUrl string `json:"rtmp_pull_url"`
		FlvPullUrl  struct {
			FULL_HD1 string `json:"FULL_HD1"`
			HD1      string `json:"HD1"`
			SD1      string `json:"SD1"`
			SD2      string `json:"SD2"`
		} `json:"flv_pull_url"`
		CandidateResolution []string `json:"candidate_resolution"`
		FlvPullUrlParams    struct {
			FULL_HD1 string `json:"FULL_HD1"`
			HD1      string `json:"HD1"`
			SD1      string `json:"SD1"`
			SD2      string `json:"SD2"`
		} `json:"flv_pull_url_params"`
		LiveCoreSdkData struct {
			PullData struct {
				StreamData string `json:"stream_data"`
			} `json:"pull_data"`
		} `json:"live_core_sdk_data"`
	} `json:"stream_url"`
	LiveStats struct {
		TotalUser    int `json:"total_user"`
		EnterCount   int `json:"enter_count"`
		CommentCount int `json:"comment_count"`
	} `json:"stats"`
	Owner struct {
		UserId    int64  `json:"user_id"`
		SecUid    string `json:"sec_uid"`
		DisplayId string `json:"display_id"`
		Avatar    struct {
			UrlList  []string `json:"url_list"`
			Uri      string   `json:"uri"`
			AvgColor string   `json:"avg_color"`
		} `json:"avatar"`
	} `json:"owner"`
	StartTime int `json:"start_time"`
	LikeCount int `json:"like_count"`
	Hashtag   struct {
		Id    int    `json:"id"`
		Title string `json:"title"`
		Image struct {
			UrlList  []string `json:"url_list"`
			Uri      string   `json:"uri"`
			AvgColor string   `json:"avg_color"`
		} `json:"image"`
	} `json:"hashtag"`
	GameTag []struct {
		Id    int    `json:"id"`
		Title string `json:"title"`
	} `json:"game_tag"`
	CoverType int `json:"cover_type"`
	SubTag    int `json:"sub_tag"`
}

func (c *Client) Search(query string, offset int, limit int) (*SearchResponse, error) {
	queryParams := c.formatDefaultGetParams()
	queryParams["keyword"] = query
	queryParams["offset"] = fmt.Sprintf("%d", offset)
	queryParams["history_len"] = fmt.Sprintf("%d", limit)
	queryParams["count"] = fmt.Sprintf("%d", 20)
	queryParams["web_search_code"] = `{"tiktok":{"client_params_x":{"search_engine":{"ies_mt_user_live_video_card_use_libra":1,"mt_search_general_user_live_card":1}},"search_server":{}}}`
	queryParams["webcast_language"] = c.location.Lang

	url := c.FormatUrl(tiktokAppURL, urlSearch, queryParams)
	fmt.Println("Search URL:", url)

	resp, err := c.Get(url, false)
	if err != nil {
		return nil, err
	}

	reader := parseBody(resp)
	defer reader.Close()

	var searchResponse SearchResponse
	if err := json.NewDecoder(reader).Decode(&searchResponse); err != nil {
		fmt.Println(`Failed to decode search response for`, query, `with error`, err)
		return nil, err
	}

	searchResponse.ParseRawData()

	return &searchResponse, nil
}
