// Package settings is a thin key-value store on top of model.ConfigEntry,
// for the non-startup-critical overrides plan.txt calls for (startup config
// stays in env/YAML, see internal/config). It knows nothing about what the
// keys mean — callers own their own key names and value encoding (plain
// string or JSON, their choice).
package settings

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"apanel/internal/model"
)

type Manager struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Manager {
	return &Manager{db: db}
}

// Get returns the stored value and true, or "" and false if the key has
// never been set.
func (m *Manager) Get(key string) (string, bool, error) {
	var entry model.ConfigEntry
	err := m.db.First(&entry, "key = ?", key).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", false, nil
		}
		return "", false, err
	}
	return entry.Value, true, nil
}

// Set upserts the key's value.
func (m *Manager) Set(key, value string) error {
	entry := model.ConfigEntry{Key: key, Value: value}
	return m.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Create(&entry).Error
}

// Delete removes an override so callers can fall back to their default.
func (m *Manager) Delete(key string) error {
	return m.db.Delete(&model.ConfigEntry{}, "key = ?", key).Error
}
