package models

import (
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
