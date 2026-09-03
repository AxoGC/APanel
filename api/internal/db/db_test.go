package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenCreatesMissingSQLiteParentDirectory(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "missing", "nested", "apanel.db")

	database, err := Open("sqlite://" + dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}

	sqlDB, err := database.DB()
	if err != nil {
		t.Fatalf("DB() error = %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	if _, err := os.Stat(dbPath); err != nil {
		t.Fatalf("database file was not created: %v", err)
	}
}

func TestOpenRejectsInvalidSQLiteDatabase(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "apanel.db")
	if err := os.WriteFile(dbPath, []byte("not a sqlite database"), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	if _, err := Open("sqlite://" + dbPath); err == nil {
		t.Fatal("Open() succeeded for an invalid SQLite database")
	}
}
