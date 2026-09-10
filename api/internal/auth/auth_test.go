package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"apanel/internal/auditlog"
	"apanel/internal/db"
	"apanel/internal/settings"
	"apanel/internal/users"
)

func newTestService(t *testing.T) *Service {
	t.Helper()
	t.Setenv("APANEL_DB_PATH", filepath.Join(t.TempDir(), "apanel.db"))
	sqliteDB, err := db.Open()
	if err != nil {
		t.Fatal(err)
	}
	svc, err := New(sqliteDB, users.New(sqliteDB), auditlog.New(sqliteDB, settings.New(sqliteDB)))
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

// setPassword replaces the bootstrapped user's password with a known one,
// so the rest of a test can log in with it directly instead of trying to
// recover the randomly generated bootstrap plaintext (which can't be — only
// its hash is ever stored).
func setPassword(t *testing.T, svc *Service, password string) {
	t.Helper()
	infos, err := svc.users.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(infos) != 1 {
		t.Fatalf("expected exactly one bootstrapped user, got %d", len(infos))
	}
	if err := svc.users.SetPassword(infos[0].ID, password); err != nil {
		t.Fatal(err)
	}
}

// encryptedLoginBody plays the browser's half of the exchange using the
// standard library's crypto/ecdh, to check it's compatible with what
// decryptLoginPassword expects — the frontend does the equivalent with a
// pure-JS implementation (see loginCrypto.ts) instead, since browsers only
// expose the Web Crypto API in secure contexts.
func encryptedLoginBody(t *testing.T, challengeID, serverPublicKeyB64, password string) []byte {
	t.Helper()

	serverPublicKeyBytes, err := base64.StdEncoding.DecodeString(serverPublicKeyB64)
	if err != nil {
		t.Fatal(err)
	}
	serverPublicKey, err := ecdh.P256().NewPublicKey(serverPublicKeyBytes)
	if err != nil {
		t.Fatal(err)
	}

	clientPrivateKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	sharedSecret, err := clientPrivateKey.ECDH(serverPublicKey)
	if err != nil {
		t.Fatal(err)
	}
	aesKey := sha256.Sum256(sharedSecret)

	block, err := aes.NewCipher(aesKey[:])
	if err != nil {
		t.Fatal(err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	iv := make([]byte, aead.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		t.Fatal(err)
	}
	plaintext, err := json.Marshal(map[string]string{"password": password})
	if err != nil {
		t.Fatal(err)
	}
	ciphertext := aead.Seal(nil, iv, plaintext, []byte(challengeID))

	body, err := json.Marshal(map[string]string{
		"challengeId":     challengeID,
		"clientPublicKey": base64.StdEncoding.EncodeToString(clientPrivateKey.PublicKey().Bytes()),
		"iv":              base64.StdEncoding.EncodeToString(iv),
		"ciphertext":      base64.StdEncoding.EncodeToString(ciphertext),
	})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func getChallenge(t *testing.T, svc *Service) (challengeID, publicKey string) {
	t.Helper()
	rec := httptest.NewRecorder()
	svc.Challenge(rec, httptest.NewRequest(http.MethodGet, "/api/login/challenge", nil))

	var env struct {
		Data struct {
			ChallengeID string `json:"challengeId"`
			PublicKey   string `json:"publicKey"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	return env.Data.ChallengeID, env.Data.PublicKey
}

func doLogin(svc *Service, body []byte) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/login", strings.NewReader(string(body)))
	svc.Login(rec, req)
	return rec
}

func TestLoginWithCorrectPasswordSucceeds(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "correct horse battery staple")

	challengeID, publicKey := getChallenge(t, svc)
	body := encryptedLoginBody(t, challengeID, publicKey, "correct horse battery staple")

	rec := doLogin(svc, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if rec.Result().Cookies() == nil {
		t.Fatal("expected a session cookie to be set")
	}
}

func TestLoginWithWrongPasswordFails(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")

	challengeID, publicKey := getChallenge(t, svc)
	body := encryptedLoginBody(t, challengeID, publicKey, "a-guess")

	rec := doLogin(svc, body)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestLoginChallengeIsSingleUse(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")

	challengeID, publicKey := getChallenge(t, svc)
	body := encryptedLoginBody(t, challengeID, publicKey, "the-real-password")

	if rec := doLogin(svc, body); rec.Code != http.StatusOK {
		t.Fatalf("first login: status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if rec := doLogin(svc, body); rec.Code != http.StatusUnauthorized {
		t.Fatalf("replayed login: status = %d, want 401 (CHALLENGE_EXPIRED)", rec.Code)
	}
}

// loginToken drives a full login and returns the token from the response
// body — what the standalone client stores and sends back as
// `Authorization: Bearer <token>` instead of relying on the session cookie.
func loginToken(t *testing.T, svc *Service, password string) string {
	t.Helper()
	challengeID, publicKey := getChallenge(t, svc)
	body := encryptedLoginBody(t, challengeID, publicKey, password)
	rec := doLogin(svc, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var env struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&env); err != nil {
		t.Fatal(err)
	}
	if env.Data.Token == "" {
		t.Fatal("expected a non-empty token in the login response body")
	}
	return env.Data.Token
}

func TestSessionWithBearerTokenSucceeds(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")
	token := loginToken(t, svc, "the-real-password")

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	svc.Session(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestSessionWithTokenQueryParamSucceeds(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")
	token := loginToken(t, svc, "the-real-password")

	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/stream?token="+token, nil)
	rec := httptest.NewRecorder()
	svc.Session(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestSessionWithWrongBearerTokenFails(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")
	loginToken(t, svc, "the-real-password")

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	req.Header.Set("Authorization", "Bearer not-a-real-token")
	rec := httptest.NewRecorder()
	svc.Session(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestLogoutWithBearerTokenRevokesSession(t *testing.T) {
	svc := newTestService(t)
	setPassword(t, svc, "the-real-password")
	token := loginToken(t, svc, "the-real-password")

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+token)
	svc.Logout(httptest.NewRecorder(), logoutReq)

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	svc.Session(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 after logout", rec.Code)
	}
}

func TestLoginWithUnknownChallengeFails(t *testing.T) {
	svc := newTestService(t)
	body := []byte(`{"challengeId":"does-not-exist","clientPublicKey":"","iv":"","ciphertext":""}`)

	rec := doLogin(svc, body)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), string(CHALLENGE_EXPIRED)) {
		t.Fatalf("body = %s, want it to mention %s", rec.Body.String(), CHALLENGE_EXPIRED)
	}
}
