package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORSAllowedOriginGetsHeaders(t *testing.T) {
	allowed := map[string]bool{"tauri://localhost": true}
	called := false
	handler := corsMiddleware(allowed, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	req.Header.Set("Origin", "tauri://localhost")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected the wrapped handler to be called")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "tauri://localhost" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want tauri://localhost", got)
	}
	if rec.Header().Get("Access-Control-Allow-Credentials") != "" {
		t.Fatal("did not expect Access-Control-Allow-Credentials to be set")
	}
}

func TestCORSDisallowedOriginGetsNoHeaders(t *testing.T) {
	allowed := map[string]bool{"tauri://localhost": true}
	called := false
	handler := corsMiddleware(allowed, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected the wrapped handler to still be called for a plain (non-preflight) request")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}

func TestCORSPreflightShortCircuits(t *testing.T) {
	allowed := map[string]bool{"tauri://localhost": true}
	called := false
	handler := corsMiddleware(allowed, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/session", nil)
	req.Header.Set("Origin", "tauri://localhost")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if called {
		t.Fatal("preflight OPTIONS should not reach the wrapped handler")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Headers"); got == "" {
		t.Fatal("expected Access-Control-Allow-Headers to be set on the preflight response")
	}
}

func TestCORSNonAPIPathIsUntouched(t *testing.T) {
	allowed := map[string]bool{"tauri://localhost": true}
	handler := corsMiddleware(allowed, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	req.Header.Set("Origin", "tauri://localhost")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want empty for a non-API path", got)
	}
}
