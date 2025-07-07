package models

import (
    "time"
)

// Task represents a command for the agent to execute.
// Data is stored as JSON string. Status values: pending, sent, completed, error.
// Result fields are populated by the agent via /agent/tasks/result.
type Task struct {
    ID        string    `json:"id" gorm:"primaryKey;size:64"`
    ServerID  string    `json:"server_id" gorm:"size:64;index"`
    Type      string    `json:"type" gorm:"size:32"`
    Data      string    `json:"data" gorm:"type:text"`
    Status    string    `json:"status" gorm:"size:16;default:pending"`
    Output    string    `json:"output" gorm:"type:text"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
