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
	"strings"
	"time"

	"gorm.io/gorm"

	"apanel/internal/model"
)

const (
	defaultLimit = 50
	maxLimit     = 200
)

type Manager struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Manager {
	return &Manager{db: db}
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
	}
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
