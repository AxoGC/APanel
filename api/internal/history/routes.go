package history

import (
	"encoding/json"
	"net/http"
	"strconv"

	"apanel/internal/response"
)

// SYSSTAT_UNAVAILABLE is returned when sysstat (sadf) isn't installed on
// this host. There's no self-collection fallback in this stage, so the
// history feature is simply off — this code tells the frontend to say so
// rather than show an empty chart.
const SYSSTAT_UNAVAILABLE response.Code = "SYSSTAT_UNAVAILABLE"

const INVALID_DAYS_AGO response.Code = "INVALID_DAYS_AGO"

const INVALID_SETTINGS response.Code = "INVALID_SETTINGS"

const historySettingsKey = "history.collectionSettings"

// RegisterRoutes wires the /api/history/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/history", requireAuth(http.HandlerFunc(m.getHistory)))
	mux.Handle("GET /api/history/settings", requireAuth(http.HandlerFunc(m.getHistorySettings)))
	mux.Handle("PUT /api/history/settings", requireAuth(http.HandlerFunc(m.putHistorySettings)))
}

// CollectionTarget holds the per-metric settings shown on the history
// page's settings dialog. This is a shell: sampling is still entirely
// sysstat/sadf-driven (see Manager.Sample), so changing these values is
// persisted but doesn't yet affect what's actually collected — that needs
// a real self-collection path, which this stage doesn't have.
type CollectionTarget struct {
	Enabled         bool `json:"enabled"`
	IntervalMinutes int  `json:"intervalMinutes"`
	RetentionDays   int  `json:"retentionDays"`
}

type HistoryCollectionSettings struct {
	CPU    CollectionTarget `json:"cpu"`
	Memory CollectionTarget `json:"memory"`
	Swap   CollectionTarget `json:"swap"`
}

func defaultHistoryCollectionSettings() HistoryCollectionSettings {
	target := CollectionTarget{Enabled: true, IntervalMinutes: 10, RetentionDays: 7}
	return HistoryCollectionSettings{CPU: target, Memory: target, Swap: target}
}

func (m *Manager) getHistorySettings(w http.ResponseWriter, r *http.Request) {
	raw, ok, err := m.settings.Get(historySettingsKey)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if !ok {
		response.WriteOK(w, defaultHistoryCollectionSettings())
		return
	}

	var parsed HistoryCollectionSettings
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, parsed)
}

func (m *Manager) putHistorySettings(w http.ResponseWriter, r *http.Request) {
	var body HistoryCollectionSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_SETTINGS)
		return
	}
	for _, target := range []CollectionTarget{body.CPU, body.Memory, body.Swap} {
		if target.IntervalMinutes <= 0 || target.RetentionDays <= 0 {
			response.WriteCode(w, http.StatusBadRequest, INVALID_SETTINGS)
			return
		}
	}

	encoded, err := json.Marshal(body)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if err := m.settings.Set(historySettingsKey, string(encoded)); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, body)
}

func (m *Manager) getHistory(w http.ResponseWriter, r *http.Request) {
	if !m.Available(r.Context()) {
		response.WriteCode(w, http.StatusOK, SYSSTAT_UNAVAILABLE)
		return
	}

	daysAgo := 0
	if v := r.URL.Query().Get("daysAgo"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 || n > 6 {
			response.WriteCode(w, http.StatusBadRequest, INVALID_DAYS_AGO)
			return
		}
		daysAgo = n
	}

	day, err := m.Sample(r.Context(), daysAgo)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, day)
}
