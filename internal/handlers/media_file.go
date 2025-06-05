package handlers

import (
	"encoding/binary"
	"fmt"
	"io"
	"log"
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

type MediaFileWithStreamCount struct {
	models.MediaFile
	StreamNames string          `json:"stream_names"`
	StreamCount int64           `json:"stream_count"`
	Streams     []models.Stream `json:"streams" gorm:"-"`
}

func (h *MediaFileHandler) GetMediaFilesWithFullStreamDetails(userID string, mediaType string, limit int, offset int, query string) ([]MediaFileWithStreamCount, error) {
	var err error
	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}

	if mediaType != "video" && mediaType != "audio" && mediaType != "all" {
		return nil, fmt.Errorf("type must be video or audio or all")
	}

	if query != "" {
		query = "%" + query + "%"
	}
	if limit == 0 {
		limit = 10
	}

	// First, get the media files with stream counts
	var mediaFiles []MediaFileWithStreamCount
	baseQuery := h.DB.Model(&models.MediaFile{}).
		Select("media_files.*, COALESCE(stream_info.stream_names, '') as stream_names, COALESCE(stream_info.stream_count, 0) as stream_count").
		Joins(`LEFT JOIN (
    SELECT 
        smf.media_file_id,
        GROUP_CONCAT(s.name, ', ') as stream_names,
        COUNT(DISTINCT s.id) as stream_count
    FROM stream_media_files smf
    LEFT JOIN streams s ON smf.stream_id = s.id AND s.deleted_at IS NULL
    GROUP BY smf.media_file_id
) as stream_info ON media_files.id = stream_info.media_file_id`)

	if query != "" {
		if mediaType == "all" {
			err = baseQuery.Where("media_files.user_id = ? AND (media_files.file_name LIKE ? OR media_files.file_path LIKE ?)", userID, query, query).
				Limit(limit).Offset(offset).Find(&mediaFiles).Error
		} else {
			err = baseQuery.Where("media_files.user_id = ? AND media_files.media_type = ? AND (media_files.file_name LIKE ? OR media_files.file_path LIKE ?)", userID, mediaType, query, query).
				Limit(limit).Offset(offset).Find(&mediaFiles).Error
		}
	} else {
		if mediaType == "all" {
			err = baseQuery.Where("media_files.user_id = ?", userID).
				Limit(limit).Offset(offset).Find(&mediaFiles).Error
		} else {
			err = baseQuery.Where("media_files.user_id = ? AND media_files.media_type = ?", userID, mediaType).
				Limit(limit).Offset(offset).Find(&mediaFiles).Error
		}
	}

	if err != nil {
		return nil, err
	}

	// Now get the full stream details for each media file
	for i, mediaFile := range mediaFiles {
		var streams []models.Stream
		err = h.DB.Table("streams").
			Joins("JOIN stream_media_files ON streams.id = stream_media_files.stream_id").
			Where("stream_media_files.media_file_id = ? AND streams.deleted_at is NULL", mediaFile.ID).
			Find(&streams).Error
		if err != nil {
			return nil, err
		}
		mediaFiles[i].Streams = streams
	}

	return mediaFiles, nil
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
	// Join with StreamMediaFile to filter by stream_id
	var mediaFiles []models.MediaFile
	if err := h.DB.Preload("StreamMediaFiles").Preload("StreamMediaFiles.Stream").
		Joins("JOIN stream_media_files ON media_files.id = stream_media_files.media_file_id").
		Where("stream_media_files.stream_id = ? AND stream_media_files.deleted_at IS NULL", streamID).
		Order("media_files.created_at DESC").
		Find(&mediaFiles).Error; err != nil {
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

	// Add media file to stream
	streamMediaFile := models.StreamMediaFile{
		StreamID:    streamID,
		MediaFileID: mediaFile.ID,
		Order:       0, // Assuming it's the first file
		IsPrimary:   false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.DB.Create(&streamMediaFile).Error; err != nil {
		// Clean up the uploaded file if DB operation fails
		os.Remove(filePath)
		c.JSON(500, gin.H{"error": "failed to add media file to stream"})
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

	// check if there is other media files using the same file_path then remove it
	var otherMediaFiles []models.MediaFile
	if err := h.DB.Where("file_path =?", mediaFile.FilePath).Find(&otherMediaFiles).Error; err == nil {
		for _, otherMediaFile := range otherMediaFiles {
			h.DB.Delete(&otherMediaFile)
		}
	}

	c.JSON(200, gin.H{"message": "media file deleted successfully"})
}

// GetMediaPreview serves a preview of a media file
// GET /api/streams/:streamId/media/:mediaId/preview
func (h *MediaFileHandler) GetMediaPreview(c *gin.Context) {
	mediaID := c.Param("mediaId")

	// Verify media file exists and belongs to the stream
	var mediaFile models.MediaFile
	if err := h.DB.First(&mediaFile, "id = ?", mediaID).Error; err != nil {
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

func (h *MediaFileHandler) GetMediaFilesWithStreamInfo(userID string) ([]models.MediaFile, error) {
	var mediaFiles []models.MediaFile

	err := h.DB.Where("user_id = ?", userID).
		Preload("Stream"). // This would require adding Stream relationship to MediaFile
		Find(&mediaFiles).Error

	return mediaFiles, err
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

	if typeFile != "video" && typeFile != "audio" && typeFile != "all" {
		c.JSON(400, gin.H{"error": "type must be video or audio or all"})
		return
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
		if typeFile == "all" {
			if err := h.DB.Model(&models.MediaFile{}).Where("user_id = ? AND (file_name LIKE ? OR file_path LIKE ?)", userID, query, query).Count(&totalFiles).Error; err != nil {
				c.JSON(500, gin.H{"error": "failed to fetch media files"})
				return
			}
		} else {
			if err := h.DB.Model(&models.MediaFile{}).Where("user_id = ? AND media_type = ? AND (file_name LIKE ? OR file_path LIKE ?)", userID, typeFile, query, query).Count(&totalFiles).Error; err != nil {
				c.JSON(500, gin.H{"error": "failed to fetch media files"})
				return
			}
		}
	} else {
		if typeFile == "all" {
			if err := h.DB.Model(&models.MediaFile{}).Where("user_id = ?", userID).Count(&totalFiles).Error; err != nil {
				c.JSON(500, gin.H{"error": "failed to fetch media files"})
				return
			}
		} else {
			if err := h.DB.Model(&models.MediaFile{}).Where("user_id = ? AND media_type = ?", userID, typeFile).Count(&totalFiles).Error; err != nil {
				c.JSON(500, gin.H{"error": "failed to fetch media files"})
				return
			}
		}
	}

	// Get all media files for this stream
	mediaFilesStream, err := h.GetMediaFilesWithFullStreamDetails(userID.(string), typeFile, limit, offset, query)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to fetch media files"})
		return
	}

	var hasMore bool
	if offset+limit < int(totalFiles) {
		hasMore = true
	}
	c.JSON(200, gin.H{"files": mediaFilesStream, "pagination": gin.H{"total": totalFiles, "limit": limit, "offset": offset, "has_more": hasMore}})
}

func (h *MediaFileHandler) MapMediaFile(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}

	_, ok := c.Get("user_id")
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

	var req struct {
		MediaID string `json:"media_id"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}

	// Verify media file exists
	var mediaFile models.MediaFile
	if err := h.DB.First(&mediaFile, "id =?", req.MediaID).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}

	// map media file to stream
	streamMediaFile := models.StreamMediaFile{
		StreamID:    streamID,
		MediaFileID: mediaFile.ID,
		Order:       0,
		IsPrimary:   false,
	}

	if err := h.DB.Create(&streamMediaFile).Error; err != nil {
		// Clean up the uploaded file if DB operation fails
		c.JSON(500, gin.H{"error": "failed to map media file record"})
		return
	}

	c.JSON(200, gin.H{"message": "file uploaded successfully", "file": mediaFile})
}

// 5. Update Handler untuk Many-to-Many Operations

// AddMediaFileToStream menambahkan media file ke stream (many-to-many)
func (h *MediaFileHandler) AddMediaFileToStream(c *gin.Context) {
	streamID := c.Param("stream_id")
	mediaFileID := c.Param("media_file_id")

	if streamID == "" || mediaFileID == "" {
		c.JSON(400, gin.H{"error": "stream_id and media_file_id required"})
		return
	}

	// Verify stream exists
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", streamID).Error; err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}

	// Verify media file exists
	var mediaFile models.MediaFile
	if err := h.DB.First(&mediaFile, "id = ?", mediaFileID).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}

	// Check if relationship already exists
	var existing models.StreamMediaFile
	if err := h.DB.Where("stream_id = ? AND media_file_id = ?", streamID, mediaFileID).First(&existing).Error; err == nil {
		c.JSON(409, gin.H{"error": "media file already added to this stream"})
		return
	}

	// Create relationship
	streamMediaFile := models.StreamMediaFile{
		StreamID:    streamID,
		MediaFileID: mediaFileID,
		Order:       0,     // You can get this from request body
		IsPrimary:   false, // You can get this from request body
	}

	if err := h.DB.Create(&streamMediaFile).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to add media file to stream"})
		return
	}

	c.JSON(200, gin.H{"message": "media file added to stream successfully"})
}

// RemoveMediaFileFromStream menghapus media file dari stream
func (h *MediaFileHandler) RemoveMediaFileFromStream(c *gin.Context) {
	streamID := c.Param("stream_id")
	mediaFileID := c.Param("media_file_id")

	if streamID == "" || mediaFileID == "" {
		c.JSON(400, gin.H{"error": "stream_id and media_file_id required"})
		return
	}

	// Delete relationship
	result := h.DB.Where("stream_id = ? AND media_file_id = ?", streamID, mediaFileID).Delete(&models.StreamMediaFile{})
	if result.Error != nil {
		c.JSON(500, gin.H{"error": "failed to remove media file from stream"})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"error": "relationship not found"})
		return
	}

	c.JSON(200, gin.H{"message": "media file removed from stream successfully"})
}

// GetStreamsUsingMediaFile mendapatkan semua stream yang menggunakan media file tertentu
func (h *MediaFileHandler) GetStreamsUsingMediaFile(c *gin.Context) {
	mediaFileID := c.Param("id")
	if mediaFileID == "" {
		c.JSON(400, gin.H{"error": "media_file_id required"})
		return
	}

	var mediaFile models.MediaFile
	if err := h.DB.Preload("StreamMediaFiles").Preload("StreamMediaFiles.Stream").First(&mediaFile, "id = ?", mediaFileID).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}

	c.JSON(200, gin.H{
		"media_file":   mediaFile,
		"streams":      mediaFile.StreamMediaFiles,
		"stream_count": len(mediaFile.StreamMediaFiles),
	})
}

func (h *MediaFileHandler) UnMapMediaFile(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}

	_, ok := c.Get("user_id")
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

	mediaId := c.Param("mediaId")

	// map media file to stream
	var streamMediaFile models.StreamMediaFile
	if err := h.DB.Where("stream_id =? AND media_file_id =?", streamID, mediaId).First(&streamMediaFile).Error; err != nil {
		c.JSON(404, gin.H{"error": "media file not found"})
		return
	}
	if err := h.DB.Delete(&streamMediaFile).Error; err != nil {
		c.JSON(500, gin.H{"error": "failed to unmap media file record"})
		return
	}

	c.JSON(200, gin.H{"message": "file unmap successfully"})
}

// UploadMediaFile handles file upload for a stream
// POST /api/streams/:id/media
func (h *MediaFileHandler) UploadMediaFileOnly(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	//parsing multiple files
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid form data"})
		return
	}
	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(400, gin.H{"error": "no files uploaded"})
		return
	}

	for _, file := range files {

		// Get file extension and validate
		ext := strings.TrimSpace(strings.ToLower(filepath.Ext(file.Filename)))
		allowedExts := map[string]bool{
			".mp4": true,
			".mkv": true,
			".wav": true,
			".mp3": true,
		}

		log.Println("ext", ext)
		log.Println("allowedExts", allowedExts[ext])

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

		// Get the content type from the first 512 bytes
		contentType := http.DetectContentType(buffer)

		if ext == ".mp4" || ext == ".mkv" || ext == ".mov" {

			// Reset the file read pointer
			_, err = f.Seek(0, 0)
			if err != nil {
				c.JSON(500, gin.H{"error": "failed to reset file pointer"})
				return
			}

			header := make([]byte, 12)
			_, err = io.ReadFull(f, header)
			if err != nil {
				log.Println("Error reading header:", err)
			}

			// Check MKV EBML signature
			if header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3 {
				log.Println("File type: MKV (Matroska)")
			}

			_ = binary.BigEndian.Uint32(header[:4])
			boxType := string(header[4:8])
			if boxType != "ftyp" {
				log.Printf("Unknown file type. First box is: %s\n", boxType)
			}

			majorBrand := string(header[8:12])
			allowedMajorBrands := map[string]bool{
				"mp42": true,
				"isom": true,
				"iso2": true,
				"mp41": true,
				"qt  ": true,
			}

			if !allowedMimeTypes[contentType] && !allowedMajorBrands[majorBrand] {
				log.Println("Unknown file type. Major brand:", majorBrand)
				c.JSON(400, gin.H{"error": "invalid file content. Only MP4, MKV, WAV, and MP3 files are allowed"})
				return
			}
		} else {
			if !allowedMimeTypes[contentType] {
				log.Println("Unknown file type. Content type:", contentType)
				c.JSON(400, gin.H{"error": "invalid file content. Only MP4, MKV, WAV, and MP3 files are allowed"})
				return
			}
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
		uploadDir := filepath.Join("uploads", userID.(string))
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Println("Error creating upload directory:", err)
			c.JSON(500, gin.H{"error": "failed to create upload directory"})
			return
		}

		// Generate unique filename
		fileName := fmt.Sprintf("%s_%d%s", strings.TrimSuffix(filepath.Base(file.Filename), ext), time.Now().Unix(), ext)
		filePath := filepath.Join(uploadDir, fileName)

		// Save the file
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			log.Println("Error saving file:", err) // Log the error for debuggin
			c.JSON(500, gin.H{"error": "failed to save file"})
			return
		}

		// Create media file record
		t := time.Now()
		entropy := ulid.Monotonic(rand.New(rand.NewSource(t.UnixNano())), 0)
		id := ulid.MustNew(ulid.Timestamp(t), entropy)

		mediaFile := models.MediaFile{
			ID:        id.String(),
			FileName:  file.Filename,
			FilePath:  filePath,
			FileSize:  file.Size,
			MediaType: models.MediaType(mediaType),
			MimeType:  file.Header.Get("Content-Type"),
			UserId:    userID.(string),
		}

		if err := h.DB.Create(&mediaFile).Error; err != nil {
			// Clean up the uploaded file if DB operation fails
			log.Println("Error saving media file record:", err) // Log the error for debuggin
			os.Remove(filePath)
			c.JSON(500, gin.H{"error": "failed to save media file record"})
			return
		}
	}

	c.JSON(200, gin.H{"message": "file uploaded successfully", "file": files})
}
