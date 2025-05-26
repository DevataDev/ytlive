package models

import (
	"time"

	"gorm.io/gorm"
)

type MediaType string

const (
	MediaTypeVideo MediaType = "video"
	MediaTypeAudio MediaType = "audio"
)

type MediaFile struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	StreamID    string         `gorm:"not null;index" json:"stream_id"`
	FileName    string         `gorm:"not null" json:"file_name"`
	FilePath    string         `gorm:"not null" json:"file_path"`
	FileSize    int64          `gorm:"not null" json:"file_size"`
	MediaType   MediaType      `gorm:"not null" json:"media_type"`
	MimeType    string         `gorm:"not null" json:"mime_type"`
	IsPrimary   bool           `gorm:"default:false" json:"is_primary"`
	Order       int            `gorm:"default:0" json:"order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
