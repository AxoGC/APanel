package auditlog

import (
	"net/http"
	"strconv"

	"apanel/internal/response"
)

const INVALID_QUERY response.Code = "INVALID_QUERY"

// RegisterRoutes wires the read-only /api/auditlog route onto mux — see
// httpserver.RouteRegistrar. Writing entries happens exclusively through
// Record, called from httpserver's global request instrumentation (and
// directly from internal/auth for login/logout), not through any route
// here.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/auditlog", requireAuth(http.HandlerFunc(m.list)))
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
