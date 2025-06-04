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
	ID string `gorm:"primaryKey" json:"id"`
	// Hapus StreamID karena sekarang menggunakan many-to-many
	// StreamID  string         `gorm:"not null;index" json:"stream_id"`
	FileName      string         `gorm:"not null" json:"file_name"`
	FilePath      string         `gorm:"not null" json:"file_path"`
	FileSize      int64          `gorm:"not null" json:"file_size"`
	MediaType     MediaType      `gorm:"not null" json:"media_type"`
	MimeType      string         `gorm:"not null" json:"mime_type"`
	Duration      *float64       `gorm:"default:null" json:"duration,omitempty"`       // Durasi dalam detik
	Resolution    *string        `gorm:"default:null" json:"resolution,omitempty"`     // Resolusi video (e.g., "1920x1080")
	ThumbnailPath *string        `gorm:"default:null" json:"thumbnail_path,omitempty"` // Path thumbnail
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
	UserId        string         `gorm:"not null;index;default:''" json:"UserId"`

	// Many-to-many relationship dengan Stream melalui StreamMediaFile
	Streams []Stream `gorm:"many2many:stream_media_files;foreignKey:ID;joinForeignKey:MediaFileID;References:ID;joinReferences:StreamID" json:"streams,omitempty"`
}
