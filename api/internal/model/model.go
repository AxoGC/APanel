// Package model holds the database schema. Table/column names here must
// match the CREATE TABLE statements in internal/db.Open exactly — there's no
// migration tool inferring one from the other.
package model

import "time"

// ConfigEntry overrides a non-startup-critical default. Startup-critical
// settings come from env/YAML instead (see config.Config).
type ConfigEntry struct {
	Key   string `db:"key"`
	Value string `db:"value"`
}

// User is a login credential plus a human-readable label. There is no
// permission system: every user has identical, unrestricted access — User
// exists only so a Session (and, in turn, an AuditLog entry) can say who did
// something. See internal/users.
type User struct {
	ID           uint      `db:"id"`
	PasswordHash string    `db:"password_hash"`
	Remark       string    `db:"remark"`
	CreatedAt    time.Time `db:"created_at"`
}

// Session is an issued login token, tied to the User who logged in.
type Session struct {
	Token     string    `db:"token"`
	UserID    uint      `db:"user_id"`
	CreatedAt time.Time `db:"created_at"`
	ExpiresAt time.Time `db:"expires_at"`
}

// AuditLog is one recorded mutating (POST/PUT/PATCH/DELETE) API request —
// see internal/auditlog. GET requests and request bodies are never
// recorded. UserRemark is a snapshot of the acting user's remark at the
// time of the action, not a foreign key, so the record stays meaningful
// even after that user's remark changes or the user is deleted.
type AuditLog struct {
	ID         uint      `json:"id" db:"id"`
	At         time.Time `json:"at" db:"at"`
	UserRemark string    `json:"userRemark" db:"user_remark"`
	Action     string    `json:"action,omitempty" db:"action"`
	Method     string    `json:"method" db:"method"`
	Path       string    `json:"path" db:"path"`
	Status     int       `json:"status" db:"status"`
	IP         string    `json:"ip" db:"ip"`
}
