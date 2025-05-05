package tiktok

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
)

func (c *Client) GetRoomIdFromUserWithAPI(username string) (string, error) {
	if username == "" {
		return "", errors.New("username is empty")
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["uniqueId"] = username
	queryParams["sourceType"] = "54"

	url := c.FormatUrl(tiktokAppURL, urlGetRoomIdFromUser, queryParams)

	data, err := c.Get(url, false)
	if err != nil {
		return "", err
	}
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	if strings.Contains(string(body), "This account is private") {
		return "", ErrPrivateAccount
	}

	if strings.Contains(string(body), "user_not_found") {
		return "", ErrUserNotFound
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}

	if _, ok := response["data"]; !ok {
		return "", ErrDataNotFound
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return "", ErrDataNotFound
	}
	if _, ok := dataBody["user"]; !ok {
		return "", ErrUserNotFound
	}

	return dataBody["user"].(map[string]interface{})["roomId"].(string), nil
}

func (c *Client) GetRoomInfo(roomID string) (map[string]interface{}, error) {
	if roomID == "" {
		return nil, errors.New("room id is empty")
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["room_id"] = roomID

	url := c.FormatUrl(webcastURL, getRoomInfo, queryParams)
	data, err := c.Get(url, false)
	if err != nil {
		return nil, err
	}

	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if _, ok := response["data"]; !ok {
		return nil, ErrDataNotFound
	}

	// This account is private
	if strings.Contains(string(body), "This account is private") {
		return nil, ErrPrivateAccount
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return nil, ErrDataNotFound
	}

	return dataBody, nil
}

func (c *Client) CheckMultipleRoomIsAlive(roomIDs []string) (map[string]bool, error) {
	if len(roomIDs) == 0 {
		return nil, ErrValidationEmptyField
	}

	var isAliveMap map[string]bool
	roomIds := strings.Join(roomIDs, ",")

	queryParams := c.formatDefaultGetParams()
	queryParams["room_ids"] = roomIds
	queryParams["user_is_login"] = "true"

	url := c.FormatUrl(webcastURL, checkRoomIsAlive, queryParams)

	if c.httpClient == nil {
		return nil, ErrHttpClientNil
	}

	data, err := c.Get(url, false)
	if err != nil {
		return nil, err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if _, ok := response["data"]; !ok {
		return nil, ErrDataNotFound
	}

	dataBody, ok := response["data"].([]interface{})
	if !ok {
		return nil, ErrDataNotFound
	}

	isAliveMap = make(map[string]bool)

	for _, v := range dataBody {
		isAliveMap[v.(map[string]interface{})["room_id_str"].(string)] = v.(map[string]interface{})["alive"].(bool)
	}
	return isAliveMap, nil
}

func (c *Client) CheckRoomIsAlive(roomID string) (bool, error) {
	if c == nil {
		return false, ErrHttpClientNil
	}

	if roomID == "" {
		return false, ErrValidationEmptyField
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["room_ids"] = roomID
	queryParams["user_is_login"] = "true"

	url := c.FormatUrl(webcastURL, checkRoomIsAlive, queryParams)

	if c.httpClient == nil {
		return false, ErrHttpClientNil
	}

	data, err := c.Get(url, false)

	if err != nil {
		return false, err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return false, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Println("Failed to unmarshal room info for room", roomID, "with error", err)
		return false, err
	}

	if _, ok := response["data"]; !ok {
		fmt.Println("Data not found for room", roomID)
		return false, ErrDataNotFound
	}

	dataBody := response["data"].([]interface{})
	if len(dataBody) == 0 {
		fmt.Println("Data is empty for room", roomID)
		return false, ErrDataNotFound
	}

	var isAlive bool
	for _, v := range dataBody {
		if v.(map[string]interface{})["room_id_str"] == roomID {
			isAlive = v.(map[string]interface{})["alive"].(bool)
			break
		}
	}
	return isAlive, nil
}

func (c *Client) GetLiveUrl(roomID string) (string, error) {
	if roomID == "" {
		return "", ErrValidationEmptyField
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["room_id"] = roomID
	queryParams["user_is_login"] = "true"

	url := c.FormatUrl(webcastURL, getRoomInfo, queryParams)
	data, err := c.Get(url, false)
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}

	if _, ok := response["data"]; !ok {
		return "", ErrDataNotFound
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return "", ErrDataNotFound
	}

	liveUrl, err := c.ParseRoomInfoForLiveUrl(dataBody)
	if err != nil {
		return "", err
	}
	return liveUrl, nil
}

func (c *Client) ParseRoomInfoForLiveUrl(roomInfo map[string]interface{}) (string, error) {
	if roomInfo == nil {
		return "", ErrValidationEmptyField
	}

	var liveUrl string
	streamUrl := roomInfo["stream_url"].(map[string]interface{})
	if streamUrl == nil {
		return "", ErrLiveHasEnded
	}

	flvPullUrl := streamUrl["flv_pull_url"].(map[string]interface{})
	if flvPullUrl == nil {
		return "", ErrLiveHasEnded
	}

	fullHD1, ok := flvPullUrl["FULL_HD1"].(string)
	if !ok {
		fullHD1 = ""
	}
	liveUrl = fullHD1
	// if FULL_HD1 is not available, use HD1
	if liveUrl == "" {
		hd1, ok := flvPullUrl["HD1"].(string)
		if !ok {
			hd1 = ""
		}
		liveUrl = hd1
	}
	// if HD1 is not available, use SD2
	if liveUrl == "" {
		sd2, ok := flvPullUrl["SD2"].(string)
		if !ok {
			sd2 = ""
		}
		liveUrl = sd2
	}
	// if SD2 is not available, use SD1
	if liveUrl == "" {
		sd1, ok := flvPullUrl["SD1"].(string)
		if !ok {
			sd1 = ""
		}
		liveUrl = sd1
	}
	// if SD1 is not available, use rtmp_pull_url
	if liveUrl == "" {
		rtmpPullUrl := streamUrl["rtmp_pull_url"].(string)
		if rtmpPullUrl == "" {
			rtmpPullUrl = ""
		}
		liveUrl = rtmpPullUrl
	}
	// if rtmp_pull_url is not available, use hls_pull_url
	if liveUrl == "" {
		hlsPullUrl := streamUrl["hls_pull_url"].(string)
		if hlsPullUrl == "" {
			hlsPullUrl = ""
		}
		liveUrl = hlsPullUrl
	}
	if liveUrl == "" {
		return "", ErrLiveHasEnded
	}
	return liveUrl, nil
}

func (c *Client) GetUserFromRoomId(roomId string) (string, error) {
	if roomId == "" {
		return "", ErrValidationEmptyField
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["room_id"] = roomId

	url := c.FormatUrl(webcastURL, getRoomInfo, queryParams)
	data, err := c.Get(url, false)
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return "", err
	}

	if _, ok := response["data"]; !ok {
		return "", ErrDataNotFound
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody["owner"] == nil {
		return "", ErrDataNotFound
	}

	return dataBody["owner"].(map[string]interface{})["display_id"].(string), nil
}

func (c *Client) GetRoomAndUserFromUrl(liveUrl string) (string, string, error) {
	if liveUrl == "" {
		return "", "", ErrValidationEmptyField
	}

	data, err := c.Get(liveUrl, false)
	if err != nil {
		return "", "", err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", "", err
	}

	var userID string

	// if status code is 302, get the location header
	if data.StatusCode == http.StatusFound {
		return "", "", ErrCountryBlacklisted
	}

	// if status code is MOVED
	if data.StatusCode == http.StatusMovedPermanently {
		matches := regexp.MustCompile("com/@(.*?)/live").FindAllStringSubmatch(string(body), -1)
		if len(matches) < 1 {
			return "", "", ErrUserNotFound
		}
		userID = matches[0][1]
	} else {

		// if status code is OK
		matches := regexp.MustCompile("https?://(?:www.)?tiktok.com/@([^/]+)/live").FindAllStringSubmatch(string(body), -1)
		if len(matches) < 1 {
			return "", "", ErrUserNotFound
		} else {
			userID = matches[0][1]
		}
	}

	if userID == "" {
		return "", "", ErrUserNotFound
	}

	roomID, err := c.GetRoomIdFromUser(userID)
	if err != nil {
		return "", "", err
	}

	return userID, roomID, nil
}

func (c *Client) GetRoomIdFromUser(user string) (string, error) {
	if user == "" {
		return "", errors.New("user is empty")
	}

	data, err := c.Get(c.FormatUrl(tiktokAppURL, fmt.Sprintf(urlUser+urlLive, user), nil), false)
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	if strings.Contains(string(body), "Please wait") {
		return "", ErrCaptcha
	}

	pattern := regexp.MustCompile(`(?s)<script id="SIGI_STATE" type="application/json">(.*?)</script>`)
	match := pattern.FindStringSubmatch(string(body))
	if match == nil {
		return "", ErrUserOffline
	}

	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(match[1]), &jsonData); err != nil {
		return "", err
	}

	if _, ok := jsonData["LiveRoom"]; !ok {
		return "", ErrUserOffline
	}

	if _, ok := jsonData["LiveRoom"]; !ok {
		return "", ErrUserOffline
	}

	roomID := jsonData["LiveRoom"].(map[string]interface{})["liveRoomUserInfo"].(map[string]interface{})["user"].(map[string]interface{})["roomId"].(string)
	if roomID == "" {
		return "", ErrUserOffline
	}

	return roomID, nil
}

func (c *Client) CheckUserIsLive(user string) (bool, error) {
	if user == "" {
		return false, ErrValidationEmptyField
	}

	queryParams := c.formatDefaultGetParams()
	queryParams["uniqueId"] = user
	queryParams["sourceType"] = "54"

	url := c.FormatUrl(tiktokAppURL, urlGetRoomIdFromUser, queryParams)

	data, err := c.Get(url, false)
	if err != nil {
		return false, err
	}
	reader := parseBody(data)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return false, err
	}

	if strings.Contains(string(body), "This account is private") {
		return false, ErrPrivateAccount
	}

	if strings.Contains(string(body), "user_not_found") {
		return false, ErrUserNotFound
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return false, err
	}

	if _, ok := response["data"]; !ok {
		return false, ErrDataNotFound
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return false, ErrDataNotFound
	}
	if _, ok := dataBody["liveRoom"]; !ok {
		return false, ErrUserOffline
	}

	return dataBody["liveRoom"].(map[string]interface{})["status"].(float64) != 4, nil
}
