package models

import (
    "time"

    ulid "github.com/oklog/ulid/v2"
    "gorm.io/gorm"
)

// EnvVar stores environment or configuration variables reported for a server.

type EnvVar struct {
    ID       string `json:"id" gorm:"primaryKey;size:64"`
    ServerID string `json:"server_id" gorm:"size:64;index"`
    Key      string `json:"key" gorm:"size:128;index"`
    Value    string `json:"value" gorm:"size:1024"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

func (e *EnvVar) BeforeCreate(tx *gorm.DB) (err error) {
    if e.ID == "" {
        e.ID = ulid.Make().String()
    }
    return nil
}
