package models

import (
    "time"

    "github.com/oklog/ulid/v2"
    "gorm.io/gorm"
)

// Deployment tracks an installation / deployment job executed on a server.
// Status is one of: running, success, failed.
// Logs contains combined stdout/stderr.
// ErrMsg holds the final error message if failed.
//
// ULID is used as primary key to keep consistent with other tables.
//
// This table is appended-only so foreign key to Server with ON DELETE SET NULL.

type Deployment struct {
    ID         string    `gorm:"primaryKey;size:26" json:"id"`
    ServerID   string    `gorm:"index" json:"server_id"`
    StartedAt  time.Time `json:"started_at"`
    FinishedAt time.Time `json:"finished_at,omitempty"`
    Status     string    `gorm:"size:16" json:"status"`
    Logs       string    `gorm:"type:text" json:"logs"`
    ErrMsg     string    `gorm:"type:text" json:"err_msg,omitempty"`
}

func (d *Deployment) BeforeCreate(tx *gorm.DB) (err error) {
    if d.ID == "" {
        d.ID = ulid.Make().String()
    }
    d.StartedAt = time.Now().UTC()
    return nil
}
