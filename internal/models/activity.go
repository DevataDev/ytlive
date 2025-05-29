package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

type ActivityType string

const (
	ActivityTypeStreamStarted   ActivityType = "stream_started"
	ActivityTypeStreamStopped  ActivityType = "stream_stopped"
	ActivityTypeStreamScheduled ActivityType = "stream_scheduled"
	ActivityTypeStreamDeleted  ActivityType = "stream_deleted"
	ActivityTypeStreamError     ActivityType = "stream_error"
	ActivityTypeVideoUploaded   ActivityType = "video_uploaded"
	ActivityTypeVideoProcessed  ActivityType = "video_processed"
	ActivityTypeSystem          ActivityType = "system"
)

type ActivityStatus string

const (
	ActivityStatusSuccess  ActivityStatus = "success"
	ActivityStatusWarning  ActivityStatus = "warning"
	ActivityStatusError    ActivityStatus = "error"
	ActivityStatusInfo     ActivityStatus = "info"
	ActivityStatusPending  ActivityStatus = "pending"
)

// Metadata is a custom type to handle JSON data in the database
type Metadata map[string]interface{}

// Value implements the driver.Valuer interface
func (m Metadata) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

// Scan implements the sql.Scanner interface
func (m *Metadata) Scan(value interface{}) error {
	if value == nil {
		*m = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("invalid type for metadata")
	}
	return json.Unmarshal(b, m)
}

type Activity struct {
	ID          string         `gorm:"primaryKey;size:36" json:"id"`
	UserID      string         `gorm:"not null;index" json:"user_id"`
	Type        ActivityType   `gorm:"not null;index" json:"type"`
	Status      ActivityStatus `gorm:"not null;default:'success'" json:"status"`
	Title       string         `gorm:"not null" json:"title"`
	Description string         `gorm:"type:text" json:"description,omitempty"`
	StreamID    *string        `gorm:"index" json:"stream_id,omitempty"`
	StreamName  *string        `gorm:"-" json:"stream_name,omitempty"`
	Metadata    Metadata       `gorm:"type:json" json:"metadata,omitempty"`
	CreatedAt   time.Time      `gorm:"index" json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// TableName specifies the table name for the Activity model
func (Activity) TableName() string {
	return "activities"
}

// MigrateActivities handles database migrations for the Activity model
func MigrateActivities(db *gorm.DB) error {
	return db.AutoMigrate(&Activity{})
}

// LogActivity creates a new activity log entry
func LogActivity(db *gorm.DB, activity *Activity) error {
	if activity.CreatedAt.IsZero() {
		activity.CreatedAt = time.Now()
	}
	activity.UpdatedAt = time.Now()
	return db.Create(activity).Error
}

// GetRecentActivities returns recent activities for a user
func GetRecentActivities(db *gorm.DB, userID string, limit int) ([]Activity, error) {
	var activities []Activity
	err := db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&activities).Error
	return activities, err
}
