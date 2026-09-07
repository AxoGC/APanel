package database

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"apanel/internal/response"
)

const (
	databaseUnreachable  response.Code = "DATABASE_UNREACHABLE"
	databaseUnauthorized response.Code = "DATABASE_UNAUTHORIZED"
)

// RegisterRoutes wires the /api/database/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/database/databases", requireAuth(http.HandlerFunc(m.getDatabases)))
	mux.Handle("GET /api/database/databases/stream", requireAuth(http.HandlerFunc(m.streamDatabaseSizes)))
	mux.Handle("GET /api/database/databases/{name}/tables", requireAuth(http.HandlerFunc(m.getTables)))
	mux.Handle("GET /api/database/databases/{name}/tables/stream", requireAuth(http.HandlerFunc(m.streamTableStats)))
	mux.Handle("GET /api/database/databases/{name}/tables/{schema}/{table}/columns", requireAuth(http.HandlerFunc(m.getColumns)))
}

// writeDatabaseError maps the connection-facing errors from database.go onto
// specific response codes, so the frontend can tell "wrong host/port /
// nothing there" apart from "reachable but rejected the credentials" apart
// from everything else.
func writeDatabaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnreachable):
		response.WriteCode(w, http.StatusBadGateway, databaseUnreachable)
	case errors.Is(err, ErrUnauthorized):
		response.WriteCode(w, http.StatusUnauthorized, databaseUnauthorized)
	default:
		response.WriteInternalError(w, err)
	}
}

func (m *Manager) getDatabases(w http.ResponseWriter, r *http.Request) {
	infos, err := m.ListDatabases(r.Context())
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func (m *Manager) getTables(w http.ResponseWriter, r *http.Request) {
	infos, err := m.ListTables(r.Context(), r.PathValue("name"))
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func (m *Manager) getColumns(w http.ResponseWriter, r *http.Request) {
	infos, err := m.ListColumns(r.Context(), r.PathValue("name"), r.PathValue("schema"), r.PathValue("table"))
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func (m *Manager) streamDatabaseSizes(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}

	stream, err := m.OpenDatabaseSizeStream(r.Context())
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	defer stream.Close()

	response.WriteLogStreamHeaders(w, flusher)
	err = stream.Run(r.Context(), func(size DatabaseSize) { writeSSEEvent(w, flusher, size) })
	writeSSEStreamEnd(w, flusher, err)
}

func (m *Manager) streamTableStats(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}

	stream, err := m.OpenTableStatsStream(r.Context(), r.PathValue("name"))
	if err != nil {
		writeDatabaseError(w, err)
		return
	}
	defer stream.Close()

	response.WriteLogStreamHeaders(w, flusher)
	err = stream.Run(r.Context(), func(stats TableStats) { writeSSEEvent(w, flusher, stats) })
	writeSSEStreamEnd(w, flusher, err)
}

// writeSSEEvent sends one unnamed ("message") SSE event carrying v as JSON.
func writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, v any) {
	payload, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", payload)
	flusher.Flush()
}

// writeSSEStreamEnd closes out a stream with a named "done" event so the
// client can tell "every item finished" apart from a dropped connection —
// EventSource can't otherwise distinguish those from a plain close, and
// would keep auto-retrying a stream that already finished on purpose. A
// failure partway through (the connection to Postgres dropped, credentials
// stopped working mid-scan) is reported as a named "failed" event instead
// — deliberately not "error", which EventSource itself already dispatches
// for transport-level failures and would make the two impossible to tell
// apart client-side. A normal JSON error envelope can't be sent this far
// into an SSE response either way — the 200 and headers are already
// committed.
func writeSSEStreamEnd(w http.ResponseWriter, flusher http.Flusher, err error) {
	if err != nil {
		payload, _ := json.Marshal(map[string]string{"message": err.Error()})
		fmt.Fprintf(w, "event: failed\ndata: %s\n\n", payload)
	} else {
		fmt.Fprint(w, "event: done\ndata: {}\n\n")
	}
	flusher.Flush()
}
