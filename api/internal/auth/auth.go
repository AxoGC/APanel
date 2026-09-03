// Package auth implements apanel's single-operator login: one shared
// password (from config), a 7-day cookie session backed by a DB table.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"gorm.io/gorm"

	"apanel/internal/model"
	"apanel/internal/response"
)

const (
	cookieName = "apanel_session"
	sessionTTL = 7 * 24 * time.Hour

	// INVALID_TOKEN is returned when the session cookie is missing, unknown,
	// or expired.
	INVALID_TOKEN response.Code = "INVALID_TOKEN"
)

type Service struct {
	db       *gorm.DB
	password string

	// Every request goes through check(), so sessions are kept in an
	// in-memory cache instead of round-tripping to the DB on each request.
	// The DB row stays the source of truth (it's what survives a restart);
	// this map is a write-through cache over it, keyed by token.
	mu       sync.RWMutex
	sessions map[string]model.Session
}

func New(db *gorm.DB, password string) (*Service, error) {
	var sessions []model.Session
	if err := db.Where("expires_at > ?", time.Now()).Find(&sessions).Error; err != nil {
		return nil, err
	}

	byToken := make(map[string]model.Session, len(sessions))
	for _, session := range sessions {
		byToken[session.Token] = session
	}
	return &Service{db: db, password: password, sessions: byToken}, nil
}

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func (s *Service) setCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Service) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInternalError(w, err)
		return
	}

	if subtle.ConstantTimeCompare([]byte(req.Password), []byte(s.password)) != 1 {
		response.WriteCode(w, http.StatusUnauthorized, INVALID_TOKEN)
		return
	}

	token, err := newToken()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	session := model.Session{
		Token:     token,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	if err := s.db.Create(&session).Error; err != nil {
		response.WriteInternalError(w, err)
		return
	}
	s.mu.Lock()
	s.sessions[session.Token] = session
	s.mu.Unlock()

	s.setCookie(w, token, session.ExpiresAt)
	response.WriteOK(w, nil)
}

func (s *Service) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(cookieName); err == nil {
		s.db.Delete(&model.Session{}, "token = ?", cookie.Value)
		s.mu.Lock()
		delete(s.sessions, cookie.Value)
		s.mu.Unlock()
	}
	s.setCookie(w, "", time.Unix(0, 0))
	response.WriteOK(w, nil)
}

// Session reports whether the caller currently holds a valid session, for
// the frontend to decide between showing the login page and the app shell.
func (s *Service) Session(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.check(r); !ok {
		response.WriteCode(w, http.StatusUnauthorized, INVALID_TOKEN)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Service) check(r *http.Request) (model.Session, bool) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return model.Session{}, false
	}

	s.mu.RLock()
	session, ok := s.sessions[cookie.Value]
	s.mu.RUnlock()
	if !ok {
		return model.Session{}, false
	}
	if time.Now().After(session.ExpiresAt) {
		s.mu.Lock()
		delete(s.sessions, cookie.Value)
		s.mu.Unlock()
		return model.Session{}, false
	}
	return session, true
}

// Middleware protects routes that require a valid session.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.check(r); !ok {
			response.WriteCode(w, http.StatusUnauthorized, INVALID_TOKEN)
			return
		}
		next.ServeHTTP(w, r)
	})
}
