package tiktok

import (
	"compress/gzip"
	"io"

	"github.com/andybalholm/brotli"
	"github.com/imroc/req/v3"
)

func mergeMaps(m1, m2 map[string]string) map[string]string {
	merged := make(map[string]string)
	for k, v := range m1 {
		merged[k] = v
	}
	for k, v := range m2 {
		merged[k] = v
	}
	return merged
}

func parseBody(response *req.Response) io.ReadCloser {
	var reader io.ReadCloser
	switch response.Header.Get("Content-Encoding") {
	case "gzip":
		reader, _ = gzip.NewReader(response.Body)
	case "br":
		reader = io.NopCloser(brotli.NewReader(response.Body))
	default:
		reader = response.Body
	}
	return reader
}
