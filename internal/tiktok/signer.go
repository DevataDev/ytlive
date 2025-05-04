package tiktok

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/imroc/req/v3"
)

type SignResponse struct {
	Signature         string `json:"signature"`
	SignedUrl         string `json:"signed_url"`
	UserAgent         string `json:"user_agent"`
	VerifyFingerprint string `json:"verify_fp"`
	XxttParams        string `json:"xxttparams"`
}

func (c *Client) Sign(destinationUrl string) (string, error) {
	mustRemoveParams := []string{"X-Bogus", "X-Gnarly", "msToken"}

	parsedUrl, err := url.Parse(destinationUrl)
	if err != nil {
		return "", err
	}

	var originalQueryParams = parsedUrl.Query()

	//looping query params and encode it
	for _, key := range mustRemoveParams {
		originalQueryParams.Del(key)
	}

	parsedUrl.RawQuery = originalQueryParams.Encode()

	apiUrl := fmt.Sprintf("%s/sign?url=%s", signerURL, url.QueryEscape(parsedUrl.String()))

	client := req.NewClient()
	client.SetTimeout(60 * time.Second)
	client.SetUserAgent(c.userAgent)

	response, err := client.R().Get(apiUrl)
	if err != nil {
		return "", err
	}
	// check if br or gzip
	reader := parseBody(response)

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		fmt.Println("Failed to read signed url for", destinationUrl, "with error", err)
		return destinationUrl, err
	}

	var signResponse SignResponse
	if err := json.Unmarshal(body, &signResponse); err != nil {
		return destinationUrl, err
	}

	parsedUrl, err = url.Parse(signResponse.SignedUrl)
	if err != nil {
		fmt.Println("Failed to parse signed url for", destinationUrl, "with error", err)
		return destinationUrl, err
	}

	var queryParams = parsedUrl.Query()

	//looping query params and encode it
	for key, value := range parsedUrl.Query() {
		queryParams.Set(key, url.QueryEscape(value[0]))
	}

	parsedUrl.RawQuery = queryParams.Encode()

	return parsedUrl.String(), nil
}
