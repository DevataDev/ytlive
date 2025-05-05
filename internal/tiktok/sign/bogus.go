package sign

import (
	"errors"
	"fmt"
	"strings"
)

type BogusManager struct{}

// xbStrToEndpoint generates the final endpoint with X-Bogus from a full query string.
func (bm *BogusManager) XbStrToEndpoint(userAgent string, endpoint string) (string, error) {
	xb := NewXBogus(userAgent)
	params, _, _ := xb.GetXBogus(endpoint)
	return params, nil
}

// modelToEndpoint takes a base endpoint, a map of query parameters, and a User-Agent to return a full URL with X-Bogus.
func (bm *BogusManager) ModelToEndpoint(baseEndpoint string, params map[string]string, userAgent string) (string, error) {
	if params == nil {
		return "", errors.New("params must be a non-nil map")
	}

	var paramList []string
	for k, v := range params {
		paramList = append(paramList, fmt.Sprintf("%s=%s", k, v))
	}
	paramStr := strings.Join(paramList, "&")

	xb := NewXBogus(userAgent)
	_, xbValue, _ := xb.GetXBogus(paramStr)

	separator := "?"
	if strings.Contains(baseEndpoint, "?") {
		separator = "&"
	}

	finalEndpoint := fmt.Sprintf("%s%s%s&X-Bogus=%s", baseEndpoint, separator, paramStr, xbValue)
	return finalEndpoint, nil
}
