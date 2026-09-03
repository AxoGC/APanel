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

// statesForStatus maps the frontend's status filter to a systemd D-Bus
// "states" filter, so the call itself does the filtering instead of us
// fetching everything and filtering in Go. systemd's states filter matches
// against a unit's load, active, *or* sub state — so passing the SubState
// value directly is exact, unlike e.g. ActiveState "active", which also
// matches SubState "exited". On this system the observed SubStates are
// "running", "exited", "dead" (per user observation, not systemd's own
// "failed" SubState, which never showed up) — "stopped" maps to "exited"
// and "failed" maps to "dead" accordingly. "all" (and any unrecognized
// value) falls back to service.Manager's unfiltered catalog listing, since
// systemd has no single native "everything, including units it's never
// loaded" query.
func statesForStatus(status string) []string {
	switch status {
	case "failed":
		return []string{"dead"}
	case "stopped":
		return []string{"exited"}
	case "all":
		return nil
	default: // "running", and no status given at all
		return []string{"running"}
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

func (s *Server) serviceDetail(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	detail, err := s.services.Detail(r.Context(), name)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, detail)
}

func (s *Server) serviceLogs(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	out, err := s.services.Logs(r.Context(), name, logLines(r))
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, splitLogLines(out))
}

func (s *Server) serviceLogsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := requireFlusher(w)
	if !ok {
		return
	}
	name := r.PathValue("name")
	rc, err := s.services.StreamLogs(r.Context(), name, logLines(r))
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	defer rc.Close()

	writeLogStreamHeaders(w, flusher)
	streamLogLines(w, flusher, rc)
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
