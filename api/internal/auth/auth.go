// Package auth implements apanel's single-operator login: one shared
// password (bcrypt-hashed, stored in the config table), a 7-day cookie
// session backed by a DB table.
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
	"log"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"apanel/internal/model"
	"apanel/internal/response"
	"apanel/internal/settings"
)

const (
	cookieName = "apanel_session"
	sessionTTL = 7 * 24 * time.Hour

	// passwordHashKey is the settings key the bcrypt-hashed login password
	// is stored under. There is no env var for the password any more: on
	// first run apanel generates one, hashes it, and stores it here.
	passwordHashKey = "auth.password_hash"

	// INVALID_TOKEN is returned when the session cookie is missing, unknown,
	// or expired, and also when a login attempt uses the wrong password.
	INVALID_TOKEN response.Code = "INVALID_TOKEN"

	// WRONG_PASSWORD is returned when a change-password request's current
	// password doesn't match.
	WRONG_PASSWORD response.Code = "WRONG_PASSWORD"

	// PASSWORD_TOO_SHORT is returned when a change-password request's new
	// password is shorter than the minimum length.
	PASSWORD_TOO_SHORT response.Code = "PASSWORD_TOO_SHORT"

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
	db       *gorm.DB
	settings *settings.Manager

	// passwordHash is read on every login and change-password request, and
	// written by ChangePassword, so it's guarded by mu alongside sessions.
	mu           sync.RWMutex
	passwordHash []byte
	sessions     map[string]model.Session

	// challenges holds one ephemeral ECDH keypair per in-flight login
	// attempt, keyed by challenge ID. See Challenge and decryptLoginPassword.
	challengeMu sync.Mutex
	challenges  map[string]loginChallenge
}

type loginChallenge struct {
	privateKey *ecdh.PrivateKey
	expiresAt  time.Time
}

func New(db *gorm.DB, settingsMgr *settings.Manager) (*Service, error) {
	var sessions []model.Session
	if err := db.Where("expires_at > ?", time.Now()).Find(&sessions).Error; err != nil {
		return nil, err
	}

	byToken := make(map[string]model.Session, len(sessions))
	for _, session := range sessions {
		byToken[session.Token] = session
	}

	hash, err := bootstrapPasswordHash(settingsMgr)
	if err != nil {
		return nil, err
	}

	return &Service{
		db:           db,
		settings:     settingsMgr,
		passwordHash: hash,
		sessions:     byToken,
		challenges:   make(map[string]loginChallenge),
	}, nil
}

// bootstrapPasswordHash loads the stored password hash, or — on a fresh
// install where none exists yet — generates a random password, hashes it,
// stores the hash, and prints the plaintext once so the operator can log in
// and change it to one of their own choosing.
func bootstrapPasswordHash(settingsMgr *settings.Manager) ([]byte, error) {
	if stored, ok, err := settingsMgr.Get(passwordHashKey); err != nil {
		return nil, err
	} else if ok {
		return []byte(stored), nil
	}

	plain, err := generatePassword()
	if err != nil {
		return nil, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if err := settingsMgr.Set(passwordHashKey, string(hash)); err != nil {
		return nil, err
	}

	log.Printf("apanel: no login password set yet, generated one: %s", plain)
	log.Printf("apanel: log in with it and change it to one of your own choosing as soon as possible")
	return hash, nil
}

// generatePassword returns a random 16-character alphanumeric password.
func generatePassword() (string, error) {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	for i, b := range buf {
		buf[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(buf), nil
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

	s.mu.RLock()
	hash := s.passwordHash
	s.mu.RUnlock()

	if bcrypt.CompareHashAndPassword(hash, []byte(password)) != nil {
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

// ChangePassword updates the login password. It requires the current
// password, and is only reachable by a caller who already holds a valid
// session (see Middleware).
func (s *Service) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if len(req.NewPassword) < 8 {
		response.WriteCode(w, http.StatusBadRequest, PASSWORD_TOO_SHORT)
		return
	}

	s.mu.RLock()
	hash := s.passwordHash
	s.mu.RUnlock()
	if bcrypt.CompareHashAndPassword(hash, []byte(req.CurrentPassword)) != nil {
		response.WriteCode(w, http.StatusUnauthorized, WRONG_PASSWORD)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if err := s.settings.Set(passwordHashKey, string(newHash)); err != nil {
		response.WriteInternalError(w, fmt.Errorf("store new password: %w", err))
		return
	}

	s.mu.Lock()
	s.passwordHash = newHash
	s.mu.Unlock()
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
