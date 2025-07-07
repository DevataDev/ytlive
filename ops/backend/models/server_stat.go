package models

import (
	"time"

	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

// ServerStat stores per-heartbeat time-series metrics that change frequently.
// Only uptime and load averages for now but easy to extend later.
// Each row represents one heartbeat.
// ID uses ULID like other tables.
type ServerStat struct {
	ID        string    `json:"id" gorm:"primaryKey;size:64"`
	ServerID  string    `json:"server_id" gorm:"size:64;index"`
	UptimeSec uint64    `json:"uptime_sec"`
	Load1     float64   `json:"load_1"`
	Load5     float64   `json:"load_5"`
	Load15    float64   `json:"load_15"`
	CreatedAt time.Time `json:"created_at"`
}

// BeforeCreate generates ULID and sets defaults
func (s *ServerStat) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == "" {
		s.ID = ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()
	}
	return nil
}
