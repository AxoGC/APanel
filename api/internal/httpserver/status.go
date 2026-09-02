package httpserver

import (
	"net/http"

	"apanel/internal/response"
)

// featureStatus tells the frontend which optional, dependency-gated
// features are actually usable on this host, so it can hide their nav
// items entirely rather than showing a page that says "unavailable".
type featureStatus struct {
	Containers bool `json:"containers"`
	History    bool `json:"history"`
	Firewall   bool `json:"firewall"`
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	response.WriteOK(w, featureStatus{
		Containers: s.containers.Available(r.Context()),
		History:    s.history.Available(),
		Firewall:   s.firewall.Available(),
	})
}
