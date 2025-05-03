package tiktok

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"

	"github.com/andybalholm/brotli"
)

type SignResponse struct {
	Signature         string `json:"signature"`
	SignedUrl         string `json:"signed_url"`
	UserAgent         string `json:"user_agent"`
	VerifyFingerprint string `json:"verify_fp"`
	XxttParams        string `json:"xxttparams"`
}

func (c *Client) Sign(url string) (string, error) {
	url = fmt.Sprintf("%s?url=%s", SignerURL, url)
	response, err := c.Get(url)
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
		return "", err
	}

	var signResponse SignResponse
	if err := json.Unmarshal(body, &signResponse); err != nil {
		return "", err
	}
	return signResponse.SignedUrl, nil
}
