package tiktok

import (
	"encoding/json"
	"fmt"
	"io"
)

//Live Tab
// https://webcast.tiktok.com/webcast/feed/?aid=1988&app_language=en-GB&app_name=tiktok_web&browser_language=en-GB&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F135.0.0.0%20Safari%2F537.36&channel=tiktok_web&channel_id=87&cookie_enabled=true&data_collection_enabled=true&device_id=7489764569449072136&device_platform=web_pc&device_type=web_h265&focus_state=true&from_page=&history_len=5&is_fullscreen=false&is_non_personalized=0&is_page_visible=true&max_time=0&os=mac&priority_region=SG&referer=https%3A%2F%2Fwww.tiktok.com%2Fen-GB&region=ID&req_from=live_mt_pc_web_rec_tab_refresh&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fforyou&screen_height=1169&screen_width=1800&tz_name=Asia%2FSingapore&webcast_language=en-GB&msToken=2YYn0opvdjd9Z6XNm3Ip8cfKILspCqz-aCqDO5Q2ZqPIHkODyWAM4COhlLUaFGOEI0nGUfJcwnjosiVCz6WZboFFn9wkZVaiNYtFkeBf2HSUSc5lzCBFbbWStsDEXrD0zZzokAn56hUPftOzV31-QA6_&X-Bogus=DFSzswVOjoxANcmRCc/Q4GlUrnMC&X-Gnarly=M5C7-wGTTX5ljyOxxRmraNog-qMePBcatZUIJeRiuCTWaI7a47FrgaqyglrJ8KuYHM/QkaVlBV0wwpBLm9ONzVHTpGpucygq1Te8-N34q9pYUpg7PkfDKE8of9LFYb2y6YhnavTKUkZtHNVaYrHpK7xiuSDX4BtzP71hiQlW8Imj2Nfv10hXbC8F4vLKt/80Zvkbhd2xdarr50PYIGfTb6pyiy-eBNrHo2G4NawwEKnRE/7V14dcnhViCLUptwRQBBvMb3mw0NqS

// Explore
// https://www.tiktok.com/api/explore/item_list/?WebIdLastTime=1743846712&aid=1988&app_language=en-GB&app_name=tiktok_web&browser_language=en-GB&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=5.0%20%28Macintosh%3B%20Intel%20Mac%20OS%20X%2010_15_7%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F135.0.0.0%20Safari%2F537.36&categoryType=120&channel=tiktok_web&clientABVersions=71960613%2C70508271%2C72437276%2C73343441%2C73356773%2C73464036%2C73558921%2C73563783%2C73607176%2C73635176%2C73639823%2C73641235%2C73650548%2C73686099%2C73692431%2C73699598%2C73700822%2C73723489%2C73736860%2C73739073%2C73759868%2C73798193%2C73811265%2C70138197%2C70156809%2C70405643%2C71057832%2C71200802%2C71381811%2C71516509%2C71803300%2C71962127%2C72360691%2C72408100%2C72854054%2C72892778%2C73004916%2C73171280%2C73208420%2C73385640%2C73574728%2C73628214&cookie_enabled=true&count=16&data_collection_enabled=true&device_id=7489764569449072136&device_platform=web_pc&focus_state=true&from_page=&history_len=7&is_fullscreen=false&is_page_visible=true&language=en&os=mac&priority_region=SG&referer=https%3A%2F%2Fwww.tiktok.com%2Flive&region=ID&root_referer=https%3A%2F%2Fwww.tiktok.com%2Fforyou&screen_height=1169&screen_width=1800&tz_name=Asia%2FSingapore&webcast_language=en-GB

type FeedResponse struct {
	StatusCode int `json:"status_code"`
	Extra      struct {
		LogPb struct {
			ImprID    string `json:"impr_id"`
			SessionID int64  `json:"session_id"`
		} `json:"log_pb"`
		HasMore bool  `json:"has_more"`
		Cost    int   `json:"cost"`
		MaxTime int64 `json:"max_time"`
		Total   int   `json:"total"`
		Banner  struct {
		} `json:"banner"`
		UnreadExtra string `json:"unread_extra"`
		Now         int64  `json:"now"`
	} `json:"extra"`
	RoomFeedData []struct {
		Type       int          `json:"type"`
		Rid        string       `json:"rid"`
		Data       FeedRoomData `json:"data"`
		LiveReason string       `json:"live_reason"`
		FlareInfo  struct {
		} `json:"flare_info"`
		SortStatsTags struct {
			ForAppLog []struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			} `json:"for_app_log"`
			ForClientFunc []struct {
				Key string `json:"key"`
			} `json:"for_client_func"`
		} `json:"sort_stats_tags"`
		RoomEventTracking string `json:"room_event_tracking"`
	} `json:"data"`
}

type FeedRoomData struct {
	ID            int64  `json:"id"`
	IDStr         string `json:"id_str"`
	Status        int    `json:"status"`
	OwnerUserID   int64  `json:"owner_user_id"`
	Title         string `json:"title"`
	UserCount     int    `json:"user_count"`
	OsType        int    `json:"os_type"`
	ClientVersion int    `json:"client_version"`
	Cover         struct {
		URLList  []string `json:"url_list"`
		URI      string   `json:"uri"`
		Height   int      `json:"height"`
		Width    int      `json:"width"`
		AvgColor string   `json:"avg_color"`
	} `json:"cover"`
	StreamURL struct {
		RtmpPullURL string `json:"rtmp_pull_url"`
		FlvPullURL  struct {
			HD1     string `json:"HD1"`
			FULLHD1 string `json:"FULL_HD1"`
			SD2     string `json:"SD2"`
			SD1     string `json:"SD1"`
		} `json:"flv_pull_url"`
		FlvPullURLParams struct {
			HD1     string `json:"HD1"`
			FULLHD1 string `json:"FULL_HD1"`
			SD2     string `json:"SD2"`
			SD1     string `json:"SD1"`
		} `json:"flv_pull_url_params"`
		LiveCoreSdkData struct {
			PullData struct {
				StreamData string `json:"stream_data"`
				Options    struct {
					DefaultQuality struct {
						Name   string `json:"name"`
						SdkKey string `json:"sdk_key"`
					} `json:"default_quality"`
				} `json:"options"`
			} `json:"pull_data"`
		} `json:"live_core_sdk_data"`
		StreamSizeWidth  int `json:"stream_size_width"`
		StreamSizeHeight int `json:"stream_size_height"`
	} `json:"stream_url"`
	Stats struct {
		TotalUser    int `json:"total_user"`
		EnterCount   int `json:"enter_count"`
		CommentCount int `json:"comment_count"`
	} `json:"stats"`
	FeedRoomLabel struct {
		URLList  []string `json:"url_list"`
		URI      string   `json:"uri"`
		AvgColor string   `json:"avg_color"`
	} `json:"feed_room_label"`
	Owner struct {
		ID          int64  `json:"id"`
		Nickname    string `json:"nickname"`
		AvatarThumb struct {
			URLList []string `json:"url_list"`
			URI     string   `json:"uri"`
		} `json:"avatar_thumb"`
		AvatarMedium struct {
			URLList []string `json:"url_list"`
			URI     string   `json:"uri"`
		} `json:"avatar_medium"`
		AvatarLarge struct {
			URLList []string `json:"url_list"`
			URI     string   `json:"uri"`
		} `json:"avatar_large"`
		Status     int `json:"status"`
		ModifyTime int `json:"modify_time"`
		FollowInfo struct {
			FollowingCount int `json:"following_count"`
			FollowerCount  int `json:"follower_count"`
		} `json:"follow_info"`
		PayGrade struct {
		} `json:"pay_grade"`
		UserAttr struct {
		} `json:"user_attr"`
		OwnRoom struct {
			RoomIds    []int64  `json:"room_ids"`
			RoomIdsStr []string `json:"room_ids_str"`
		} `json:"own_room"`
		LinkMicStats int    `json:"link_mic_stats"`
		DisplayID    string `json:"display_id"`
		SecUID       string `json:"sec_uid"`
		IDStr        string `json:"id_str"`
	} `json:"owner"`
	RoomAuth struct {
		Chat                bool `json:"Chat"`
		Gift                bool `json:"Gift"`
		LuckMoney           bool `json:"LuckMoney"`
		Digg                bool `json:"Digg"`
		UserCard            bool `json:"UserCard"`
		Banner              int  `json:"Banner"`
		Landscape           int  `json:"Landscape"`
		PublicScreen        int  `json:"PublicScreen"`
		GiftAnchorMt        int  `json:"GiftAnchorMt"`
		DonationSticker     int  `json:"DonationSticker"`
		InteractionQuestion bool `json:"InteractionQuestion"`
		ChatL2              bool `json:"ChatL2"`
		Viewers             bool `json:"Viewers"`
		Share               bool `json:"Share"`
		TransactionHistory  int  `json:"transaction_history"`
		UserCount           int  `json:"UserCount"`
		Rank                int  `json:"Rank"`
		BroadcastMessage    int  `json:"BroadcastMessage"`
	} `json:"room_auth"`
	LikeCount     int `json:"like_count"`
	AnchorTabType int `json:"anchor_tab_type"`
	CommerceInfo  struct {
	} `json:"commerce_info"`
	InteractionQuestionVersion int `json:"interaction_question_version"`
	StreamURLFilteredInfo      struct {
	} `json:"stream_url_filtered_info"`
	BlurredCover struct {
		URLList  []string `json:"url_list"`
		URI      string   `json:"uri"`
		Height   int      `json:"height"`
		Width    int      `json:"width"`
		AvgColor string   `json:"avg_color"`
	} `json:"blurred_cover"`
	TaxonomyTagInfo struct {
		Level1Tag []string `json:"level1_tag"`
		Level2Tag string   `json:"level2_tag"`
	} `json:"taxonomy_tag_info"`
}

func (c *Client) GetLiveFeed() ([]FeedRoomData, error) {
	queryParams := c.formatDefaultGetParams()
	queryParams["req_from"] = fromLiveTab
	queryParams["channel_id"] = "87"

	url := c.FormatUrl(webcastURL, urlFeed, queryParams)
	data, err := c.Get(url, true)
	if err != nil {
		return nil, err
	}

	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var feedResponse FeedResponse
	if err := json.Unmarshal(body, &feedResponse); err != nil {
		return nil, err
	}

	var feedRoomData []FeedRoomData
	for _, room := range feedResponse.RoomFeedData {
		feedRoomData = append(feedRoomData, room.Data)
	}

	fmt.Println("Feed Room Data:", feedRoomData)

	return feedRoomData, nil
}

func (c *Client) GetFollowingFeed() ([]FeedRoomData, error) {
	queryParams := c.formatDefaultGetParams()
	queryParams["req_from"] = fromFollowingTab

	url := c.FormatUrl(webcastURL, urlFeed, queryParams)
	data, err := c.Get(url, true)
	if err != nil {
		return nil, err
	}

	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var feedResponse FeedResponse
	if err := json.Unmarshal(body, &feedResponse); err != nil {
		return nil, err
	}

	var feedRoomData []FeedRoomData
	for _, room := range feedResponse.RoomFeedData {
		feedRoomData = append(feedRoomData, room.Data)
	}

	return feedRoomData, nil
}
