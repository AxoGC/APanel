// Package db opens a *gorm.DB from a DSN, hiding which SQL dialect is
// behind it from the rest of the backend. The DSN's scheme selects the
// driver: sqlite://, postgres:// (or postgresql://), mysql://.
package db

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"apanel/internal/model"
)

func Open(dsn string) (*gorm.DB, error) {
	var (
		db  *gorm.DB
		err error
	)
	switch {
	case strings.HasPrefix(dsn, "sqlite://"):
		path := strings.TrimPrefix(dsn, "sqlite://")
		if err := ensureSQLiteParentDir(path); err != nil {
			return nil, fmt.Errorf("prepare sqlite database directory: %w", err)
		}
		db, err = gorm.Open(sqlite.Open(path), &gorm.Config{})
	case strings.HasPrefix(dsn, "postgres://"), strings.HasPrefix(dsn, "postgresql://"):
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	case strings.HasPrefix(dsn, "mysql://"):
		db, err = gorm.Open(mysql.Open(strings.TrimPrefix(dsn, "mysql://")), &gorm.Config{})
	default:
		return nil, fmt.Errorf("unrecognized dsn scheme (expected sqlite://, postgres://, or mysql://): %s", dsn)
	}
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := db.AutoMigrate(&model.ConfigEntry{}, &model.Session{}); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	return db, nil
}

// ensureSQLiteParentDir creates only the parent directory of a filesystem
// SQLite database. SQLite itself creates the database file on first open;
// creating it here would be both unnecessary and liable to hide a bad path.
// In-memory and URI-style SQLite databases do not have a filesystem parent.
func ensureSQLiteParentDir(path string) error {
	if path == ":memory:" || strings.HasPrefix(path, "file:") {
		return nil
	}

	dir := filepath.Dir(path)
	if dir == "." {
		return nil
	}
	return os.MkdirAll(dir, 0o700)
}
