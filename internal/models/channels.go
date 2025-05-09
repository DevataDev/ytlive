package models

import (
	"time"

	"gorm.io/gorm"
)

type Channels struct {
	ID           string  `gorm:"primaryKey"`
	ChannelID    string  `gorm:"not null"`
	ChannelName  string  `gorm:"not null"`
	AccessToken  *string `gorm:"default:null;length:2000"` // Optional
	RefreshToken *string `gorm:"default:null;length:2000"` // Optional
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	UserId       string         `gorm:"not null;index" json:"UserId"` // New field for user reference
}
