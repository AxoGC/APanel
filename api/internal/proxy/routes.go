package proxy

import (
	"encoding/json"
	"errors"
	"net/http"

	"apanel/internal/response"
)

const (
	proxyUnreachable      response.Code = "PROXY_UNREACHABLE"
	proxyUnauthorized     response.Code = "PROXY_UNAUTHORIZED"
	proxyGroupNotFound    response.Code = "PROXY_GROUP_NOT_FOUND"
	invalidProxyMode      response.Code = "INVALID_PROXY_MODE"
	invalidProxySelection response.Code = "INVALID_PROXY_SELECTION"
)

// RegisterRoutes wires the /api/proxy/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/proxy/overview", requireAuth(http.HandlerFunc(m.getOverview)))
	mux.Handle("PUT /api/proxy/mode", requireAuth(http.HandlerFunc(m.putMode)))
	mux.Handle("GET /api/proxy/groups/{name}", requireAuth(http.HandlerFunc(m.getGroup)))
	mux.Handle("PUT /api/proxy/groups/{name}/selection", requireAuth(http.HandlerFunc(m.putSelection)))
	mux.Handle("POST /api/proxy/groups/{name}/test", requireAuth(http.HandlerFunc(m.postTestDelay)))
}

// writeProxyError maps the controller-facing errors from proxy.go onto
// specific response codes, so the frontend can tell "wrong URL / nothing
// there" apart from "reachable but rejected the secret" apart from
// everything else.
func writeProxyError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrUnreachable):
		response.WriteCode(w, http.StatusBadGateway, proxyUnreachable)
	case errors.Is(err, ErrUnauthorized):
		response.WriteCode(w, http.StatusUnauthorized, proxyUnauthorized)
	case errors.Is(err, ErrGroupNotFound):
		response.WriteCode(w, http.StatusNotFound, proxyGroupNotFound)
	default:
		response.WriteInternalError(w, err)
	}
}

func (m *Manager) getOverview(w http.ResponseWriter, r *http.Request) {
	overview, err := m.Overview(r.Context())
	if err != nil {
		writeProxyError(w, err)
		return
	}
	response.WriteOK(w, overview)
}

func (m *Manager) putMode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mode string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, invalidProxyMode)
		return
	}

	overview, err := m.SetMode(r.Context(), body.Mode)
	if err != nil {
		if errors.Is(err, ErrInvalidMode) {
			response.WriteCode(w, http.StatusBadRequest, invalidProxyMode)
			return
		}
		writeProxyError(w, err)
		return
	}
	response.WriteOK(w, overview)
}

func (m *Manager) getGroup(w http.ResponseWriter, r *http.Request) {
	group, err := m.Group(r.Context(), r.PathValue("name"))
	if err != nil {
		writeProxyError(w, err)
		return
	}
	response.WriteOK(w, group)
}

func (m *Manager) putSelection(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		response.WriteCode(w, http.StatusBadRequest, invalidProxySelection)
		return
	}

	group, err := m.Select(r.Context(), r.PathValue("name"), body.Name)
	if err != nil {
		writeProxyError(w, err)
		return
	}
	response.WriteOK(w, group)
}

func (m *Manager) postTestDelay(w http.ResponseWriter, r *http.Request) {
	group, err := m.TestDelay(r.Context(), r.PathValue("name"))
	if err != nil {
		writeProxyError(w, err)
		return
	}
	response.WriteOK(w, group)
}
