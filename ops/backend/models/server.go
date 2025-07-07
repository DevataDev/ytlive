package models

import (
	"crypto/rand"
	"time"

	ulid "github.com/oklog/ulid/v2"
	"github.com/devatadev/ytlive/ops/backend/utils/crypto"
	"gorm.io/gorm"
)

var entropy = ulid.Monotonic(rand.Reader, 0)

// Server represents a managed server/node in the Ops panel backend.
// Feel free to expand this struct with more columns (OS, tags, etc.).
// Gorm will pluralise the struct name by default (servers table).
//
// ID is an externally provided unique identifier (e.g. "srv-1").
// You can switch to UUID by changing the type/tag.
//
// Note: Keep JSON tags aligned with what the frontend expects.

type Server struct {
	ID             string `json:"id" gorm:"primaryKey;size:64"`
	Name           string `json:"name" gorm:"size:128"`
	Address        string `json:"address" gorm:"size:64"`
	Status         string `json:"status" gorm:"size:32"`
	Domain         string `json:"domain" gorm:"size:128"`
	SSHUser        string `json:"ssh_user" gorm:"size:64"`
	SSHPort        int    `json:"ssh_port"`
	SSHKeyPath     string `json:"ssh_key_path" gorm:"size:255"`
	SSHPasswordEnc string `json:"-" gorm:"column:ssh_password"` // encrypted
}

// SetPassword stores encrypted password.
func (s *Server) SetPassword(raw, key string) error {
	enc, err := crypto.EncryptString(key, raw)
	if err != nil {
		return err
	}
	s.SSHPasswordEnc = enc
	return nil
}

func (s *Server) GetPassword(key string) (string, error) {
	return crypto.DecryptString(key, s.SSHPasswordEnc)
}

// BeforeCreate generates ULID and sets defaults
func (s *Server) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == "" {
		s.ID = ulid.MustNew(ulid.Timestamp(time.Now()), entropy).String()
	}
	if s.SSHPort == 0 {
		s.SSHPort = 22
	}
	return nil
}
