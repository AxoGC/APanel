package update

import (
	"encoding/json"
	"net/http"
	"time"

	"apanel/internal/response"
	"apanel/internal/version"
)

const invalidSource response.Code = "INVALID_SOURCE"

// RegisterRoutes wires the /api/update/* routes onto mux — see
// httpserver.RouteRegistrar.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/update/status", requireAuth(http.HandlerFunc(m.getStatus)))
	mux.Handle("PUT /api/update/settings", requireAuth(http.HandlerFunc(m.putSettings)))
	mux.Handle("POST /api/update/check", requireAuth(http.HandlerFunc(m.postCheck)))
}

func (m *Manager) getStatus(w http.ResponseWriter, r *http.Request) {
	response.WriteOK(w, m.status())
}

func (m *Manager) putSettings(w http.ResponseWriter, r *http.Request) {
	var body Settings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, invalidSource)
		return
	}
	if err := m.saveSettings(body); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, m.status())
}

// postCheck is a manual, notify-only check: it records the result exactly
// like the background loop does, but never applies — only the enabled
// background loop does that (see Settings' doc comment).
func (m *Manager) postCheck(w http.ResponseWriter, r *http.Request) {
	s := m.loadSettings()
	manifest, err := FetchManifest(r.Context(), s.Source)
	result := &CheckResult{At: time.Now()}
	if err != nil {
		result.Error = err.Error()
	} else {
		result.LatestVersion = manifest.Version
		result.UpdateAvailable = version.Current() != "dev" && version.IsNewer(manifest.Version, version.Current())
	}
	m.setLastCheck(result)
	response.WriteOK(w, m.status())
}
