// Package httpserver wires up routing: the JSON API, the SSE dashboard
// stream, and serving the embedded frontend build with SPA fallback.
package httpserver

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"time"

	"apanel/internal/auth"
	"apanel/internal/response"
	"apanel/internal/settings"
	"apanel/internal/stats"
)

//go:embed dist
var embeddedDist embed.FS

type Server struct {
	auth               *auth.Service
	stats              *stats.Collector
	settings           *settings.Manager
	registrars         []RouteRegistrar
	dependencyCheckers map[string]DependencyChecker
	mux                *http.ServeMux
}

// New wires up the mux: the routes this package owns directly (auth,
// dashboard, terminal, status/system, the embedded SPA), plus one
// RegisterRoutes call per registrar for everything business-specific —
// httpserver itself never imports container/service/firewall/history/files.
func New(authSvc *auth.Service, statsCollector *stats.Collector, settingsMgr *settings.Manager, registrars ...RouteRegistrar) *Server {
	s := &Server{
		auth:               authSvc,
		stats:              statsCollector,
		settings:           settingsMgr,
		registrars:         registrars,
		dependencyCheckers: make(map[string]DependencyChecker),
		mux:                http.NewServeMux(),
	}
	for _, r := range registrars {
		if c, ok := r.(DependencyChecker); ok {
			s.dependencyCheckers[c.Key()] = c
		}
	}
	s.routes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() {
	s.mux.HandleFunc("POST /api/login", s.auth.Login)
	s.mux.HandleFunc("POST /api/logout", s.auth.Logout)
	s.mux.HandleFunc("GET /api/session", s.auth.Session)

	s.mux.Handle("GET /api/dashboard/stream", s.auth.Middleware(http.HandlerFunc(s.dashboardStream)))
	s.mux.Handle("GET /api/dashboard/processes/{pid}", s.auth.Middleware(http.HandlerFunc(s.processDetail)))
	s.mux.Handle("POST /api/dashboard/processes/{pid}/terminate", s.auth.Middleware(http.HandlerFunc(s.terminateProcess)))
	s.mux.Handle("GET /api/dashboard/network-settings", s.auth.Middleware(http.HandlerFunc(s.getDashboardNetworkSettings)))
	s.mux.Handle("PUT /api/dashboard/network-settings", s.auth.Middleware(http.HandlerFunc(s.putDashboardNetworkSettings)))
	s.mux.Handle("GET /api/terminal", s.auth.Middleware(http.HandlerFunc(s.terminal)))
	s.mux.Handle("GET /api/terminal/directories", s.auth.Middleware(http.HandlerFunc(s.listTerminalDirectories)))

	for _, r := range s.registrars {
		r.RegisterRoutes(s.mux, s.auth.Middleware)
	}

	s.mux.Handle("GET /api/status", s.auth.Middleware(http.HandlerFunc(s.getStatus)))
	s.mux.Handle("PUT /api/status/features", s.auth.Middleware(http.HandlerFunc(s.putEnabledFeatures)))
	s.mux.Handle("GET /api/system/info", s.auth.Middleware(http.HandlerFunc(s.getSystemInfo)))

	s.mux.Handle("GET /api/modules/{key}/dependency", s.auth.Middleware(http.HandlerFunc(s.getModuleDependency)))
	s.mux.Handle("PUT /api/modules/{key}/dependency", s.auth.Middleware(http.HandlerFunc(s.putModuleDependency)))
	s.mux.Handle("POST /api/modules/{key}/dependency/enable-service", s.auth.Middleware(http.HandlerFunc(s.enableModuleService)))

	dist, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		panic(err) // the dist/ dir is always embedded; this can't fail
	}
	s.mux.Handle("/", spaHandler(dist))
}

func (s *Server) dashboardStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.WriteInternalError(w, fmt.Errorf("streaming unsupported"))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	sortBy := stats.SortByMem
	if r.URL.Query().Get("sort") == "cpu" {
		sortBy = stats.SortByCPU
	}

	send := func() bool {
		overview, err := s.stats.Sample(sortBy)
		if err != nil {
			return false
		}
		payload, err := json.Marshal(overview)
		if err != nil {
			return false
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
			return false
		}
		flusher.Flush()
		return true
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	if !send() {
		return
	}
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			if !send() {
				return
			}
		}
	}
}
