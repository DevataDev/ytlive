package tiktok

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/andybalholm/brotli"
)

func (c *Client) GetRoomInfo(roomID string) (map[string]interface{}, error) {
	if roomID == "" {
		return nil, errors.New("room id is empty")
	}

	url := fmt.Sprintf("%s/webcast/room/info/?aid=1988&region=%s&room_id=%s", WebcastURL, c.region, roomID)
	data, err := c.Get(url)
	if err != nil {
		return nil, err
	}
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	fmt.Println(string(body))

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}

	if _, ok := response["data"]; !ok {
		return nil, errors.New("data not found")
	}

	// This account is private
	if strings.Contains(string(body), "This account is private") {
		return nil, errors.New("this account is private")
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return nil, errors.New("data is empty")
	}

	return dataBody, nil
}

func (c *Client) CheckMultipleRoomIsAlive(roomIDs []string) (map[string]bool, error) {
	if len(roomIDs) == 0 {
		return nil, errors.New("room ids is empty")
	}

	var isAliveMap map[string]bool
	roomIds := strings.Join(roomIDs, ",")

	url := fmt.Sprintf("%s/webcast/room/check_alive/?aid=1988&region=%s&room_ids=%s&user_is_login=true", WebcastURL, c.region, roomIds)

	if c.httpClient == nil {
		return nil, errors.New("http client is nil")
	}

	data, err := c.Get(url)
	if err != nil {
		return nil, err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

	defer reader.Close()

	body, err := io.ReadAll(reader)
	if err != nil {
		fmt.Println("Failed to read room info for room", roomIds, "with error", err)
		return nil, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Println("Failed to unmarshal room info for room", roomIds, "with error", err)
		return nil, err
	}

	if _, ok := response["data"]; !ok {
		fmt.Println("Data not found for room", roomIds)
		return nil, errors.New("data not found")
	}

	dataBody := response["data"].([]interface{})
	if len(dataBody) == 0 {
		fmt.Println("Data is empty for room", roomIds)
		return nil, errors.New("data is empty")
	}

	isAliveMap = make(map[string]bool)

	for _, v := range dataBody {
		isAliveMap[v.(map[string]interface{})["room_id_str"].(string)] = v.(map[string]interface{})["alive"].(bool)
	}
	return isAliveMap, nil
}

func (c *Client) CheckRoomIsAlive(roomID string) (bool, error) {
	fmt.Println("Checking room is alive for room", roomID)
	if c == nil {
		return false, errors.New("client is nil")
	}

	if roomID == "" {
		return false, errors.New("room id is empty")
	}

	url := fmt.Sprintf("%s/webcast/room/check_alive/?aid=1988&region=%s&room_ids=%s&user_is_login=true", WebcastURL, c.region, roomID)

	if c.httpClient == nil {
		return false, errors.New("http client is nil")
	}

	data, err := c.Get(url)

	if err != nil {
		fmt.Println("Failed to get room info for room", roomID, "with error", err)
		return false, err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		fmt.Println("Failed to read room info for room", roomID, "with error", err)
		return false, err
	}

	var response map[string]interface{}
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Println("Failed to unmarshal room info for room", roomID, "with error", err)
		return false, err
	}

	if _, ok := response["data"]; !ok {
		fmt.Println("Data not found for room", roomID)
		return false, errors.New("data not found")
	}

	dataBody := response["data"].([]interface{})
	if len(dataBody) == 0 {
		fmt.Println("Data is empty for room", roomID)
		return false, errors.New("data is empty")
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
		return "", errors.New("room id is empty")
	}

	url := fmt.Sprintf("%s/webcast/room/info/?aid=1988&region=%s&room_id=%s&user_is_login=true", WebcastURL, c.region, roomID)
	data, err := c.Get(url)
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

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
		return "", errors.New("data not found")
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody == nil {
		return "", errors.New("data is empty")
	}

	liveUrl, err := c.ParseRoomInfoForLiveUrl(dataBody)
	if err != nil {
		return "", err
	}
	return liveUrl, nil
}

func (c *Client) ParseRoomInfoForLiveUrl(roomInfo map[string]interface{}) (string, error) {
	if roomInfo == nil {
		return "", errors.New("room info is nil")
	}

	var liveUrl string
	streamUrl := roomInfo["stream_url"].(map[string]interface{})
	if streamUrl == nil {
		return "", errors.New("stream url is nil")
	}

	flvPullUrl := streamUrl["flv_pull_url"].(map[string]interface{})
	if flvPullUrl == nil {
		return "", errors.New("flv pull url is nil")
	}

	fullHD1, ok := flvPullUrl["FULL_HD1"].(string)
	if !ok {
		return "", errors.New("full hd1 is not string")
	}
	liveUrl = fullHD1
	// if FULL_HD1 is not available, use HD1
	if liveUrl == "" {
		hd1, ok := flvPullUrl["HD1"].(string)
		if !ok {
			return "", errors.New("hd1 is not string")
		}
		liveUrl = hd1
	}
	// if HD1 is not available, use SD2
	if liveUrl == "" {
		sd2, ok := flvPullUrl["SD2"].(string)
		if !ok {
			return "", errors.New("sd2 is not string")
		}
		liveUrl = sd2
	}
	// if SD2 is not available, use SD1
	if liveUrl == "" {
		sd1, ok := flvPullUrl["SD1"].(string)
		if !ok {
			return "", errors.New("sd1 is not string")
		}
		liveUrl = sd1
	}
	// if SD1 is not available, use rtmp_pull_url
	if liveUrl == "" {
		rtmpPullUrl := streamUrl["rtmp_pull_url"].(string)
		if rtmpPullUrl == "" {
			return "", errors.New("rtmp pull url is empty")
		}
		liveUrl = rtmpPullUrl
	}
	// if rtmp_pull_url is not available, use hls_pull_url
	if liveUrl == "" {
		hlsPullUrl := streamUrl["hls_pull_url"].(string)
		if hlsPullUrl == "" {
			return "", errors.New("hls pull url is empty")
		}
		liveUrl = hlsPullUrl
	}
	if liveUrl == "" {
		return "", errors.New("live url not found")
	}
	return liveUrl, nil
}

func (c *Client) GetUserFromRoomId(roomId string) (string, error) {
	if roomId == "" {
		return "", errors.New("room id is empty")
	}

	url := fmt.Sprintf("%s/webcast/room/info/?aid=1988&room_id=%s", WebcastURL, roomId)
	data, err := c.Get(url)
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

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
		return "", errors.New("data not found")
	}

	dataBody := response["data"].(map[string]interface{})
	if dataBody["owner"] == nil {
		return "", errors.New("owner not found")
	}

	return dataBody["owner"].(map[string]interface{})["display_id"].(string), nil
}

func (c *Client) GetRoomAndUserFromUrl(liveUrl string) (string, string, error) {
	if liveUrl == "" {
		return "", "", errors.New("live url is empty")
	}

	data, err := c.Get(liveUrl)
	if err != nil {
		return "", "", err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", "", err
	}

	var userID string

	// if status code is 302, get the location header
	if data.StatusCode == http.StatusFound {
		return "", "", errors.New("country blacklisted")
	}

	// if status code is MOVED
	if data.StatusCode == http.StatusMovedPermanently {
		matches := regexp.MustCompile("com/@(.*?)/live").FindAllStringSubmatch(string(body), -1)
		if len(matches) < 1 {
			return "", "", errors.New("user not found")
		}
		userID = matches[0][1]
	}

	// if status code is OK
	matches := regexp.MustCompile("https?://(?:www.)?tiktok.com/@([^/]+)/live").FindAllStringSubmatch(string(body), -1)
	if len(matches) < 1 {
		return "", "", errors.New("user not found")
	} else {
		userID = matches[0][1]
	}

	if userID == "" {
		return "", "", errors.New("user not found")
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

	data, err := c.Get(fmt.Sprintf("https://www.tiktok.com/@%s/live", user))
	if err != nil {
		return "", err
	}
	// Suppose resp is your *http.Response
	var reader io.ReadCloser

	switch data.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(data.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(data.Body))
	default:
		reader = data.Body
	}

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	fmt.Println(string(body))

	if strings.Contains(string(body), "Please wait") {
		return "", errors.New("got tiktok waf")
	}

	fmt.Println("Checking room id from user", user)
	fmt.Println(string(body))

	pattern := regexp.MustCompile(`(?s)<script id="SIGI_STATE" type="application/json">(.*?)</script>`)
	match := pattern.FindStringSubmatch(string(body))
	if match == nil {
		return "", errors.New("room id not found")
	}

	var jsonData map[string]interface{}
	if err := json.Unmarshal([]byte(match[1]), &jsonData); err != nil {
		return "", err
	}

	if _, ok := jsonData["LiveRoom"]; !ok {
		return "", errors.New("room id not found")
	}

	if _, ok := jsonData["LiveRoom"]; !ok {
		return "", errors.New("room id not found")
	}

	roomID := jsonData["LiveRoom"].(map[string]interface{})["liveRoomUserInfo"].(map[string]interface{})["user"].(map[string]interface{})["roomId"].(string)
	if roomID == "" {
		return "", errors.New("room id not found")
	}

	return roomID, nil
}
