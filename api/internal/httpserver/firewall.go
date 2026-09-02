package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"

	"apanel/internal/firewall"
	"apanel/internal/response"
)

// FIREWALL_UNAVAILABLE is returned when ufw isn't installed on this host.
const FIREWALL_UNAVAILABLE response.Code = "FIREWALL_UNAVAILABLE"

// INVALID_RULE is returned when the add-rule request body fails validation.
const INVALID_RULE response.Code = "INVALID_RULE"

func (s *Server) getFirewallStatus(w http.ResponseWriter, r *http.Request) {
	if !s.firewall.Available() {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	status, err := s.firewall.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (s *Server) addFirewallRule(w http.ResponseWriter, r *http.Request) {
	if !s.firewall.Available() {
		response.WriteCode(w, http.StatusOK, FIREWALL_UNAVAILABLE)
		return
	}

	var body struct {
		Action   string `json:"action"`
		From     string `json:"from"`
		Port     string `json:"port"`
		Protocol string `json:"protocol"`
		Family   string `json:"family"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
		return
	}

	if err := s.firewall.AddRule(r.Context(), body.Action, body.From, body.Port, body.Protocol, body.Family); err != nil {
		if errors.Is(err, firewall.ErrInvalidRule) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_RULE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}

	status, err := s.firewall.Status(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}
