package models

import (
	"time"

	"gorm.io/gorm"
)

type Mirror struct {
	ID          string `gorm:"primaryKey"`
	RoomId      string `gorm:"default:null" json:"RoomId"`
	DisplayName string `gorm:"default:null" json:"DisplayName"`
	LiveUrl     string `gorm:"default:null" json:"LiveUrl"`
	RtmpUrl     string `gorm:"default:null" json:"RtmpUrl"`
	StreamKey   string `gorm:"default:null" json:"StreamKey"`
	UserAgent   string `gorm:"default:null" json:"UserAgent"`
	IsAlive     bool   `gorm:"default:false" json:"IsAlive"`
	StartedAt   *time.Time
	StoppedAt   *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
	FFmpegPID   *int           `gorm:"ffmpeg_pid;default:null" json:"FFmpegPID"`
	Status      string         `gorm:"default:null" json:"Status"`   // "live", "stopped", "scheduled", etc.
	UserId      string         `gorm:"not null;index" json:"UserId"` // New field for user reference
}
