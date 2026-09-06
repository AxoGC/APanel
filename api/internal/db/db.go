// Package db opens apanel's own sqlite storage — the config key/value table
// and the session table. apanel only ever uses sqlite for this; there is no
// separate database service to install or connect to, and no connection
// string to configure. The database module (internal/database) is unrelated:
// it connects to a user-supplied external Postgres instance for browsing,
// not to apanel's own storage.
package db

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"apanel/internal/model"
)

// defaultPath is where apanel's sqlite database lives by default. It can be
// overridden with APANEL_DB_PATH, mainly useful for local development —
// production deployments should not need to touch this.
const defaultPath = "/var/lib/apanel/apanel.db"

func Open() (*gorm.DB, error) {
	path := os.Getenv("APANEL_DB_PATH")
	if path == "" {
		path = defaultPath
	}
	if err := ensureParentDir(path); err != nil {
		return nil, fmt.Errorf("prepare sqlite database directory: %w", err)
	}

	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.AutoMigrate(&model.ConfigEntry{}, &model.User{}, &model.Session{}, &model.AuditLog{}); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	return db, nil
}

// ensureParentDir creates only the parent directory of the sqlite file.
// SQLite itself creates the database file on first open; creating it here
// would be both unnecessary and liable to hide a bad path.
func ensureParentDir(path string) error {
	if path == ":memory:" || strings.HasPrefix(path, "file:") {
		return nil
	}

	dir := filepath.Dir(path)
	if dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0o700)
}
