package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"

	"windsorf-youtube-live/internal/models"
)

type MediaFileHandler struct {
	DB *gorm.DB
}

// ListMediaFiles returns all media files for a stream
// GET /api/streams/:id/media
func (h *MediaFileHandler) ListMediaFiles(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}

	// Verify stream exists
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", streamID).Error; err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}

	// Get all media files for this stream
	var mediaFiles []models.MediaFile
	if err := h.DB.Where("stream_id = ?", streamID).Order("created_at DESC").Find(&mediaFiles).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch media files"})
		return
	}

	c.JSON(200, gin.H{"files": mediaFiles})
}

// UploadMediaFile handles file upload for a stream
// POST /api/streams/:id/media
func (h *MediaFileHandler) UploadMediaFile(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}

	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Verify stream exists
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", streamID).Error; err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}

	// Parse form data
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(400, gin.H{"error": "file is required"})
		return
	}

	// Get file extension and validate
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{
		".mp4": true,
		".mkv": true,
		".wav": true,
		".mp3": true,
	}

	if !allowedExts[ext] {
		c.JSON(400, gin.H{"error": "unsupported file type. Only MP4, MKV, WAV, and MP3 are allowed"})
		return
	}

	// Validate MIME type
	allowedMimeTypes := map[string]bool{
		"video/mp4":        true,
		"video/x-matroska": true, // MKV
		"audio/wav":        true,
		"audio/wave":       true,
		"audio/x-wav":      true,
		"audio/mpeg":       true, // MP3
		"audio/mp3":        true,
	}

	// Open the file to check its actual content type
	f, err := file.Open()
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to read file"})
		return
	}
	defer f.Close()

	// Only read the first 512 bytes to determine the content type
	buffer := make([]byte, 512)
	_, err = f.Read(buffer)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to read file content"})
		return
	}

	// Reset the file read pointer
	_, err = f.Seek(0, 0)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to reset file pointer"})
		return
	}

	// Get the content type from the first 512 bytes
	contentType := http.DetectContentType(buffer)
	if !allowedMimeTypes[contentType] {
		c.JSON(400, gin.H{"error": "invalid file content. Only MP4, MKV, WAV, and MP3 files are allowed"})
		return
	}

	mediaType := ""
	switch ext {
	case ".mp4", ".mkv":
		mediaType = "video"
	case ".mp3", ".wav":
		mediaType = "audio"
	}

	if mediaType == "" {
		mediaType = "video" // default to video if type couldn't be determined
	}

	// Create uploads directory if it doesn't exist
	uploadDir := filepath.Join("uploads", streamID)
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(500, gin.H{"error": "failed to create upload directory"})
		return
	}

	// Generate unique filename
	fileName := fmt.Sprintf("%s_%d%s", strings.TrimSuffix(filepath.Base(file.Filename), ext), time.Now().Unix(), ext)
	filePath := filepath.Join(uploadDir, fileName)

	// Save the file
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(500, gin.H{"error": "failed to save file"})
		return
	}

	// Create media file record
	t := time.Now()
	entropy := ulid.Monotonic(rand.New(rand.NewSource(t.UnixNano())), 0)
	id := ulid.MustNew(ulid.Timestamp(t), entropy)

	mediaFile := models.MediaFile{
		ID:        id.String(),
		StreamID:  streamID,
		FileName:  file.Filename,
		FilePath:  filePath,
		FileSize:  file.Size,
		MediaType: models.MediaType(mediaType),
		MimeType:  file.Header.Get("Content-Type"),
		UserId:    userID.(string),
	}

	if err := h.DB.Create(&mediaFile).Error; err != nil {
		// Clean up the uploaded file if DB operation fails
		os.Remove(filePath)
		c.JSON(500, gin.H{"error": "failed to save media file record"})
		return
	}

	c.JSON(200, gin.H{"message": "file uploaded successfully", "file": mediaFile})
}

// DeleteMediaFile deletes a media file
// DELETE /api/streams/media/:id
func (h *MediaFileHandler) DeleteMediaFile(c *gin.Context) {
	mediaID := c.Param("id")
	if mediaID == "" {
		c.JSON(400, gin.H{"error": "media_id required"})
		return
	}

	// Get media file
	var mediaFile models.MediaFile
	if err := h.DB.First(&mediaFile, "id = ?", mediaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}

	// Delete file from storage
	if err := os.Remove(mediaFile.FilePath); err != nil && !os.IsNotExist(err) {
		c.JSON(500, gin.H{"error": "failed to delete file from storage"})
		return
	}

	// Delete record from database
	if err := h.DB.Delete(&mediaFile).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to delete media file record"})
		return
	}

	c.JSON(200, gin.H{"message": "media file deleted successfully"})
}

// GetMediaPreview serves a preview of a media file
// GET /api/streams/:streamId/media/:mediaId/preview
func (h *MediaFileHandler) GetMediaPreview(c *gin.Context) {
	streamID := c.Param("id")
	mediaID := c.Param("mediaId")

	// Verify media file exists and belongs to the stream
	var mediaFile models.MediaFile
	if err := h.DB.First(&mediaFile, "id = ? AND stream_id = ?", mediaID, streamID).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}

	// Check if file exists
	if _, err := os.Stat(mediaFile.FilePath); os.IsNotExist(err) {
		c.JSON(404, gin.H{"error": "media file not found on disk"})
		return
	}

	// Set appropriate headers based on file type
	contentType := mediaFile.MimeType
	if contentType == "" {
		// Fallback to common MIME types based on file extension
		ext := strings.ToLower(filepath.Ext(mediaFile.FilePath))
		switch ext {
		case ".mp4":
			contentType = "video/mp4"
		case ".mkv":
			contentType = "video/x-matroska"
		case ".wav":
			contentType = "audio/wav"
		case ".mp3":
			contentType = "audio/mpeg"
		default:
			contentType = "application/octet-stream"
		}
	}

	// Set content disposition to inline for preview
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filepath.Base(mediaFile.FilePath)))
	c.Header("Content-Type", contentType)
	c.File(mediaFile.FilePath)
}

func (h *MediaFileHandler) ListAllMediaFilesByUser(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var limit int
	var offset int
	if c.Query("limit") != "" {
		limit, _ = strconv.Atoi(c.Query("limit"))
	}
	if c.Query("offset") != "" {
		offset, _ = strconv.Atoi(c.Query("offset"))
	}

	var typeFile string
	if c.Query("type") != "" {
		typeFile = c.Query("type")
	}

	if typeFile == "" {
		typeFile = "video"
	}

	var query string
	if c.Query("query") != "" {
		query = c.Query("query")
	}
	if query != "" {
		query = "%" + query + "%"
	}

	var totalFiles int64
	if query != "" {
		if err := h.DB.Model(&models.MediaFile{}).Where("user_id =? AND media_type =? AND file_name LIKE ?", userID, typeFile, query).Count(&totalFiles).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch media files"})
			return
		}
	} else {
		if err := h.DB.Model(&models.MediaFile{}).Where("user_id = ? AND media_type = ?", userID, typeFile).Count(&totalFiles).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch media files"})
			return
		}
	}

	// Get all media files for this stream
	var mediaFiles []models.MediaFile
	if query != "" {
		if err := h.DB.Where("user_id =? AND media_type =? AND file_name LIKE?", userID, typeFile, query).Limit(limit).Offset(offset).Order("created_at DESC").Find(&mediaFiles).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch media files"})
			return
		}
	} else {
		if err := h.DB.Where("user_id = ? and media_type = ?", userID, typeFile).Limit(limit).Offset(offset).Order("created_at DESC").Find(&mediaFiles).Error; err != nil {
			c.JSON(500, gin.H{"error": "failed to fetch media files"})
			return
		}
	}

	var hasMore bool
	if offset+limit < int(totalFiles) {
		hasMore = true
	}
	c.JSON(200, gin.H{"files": mediaFiles, "pagination": gin.H{"total": totalFiles, "limit": limit, "offset": offset, "has_more": hasMore}})
}
