// Package auditlog records every mutating (POST/PUT/PATCH/DELETE) API
// request apanel receives, so it's possible to answer "who did this and
// when" now that logins are per-user (see internal/users) instead of a
// single shared password. There is no permission system — every user can
// do everything — so this package is purely an accountability trail, not
// an access-control layer.
//
// GET requests are never recorded, and neither is any request body: the
// method and path already say what happened for almost every endpoint
// (e.g. "POST /api/services/{name}/restart"), and some bodies contain a
// secret outright (a change-password request's new password), so logging
// bodies would risk persisting one.
package auditlog

import (
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"apanel/internal/model"
	"apanel/internal/settings"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

// retentionDaysKey is the settings-table key for how many days of entries
// to keep; see loadRetentionDays for the default when it's never been set.
const retentionDaysKey = "auditlog.retentionDays"

const defaultRetentionDays = 7

// cleanupDelay is how long a write waits before it triggers a cleanup pass
// — see scheduleCleanup.
const cleanupDelay = time.Hour

type Manager struct {
	db       *gorm.DB
	settings *settings.Manager

	mu           sync.Mutex
	cleanupTimer *time.Timer
}

func New(db *gorm.DB, settingsMgr *settings.Manager) *Manager {
	return &Manager{db: db, settings: settingsMgr}
}

// Record stores one entry. pattern is the exact mux pattern the request
// matched (e.g. "POST /api/containers/{id}/restart") — it's looked up in
// actionLabels for a translatable action name, but Method/Path are kept
// verbatim regardless so the entry is still meaningful even for a pattern
// with no label yet. Failures are only logged, not surfaced: a broken audit
// write should never take down the request it's trying to record.
func (m *Manager) Record(remark, pattern, method, path string, status int, ip string) {
	entry := model.AuditLog{
		At:         time.Now(),
		UserRemark: remark,
		Action:     actionFor(pattern),
		Method:     method,
		Path:       path,
		Status:     status,
		IP:         ip,
	}
	if err := m.db.Create(&entry).Error; err != nil {
		log.Printf("auditlog: record failed: %v", err)
		return
	}
	m.scheduleCleanup()
}

// scheduleCleanup implements the retention policy's whole schedule: idle
// (no writes) means no timer and no cleanup work at all. The first write
// after idle arms a one-shot timer; every write that lands before it fires
// just rides along with it rather than restarting the delay, so a burst of
// activity still costs one cleanup pass, not one per write. Once the timer
// fires, runCleanup does the deletion and clears the timer, so the next
// write after that starts the cycle over.
func (m *Manager) scheduleCleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cleanupTimer != nil {
		return
	}
	m.cleanupTimer = time.AfterFunc(cleanupDelay, m.runCleanup)
}

func (m *Manager) runCleanup() {
	defer func() {
		m.mu.Lock()
		m.cleanupTimer = nil
		m.mu.Unlock()
	}()

	days := m.RetentionDays()
	cutoff := time.Now().AddDate(0, 0, -days)
	if err := m.db.Where("at < ?", cutoff).Delete(&model.AuditLog{}).Error; err != nil {
		log.Printf("auditlog: cleanup failed: %v", err)
	}
}

// RetentionDays returns how many days of entries to keep, defaulting to
// defaultRetentionDays when never configured or set to an invalid value.
func (m *Manager) RetentionDays() int {
	raw, ok, err := m.settings.Get(retentionDaysKey)
	if !ok || err != nil {
		return defaultRetentionDays
	}
	days, err := strconv.Atoi(raw)
	if err != nil || days <= 0 {
		return defaultRetentionDays
	}
	return days
}

// SetRetentionDays persists the retention policy. It doesn't itself trigger
// a cleanup — the next write does, same as any other change.
func (m *Manager) SetRetentionDays(days int) error {
	return m.settings.Set(retentionDaysKey, strconv.Itoa(days))
}

// ClientIP reports the address an audit entry should attribute a request
// to. It trusts X-Forwarded-For/X-Real-IP (set by the Nginx reverse-proxy
// setup documented in the install guide) ahead of the raw TCP peer, since
// apanel has no configured set of trusted proxies to check those headers
// against; that's an acceptable tradeoff for an accountability trail among
// a small set of already-trusted admin accounts, not a security boundary.
func ClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if i := strings.IndexByte(fwd, ','); i >= 0 {
			fwd = fwd[:i]
		}
		if ip := strings.TrimSpace(fwd); ip != "" {
			return ip
		}
	}
	if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); real != "" {
		return real
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// List returns entries newest-first, at most limit of them, starting just
// before beforeID (0 means start from the newest) — cursor pagination so
// the ever-growing log is never fetched in one shot.
func (m *Manager) List(limit int, beforeID uint) ([]model.AuditLog, error) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	q := m.db.Order("id desc").Limit(limit)
	if beforeID > 0 {
		q = q.Where("id < ?", beforeID)
	}

	entries := make([]model.AuditLog, 0, limit)
	if err := q.Find(&entries).Error; err != nil {
		return nil, err
	}
	return entries, nil
}
