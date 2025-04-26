package models

import (
	"math/rand"
	"time"

	"github.com/oklog/ulid/v2"
	"gorm.io/gorm"
)

type User struct {
	ID                  string     `gorm:"primaryKey;size:26" json:"id"`
	Username            string     `gorm:"unique;not null" json:"username"`
	Email               string     `gorm:"unique;not null" json:"email"`
	Password            string     `gorm:"not null" json:"-"`
	CreatedAt           time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"autoUpdateTime" json:"updated_at"`
	IsActive            bool       `gorm:"default:true" json:"is_active"`
	IsAdmin             bool       `gorm:"default:false" json:"is_admin"`
	SubscriptionStartAt *time.Time `json:"subscription_start_at"`
	SubscriptionEndAt   *time.Time `json:"subscription_end_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	entropy := rand.New(rand.NewSource(time.Now().UnixNano()))
	ms := ulid.Timestamp(time.Now())
	id, err := ulid.New(ms, entropy)
	if err != nil {
		return
	}
	u.ID = id.String()
	return
}
