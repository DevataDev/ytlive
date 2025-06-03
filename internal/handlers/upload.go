package handlers

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	config "windsorf-youtube-live/internal/configuration"
	"windsorf-youtube-live/internal/job"
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
		job.SetDriveProgress(pr.url, map[string]interface{}{"status": "Downloading...", "progress": percentage})
		if percentage >= 100 {
			// delay 2 seconds
			time.Sleep(2 * time.Second)
			job.SetDriveProgress(pr.url, map[string]interface{}{"status": "Done", "progress": 100})
			job.ClearDriveProgress(pr.url)
		}
		fmt.Printf("\rDownloading... %.2f%% (%d/%d bytes)", percentage, pr.BytesRead, pr.TotalSize)
	} else {
		fmt.Printf("\rDownloading... %d bytes", pr.BytesRead)
	}
}

// Downloads a public Google Drive file using its file ID
func downloadDriveFile(client *http.Client, url string, destPath string, driveLink string) error {
	job.SetDriveProgress(driveLink, map[string]interface{}{"status": "Download Starting...", "progress": 1})
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

type uploadResult struct {
	FileName string `json:"fileName"`
	Success  bool   `json:"success"`
	Message  string `json:"message,omitempty"`
	FilePath string `json:"filePath,omitempty"`
	StreamID string `json:"streamId,omitempty"`
}

func (h *FileUploadHandler) UploadStream(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(401, gin.H{"error": "Unauthorized"})
		return
	}

	// Create a new stream for all files
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	id, err := ulid.New(ms, entropy)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to generate stream ID"})
		return
	}
	streamID := id.String()
	streamName := fmt.Sprintf("Stream %s", time.Now().Format("2006-01-02 15:04:05"))
	defaultLoopCount := -1
	rtmpUrl := "rtmp://a.rtmp.youtube.com/live2/"

	// Create stream record
	stream := models.Stream{
		ID:         streamID,
		Name:       streamName,
		Status:     "stopped",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		LoopVideo:  true,
		RTMPUrl:    rtmpUrl,
		LoopCount:  &defaultLoopCount,
		UserID:     userID.(string),
		MediaFiles: []models.MediaFile{},
	}

	// Handle Google Drive links
	driveLink := c.PostForm("driveLink")
	if driveLink != "" {
		job.SetDriveProgress(driveLink, map[string]interface{}{"status": "Starting...", "progress": 0})
		// Offload Google Drive download to background goroutine
		go func(userID string, driveLink string) {
			fileID := extractDriveFileID(driveLink)
			if fileID == "" {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Invalid Google Drive link", "progress": 0})
				return
			}

			srv, err := drive.NewService(ctx, option.WithAPIKey(h.Config.Google.ApiKey))
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive API error", "progress": 0})
				return
			}

			file, err := srv.Files.Get(fileID).Do()
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Google Drive file not accessible", "progress": 0})
				return
			}

			client := http.DefaultClient
			downloadUrl, err := generateDownloadUrl(client, file)
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate download URL", "progress": 0})
				return
			}

			fileNameWithoutExtension := strings.ReplaceAll(file.OriginalFilename, "."+file.FileExtension, "")
			downloadName := fmt.Sprintf("file-%d-%s.mp4", time.Now().UnixMilli(), normalizeFileName(fileNameWithoutExtension))
			destPath := "./uploads/" + downloadName

			if err := downloadDriveFile(client, downloadUrl, destPath, driveLink); err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Download failed: " + err.Error(), "progress": 0})
				return
			}

			// Get file info
			fileInfo, err := os.Stat(destPath)
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to get file info: " + err.Error(), "progress": 100})
				return
			}

			// Generate IDs
			entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
			ms := ulid.Timestamp(time.Now())
			streamID, err := ulid.New(ms, entropy)
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate stream ID", "progress": 100})
				return
			}

			mediaFileID, err := ulid.New(ulid.Timestamp(time.Now()), entropy)
			if err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to generate media file ID", "progress": 100})
				return
			}

			// Determine media type from MIME type
			mediaType := models.MediaTypeVideo
			if strings.HasPrefix(file.MimeType, "audio/") {
				mediaType = models.MediaTypeAudio
			}

			// Start a transaction
			tx := h.DB.Begin()

			// Create stream record
			streamName := fmt.Sprintf("Stream %s", time.Now().Format("2006-01-02 15:04:05"))
			stream := models.Stream{
				ID:         streamID.String(),
				Name:       streamName,
				Status:     "stopped",
				UserID:     userID,
				CreatedAt:  time.Now(),
				UpdatedAt:  time.Now(),
				MediaFiles: []models.MediaFile{},
			}

			if err := tx.Create(&stream).Error; err != nil {
				tx.Rollback()
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to create stream: " + err.Error(), "progress": 100})
				return
			}

			// Create media file record
			mediaFile := models.MediaFile{
				ID:        mediaFileID.String(),
				StreamID:  stream.ID,
				FileName:  downloadName,
				FilePath:  destPath,
				FileSize:  fileInfo.Size(),
				MediaType: mediaType,
				MimeType:  file.MimeType,
				IsPrimary: true,
				Order:     0,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
				UserId:    userID,
			}

			log.Println("mediaFile", mediaFile)

			if err := tx.Create(&mediaFile).Error; err != nil {
				tx.Rollback()
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to create media file: " + err.Error(), "progress": 100})
				return
			}

			// Commit transaction
			if err := tx.Commit().Error; err != nil {
				job.SetDriveProgress(driveLink, map[string]interface{}{"error": "Failed to commit transaction: " + err.Error(), "progress": 100})
				return
			}

			job.SetDriveProgress(driveLink, map[string]interface{}{"message": "Done", "progress": 100, "streamId": stream.ID})
		}(userID.(string), driveLink)

		// Respond immediately so UI is not blocked
		c.JSON(http.StatusOK, gin.H{"message": "Google Drive download started"})
		return
	}

	// Handle file uploads
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "No files provided"})
		return
	}

	files := form.File["videoFiles"]
	if len(files) == 0 {
		c.JSON(400, gin.H{"error": "No files provided"})
		return
	}

	// Start a transaction for all file operations
	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create the stream first
	if err := tx.Create(&stream).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{"error": "Failed to create stream: " + err.Error()})
		return
	}

	results := make([]uploadResult, 0, len(files))
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, fileHeader := range files {
		wg.Add(1)
		go func(fileHeader *multipart.FileHeader) {
			defer wg.Done()
			result := uploadResult{
				FileName: fileHeader.Filename,
			}

			// Process file
			file, err := fileHeader.Open()
			if err != nil {
				result.Message = "Failed to open file: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}
			defer file.Close()

			// Generate unique filename
			ext := filepath.Ext(fileHeader.Filename)
			fileNameWithoutExtension := strings.TrimSuffix(fileHeader.Filename, ext)
			fileNameWithoutExtension = strings.ReplaceAll(fileNameWithoutExtension, " ", "-")
			fileName := fmt.Sprintf("file-%d-%s%s",
				time.Now().UnixNano(),
				normalizeFileName(fileNameWithoutExtension),
				ext)

			uploadPath := "./uploads/" + fileName

			// Save file
			out, err := os.Create(uploadPath)
			if err != nil {
				result.Message = "Failed to create file: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}
			defer out.Close()

			if _, err = io.Copy(out, file); err != nil {
				result.Message = "Failed to save file: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}

			// Get file size by seeking to end
			size, err := file.Seek(0, io.SeekEnd)
			if err != nil {
				result.Message = "Failed to get file size: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}
			// Seek back to start for the actual file copy
			if _, err := file.Seek(0, io.SeekStart); err != nil {
				result.Message = "Failed to reset file pointer: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}

			// Determine media type from MIME type
			mediaType := models.MediaTypeVideo
			mimeType := fileHeader.Header.Get("Content-Type")
			if strings.HasPrefix(mimeType, "audio/") {
				mediaType = models.MediaTypeAudio
			}

			// Generate a new ULID for the media file
			mediaFileID, err := ulid.New(ulid.Timestamp(time.Now()), entropy)
			if err != nil {
				result.Message = "Failed to generate media file ID: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}

			// Create media file record
			mediaFile := models.MediaFile{
				ID:        mediaFileID.String(),
				StreamID:  stream.ID,
				FileName:  fileName,
				FilePath:  uploadPath,
				FileSize:  size,
				MediaType: mediaType,
				MimeType:  mimeType,
				IsPrimary: len(results) == 0, // First file is primary
				Order:     len(results),      // Maintain upload order
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
				UserId:    userID.(string),
			}

			// Add media file
			if err := tx.Create(&mediaFile).Error; err != nil {
				result.Message = "Failed to register media file: " + err.Error()
				mu.Lock()
				results = append(results, result)
				mu.Unlock()
				return
			}

			result.Success = true
			result.FilePath = uploadPath
			result.StreamID = stream.ID
			result.Message = "File uploaded successfully"

			mu.Lock()
			results = append(results, result)
			mu.Unlock()

		}(fileHeader)
	}

	// Wait for all uploads to complete
	wg.Wait()

	// Check if all uploads were successful
	successCount := 0
	for _, result := range results {
		if result.Success {
			successCount++
		}
	}

	if successCount == 0 {
		tx.Rollback()
		c.JSON(500, gin.H{
			"error":   "All file uploads failed",
			"results": results,
		})
		return
	}

	// Update the stream with the latest changes
	stream.UpdatedAt = time.Now()
	if err := tx.Save(&stream).Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{
			"error":   "Failed to update stream: " + err.Error(),
			"results": results,
		})
		return
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		c.JSON(500, gin.H{
			"error":   "Failed to save changes: " + err.Error(),
			"results": results,
		})
		return
	}

	message := fmt.Sprintf("Successfully uploaded %d of %d files", successCount, len(files))
	c.JSON(http.StatusOK, gin.H{
		"message":  message,
		"streamId": stream.ID,
		"results":  results,
	})
}
