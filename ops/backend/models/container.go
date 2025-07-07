package models

import (
    "time"

    ulid "github.com/oklog/ulid/v2"
    "gorm.io/gorm"
)

// Container represents a Docker container running on a server.
// This table is populated by the agent reporting docker ps output.
// ID is ULID. Combination of Name+ServerID could also be unique, but ULID keeps things consistent.
// Ports and Uptime are stored as strings for simplicity (can be normalised later).

type Container struct {
    ID       string `json:"id" gorm:"primaryKey;size:64"`
    ServerID string `json:"server_id" gorm:"size:64;index"`
    Name     string `json:"name" gorm:"size:128"`
    Image    string `json:"image" gorm:"size:128"`
    Status   string `json:"status" gorm:"size:64"`
    Ports    string `json:"ports" gorm:"size:255"`
    Uptime   string `json:"uptime" gorm:"size:64"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

func (c *Container) BeforeCreate(tx *gorm.DB) (err error) {
    if c.ID == "" {
        c.ID = ulid.Make().String()
    }
    return nil
}
