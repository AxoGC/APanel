// Package model holds the database schema. Kept deliberately small in
// phase 1: a config key-value table and a session token table.
package model

import "time"

// ConfigEntry overrides a non-startup-critical default. Startup-critical
// settings come from env/YAML instead (see config.Config).
type ConfigEntry struct {
	Key   string `gorm:"primaryKey"`
	Value string
}

// Session is an issued login token. There is no user table: apanel has a
// single operator authenticated by one shared password.
type Session struct {
	Token     string `gorm:"primaryKey"`
	CreatedAt time.Time
	ExpiresAt time.Time
}
