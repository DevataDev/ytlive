package handlers

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"golang.org/x/net/html"
	"google.golang.org/api/drive/v2"
	"google.golang.org/api/option"
	"gorm.io/gorm"
)

// Extracts the file ID from a Google Drive share link
func extractDriveFileID(link string) string {
	parts := strings.Split(link, "/")
	for i, p := range parts {
		if p == "d" && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}

// Custom reader to track download progress
type ProgressReader struct {
	io.Reader
	TotalSize int64
	BytesRead int64
	url       string
}

// Read method to update progress
func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.Reader.Read(p)
	pr.BytesRead += int64(n)
	pr.printProgress()
	return n, err
}

// Print download progress
func (pr *ProgressReader) printProgress() {
	if pr.TotalSize > 0 {
		percentage := float64(pr.BytesRead) / float64(pr.TotalSize) * 100
		models.SetDriveProgress(pr.url, map[string]interface{}{"status": "Downloading...", "progress": percentage})
		if percentage >= 100 {
			// delay 2 seconds
			time.Sleep(2 * time.Second)
			models.SetDriveProgress(pr.url, map[string]interface{}{"status": "Done", "progress": 100})
			models.ClearDriveProgress(pr.url)
		}
		fmt.Printf("\rDownloading... %.2f%% (%d/%d bytes)", percentage, pr.BytesRead, pr.TotalSize)
	} else {
		fmt.Printf("\rDownloading... %d bytes", pr.BytesRead)
	}
}

// Downloads a public Google Drive file using its file ID
func downloadDriveFile(client *http.Client, url string, destPath string, driveLink string) error {
	models.SetDriveProgress(driveLink, map[string]interface{}{"status": "Download Starting...", "progress": 1})
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Get content length
	totalSize := resp.ContentLength

	// Create progress reader
	progressReader := &ProgressReader{
		Reader:    resp.Body,
		TotalSize: totalSize,
		BytesRead: 0,
		url:       driveLink,
	}

	if resp.StatusCode != 200 {
		return fmt.Errorf("error : Google Drive file not accessible (status %d)", resp.StatusCode)
	}

	// if file is html, return error
	if resp.Header.Get("Content-Type") == "text/html" {
		return fmt.Errorf("error : Google Drive file not accessible (status %d)", resp.StatusCode)
	}

	out, err := os.Create(destPath)

	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, progressReader)
	return err
}

func generateDownloadUrl(client *http.Client, file *drive.File) (string, error) {
	fileSize := file.FileSize
	fileId := file.Id
	// check if file size is larger than 100MB
	if fileSize < 100*(1<<20) {
		// simple download
		// https://drive.google.com/uc?export=download&id=file-id
		downloadUrl := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileId)
		return downloadUrl, nil
	}

	// large file download, more complicated download
	// Example: https://drive.google.com/u/0/uc?id=XXXXXXXXBKPx3G5_UZWA79g79ncqEfQ&export=download
	scanFailedUrl := fmt.Sprintf("https://drive.google.com/uc?export=download&id=%s", fileId)
	res, err := client.Get(scanFailedUrl)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to open download url: %s", scanFailedUrl)
	}

	// check content type, must be html
	contentType := res.Header.Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		return "", fmt.Errorf("download page content type is not html: %s", contentType)
	}

	downloadPage, err := html.Parse(res.Body)
	if err != nil {
		return "", err
	}

	// TODO: Check if the page is "Google Drive Quota Exceeded or Limit Reached"
	formElem := getElementByID(downloadPage, "download-form")
	if formElem == nil {
		return "", fmt.Errorf("form element was not found in the download page")
	}

	formAction := getAttribute(formElem, "action")
	if formAction == "" {
		return "", fmt.Errorf("form action was not found in the download page")
	}

	// get the form input type hidden
	if formElem != nil {
		id := ""
		export := ""
		authuser := "0"
		confirm := "t"
		uuid := ""

		// get the hidden input
		for child := range formElem.ChildNodes() {
			if child.Type == html.ElementNode && child.Data == "input" {
				if attr := getAttribute(child, "name"); attr == "id" {
					id = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "export" {
					export = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "authuser" {
					authuser = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "confirm" {
					confirm = getAttribute(child, "value")
				}
				if attr := getAttribute(child, "name"); attr == "uuid" {
					uuid = getAttribute(child, "value")
				}
			}
		}

		if id != "" && export != "" && authuser != "" && confirm != "" && uuid != "" {
			return fmt.Sprintf("https://drive.usercontent.google.com/download?id=%s&export=%s&authuser=%s&confirm=%s&uuid=%s", id, export, authuser, confirm, uuid), nil
		} else {
			return "", fmt.Errorf("download page content type is not html: %s", contentType)
		}
	} else {
		return "", fmt.Errorf("download page content type is not html: %s", contentType)
	}
}

func getElementByID(n *html.Node, id string) *html.Node {
	if n.Type == html.ElementNode {
		if attr := getAttribute(n, "id"); attr == id {
			return n
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if n := getElementByID(c, id); n != nil {
			return n
		}
	}
	return nil
}

func getAttribute(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func normalizeFileName(fileName string) string {
	// Remove special characters and convert to lowercase
	normalizeFileName := strings.ToLower(fileName)
	normalizeFileName = strings.ReplaceAll(normalizeFileName, ".", "-")
	// remove any symbol
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "!", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "@", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "#", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "$", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "%", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "^", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "&", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "*", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "(", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, ")", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "_", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "-", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "+", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "=", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "[", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "]", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "{", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "}", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "|", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "\\", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "/", "-")
	normalizeFileName = strings.ReplaceAll(normalizeFileName, "?", "-")
	return normalizeFileName
}

var (
	ctx = context.Background()
)

type FileUploadHandler struct {
	DB     *gorm.DB
	Config *config.Config
}

func (h *FileUploadHandler) UploadStream(c *gin.Context) {

	file, fileHeaderErr := c.FormFile("videoFile")
	driveLink := c.PostForm("driveLink")
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}
	if fileHeaderErr != nil && driveLink == "" {
		c.JSON(400, gin.H{"error": "No file or Google Drive link provided."})
		return
	}
	var fileName string
	var googleDriveLink *string
	var filePath *string
	if driveLink != "" {
		models.SetDriveProgress(driveLink, map[string]interface{}{"status": "Starting...", "progress": 0})
		// Offload Google Drive download to background goroutine
		go func(userID string, driveLink string) {
			fileID := extractDriveFileID(driveLink)
			if fileID == "" {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Invalid Google Drive link", "progress": 0})
				return
			}
			srv, err := drive.NewService(ctx, option.WithAPIKey(h.Config.Google.ApiKey))
			if err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive API error", "progress": 0})
				return
			}
			file, err := srv.Files.Get(fileID).Do()
			if err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive file not accessible", "progress": 0})
				return
			}
			client := http.DefaultClient
			downloadUrl, err := generateDownloadUrl(client, file)
			if err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate download URL", "progress": 0})
				return
			}
			fileNameWithoutExtension := strings.ReplaceAll(file.OriginalFilename, "."+file.FileExtension, "")
			downloadName := fmt.Sprintf("file-%d-%s.mp4", time.Now().UnixMilli(), normalizeFileName(fileNameWithoutExtension))
			destPath := "./uploads/" + downloadName
			if err := downloadDriveFile(client, downloadUrl, destPath, driveLink); err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Download failed: " + err.Error(), "progress": 0})
				return
			}
			// Register the stream in the DB after download completes
			entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
			ms := ulid.Timestamp(time.Now())
			id, err := ulid.New(ms, entropy)
			if err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate ID", "progress": 100})
				return
			}
			stream := models.Stream{
				ID:              id.String(),
				FileName:        downloadName,
				FilePath:        &destPath,
				GoogleDriveLink: &driveLink,
				Status:          "stopped",
				UserId:          userID,
			}
			if err := h.DB.Create(&stream).Error; err != nil {
				models.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to register stream", "progress": 100})
				return
			}
			models.SetDriveProgress(driveLink, map[string]interface{}{"message": "Done", "progress": 100})
		}(userID.(string), driveLink)
		// Respond immediately so UI is not blocked
		c.JSON(http.StatusOK, gin.H{"message": "Google Drive download started"})
		return
	}
	if fileHeaderErr == nil {
		// Save file to disk (uploads folder)
		// remove extension from filename
		fileNameWithoutExtension := strings.ReplaceAll(file.Filename, "."+file.Filename[strings.LastIndex(file.Filename, "."):], "")
		//remove space from filename
		fileNameWithoutExtension = strings.ReplaceAll(fileNameWithoutExtension, " ", "-")
		fileName = fmt.Sprintf("file-%d-%s.mp4", time.Now().UnixMilli(), normalizeFileName(fileNameWithoutExtension))
		uploadPath := "./uploads/" + fileName
		if err := c.SaveUploadedFile(file, uploadPath); err != nil {
			fmt.Println(err)
			c.JSON(500, gin.H{"error": "Failed to save file."})
			return
		}
		filePath = &uploadPath
	}

	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	id, err := ulid.New(ms, entropy)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to generate ID."})
		return
	}

	defaultLoopCount := -1
	// Create new Stream DB entry
	stream := models.Stream{
		ID:              id.String(),
		FileName:        fileName,
		FilePath:        filePath,
		GoogleDriveLink: googleDriveLink,
		Status:          "stopped",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		LoopVideo:       true,
		RTMPUrl:         "rtmp://a.rtmp.youtube.com/live2/",
		LoopCount:       &defaultLoopCount,
		UserId:          userID.(string),
	}
	if err := h.DB.Create(&stream).Error; err != nil {
		fmt.Println(err)
		c.JSON(500, gin.H{"error": "Failed to save stream info."})
		return
	}
	c.JSON(200, gin.H{"message": "Upload successful!"})
}
