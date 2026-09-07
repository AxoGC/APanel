package auditlog

import (
	"encoding/json"
	"net/http"
	"strconv"

	"apanel/internal/response"
)

const INVALID_QUERY response.Code = "INVALID_QUERY"
const INVALID_RETENTION_DAYS response.Code = "INVALID_RETENTION_DAYS"

// RegisterRoutes wires the /api/auditlog routes onto mux — see
// httpserver.RouteRegistrar. Writing entries happens exclusively through
// Record, called from httpserver's global request instrumentation (and
// directly from internal/auth for login/logout), not through any route
// here.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/auditlog", requireAuth(http.HandlerFunc(m.list)))
	mux.Handle("GET /api/auditlog/settings", requireAuth(http.HandlerFunc(m.getSettings)))
	mux.Handle("PUT /api/auditlog/settings", requireAuth(http.HandlerFunc(m.putSettings)))
}

type auditLogSettings struct {
	RetentionDays int `json:"retentionDays"`
}

func (m *Manager) getSettings(w http.ResponseWriter, r *http.Request) {
	response.WriteOK(w, auditLogSettings{RetentionDays: m.RetentionDays()})
}

func (m *Manager) putSettings(w http.ResponseWriter, r *http.Request) {
	var body auditLogSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RetentionDays <= 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_RETENTION_DAYS)
		return
	}
	if err := m.SetRetentionDays(body.RetentionDays); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, auditLogSettings{RetentionDays: body.RetentionDays})
}

func (m *Manager) list(w http.ResponseWriter, r *http.Request) {
	limit := defaultLimit
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			response.WriteCode(w, http.StatusBadRequest, INVALID_QUERY)
			return
		}
		limit = n
	}

	var beforeID uint
	if v := r.URL.Query().Get("beforeId"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			response.WriteCode(w, http.StatusBadRequest, INVALID_QUERY)
			return
		}
		beforeID = uint(n)
	}

	entries, err := m.List(limit, beforeID)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, entries)
}
