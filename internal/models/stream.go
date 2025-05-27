package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type Stream struct {
	ID               string `gorm:"primaryKey"`
	Name             string `gorm:"not null" json:"name"`
	Status           string `gorm:"not null"`     // "live", "scheduled", "stopped"
	FfmpegPID        *int   `gorm:"default:null"` // Optional, for managing ffmpeg process
	ScheduledAt      *time.Time
	ScheduledStartAt *time.Time `gorm:"column:scheduled_start_at;default:null" json:"ScheduledStartAt"`
	ScheduledEndAt   *time.Time `gorm:"column:scheduled_end_at;default:null" json:"ScheduledEndAt"`
	StartedAt        *time.Time
	StoppedAt        *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
	DeletedAt        gorm.DeletedAt `gorm:"index"`
	RTMPUrl          string         `gorm:"column:rtmp_url;default:'rtmp://a.rtmp.youtube.com/live2/'" json:"RTMPUrl"`
	LoopVideo        bool           `gorm:"column:loop_video;default:true" json:"LoopVideo"`
	StreamKey        string         `gorm:"column:stream_key" json:"StreamKey"`
	MaxBitrate       *int           `gorm:"column:max_bitrate" json:"MaxBitrate,omitempty"`
	LoopCount        *int           `gorm:"column:loop_count;default:-1" json:"LoopCount,omitempty"`
	UserID           string         `gorm:"not null;index" json:"UserId"`
	ChannelID        *string        `gorm:"default:null" json:"ChannelId,omitempty"`
	MediaFiles       []MediaFile    `gorm:"foreignKey:StreamID;constraint:OnDelete:CASCADE;" json:"media_files,omitempty"`
}

// MigrateStreams handles database migrations for the Stream model
func MigrateStreams(db *gorm.DB) error {
	// First, check if the name column exists and is NOT NULL
	var count int64
	db.Raw(`
		SELECT COUNT(*)
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE()
		AND TABLE_NAME = 'streams'
		AND COLUMN_NAME = 'name'
		AND IS_NULLABLE = 'NO'`).Scan(&count)

	// If name column is NOT NULL, we need to alter it to allow NULL
	if count > 0 {
		// First, add a temporary column
		err := db.Exec(`ALTER TABLE streams ADD COLUMN temp_name TEXT`).Error
		if err != nil {
			return fmt.Errorf("failed to add temp_name column: %v", err)
		}

		// Copy data to temporary column
		err = db.Exec(`UPDATE streams SET temp_name = name`).Error
		if err != nil {
			return fmt.Errorf("failed to copy data to temp_name: %v", err)
		}

		// Drop the old NOT NULL column
		err = db.Exec(`ALTER TABLE streams DROP COLUMN name`).Error
		if err != nil {
			return fmt.Errorf("failed to drop name column: %v", err)
		}

		// Rename temp column to name
		err = db.Exec(`ALTER TABLE streams CHANGE COLUMN temp_name name TEXT`).Error
		if err != nil {
			return fmt.Errorf("failed to rename temp_name to name: %v", err)
		}
	}

	// Now run the auto-migration for any other changes
	return db.AutoMigrate(&Stream{})
}
