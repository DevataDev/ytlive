package tiktok

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/url"

	"github.com/andybalholm/brotli"
)

type SignResponse struct {
	Signature         string `json:"signature"`
	SignedUrl         string `json:"signed_url"`
	UserAgent         string `json:"user_agent"`
	VerifyFingerprint string `json:"verify_fp"`
	XxttParams        string `json:"xxttparams"`
}

func (c *Client) Sign(destinationUrl string) (string, error) {
	encodedUrl := url.QueryEscape(destinationUrl)
	apiUrl := fmt.Sprintf("%s/sign?url=%s", SignerURL, encodedUrl)
	response, err := c.Get(apiUrl)
	if err != nil {
		return "", err
	}
	// check if br or gzip
	var reader io.ReadCloser
	switch response.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(response.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(response.Body))
	default:
		reader = response.Body
	}

	defer reader.Close()
	body, err := io.ReadAll(reader)
	if err != nil {
		fmt.Println("Failed to read signed url for", destinationUrl, "with error", err)
		return "", err
	}

	var signResponse SignResponse
	if err := json.Unmarshal(body, &signResponse); err != nil {
		return "", err
	}

	parsedUrl, err := url.Parse(signResponse.SignedUrl)
	if err != nil {
		fmt.Println("Failed to parse signed url for", destinationUrl, "with error", err)
		return "", err
	}

	var queryParams = parsedUrl.Query()

	//looping query params and encode it
	for key, value := range parsedUrl.Query() {
		queryParams.Set(key, url.QueryEscape(value[0]))
	}

	parsedUrl.RawQuery = queryParams.Encode()

	return parsedUrl.String(), nil
}
