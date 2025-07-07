package models

import (
    "time"

    "github.com/oklog/ulid/v2"
    "github.com/devatadev/ytlive/ops/backend/utils/crypto"
    "gorm.io/gorm"
)

// Secret stores encrypted key-value pairs such as API credentials
// Values are encrypted at rest using the same ENCRYPTION_KEY as other sensitive data.
type Secret struct {
    ID        string    `gorm:"primaryKey;size:26" json:"id"`
    Key       string    `gorm:"uniqueIndex;size:64" json:"key"`
    ValueEnc  string    `gorm:"type:text" json:"-"`
    CreatedAt time.Time `json:"created_at"`
}

func (s *Secret) BeforeCreate(tx *gorm.DB) error {
    if s.ID == "" {
        s.ID = ulid.Make().String()
    }
    return nil
}

// Set stores an encrypted value
func (s *Secret) Set(raw, encKey string) error {
    enc, err := crypto.EncryptString(encKey, raw)
    if err != nil {
        return err
    }
    s.ValueEnc = enc
    return nil
}

// Get decrypts and returns the secret value
func (s *Secret) Get(encKey string) (string, error) {
    return crypto.DecryptString(encKey, s.ValueEnc)
}
