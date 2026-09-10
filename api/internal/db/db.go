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

	"github.com/jmoiron/sqlx"

	_ "github.com/glebarez/go-sqlite" // registers the "sqlite" database/sql driver
)

// defaultPath is where apanel's sqlite database lives by default. It can be
// overridden with APANEL_DB_PATH, mainly useful for local development —
// production deployments should not need to touch this.
const defaultPath = "/var/lib/apanel/apanel.db"

// schema creates every table apanel's own storage needs, matching
// internal/model's field tags exactly. CREATE TABLE/INDEX IF NOT EXISTS
// makes this idempotent, standing in for a migration tool: there's only ever
// been one shape for each of these tables, so a plain "create it if it's
// missing" has been sufficient. Timestamp columns are declared DATETIME
// (rather than TEXT) so the sqlite driver round-trips them as time.Time
// automatically — see modernc.org/sqlite's rows.Next/ColumnTypeScanType.
const schema = `
CREATE TABLE IF NOT EXISTS config_entries (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
	id            INTEGER PRIMARY KEY AUTOINCREMENT,
	password_hash TEXT NOT NULL,
	remark        TEXT NOT NULL,
	created_at    DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
	token      TEXT PRIMARY KEY,
	user_id    INTEGER NOT NULL,
	created_at DATETIME NOT NULL,
	expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	at          DATETIME NOT NULL,
	user_remark TEXT NOT NULL,
	action      TEXT NOT NULL,
	method      TEXT NOT NULL,
	path        TEXT NOT NULL,
	status      INTEGER NOT NULL,
	ip          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at);
`

func Open() (*sqlx.DB, error) {
	path := os.Getenv("APANEL_DB_PATH")
	if path == "" {
		path = defaultPath
	}
	if err := ensureParentDir(path); err != nil {
		return nil, fmt.Errorf("prepare sqlite database directory: %w", err)
	}

	db, err := sqlx.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if _, err := db.Exec(schema); err != nil {
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
