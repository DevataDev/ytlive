package utils

import (
	"fmt"
	"log"
	"time"

	"windsorf-youtube-live/internal/models"

	"gorm.io/gorm"
)

// ActivityLogger provides methods to log activities
type ActivityLogger struct {
	DB *gorm.DB
}

// NewActivityLogger creates a new ActivityLogger
func NewActivityLogger(db *gorm.DB) *ActivityLogger {
	return &ActivityLogger{DB: db}
}

// LogActivity logs a new activity
func (l *ActivityLogger) LogActivity(userID, title, description string, activityType models.ActivityType, status models.ActivityStatus, streamID *string, streamName *string, metadata map[string]interface{}) error {
	log.Println("Logging activity:", title, description, activityType, status, *streamID, *streamName, metadata)
	activity := &models.Activity{
		ID:          generateID(),
		UserID:      userID,
		Type:        activityType,
		Status:      status,
		Title:       title,
		Description: description,
		StreamID:    streamID,
		StreamName:  streamName,
		Metadata:    metadata,
		CreatedAt:   time.Now(),
	}
	return models.LogActivity(l.DB, activity)
}

// LogStreamStarted logs when a stream starts
func (l *ActivityLogger) LogStreamStarted(userID, streamID, streamName string) error {
	return l.LogActivity(
		userID,
		"Stream Started",
		fmt.Sprintf("Stream '%s' has started", streamName),
		models.ActivityTypeStreamStarted,
		models.ActivityStatusSuccess,
		&streamID,
		&streamName,
		nil,
	)
}

// LogStreamStopped logs when a stream stops
func (l *ActivityLogger) LogStreamStopped(userID, streamID, streamName string) error {
	return l.LogActivity(
		userID,
		"Stream Stopped",
		fmt.Sprintf("Stream '%s' has stopped", streamName),
		models.ActivityTypeStreamStopped,
		models.ActivityStatusSuccess,
		&streamID,
		&streamName,
		nil,
	)
}

// LogStreamError logs when a stream encounters an error
func (l *ActivityLogger) LogStreamError(userID, streamID, streamName, errorMsg string) error {
	return l.LogActivity(
		userID,
		"Stream Error",
		fmt.Sprintf("Stream '%s' encountered an error: %s", streamName, errorMsg),
		models.ActivityTypeStreamError,
		models.ActivityStatusError,
		&streamID,
		&streamName,
		map[string]interface{}{"error": errorMsg},
	)
}

// LogVideoUploaded logs when a video is uploaded
func (l *ActivityLogger) LogVideoUploaded(userID, fileName string, fileSize int64) error {
	return l.LogActivity(
		userID,
		"Video Uploaded",
		fmt.Sprintf("Uploaded video '%s' (%.2f MB)", fileName, float64(fileSize)/(1024*1024)),
		models.ActivityTypeVideoUploaded,
		models.ActivityStatusSuccess,
		nil,
		nil,
		map[string]interface{}{
			"file_name": fileName,
			"file_size": fileSize,
		},
	)
}

// LogVideoProcessed logs when a video is processed
func (l *ActivityLogger) LogVideoProcessed(userID, fileName string) error {
	return l.LogActivity(
		userID,
		"Video Processed",
		fmt.Sprintf("Video '%s' has been processed", fileName),
		models.ActivityTypeVideoProcessed,
		models.ActivityStatusSuccess,
		nil,
		nil,
		map[string]interface{}{
			"file_name": fileName,
		},
	)
}

// generateID generates a simple ID for activities
func generateID() string {
	return fmt.Sprintf("act_%d", time.Now().UnixNano())
}
