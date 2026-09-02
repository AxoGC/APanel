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
	"apanel/internal/container"
	"apanel/internal/history"
	"apanel/internal/response"
	"apanel/internal/service"
	"apanel/internal/stats"
)

//go:embed dist
var embeddedDist embed.FS

type Server struct {
	auth       *auth.Service
	stats      *stats.Collector
	services   *service.Manager
	containers *container.Manager
	history    *history.Manager
	mux        *http.ServeMux
}

func New(authSvc *auth.Service, statsCollector *stats.Collector, services *service.Manager, containers *container.Manager, historyMgr *history.Manager) *Server {
	s := &Server{auth: authSvc, stats: statsCollector, services: services, containers: containers, history: historyMgr, mux: http.NewServeMux()}
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

	s.mux.Handle("GET /api/services", s.auth.Middleware(http.HandlerFunc(s.listServices)))
	s.mux.Handle("POST /api/services/{name}/start", s.auth.Middleware(s.serviceAction(s.services.Start)))
	s.mux.Handle("POST /api/services/{name}/stop", s.auth.Middleware(s.serviceAction(s.services.Stop)))
	s.mux.Handle("POST /api/services/{name}/restart", s.auth.Middleware(s.serviceAction(s.services.Restart)))
	s.mux.Handle("POST /api/services/{name}/enable", s.auth.Middleware(s.serviceAction(s.services.Enable)))
	s.mux.Handle("POST /api/services/{name}/disable", s.auth.Middleware(s.serviceAction(s.services.Disable)))

	s.mux.Handle("GET /api/containers", s.auth.Middleware(http.HandlerFunc(s.listContainers)))
	s.mux.Handle("POST /api/containers/{id}/start", s.auth.Middleware(s.containerAction(s.containers.Start)))
	s.mux.Handle("POST /api/containers/{id}/stop", s.auth.Middleware(s.containerAction(s.containers.Stop)))
	s.mux.Handle("POST /api/containers/{id}/restart", s.auth.Middleware(s.containerAction(s.containers.Restart)))

	s.mux.Handle("GET /api/history", s.auth.Middleware(http.HandlerFunc(s.getHistory)))

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
