package models

import (
	"time"

	"gorm.io/gorm"
)

type Monitor struct {
	ID            string `gorm:"primaryKey"`
	UniqueId      string `gorm:"default:null" json:"UniqueId"`
	StartedAt     *time.Time
	StoppedAt     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
	LastCheckedAt *time.Time
	RtmpUrl       string `gorm:"default:null" json:"RtmpUrl"`
	StreamKey     string `gorm:"default:null" json:"StreamKey"`
	UserId        string `gorm:"not null;index" json:"UserId"`
	IsLive        bool   `gorm:"default:false" json:"IsLive"`
}
