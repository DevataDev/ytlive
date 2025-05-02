package handlers

import (
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"windsorf-youtube-live/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

type StreamHandler struct {
	DB *gorm.DB
}

// PUT /api/streams/:id/maxbitrate
func (h *StreamHandler) SetMaxBitrate(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		MaxBitrate *int `json:"MaxBitrate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.MaxBitrate = req.MaxBitrate
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update max bitrate"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Max bitrate updated"})
}

// GET /api/streams - list streams for current user
func (h *StreamHandler) ListStreams(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	// Parse pagination params
	page := 1
	perPage := 5
	if p := c.Query("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := c.Query("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 {
			perPage = n
		}
	}

	var total int64
	h.DB.Model(&models.Stream{}).Where("user_id = ?", userID).Count(&total)
	var streams []models.Stream
	if err := h.DB.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(perPage).
		Offset((page - 1) * perPage).
		Find(&streams).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch streams"})
		return
	}
	// Add file size info for each stream
	for i, s := range streams {
		if s.FilePath != nil && *s.FilePath != "" {
			videoPath := "." + filepath.Clean("/"+*s.FilePath)
			if fi, err := os.Stat(videoPath); err == nil {
				streams[i].FileName = s.FileName // ensure not empty
				if streams[i].FilePath == nil {
					streams[i].FilePath = s.FilePath
				}
				if fs, ok := fi.Size(), true; ok {
					c.Set("file_size_"+s.ID, fs)
					streams[i].FileSizeBytes = fs
				}
			}
		}
	}
	var countLive, countScheduled int64
	h.DB.Model(&models.Stream{}).Where("status = ?", "live").Where("user_id = ?", userID).Count(&countLive)
	h.DB.Model(&models.Stream{}).Where("status = ?", "scheduled").Where("user_id = ?", userID).Count(&countScheduled)
	resp := make([]map[string]interface{}, 0, len(streams))
	for _, s := range streams {
		item := map[string]interface{}{
			"ID":               s.ID,
			"FileName":         s.FileName,
			"FilePath":         s.FilePath,
			"Status":           s.Status,
			"GoogleDriveLink":  s.GoogleDriveLink,
			"ScheduledAt":      s.ScheduledAt,
			"ScheduledStartAt": s.ScheduledStartAt,
			"ScheduledEndAt":   s.ScheduledEndAt,
			"StartedAt":        s.StartedAt,
			"StoppedAt":        s.StoppedAt,
			"StreamKey":        s.StreamKey,
			"MaxBitrate":       s.MaxBitrate,
			"UserId":           s.UserId,
			"RTMPUrl":          s.RTMPUrl,
			"LoopVideo":        s.LoopVideo,
			"LoopCount":        s.LoopCount,
			"FfmpegPID":        s.FfmpegPID,
			"CreatedAt":        s.CreatedAt,
			"FileSizeBytes":    s.FileSizeBytes,
		}
		if s.FilePath != nil && *s.FilePath != "" {
			if fs, ok := c.Get("file_size_" + s.ID); ok {
				item["FileSizeBytes"] = fs
			}
		}
		resp = append(resp, item)
	}
	c.JSON(http.StatusOK, gin.H{"streams": resp, "page": page, "per_page": perPage, "total": total, "countLive": countLive, "countScheduled": countScheduled})
	return
}

// POST /api/streams - create a new stream for current user
func (h *StreamHandler) CreateStream(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	var req struct {
		FileName        string  `json:"FileName"`
		FilePath        *string `json:"FilePath"`
		GoogleDriveLink *string `json:"GoogleDriveLink"`
		MaxBitrate      *int    `json:"MaxBitrate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	stream := models.Stream{
		FileName:        req.FileName,
		FilePath:        req.FilePath,
		GoogleDriveLink: req.GoogleDriveLink,
		Status:          "stopped",
		MaxBitrate:      req.MaxBitrate,
		UserId:          userID.(string),
		LoopVideo:       true,
		RTMPUrl:         "rtmp://a.rtmp.youtube.com/live2/",
	}
	if err := h.DB.Create(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stream"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"stream": stream})
}

// POST /api/streams/:id/start
func (h *StreamHandler) StartStream(c *gin.Context) {
	id := c.Param("id")
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	if stream.Status == "scheduled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This stream has been scheduled and cannot be started manually."})
		return
	}
	// Existing logic to start the stream (call your StartStreamWorker, update status, etc.)
	// ...
	c.JSON(http.StatusOK, gin.H{"message": "Stream started"})
}

// PUT /api/streams/:id/schedule
func (h *StreamHandler) SetSchedule(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		ScheduledAt string `json:"ScheduledAt"`
		StoppedAt   string `json:"StoppedAt"`
		Timezone    string `json:"Timezone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	if req.ScheduledAt == "" || req.StoppedAt == "" {
		// update stream scheduledStartAt and scheduledEndAt to null
		stream.ScheduledStartAt = nil
		stream.ScheduledEndAt = nil
		stream.ScheduledAt = nil
		defaultLoopCount := -1
		stream.LoopCount = &defaultLoopCount
		if err := h.DB.Save(&stream).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stream"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Stream scheduler removed"})
		return
	}

	// convert start and end from local time to utc
	timezone := req.Timezone
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid timezone"})
		return
	}
	start, err1 := time.ParseInLocation("2006-01-02T15:04", req.ScheduledAt, loc)
	end, err2 := time.ParseInLocation("2006-01-02T15:04", req.StoppedAt, loc)
	scheduledAt := time.Now().UTC()

	// reduce the time from local timezone to utc
	start = start.UTC()
	end = end.UTC()
	now := time.Now().UTC()

	if err1 != nil || err2 != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date/time format"})
		return
	}
	if start.Before(now) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start time cannot be earlier than the current time"})
		return
	}
	if end.Before(start) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "End time cannot be earlier than start time"})
		return
	}
	stream.ScheduledStartAt = &start
	stream.ScheduledEndAt = &end
	stream.ScheduledAt = &scheduledAt
	defaultLoopCount := -1
	stream.LoopCount = &defaultLoopCount
	stream.Status = "scheduled"
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to schedule stream"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream scheduled"})
}

// PUT /api/streams/:id/duration
func (h *StreamHandler) SetDuration(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		DurationHours int `json:"DurationHours"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.DurationHours < 0 || req.DurationHours > 24 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Duration must be between 0 and 24 hours"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.ScheduledStartAt = nil
	if req.DurationHours == 0 {
		stream.ScheduledEndAt = nil // Unlimited
	} else {
		end := time.Now().UTC().Add(time.Duration(req.DurationHours) * time.Hour)
		stream.ScheduledEndAt = &end
		stream.ScheduledStartAt = nil
		current := time.Now().UTC()
		stream.ScheduledAt = &current
		defaultLoopCount := -1
		stream.LoopCount = &defaultLoopCount
	}
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set duration"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream duration set"})
}

// PUT /api/streams/:id/rename
func (h *StreamHandler) RenameFile(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		FileName string `json:"FileName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.FileName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.FileName = req.FileName
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rename file"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "File renamed"})
}

// PUT /api/streams/:id/loop
func (h *StreamHandler) SetLoopVideo(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		LoopVideo bool `json:"LoopVideo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.LoopVideo = req.LoopVideo
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update loop video setting"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Loop video setting updated"})
}

// PUT /api/streams/:id/loopcount
func (h *StreamHandler) SetLoopCount(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		LoopCount int `json:"LoopCount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if req.LoopCount < -1 {
		req.LoopCount = -1
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.LoopCount = &req.LoopCount
	stream.LoopVideo = true
	// remove scheduled start and end
	stream.ScheduledStartAt = nil
	stream.ScheduledEndAt = nil
	stream.ScheduledAt = nil

	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set loop count"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Loop count updated"})
}

// PUT /api/streams/:id/rtmpurl
func (h *StreamHandler) SetRTMPUrl(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		RTMPUrl string `json:"rtmp_url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	var stream models.Stream
	if err := h.DB.First(&stream, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}
	stream.RTMPUrl = req.RTMPUrl
	if err := h.DB.Save(&stream).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set RTMP URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "RTMP URL updated"})
}

// POST /api/streams/:id/clone
func (h *StreamHandler) CloneStream(c *gin.Context) {
	id := c.Param("id")
	var orig models.Stream
	if err := h.DB.First(&orig, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	newId, err := ulid.New(ms, entropy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate ID"})
		return
	}
	clone := orig
	clone.ID = newId.String()
	clone.CreatedAt = time.Now()
	clone.UpdatedAt = time.Now()
	clone.DeletedAt = gorm.DeletedAt{}
	clone.Status = "stopped"
	// Optionally, clear fields like StreamKey, ScheduledAt, ScheduledStartAt, ScheduledEndAt, etc.
	clone.StreamKey = ""
	clone.ScheduledAt = nil
	clone.ScheduledStartAt = nil
	clone.ScheduledEndAt = nil
	clone.FfmpegPID = nil
	clone.StartedAt = nil
	clone.StoppedAt = nil

	// copy the file
	if orig.FilePath != nil {
		newFileName := fmt.Sprintf("clone-%d-%s.mp4", time.Now().UnixMilli(), sanitizeFileName(orig.FileName))
		newFilePath := "./uploads/" + newFileName
		if err := copyFile(*orig.FilePath, newFilePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy file"})
			return
		}
		clone.FilePath = &newFilePath
	}

	if err := h.DB.Create(&clone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clone stream"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Stream cloned", "id": clone.ID})
}

// ServeVideoPreview serves a video file for preview, requires JWT auth
func (h *StreamHandler) ServeVideoPreview(c *gin.Context) {
	// Authenticate user via JWT (middleware should already do this)
	file := c.Query("file")
	if file == "" {
		c.JSON(400, gin.H{"error": "file parameter required"})
		return
	}
	// Only allow safe file paths (no directory traversal)
	if strings.Contains(file, "..") {
		c.JSON(400, gin.H{"error": "invalid file path"})
		return
	}
	// Build full path
	videoPath := filepath.Join("uploads", filepath.Clean("/"+file))
	if _, err := os.Stat(videoPath); os.IsNotExist(err) {
		c.JSON(404, gin.H{"error": "file not found"})
		return
	}
	c.File(videoPath)
}

// ServeVideoPreviewByID serves a video file for preview by stream ID, requires JWT auth
func (h *StreamHandler) ServeVideoPreviewByID(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(400, gin.H{"error": "stream_id required"})
		return
	}
	// Find stream in DB
	var stream models.Stream
	db := h.DB
	err := db.Where("id = ?", streamID).First(&stream).Error
	if err != nil {
		c.JSON(404, gin.H{"error": "stream not found"})
		return
	}
	if stream.FilePath == nil || *stream.FilePath == "" {
		c.JSON(404, gin.H{"error": "no file for this stream"})
		return
	}
	file := *stream.FilePath
	if strings.Contains(file, "..") {
		c.JSON(400, gin.H{"error": "invalid file path"})
		return
	}
	// Instead of serving the file directly, redirect to the static uploads URL
	// Assuming uploads are served at /uploads/ and file is relative to uploads dir
	// Remove leading slashes from file path if present
	cleanFile := strings.TrimLeft(file, "/")
	c.Redirect(302, "/"+cleanFile)
}

// GET /api/streams/upload/progress
// Register the progress endpoint in your router setup (main.go):
// router.GET("/api/streams/upload/progress", streamHandler.GetDriveUploadProgress)
func (h *StreamHandler) GetDriveUploadProgress(c *gin.Context) {
	driveLink := c.Query("driveLink")
	if driveLink == "" {
		driveLink = c.PostForm("driveLink")
	}
	if driveLink == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing driveLink param"})
		return
	}
	// Use a simple in-memory map for demo; replace with Redis/db for production
	progress, ok := models.GetDriveProgress(driveLink)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"progress": 0, "status": "Starting..."})
		return
	}
	c.JSON(http.StatusOK, progress)
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func sanitizeFileName(fileName string) string {
	normalized := strings.ReplaceAll(fileName, " ", "-")
	normalized = strings.ReplaceAll(normalized, "/", "-")
	normalized = strings.ReplaceAll(normalized, "\\", "-")
	normalized = strings.ReplaceAll(normalized, ".mp4", "")
	return normalized
}
