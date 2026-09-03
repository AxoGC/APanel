package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"apanel/internal/response"
	"apanel/internal/stats"
)

// PROCESS_NOT_FOUND is returned when the requested pid isn't a valid
// integer, or the process has already exited.
const PROCESS_NOT_FOUND response.Code = "PROCESS_NOT_FOUND"

const INVALID_NETWORK_SETTINGS response.Code = "INVALID_NETWORK_SETTINGS"

const dashboardNetworkSettingsKey = "dashboard.networkGaugeMaxMbps"

// defaultNetworkGaugeMaxMbps is what the upload gauge's 100% mark means
// until the user sets their own value via the dashboard's settings dialog.
const defaultNetworkGaugeMaxMbps = 10.0

// NetworkGaugeSettings controls what the dashboard's network gauge treats
// as "full" — MaxMbps is the upload rate (Mbps) that maps to 100%.
type NetworkGaugeSettings struct {
	MaxMbps float64 `json:"maxMbps"`
}

func (s *Server) getDashboardNetworkSettings(w http.ResponseWriter, r *http.Request) {
	raw, ok, err := s.settings.Get(dashboardNetworkSettingsKey)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if !ok {
		response.WriteOK(w, NetworkGaugeSettings{MaxMbps: defaultNetworkGaugeMaxMbps})
		return
	}

	var parsed NetworkGaugeSettings
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, parsed)
}

func (s *Server) putDashboardNetworkSettings(w http.ResponseWriter, r *http.Request) {
	var body NetworkGaugeSettings
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_NETWORK_SETTINGS)
		return
	}
	if body.MaxMbps <= 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_NETWORK_SETTINGS)
		return
	}

	encoded, err := json.Marshal(body)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if err := s.settings.Set(dashboardNetworkSettingsKey, string(encoded)); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, body)
}

func (s *Server) processDetail(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.Atoi(r.PathValue("pid"))
	if err != nil {
		response.WriteCode(w, http.StatusBadRequest, PROCESS_NOT_FOUND)
		return
	}

	detail, err := s.stats.ProcessDetail(pid)
	if err != nil {
		if errors.Is(err, stats.ErrProcessNotFound) {
			response.WriteCode(w, http.StatusNotFound, PROCESS_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, detail)
}
