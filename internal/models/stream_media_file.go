package models

import (
	"math/rand"
	"time"

	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

// StreamMediaFile adalah junction table untuk many-to-many relationship
type StreamMediaFile struct {
	ID          string         `gorm:"primaryKey" json:"id"`
	StreamID    string         `gorm:"not null;index" json:"stream_id"`
	MediaFileID string         `gorm:"not null;index" json:"media_file_id"`
	Order       int            `gorm:"default:0" json:"order"`          // Urutan file dalam stream
	IsPrimary   bool           `gorm:"default:false" json:"is_primary"` // Apakah file utama dalam stream
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream    Stream    `gorm:"foreignKey:StreamID;constraint:OnDelete:CASCADE" json:"stream,omitempty"`
	MediaFile MediaFile `gorm:"foreignKey:MediaFileID;constraint:OnDelete:CASCADE" json:"media_file,omitempty"`
}

// TableName menentukan nama tabel
func (StreamMediaFile) TableName() string {
	return "stream_media_files"
}

// BeforeCreate generates ULID for new records
func (smf *StreamMediaFile) BeforeCreate(tx *gorm.DB) (err error) {
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	id, err := ulid.New(ms, entropy)
	if err != nil {
		return
	}
	smf.ID = id.String()
	return
}
