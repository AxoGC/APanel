package httpserver

import (
	"net/http"

	"apanel/internal/response"
)

// FIREWALL_UNAVAILABLE is returned when ufw isn't installed on this host.
const FIREWALL_UNAVAILABLE response.Code = "FIREWALL_UNAVAILABLE"

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
