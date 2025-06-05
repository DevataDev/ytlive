package models

import (
	"errors"
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
// Add this to your StreamMediaFile struct or in a migration
func (StreamMediaFile) TableName() string {
	return "stream_media_files"
}

// Add a BeforeCreate hook to check for duplicates
func (smf *StreamMediaFile) BeforeCreate(tx *gorm.DB) error {
	// Generate ULID if not provided
	if smf.ID == "" {
		t := time.Now()
		entropy := ulid.Monotonic(rand.New(rand.NewSource(t.UnixNano())), 0)
		id := ulid.MustNew(ulid.Timestamp(t), entropy)
		smf.ID = id.String()
	}

	// Check for existing association
	var count int64
	if err := tx.Model(&StreamMediaFile{}).Where("stream_id = ? AND media_file_id = ?", smf.StreamID, smf.MediaFileID).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		return errors.New("media file already associated with this stream")
	}

	return nil
}
