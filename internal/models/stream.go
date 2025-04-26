package models

import (
    "gorm.io/gorm"
    "time"
)

type Stream struct {
    ID              string         `gorm:"primaryKey"`
    FileName        string         `gorm:"not null"`
    FilePath        *string        `gorm:"column:file_path" json:"FilePath,omitempty"` // Optional: path to stored video file
    GoogleDriveLink *string        `gorm:"default:null"` // Optional
    Status          string         `gorm:"not null"` // "live", "scheduled", "stopped"
    FfmpegPID       *int           `gorm:"default:null"` // Optional, for managing ffmpeg process
    ScheduledAt     *time.Time
    StartedAt       *time.Time
    StoppedAt       *time.Time
    CreatedAt       time.Time
    UpdatedAt       time.Time
    DeletedAt       gorm.DeletedAt `gorm:"index"`
    StreamKey       string         `gorm:"column:stream_key" json:"StreamKey"`
    MaxBitrate       *int           `gorm:"column:max_bitrate" json:"MaxBitrate,omitempty"`
    UserId          string         `gorm:"not null;index" json:"UserId"` // New field for user reference
}
