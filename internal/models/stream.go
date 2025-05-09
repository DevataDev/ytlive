package models

import (
	"time"

	"gorm.io/gorm"
)

type Stream struct {
	ID               string  `gorm:"primaryKey"`
	FileName         string  `gorm:"not null"`
	FilePath         *string `gorm:"column:file_path" json:"FilePath,omitempty"` // Optional: path to stored video file
	GoogleDriveLink  *string `gorm:"default:null"`                               // Optional
	Status           string  `gorm:"not null"`                                   // "live", "scheduled", "stopped"
	FfmpegPID        *int    `gorm:"default:null"`                               // Optional, for managing ffmpeg process
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
	UserId           string         `gorm:"not null;index" json:"UserId"` // New field for user reference
	FileSizeBytes    int64          `gorm:"-" json:"FileSizeBytes,omitempty"`
	//optional channel id
	ChannelId string `gorm:"default:null" json:"ChannelId"`
}
