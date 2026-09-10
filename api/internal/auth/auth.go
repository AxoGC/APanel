// Package auth implements apanel's login: a per-user password (see
// internal/users; there's no permission system, just per-user
// attribution), a 7-day cookie session backed by a DB table.
package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"

	"apanel/internal/auditlog"
	"apanel/internal/model"
	"apanel/internal/response"
	"apanel/internal/users"
)

const (
	cookieName = "apanel_session"
	sessionTTL = 7 * 24 * time.Hour

	// INVALID_TOKEN is returned when the session cookie is missing, unknown,
	// or expired, and also when a login attempt uses the wrong password.
	INVALID_TOKEN response.Code = "INVALID_TOKEN"

	// CHALLENGE_EXPIRED is returned when a login's challengeId is unknown or
	// has already been used/expired. The frontend retries once with a fresh
	// challenge when it sees this — it isn't a wrong-password signal.
	CHALLENGE_EXPIRED response.Code = "CHALLENGE_EXPIRED"

	// challengeTTL bounds how long an issued login challenge stays usable.
	// Challenges are also single-use (deleted as soon as they're consumed),
	// so this mainly just bounds how long an abandoned one lingers in memory.
	challengeTTL = 60 * time.Second
)

type Service struct {
	db    *sqlx.DB
	users *users.Manager
	audit *auditlog.Manager

	mu       sync.RWMutex
	sessions map[string]model.Session

	// challenges holds one ephemeral ECDH keypair per in-flight login
	// attempt, keyed by challenge ID. See Challenge and decryptLoginPassword.
	challengeMu sync.Mutex
	challenges  map[string]loginChallenge
}

type loginChallenge struct {
	privateKey *ecdh.PrivateKey
	expiresAt  time.Time
}

func New(db *sqlx.DB, usersMgr *users.Manager, auditMgr *auditlog.Manager) (*Service, error) {
	var sessions []model.Session
	if err := db.Select(&sessions, `SELECT * FROM sessions WHERE expires_at > ?`, time.Now()); err != nil {
		return nil, err
	}

	byToken := make(map[string]model.Session, len(sessions))
	for _, session := range sessions {
		byToken[session.Token] = session
	}

	if err := usersMgr.Bootstrap(); err != nil {
		return nil, err
	}

	return &Service{
		db:         db,
		users:      usersMgr,
		audit:      auditMgr,
		sessions:   byToken,
		challenges: make(map[string]loginChallenge),
	}, nil
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

// Challenge issues a fresh ephemeral ECDH keypair for one login attempt. The
// browser only exposes the Web Crypto API (SubtleCrypto — what would
// normally do ECDH/AES-GCM) in secure contexts (HTTPS or localhost), but
// apanel explicitly allows logging in over plain HTTP too (behind an
// interstitial warning), which is exactly when this matters: the frontend
// uses a pure-JS crypto implementation instead so the password never
// travels the wire in the clear even then. See decryptLoginPassword for the
// other half of the exchange.
func (s *Service) Challenge(w http.ResponseWriter, r *http.Request) {
	privateKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	id, err := newToken()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	s.challengeMu.Lock()
	s.pruneExpiredChallengesLocked()
	s.challenges[id] = loginChallenge{privateKey: privateKey, expiresAt: time.Now().Add(challengeTTL)}
	s.challengeMu.Unlock()

	response.WriteOK(w, map[string]string{
		"challengeId": id,
		"publicKey":   base64.StdEncoding.EncodeToString(privateKey.PublicKey().Bytes()),
	})
}

// pruneExpiredChallengesLocked drops abandoned challenges (ones that were
// never redeemed by a login attempt). Called with challengeMu held.
func (s *Service) pruneExpiredChallengesLocked() {
	now := time.Now()
	for id, c := range s.challenges {
		if now.After(c.expiresAt) {
			delete(s.challenges, id)
		}
	}
}

// decryptLoginPassword recovers the plaintext password from an ECDH+AES-GCM
// encrypted login payload (see Challenge and the frontend's
// loginCrypto.ts). The challenge is single-use: it's deleted here as soon
// as it's looked up, whether or not decryption goes on to succeed.
// found is false when challengeID is unknown or already expired/consumed —
// that's not a wrong-password signal, the caller should let the frontend
// retry with a fresh challenge.
func (s *Service) decryptLoginPassword(challengeID, clientPublicKeyB64, ivB64, ciphertextB64 string) (password string, found bool, err error) {
	s.challengeMu.Lock()
	s.pruneExpiredChallengesLocked()
	challenge, ok := s.challenges[challengeID]
	if ok {
		delete(s.challenges, challengeID)
	}
	s.challengeMu.Unlock()
	if !ok {
		return "", false, nil
	}

	clientPublicKeyBytes, err := base64.StdEncoding.DecodeString(clientPublicKeyB64)
	if err != nil {
		return "", true, fmt.Errorf("decode client public key: %w", err)
	}
	clientPublicKey, err := ecdh.P256().NewPublicKey(clientPublicKeyBytes)
	if err != nil {
		return "", true, fmt.Errorf("parse client public key: %w", err)
	}
	sharedSecret, err := challenge.privateKey.ECDH(clientPublicKey)
	if err != nil {
		return "", true, fmt.Errorf("compute shared secret: %w", err)
	}
	aesKey := sha256.Sum256(sharedSecret)

	block, err := aes.NewCipher(aesKey[:])
	if err != nil {
		return "", true, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return "", true, err
	}

	iv, err := base64.StdEncoding.DecodeString(ivB64)
	if err != nil {
		return "", true, fmt.Errorf("decode iv: %w", err)
	}
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return "", true, fmt.Errorf("decode ciphertext: %w", err)
	}

	// challengeID is bound in as AAD so a captured ciphertext can't be
	// replayed against a different (still-valid) challenge.
	plaintext, err := aead.Open(nil, iv, ciphertext, []byte(challengeID))
	if err != nil {
		return "", true, fmt.Errorf("decrypt login payload: %w", err)
	}

	var payload struct {
		Password string `json:"password"`
	}
	if err := json.Unmarshal(plaintext, &payload); err != nil {
		return "", true, fmt.Errorf("unmarshal login payload: %w", err)
	}
	return payload.Password, true, nil
}

func (s *Service) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChallengeID     string `json:"challengeId"`
		ClientPublicKey string `json:"clientPublicKey"`
		IV              string `json:"iv"`
		Ciphertext      string `json:"ciphertext"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInternalError(w, err)
		return
	}

	password, found, err := s.decryptLoginPassword(req.ChallengeID, req.ClientPublicKey, req.IV, req.Ciphertext)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if !found {
		response.WriteCode(w, http.StatusUnauthorized, CHALLENGE_EXPIRED)
		return
	}

	user, matched, err := s.users.FindByPassword(password)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if !matched {
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
		UserID:    user.ID,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(sessionTTL),
	}
	_, err = s.db.Exec(
		`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
		session.Token, session.UserID, session.CreatedAt, session.ExpiresAt,
	)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	s.mu.Lock()
	s.sessions[session.Token] = session
	s.mu.Unlock()

	s.setCookie(w, token, session.ExpiresAt)
	s.audit.Record(user.Remark, "POST /api/login", r.Method, r.URL.Path, http.StatusOK, auditlog.ClientIP(r))
	// The token is also returned in the body (not just set as a cookie) for
	// the standalone Tauri client, which talks to a remote apanel instance
	// cross-origin and authenticates with `Authorization: Bearer <token>`
	// instead of a cookie — see tokenFromRequest. The integrated web build
	// just ignores this field.
	response.WriteOK(w, map[string]string{"token": token})
}

func (s *Service) Logout(w http.ResponseWriter, r *http.Request) {
	if token := tokenFromRequest(r); token != "" {
		if session, ok := s.check(r); ok {
			s.audit.Record(s.users.Remark(session.UserID), "POST /api/logout", r.Method, r.URL.Path, http.StatusOK, auditlog.ClientIP(r))
		}
		_, _ = s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
		s.mu.Lock()
		delete(s.sessions, token)
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

// CurrentUserRemark resolves the request's session to its user's audit-log
// display name, for httpserver's global request-logging instrumentation
// (see internal/auditlog and httpserver.Server.ServeHTTP) — unauthenticated
// requests never reach a mutating handler in the first place, so this is
// only ever called for requests Middleware has already approved.
func (s *Service) CurrentUserRemark(r *http.Request) (string, bool) {
	session, ok := s.check(r)
	if !ok {
		return "", false
	}
	return s.users.Remark(session.UserID), true
}

// tokenFromRequest resolves a session token from, in order: the
// Authorization header (the standalone Tauri client, which can't rely on a
// cross-origin cookie — see Login), a `token` query parameter (the same
// client's WebSocket/EventSource/download-link requests, which can't set
// custom headers at all), and finally the session cookie (the integrated
// web build).
func tokenFromRequest(r *http.Request) string {
	if auth := r.Header.Get("Authorization"); auth != "" {
		if token, ok := strings.CutPrefix(auth, "Bearer "); ok {
			return token
		}
	}
	if token := r.URL.Query().Get("token"); token != "" {
		return token
	}
	if cookie, err := r.Cookie(cookieName); err == nil {
		return cookie.Value
	}
	return ""
}

func (s *Service) check(r *http.Request) (model.Session, bool) {
	token := tokenFromRequest(r)
	if token == "" {
		return model.Session{}, false
	}

	s.mu.RLock()
	session, ok := s.sessions[token]
	s.mu.RUnlock()
	if !ok {
		return model.Session{}, false
	}
	if time.Now().After(session.ExpiresAt) {
		s.mu.Lock()
		delete(s.sessions, token)
		s.mu.Unlock()
		return model.Session{}, false
	}
	// The user behind this session may have since been deleted (see
	// internal/users) — without this, a deleted user's session would stay
	// valid until it naturally expires, up to sessionTTL later, defeating
	// the point of being able to remove someone's access.
	if !s.users.Exists(session.UserID) {
		s.mu.Lock()
		delete(s.sessions, token)
		s.mu.Unlock()
		_, _ = s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
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
