package tiktok

import (
	"errors"
	"regexp"
)

const (
	webcastURL   = "https://webcast.tiktok.com"
	tiktokAppURL = "https://www.tiktok.com"
	signerURL    = "https://ttsigner.yuklive.my.id"

	// endpoints
	signReq          = "/sign"
	getRoomInfo      = "/webcast/room/info/"
	checkRoomIsAlive = "/webcast/room/check_alive/"
	urlLive          = "live/"
	urlFeed          = "/webcast/feed/"
	urlRankList      = "/ranklist/online_audience/"
	urlPriceList     = "/wallet_api/fs/diamond"
	urlUser          = "/@%s/"
	urlExplore       = "/api/explore/item_list/"

	// Think this changed to room/enter/
	urlRoomData          = "/webcast/fetch/"
	urlGiftInfo          = "/gift/list/"
	urlGetRoomIdFromUser = "/api-live/user/room"
	urlSearch            = "/api/search/live/full/"

	clientNameDefault = "tiktokLive"
	apiKeyDefault     = ""

	referer = "https://www.tiktok.com/"
	// webcast backend will fail if origin is an ending /
	origin = "https://www.tiktok.com"

	//req_from
	fromLiveTab               = "live_mt_pc_web_rec_tab_refresh"
	fromFollowingTab          = "tiktok_message_webapp_following"
	fromSuggestionTab         = "pc_web_suggested_host"
	fromLiveTabLoadMore       = "live_mt_pc_web_rec_tab_loadmore"
	fromSuggestionTabLoadMore = "pc_web_suggested_host_loadmore"
	fromPcWebGameRefresh      = "pc_web_game_sub_feed_refresh"
	fromPcWebFollowDefault    = "pc_web_side_follow_default"
	fromPcWebTaxonomy         = "webapp_taxonomy_drawer_enter_feed"
	fromPcWebGameTab          = "pc_web_game_feed_refresh"
	//related_live_tag

)

var (
	defaultAid  = "1988"
	versionCode = "270000"

	minGetParams = map[string]string{
		"aid":          defaultAid,
		"app_language": "%s", // will be replaced with language
		"app_name":     "tiktok_web",
	}

	defaultGETParams = map[string]string{
		"aid":                 defaultAid,
		"app_language":        "%s", // will be replaced with language
		"app_name":            "tiktok_web",
		"browser_language":    "%s", // will be replaced with browser language
		"browser_name":        "%s",
		"browser_online":      "true",
		"browser_platform":    "%s", // will be replaced with browser platform
		"browser_version":     "%s", // will be replaced with browser version
		"cookie_enabled":      "true",
		"cursor":              "",
		"internal_ext":        "",
		"device_platform":     "web",
		"focus_state":         "true",
		"from_page":           "user",
		"history_len":         "4",
		"is_fullscreen":       "false",
		"is_page_visible":     "true",
		"did_rule":            "3",
		"fetch_rule":          "1",
		"last_rtt":            "0",
		"live_id":             "12",
		"resp_content_type":   "protobuf",
		"tz_name":             "%s", // will be replaced with timezone name
		"referer":             referer,
		"root_referer":        origin,
		"version_code":        "180800",
		"webcast_sdk_version": "1.3.0",
		"update_version_code": "1.3.0",
		"screen_height":       "%s", // will be replaced with screen height
		"screen_width":        "%s", // will be replaced with screen width
		"region":              "%s", // will be replaced with region
		"os":                  "%s", // will be replaced with os
		"user_is_login":       "%s",
	}
	defaultRequestHeaders = map[string]string{
		"Connection":    "keep-alive",
		"Cache-control": "max-age=0",
		"User-Agent":    "%s", // will be replaced with user agent
		"Accept":        "text/html,application/json,application/protobuf",
		"Referer":       referer,
		"Origin":        origin,
		// clientId:  = "ttlive-golang"
		"Accept-Language": "en-US,en;q=0.9",
		"Accept-Encoding": "gzip, deflate",
	}

	defaultWsClientParams = map[string]string{
		"aid":                 defaultAid,
		"app_language":        "%s", // will be replaced with language
		"app_name":            "tiktok_web",
		"browser_platform":    "%s", // will be replaced with browser platform
		"browser_language":    "%s", // will be replaced with browser language
		"browser_name":        "%s", // will be replaced with browser name
		"browser_online":      "true",
		"browser_version":     "%s", // will be replaced with browser version
		"cookie_enabled":      "true",
		"debug":               "false",
		"host":                "%s", // will be replaced with host
		"identity":            "audience",
		"live_id":             "12",
		"sup_ws_ds_opt":       "1",
		"update_version_code": "2.0.0",
		"version_code":        "180800",
		"did_rule":            "3",
		"screen_height":       "%d", // will be replaced with screen height
		"screen_width":        "%d", // will be replaced with screen width
		"last_rtt":            "%s", // will be replaced with last rtt
	}

	defaultWsClientParamsAppend = map[string]string{
		"version_code": versionCode,
	}

	reJsonData = []*regexp.Regexp{
		regexp.MustCompile(`<script id="SIGI_STATE"[^>]+>(.*?)</script>`),
		regexp.MustCompile(`<script id="sigi-persisted-data">window\['SIGI_STATE'\]=(.*);w`),
	}

	reVerify = regexp.MustCompile(`tiktok-verify-page`)
)

var (
	ErrUserOffline        = errors.New("user might be offline, Room ID not found")
	ErrLiveHasEnded       = errors.New("livestream has ended")
	ErrMsgNotImplemented  = errors.New("message protobuf type has not been implemented, please report")
	ErrNoMoreFeedItems    = errors.New("no more feed items available")
	ErrUserNotFound       = errors.New("user not found")
	ErrCaptcha            = errors.New("captcha detected, unable to proceed")
	ErrURLNotFound        = errors.New("unable to download stream, URL not found")
	ErrFFMPEGNotFound     = errors.New("please install ffmpeg before downloading")
	ErrRateLimitExceeded  = errors.New("you have exceeded the rate limit, please wait a few min")
	ErrUserInfoNotFound   = errors.New("user info not found")
	ErrCountryBlacklisted = errors.New("country blacklisted")
	ErrDataNotFound       = errors.New("data not found")
	ErrHttpClientNil      = errors.New("http client is nil")
	ErrPrivateAccount     = errors.New("this account is private")
)

var (
	ErrValidationEmptyField     = errors.New("empty field validation failed")
	ErrValidationInvalidField   = errors.New("invalid field validation failed")
	ErrValidationInvalidType    = errors.New("invalid type validation failed")
	ErrValidationInvalidValue   = errors.New("invalid value validation failed")
	ErrValidationInvalidLength  = errors.New("invalid length validation failed")
	ErrValidationInvalidFormat  = errors.New("invalid format validation failed")
	ErrValidationInvalidRange   = errors.New("invalid range validation failed")
	ErrValidationInvalidPattern = errors.New("invalid pattern validation failed")
	ErrValidationInvalidEnum    = errors.New("invalid enum validation failed")
)

type ErrIPBlockedOrBanned struct{}

func (e ErrIPBlockedOrBanned) Error() string {
	return "your IP or country might be blocked by TikTok or Signer service or you might be banned, please try again with a vpn, proxy, or different credentials"
}
