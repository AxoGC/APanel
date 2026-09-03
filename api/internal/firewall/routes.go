package firewall

import (
	"encoding/json"
	"errors"
	"net/http"

	"apanel/internal/response"
)

// FIREWALL_UNAVAILABLE is returned when ufw isn't installed on this host.
const FIREWALL_UNAVAILABLE response.Code = "FIREWALL_UNAVAILABLE"

// INVALID_RULE is returned when the add-rule request body fails validation.
const INVALID_RULE response.Code = "INVALID_RULE"

// FeatureName identifies this package's entry in GET /api/status's
// per-feature availability map.
func (m *Manager) FeatureName() string { return "firewall" }

// RegisterRoutes wires the /api/firewall/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/firewall/status", requireAuth(http.HandlerFunc(m.getFirewallStatus)))
	mux.Handle("POST /api/firewall/rules", requireAuth(http.HandlerFunc(m.addFirewallRule)))
	mux.Handle("PUT /api/firewall/rules", requireAuth(http.HandlerFunc(m.updateFirewallRule)))
	mux.Handle("DELETE /api/firewall/rules", requireAuth(http.HandlerFunc(m.deleteFirewallRule)))
}

func (m *Manager) getFirewallStatus(w http.ResponseWriter, r *http.Request) {
	if !m.Available(r.Context()) {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	status, err := m.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (m *Manager) addFirewallRule(w http.ResponseWriter, r *http.Request) {
	if !m.Available(r.Context()) {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	var body struct {
		Action   string `json:"action"`
		FromIPv4 string `json:"fromIPv4"`
		FromIPv6 string `json:"fromIPv6"`
		Port     string `json:"port"`
		Protocol string `json:"protocol"`
		IPv4     bool   `json:"ipv4"`
		IPv6     bool   `json:"ipv6"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
		return
	}

	if err := m.AddRule(r.Context(), body.Action, body.FromIPv4, body.FromIPv6, body.Port, body.Protocol, body.IPv4, body.IPv6); err != nil {
		if errors.Is(err, ErrInvalidRule) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}

	status, err := m.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (m *Manager) updateFirewallRule(w http.ResponseWriter, r *http.Request) {
	if !m.Available(r.Context()) {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	var body struct {
		Numbers  []int  `json:"numbers"`
		Action   string `json:"action"`
		FromIPv4 string `json:"fromIPv4"`
		FromIPv6 string `json:"fromIPv6"`
		Port     string `json:"port"`
		Protocol string `json:"protocol"`
		IPv4     bool   `json:"ipv4"`
		IPv6     bool   `json:"ipv6"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Numbers) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
		return
	}

	if err := m.UpdateRule(r.Context(), body.Numbers, body.Action, body.FromIPv4, body.FromIPv6, body.Port, body.Protocol, body.IPv4, body.IPv6); err != nil {
		if errors.Is(err, ErrInvalidRule) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}

	status, err := m.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (m *Manager) deleteFirewallRule(w http.ResponseWriter, r *http.Request) {
	if !m.Available(r.Context()) {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	var body struct {
		Numbers []int `json:"numbers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Numbers) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
		return
	}

	if err := m.DeleteRule(r.Context(), body.Numbers); err != nil {
		if errors.Is(err, ErrInvalidRule) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}

	status, err := m.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}
