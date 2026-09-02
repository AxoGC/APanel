// Package db opens a *gorm.DB from a DSN, hiding which SQL dialect is
// behind it from the rest of the backend. The DSN's scheme selects the
// driver: sqlite://, postgres:// (or postgresql://), mysql://.
package db

import (
	"fmt"
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
