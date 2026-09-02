// Package container manages Docker containers over the Docker Engine API
// (via the official SDK, talking to the daemon's unix socket — never
// shelling out to the docker CLI). This is deliberately separate from the
// service (systemd) package: the plan keeps systemd- and Docker-managed
// services as two distinct concepts rather than one unified abstraction.
package container

import (
	"bytes"
	"context"
	"errors"
	"io"
	"sort"
	"strconv"
	"strings"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

var ErrNotFound = errors.New("container not found")

type Container struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Image  string `json:"image"`
	State  string `json:"state"`  // Docker's own vocabulary: running, exited, created, paused, restarting, removing, dead
	Status string `json:"status"` // human-readable, e.g. "Up 3 hours" / "Exited (0) 5 minutes ago"
}

type Manager struct {
	cli *client.Client
}

// New constructs a client without dialing the daemon — connection errors
// (docker not installed, daemon not running) only surface once something
// actually calls List/Start/Stop/Restart, so apanel still starts fine on a
// host without Docker.
func New() (*Manager, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &Manager{cli: cli}, nil
}

// Available reports whether the Docker daemon is actually reachable right
// now (unlike New, which never dials the daemon, this makes one real call).
func (m *Manager) Available(ctx context.Context) bool {
	_, err := m.cli.Ping(ctx)
	return err == nil
}

// List returns containers, optionally filtered by Docker's own state
// vocabulary (e.g. []string{"running"}) via the Engine API's native status
// filter — the same "push filtering down to the source" approach used for
// systemd units. An empty states list returns every container regardless
// of state.
func (m *Manager) List(ctx context.Context, states []string) ([]Container, error) {
	opts := container.ListOptions{All: true}
	if len(states) > 0 {
		args := filters.NewArgs()
		for _, s := range states {
			args.Add("status", s)
		}
		opts.Filters = args
	}

	raw, err := m.cli.ContainerList(ctx, opts)
	if err != nil {
		return nil, err
	}

	containers := make([]Container, 0, len(raw))
	for _, c := range raw {
		name := c.ID
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		containers = append(containers, Container{
			ID:     c.ID,
			Name:   name,
			Image:  c.Image,
			State:  c.State,
			Status: c.Status,
		})
	}

	sort.Slice(containers, func(i, j int) bool { return containers[i].Name < containers[j].Name })
	return containers, nil
}

func (m *Manager) Start(ctx context.Context, id string) error {
	err := m.cli.ContainerStart(ctx, id, container.StartOptions{})
	return translateNotFound(err)
}

func (m *Manager) Stop(ctx context.Context, id string) error {
	err := m.cli.ContainerStop(ctx, id, container.StopOptions{})
	return translateNotFound(err)
}

func (m *Manager) Restart(ctx context.Context, id string) error {
	err := m.cli.ContainerRestart(ctx, id, container.StopOptions{})
	return translateNotFound(err)
}

// Logs returns the container's last n lines of combined stdout/stderr,
// oldest first.
func (m *Manager) Logs(ctx context.Context, id string, lines int) (string, error) {
	demux, err := m.needsDemux(ctx, id)
	if err != nil {
		return "", err
	}
	rc, err := m.cli.ContainerLogs(ctx, id, container.LogsOptions{
		ShowStdout: true, ShowStderr: true, Tail: strconv.Itoa(lines), Timestamps: true,
	})
	if err != nil {
		return "", translateNotFound(err)
	}
	defer rc.Close()

	var buf bytes.Buffer
	if demux {
		_, err = stdcopy.StdCopy(&buf, &buf, rc)
	} else {
		_, err = io.Copy(&buf, rc)
	}
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// StreamLogs seeds with the container's last n log lines, then follows new
// ones as Docker writes them. The returned reader's Close stops the
// underlying log request; it also stops on its own when ctx is done.
func (m *Manager) StreamLogs(ctx context.Context, id string, lines int) (io.ReadCloser, error) {
	demux, err := m.needsDemux(ctx, id)
	if err != nil {
		return nil, err
	}
	rc, err := m.cli.ContainerLogs(ctx, id, container.LogsOptions{
		ShowStdout: true, ShowStderr: true, Tail: strconv.Itoa(lines), Timestamps: true, Follow: true,
	})
	if err != nil {
		return nil, translateNotFound(err)
	}
	if !demux {
		return rc, nil
	}

	pr, pw := io.Pipe()
	go func() {
		_, err := stdcopy.StdCopy(pw, pw, rc)
		rc.Close()
		_ = pw.CloseWithError(err)
	}()
	return pr, nil
}

// needsDemux reports whether a container's log stream is Docker's
// multiplexed stdout/stderr framing (true for the common case) rather than
// a raw byte stream (only when the container was created with a TTY).
func (m *Manager) needsDemux(ctx context.Context, id string) (bool, error) {
	insp, err := m.cli.ContainerInspect(ctx, id)
	if err != nil {
		return false, translateNotFound(err)
	}
	return insp.Config == nil || !insp.Config.Tty, nil
}

func translateNotFound(err error) error {
	if err == nil {
		return nil
	}
	if cerrdefs.IsNotFound(err) {
		return ErrNotFound
	}
	return err
}
