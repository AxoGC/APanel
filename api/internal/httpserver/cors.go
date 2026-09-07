package httpserver

import (
	"net/http"
	"os"
	"strings"
)

// corsAllowedOrigins is the set of origins allowed to make credentialless,
// bearer-token-authenticated cross-origin requests to /api/ — needed only
// by the standalone Tauri desktop client (see internal/auth's
// tokenFromRequest), which talks to a remote apanel instance from its own
// fixed webview origin rather than being served by that instance. The
// integrated web build is always same-origin and never triggers this path.
//
// The defaults are Tauri v2's fixed webview origins — not user data, so
// safe to allow unconditionally: tauri://localhost on Linux/macOS, and on
// Windows/Android the custom-protocol origin is http://tauri.localhost
// unless the app opts into useHttpsScheme (which this app deliberately
// doesn't — that flag also blocks mixed content, breaking requests to the
// plain-HTTP LAN servers apanel supports), so https://tauri.localhost is
// kept too only in case a build ever does turn that on.
// APANEL_CORS_ORIGINS extends the list, for anyone running a custom or dev
// build under a different origin.
func corsAllowedOrigins() map[string]bool {
	allowed := map[string]bool{
		"tauri://localhost":       true,
		"http://tauri.localhost":  true,
		"https://tauri.localhost": true,
	}
	for _, origin := range strings.Split(os.Getenv("APANEL_CORS_ORIGINS"), ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			allowed[origin] = true
		}
	}
	return allowed
}

// corsMiddleware adds CORS headers to /api/ requests from an allowed
// origin. It deliberately never sets Access-Control-Allow-Credentials:
// cross-origin API access authenticates via `Authorization: Bearer <token>`
// (see internal/auth), not the session cookie, so there's no ambient
// credential to protect against CSRF — a plain, non-wildcard origin
// allowlist is enough.
func corsMiddleware(allowed map[string]bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		origin := r.Header.Get("Origin")
		if origin != "" && allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
