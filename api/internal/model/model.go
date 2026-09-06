// Package model holds the database schema.
package model

import "time"

// ConfigEntry overrides a non-startup-critical default. Startup-critical
// settings come from env/YAML instead (see config.Config).
type ConfigEntry struct {
	Key   string `gorm:"primaryKey"`
	Value string
}

// User is a login credential plus a human-readable label. There is no
// permission system: every user has identical, unrestricted access — User
// exists only so a Session (and, in turn, an AuditLog entry) can say who did
// something. See internal/users.
type User struct {
	ID           uint `gorm:"primaryKey;autoIncrement"`
	PasswordHash string
	Remark       string
	CreatedAt    time.Time
}

// Session is an issued login token, tied to the User who logged in.
type Session struct {
	Token     string `gorm:"primaryKey"`
	UserID    uint
	CreatedAt time.Time
	ExpiresAt time.Time
}

// AuditLog is one recorded mutating (POST/PUT/PATCH/DELETE) API request —
// see internal/auditlog. GET requests and request bodies are never
// recorded. UserRemark is a snapshot of the acting user's remark at the
// time of the action, not a foreign key, so the record stays meaningful
// even after that user's remark changes or the user is deleted.
type AuditLog struct {
	ID         uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	At         time.Time `json:"at" gorm:"index"`
	UserRemark string    `json:"userRemark"`
	Action     string    `json:"action,omitempty"`
	Method     string    `json:"method"`
	Path       string    `json:"path"`
	Status     int       `json:"status"`
}
