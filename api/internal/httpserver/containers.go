package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"apanel/internal/container"
	"apanel/internal/response"
)

// CONTAINER_NOT_FOUND is returned when the requested container doesn't exist.
const CONTAINER_NOT_FOUND response.Code = "CONTAINER_NOT_FOUND"
const INVALID_IMAGE_DELETE response.Code = "INVALID_IMAGE_DELETE"
const NETWORK_NOT_FOUND response.Code = "NETWORK_NOT_FOUND"

// containerStatesForStatus maps the frontend's status filter straight onto
// Docker's own container state vocabulary — unlike systemd units, a
// container's single State field already is the concept the filter needs,
// so no translation layer is needed here. "all" (and any unrecognized
// value) returns every container regardless of state.
func containerStatesForStatus(status string) []string {
	switch status {
	case "exited":
		return []string{"exited"}
	case "all":
		return nil
	default: // "running", and no status given at all
		return []string{"running"}
	}
}

func (s *Server) listContainers(w http.ResponseWriter, r *http.Request) {
	states := containerStatesForStatus(r.URL.Query().Get("status"))
	containers, err := s.containers.List(r.Context(), states)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	if q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); q != "" {
		matched := containers[:0]
		for _, c := range containers {
			if strings.Contains(strings.ToLower(c.Name), q) || strings.Contains(strings.ToLower(c.Image), q) {
				matched = append(matched, c)
			}
		}
		containers = matched
	}

	response.WriteOK(w, containers)
}

func (s *Server) listContainerImages(w http.ResponseWriter, r *http.Request) {
	images, err := s.containers.ListImages(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, images)
}

func (s *Server) deleteContainerImages(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_IMAGE_DELETE)
		return
	}

	if err := s.containers.DeleteImages(r.Context(), body.IDs); err != nil {
		if errors.Is(err, container.ErrInvalidImage) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_IMAGE_DELETE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Server) listContainerImageTags(w http.ResponseWriter, r *http.Request) {
	tags, err := s.containers.ListImageTags(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, tags)
}

func (s *Server) listContainerNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := s.containers.ListNetworks(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, networks)
}

func (s *Server) deleteContainerNetwork(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := s.containers.DeleteNetwork(r.Context(), id); err != nil {
		if errors.Is(err, container.ErrNetworkNotFound) {
			response.WriteCode(w, http.StatusNotFound, NETWORK_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Server) containerLogs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	out, err := s.containers.Logs(r.Context(), id, logLines(r))
	if err != nil {
		if errors.Is(err, container.ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, splitLogLines(out))
}

func (s *Server) containerLogsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := requireFlusher(w)
	if !ok {
		return
	}
	id := r.PathValue("id")
	rc, err := s.containers.StreamLogs(r.Context(), id, logLines(r))
	if err != nil {
		if errors.Is(err, container.ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	defer rc.Close()

	writeLogStreamHeaders(w, flusher)
	streamLogLines(w, flusher, rc)
}

func (s *Server) containerAction(action func(context.Context, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if err := action(r.Context(), id); err != nil {
			if errors.Is(err, container.ErrNotFound) {
				response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
				return
			}
			response.WriteInternalError(w, err)
			return
		}
		response.WriteOK(w, nil)
	}
}
