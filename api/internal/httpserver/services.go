package httpserver

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"apanel/internal/response"
	"apanel/internal/service"
)

// SERVICE_NOT_FOUND is returned when the requested systemd unit doesn't exist.
const SERVICE_NOT_FOUND response.Code = "SERVICE_NOT_FOUND"

// statesForStatus maps the frontend's status filter to systemd's own
// ActiveState vocabulary, so the D-Bus call itself does the filtering
// instead of us fetching everything and filtering in Go. "all" (and any
// unrecognized value) falls back to service.Manager's unfiltered catalog
// listing, since systemd has no single native "everything, including units
// it's never loaded" query.
func statesForStatus(status string) []string {
	switch status {
	case "failed":
		return []string{"failed"}
	case "stopped":
		return []string{"inactive"}
	case "all":
		return nil
	default: // "running", and no status given at all
		return []string{"active"}
	}
}

func (s *Server) listServices(w http.ResponseWriter, r *http.Request) {
	states := statesForStatus(r.URL.Query().Get("status"))
	units, err := s.services.List(r.Context(), states)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
		matched := units[:0]
		for _, u := range units {
			if strings.Contains(strings.ToLower(u.Name), q) || strings.Contains(strings.ToLower(u.Description), q) {
				matched = append(matched, u)
			}
		}
		units = matched
	}

	response.WriteOK(w, units)
}

func (s *Server) serviceAction(action func(context.Context, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := action(r.Context(), name); err != nil {
			if errors.Is(err, service.ErrNotFound) {
				response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
				return
			}
			response.WriteInternalError(w, err)
			return
		}
		response.WriteOK(w, nil)
	}
}
