package models

import (
    "crypto/rand"
    "time"

    ulid "github.com/oklog/ulid/v2"
    "golang.org/x/crypto/bcrypt"
    "gorm.io/gorm"
)

var userEntropy = ulid.Monotonic(rand.Reader, 0)

type User struct {
    ID       string `json:"id" gorm:"primaryKey;size:64"`
    Email    string `json:"email" gorm:"uniqueIndex;size:128"`
    Password string `json:"-"`
    Role     string `json:"role" gorm:"size:32"`
}

func (u *User) SetPassword(raw string) error {
    hash, err := bcrypt.GenerateFromPassword([]byte(raw), bcrypt.DefaultCost)
    if err != nil {
        return err
    }
    u.Password = string(hash)
    return nil
}

func (u *User) CheckPassword(raw string) bool {
    return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(raw)) == nil
}

// BeforeCreate generates ULID for primary key if missing
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
    if u.ID == "" {
        u.ID = ulid.MustNew(ulid.Timestamp(time.Now()), userEntropy).String()
    }
    return nil
}
