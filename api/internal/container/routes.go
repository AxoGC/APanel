package container

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"apanel/internal/response"
)

// CONTAINER_NOT_FOUND is returned when the requested container doesn't exist.
const CONTAINER_NOT_FOUND response.Code = "CONTAINER_NOT_FOUND"
const CONTAINER_NOT_RUNNING response.Code = "CONTAINER_NOT_RUNNING"
const INVALID_IMAGE_DELETE response.Code = "INVALID_IMAGE_DELETE"
const INVALID_VOLUME_DELETE response.Code = "INVALID_VOLUME_DELETE"
const NETWORK_NOT_FOUND response.Code = "NETWORK_NOT_FOUND"
const CONTAINER_CREATE_INVALID response.Code = "CONTAINER_CREATE_INVALID"
const CONTAINER_NAME_CONFLICT response.Code = "CONTAINER_NAME_CONFLICT"

// RegisterRoutes wires the /api/containers/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/containers", requireAuth(http.HandlerFunc(m.listContainers)))
	mux.Handle("POST /api/containers", requireAuth(http.HandlerFunc(m.createContainer)))
	mux.Handle("GET /api/containers/images", requireAuth(http.HandlerFunc(m.listContainerImages)))
	mux.Handle("POST /api/containers/images/delete", requireAuth(http.HandlerFunc(m.deleteContainerImages)))
	mux.Handle("GET /api/containers/images/tags", requireAuth(http.HandlerFunc(m.listContainerImageTags)))
	mux.Handle("GET /api/containers/networks", requireAuth(http.HandlerFunc(m.listContainerNetworks)))
	mux.Handle("POST /api/containers/networks/{id}/delete", requireAuth(http.HandlerFunc(m.deleteContainerNetwork)))
	mux.Handle("GET /api/containers/volumes", requireAuth(http.HandlerFunc(m.listContainerVolumes)))
	mux.Handle("GET /api/containers/volumes/stream", requireAuth(http.HandlerFunc(m.streamContainerVolumeSizes)))
	mux.Handle("POST /api/containers/volumes/delete", requireAuth(http.HandlerFunc(m.deleteContainerVolumes)))
	mux.Handle("POST /api/containers/{id}/start", requireAuth(m.containerAction(m.Start)))
	mux.Handle("POST /api/containers/{id}/stop", requireAuth(m.containerAction(m.Stop)))
	mux.Handle("POST /api/containers/{id}/restart", requireAuth(m.containerAction(m.Restart)))
	mux.Handle("POST /api/containers/{id}/delete", requireAuth(m.containerAction(m.Delete)))
	mux.Handle("GET /api/containers/{id}", requireAuth(http.HandlerFunc(m.containerDetail)))
	mux.Handle("GET /api/containers/{id}/logs", requireAuth(http.HandlerFunc(m.containerLogs)))
	mux.Handle("GET /api/containers/{id}/logs/stream", requireAuth(http.HandlerFunc(m.containerLogsStream)))
	mux.Handle("GET /api/containers/{id}/attach", requireAuth(http.HandlerFunc(m.containerAttach)))
}

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

func (m *Manager) listContainers(w http.ResponseWriter, r *http.Request) {
	states := containerStatesForStatus(r.URL.Query().Get("status"))
	containers, err := m.List(r.Context(), states)
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

func (m *Manager) createContainer(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string   `json:"name"`
		Image         string   `json:"image"`
		TTY           bool     `json:"tty"`
		OpenStdin     bool     `json:"openStdin"`
		NetworkMode   string   `json:"networkMode"`
		RestartPolicy string   `json:"restartPolicy"`
		Env           []string `json:"env"`
		Volumes       []string `json:"volumes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, CONTAINER_CREATE_INVALID)
		return
	}

	id, err := m.Create(r.Context(), CreateOptions{
		Name:          body.Name,
		Image:         body.Image,
		TTY:           body.TTY,
		OpenStdin:     body.OpenStdin,
		NetworkMode:   body.NetworkMode,
		RestartPolicy: body.RestartPolicy,
		Env:           body.Env,
		Binds:         body.Volumes,
	})
	if err != nil {
		if errors.Is(err, ErrInvalidCreate) {
			response.WriteCode(w, http.StatusBadRequest, CONTAINER_CREATE_INVALID)
			return
		}
		if errors.Is(err, ErrNameConflict) {
			response.WriteCode(w, http.StatusConflict, CONTAINER_NAME_CONFLICT)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, map[string]string{"id": id})
}

func (m *Manager) listContainerImages(w http.ResponseWriter, r *http.Request) {
	images, err := m.ListImages(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, images)
}

func (m *Manager) deleteContainerImages(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []string `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_IMAGE_DELETE)
		return
	}

	if err := m.DeleteImages(r.Context(), body.IDs); err != nil {
		if errors.Is(err, ErrInvalidImage) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_IMAGE_DELETE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) listContainerImageTags(w http.ResponseWriter, r *http.Request) {
	tags, err := m.ListImageTags(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, tags)
}

func (m *Manager) listContainerNetworks(w http.ResponseWriter, r *http.Request) {
	networks, err := m.ListNetworks(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, networks)
}

func (m *Manager) deleteContainerNetwork(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := m.DeleteNetwork(r.Context(), id); err != nil {
		if errors.Is(err, ErrNetworkNotFound) {
			response.WriteCode(w, http.StatusNotFound, NETWORK_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) listContainerVolumes(w http.ResponseWriter, r *http.Request) {
	volumes, err := m.ListVolumes(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, volumes)
}

func (m *Manager) streamContainerVolumeSizes(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}

	stream, err := m.OpenVolumeSizeStream(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	defer stream.Close()

	response.WriteLogStreamHeaders(w, flusher)
	err = stream.Run(r.Context(), func(size VolumeSize) { writeSSEEvent(w, flusher, size) })
	writeSSEStreamEnd(w, flusher, err)
}

// writeSSEEvent sends one unnamed ("message") SSE event carrying v as JSON.
func writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, v any) {
	payload, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", payload)
	flusher.Flush()
}

// writeSSEStreamEnd closes out a stream with a named "done" event so the
// client can tell "every item finished" apart from a dropped connection —
// EventSource can't otherwise distinguish those from a plain close, and
// would keep auto-retrying a stream that already finished on purpose. A
// failure partway through is reported as a named "failed" event instead —
// deliberately not "error", which EventSource itself already dispatches for
// transport-level failures and would make the two impossible to tell apart
// client-side. A normal JSON error envelope can't be sent this far into an
// SSE response either way — the 200 and headers are already committed.
func writeSSEStreamEnd(w http.ResponseWriter, flusher http.Flusher, err error) {
	if err != nil {
		payload, _ := json.Marshal(map[string]string{"message": err.Error()})
		fmt.Fprintf(w, "event: failed\ndata: %s\n\n", payload)
	} else {
		fmt.Fprint(w, "event: done\ndata: {}\n\n")
	}
	flusher.Flush()
}

func (m *Manager) deleteContainerVolumes(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Names []string `json:"names"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Names) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_VOLUME_DELETE)
		return
	}

	if err := m.DeleteVolumes(r.Context(), body.Names); err != nil {
		if errors.Is(err, ErrInvalidVolume) {
			response.WriteCode(w, http.StatusBadRequest, INVALID_VOLUME_DELETE)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) containerDetail(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	detail, err := m.Detail(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, detail)
}

func (m *Manager) containerLogs(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	out, err := m.Logs(r.Context(), id, response.LogLines(r))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, response.SplitLogLines(out))
}

func (m *Manager) containerLogsStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := response.RequireFlusher(w)
	if !ok {
		return
	}
	id := r.PathValue("id")
	rc, err := m.StreamLogs(r.Context(), id, response.LogLines(r))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	defer rc.Close()

	response.WriteLogStreamHeaders(w, flusher)
	response.StreamLogLines(w, flusher, rc)
}

type containerAttachReady struct {
	Type      string `json:"type"`
	TTY       bool   `json:"tty"`
	Stdin     bool   `json:"stdin"`
	StdinOnce bool   `json:"stdinOnce"`
}

type containerAttachMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

type websocketBinaryWriter struct {
	conn *websocket.Conn
}

func (w websocketBinaryWriter) Write(p []byte) (int, error) {
	if err := w.conn.WriteMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

var containerAttachUpgrader = websocket.Upgrader{}

// containerAttach bridges an authenticated browser WebSocket to Docker's
// bidirectional attach stream. Closing the dialog only detaches this client;
// this handler never invokes a container stop operation.
func (m *Manager) containerAttach(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	session, err := m.Attach(r.Context(), id)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
		case errors.Is(err, ErrNotRunning):
			response.WriteCode(w, http.StatusConflict, CONTAINER_NOT_RUNNING)
		default:
			response.WriteInternalError(w, err)
		}
		return
	}
	defer session.Close()

	conn, err := containerAttachUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()
	conn.SetReadLimit(1 << 20)

	if err := conn.WriteJSON(containerAttachReady{
		Type: "ready", TTY: session.TTY, Stdin: session.Stdin, StdinOnce: session.StdinOnce,
	}); err != nil {
		return
	}

	outputDone := make(chan struct{})
	go func() {
		defer close(outputDone)
		_ = session.CopyOutput(websocketBinaryWriter{conn: conn})
		// Unblock ReadMessage if the container exits before the browser
		// closes the dialog.
		_ = conn.Close()
	}()

readLoop:
	for {
		_, payload, readErr := conn.ReadMessage()
		if readErr != nil {
			break
		}

		var message containerAttachMessage
		if json.Unmarshal(payload, &message) != nil {
			continue
		}
		switch message.Type {
		case "input":
			if session.Stdin && message.Data != "" {
				if _, err := session.WriteInput([]byte(message.Data)); err != nil {
					break readLoop
				}
			}
		case "resize":
			if session.TTY && message.Cols > 0 && message.Rows > 0 {
				if err := m.Resize(r.Context(), id, uint(message.Cols), uint(message.Rows)); err != nil {
					break readLoop
				}
			}
		}
	}

	_ = conn.Close()
	session.Close()
	<-outputDone
}

func (m *Manager) containerAction(action func(context.Context, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if err := action(r.Context(), id); err != nil {
			if errors.Is(err, ErrNotFound) {
				response.WriteCode(w, http.StatusNotFound, CONTAINER_NOT_FOUND)
				return
			}
			response.WriteInternalError(w, err)
			return
		}
		response.WriteOK(w, nil)
	}
}
