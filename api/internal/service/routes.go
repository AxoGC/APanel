package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"apanel/internal/response"
)

// SERVICE_NOT_FOUND is returned when the requested systemd unit doesn't exist.
const SERVICE_NOT_FOUND response.Code = "SERVICE_NOT_FOUND"

// RegisterRoutes wires the /api/services/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/services", requireAuth(http.HandlerFunc(m.listServices)))
	mux.Handle("GET /api/services/enablement/stream", requireAuth(http.HandlerFunc(m.streamServiceEnablement)))
	mux.Handle("GET /api/services/{name}", requireAuth(http.HandlerFunc(m.serviceDetail)))
	mux.Handle("POST /api/services/{name}/start", requireAuth(m.serviceAction(m.Start)))
	mux.Handle("POST /api/services/{name}/stop", requireAuth(m.serviceAction(m.Stop)))
	mux.Handle("POST /api/services/{name}/restart", requireAuth(m.serviceAction(m.Restart)))
	mux.Handle("POST /api/services/{name}/enable", requireAuth(m.serviceAction(m.Enable)))
	mux.Handle("POST /api/services/{name}/disable", requireAuth(m.serviceAction(m.Disable)))
	mux.Handle("GET /api/services/{name}/logs", requireAuth(http.HandlerFunc(m.serviceLogs)))
	mux.Handle("GET /api/services/{name}/logs/stream", requireAuth(http.HandlerFunc(m.serviceLogsStream)))
}

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

func (m *Manager) listServices(w http.ResponseWriter, r *http.Request) {
	states := statesForStatus(r.URL.Query().Get("status"))
	units, err := m.List(r.Context(), states)
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

// streamServiceEnablement streams each service's on-disk enablement state
// one message at a time — see UnitFileStream: it's the slow call listServices
// no longer waits on.
func (m *Manager) streamServiceEnablement(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}

	stream, err := m.OpenUnitFileStream(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	defer stream.Close()

	response.WriteLogStreamHeaders(w, flusher)
	err = stream.Run(r.Context(), func(e UnitEnablement) { writeSSEEvent(w, flusher, e) })
	writeSSEStreamEnd(w, flusher, err)
}

// writeSSEEvent and writeSSEStreamEnd duplicate the identically-named
// helpers in container/routes.go — see there for why this project doesn't
// factor them into the shared response package.
func writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, v any) {
	payload, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", payload)
	flusher.Flush()
}

func writeSSEStreamEnd(w http.ResponseWriter, flusher http.Flusher, err error) {
	if err != nil {
		payload, _ := json.Marshal(map[string]string{"message": err.Error()})
		fmt.Fprintf(w, "event: failed\ndata: %s\n\n", payload)
	} else {
		fmt.Fprint(w, "event: done\ndata: {}\n\n")
	}
	flusher.Flush()
}

func (m *Manager) serviceDetail(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	detail, err := m.Detail(r.Context(), name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, detail)
}

func (m *Manager) serviceLogs(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	out, err := m.Logs(r.Context(), name, response.LogLines(r))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, response.SplitLogLines(out))
}

func (m *Manager) serviceLogsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}
	name := r.PathValue("name")
	rc, err := m.StreamLogs(r.Context(), name, response.LogLines(r))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	defer rc.Close()

	response.WriteLogStreamHeaders(w, flusher)
	response.StreamLogLines(w, flusher, rc)
}

func (m *Manager) serviceAction(action func(context.Context, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := action(r.Context(), name); err != nil {
			if errors.Is(err, ErrNotFound) {
				response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
				return
			}
			response.WriteInternalError(w, err)
			return
		}
		response.WriteOK(w, nil)
	}
}
