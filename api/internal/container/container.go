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
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

var (
	ErrNotFound        = errors.New("container not found")
	ErrInvalidImage    = errors.New("invalid image")
	ErrNetworkNotFound = errors.New("network not found")
)

// predefinedNetworks are Docker's own built-in networks. They always exist
// and can never be removed, so the UI can disable delete for them up front
// instead of round-tripping to the daemon to find out.
var predefinedNetworks = map[string]bool{"bridge": true, "host": true, "none": true}

type Container struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Image  string `json:"image"`
	State  string `json:"state"`  // Docker's own vocabulary: running, exited, created, paused, restarting, removing, dead
	Status string `json:"status"` // human-readable, e.g. "Up 3 hours" / "Exited (0) 5 minutes ago"
}

// ContainerRef identifies a container that is using an image or network, so
// the UI can show which ones without a second round trip.
type ContainerRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Image struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	Size   int64          `json:"size"`
	UsedBy []ContainerRef `json:"usedBy"`
}

type Network struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	Driver string         `json:"driver"`
	Scope  string         `json:"scope"`
	UsedBy []ContainerRef `json:"usedBy"`
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

// containerUsage lists every container (running and stopped, since a
// stopped container still pins its image and stays attached to its
// networks) and groups them by the image ID and network IDs they use, so
// ListImages/ListNetworks can report which containers are using each entry
// without a per-entry inspect call.
func (m *Manager) containerUsage(ctx context.Context) (byImage, byNetwork map[string][]ContainerRef, err error) {
	raw, err := m.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, nil, err
	}

	byImage = make(map[string][]ContainerRef)
	byNetwork = make(map[string][]ContainerRef)
	for _, c := range raw {
		name := c.ID
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
		}
		ref := ContainerRef{ID: c.ID, Name: name}

		byImage[c.ImageID] = append(byImage[c.ImageID], ref)

		if c.NetworkSettings != nil {
			for _, ep := range c.NetworkSettings.Networks {
				if ep == nil {
					continue
				}
				byNetwork[ep.NetworkID] = append(byNetwork[ep.NetworkID], ref)
			}
		}
	}
	return byImage, byNetwork, nil
}

// ListImages returns local images together with the containers that
// reference each one. Images in use are intentionally exposed so the UI can
// keep them out of destructive bulk-selection actions.
func (m *Manager) ListImages(ctx context.Context) ([]Image, error) {
	raw, err := m.cli.ImageList(ctx, image.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	byImage, _, err := m.containerUsage(ctx)
	if err != nil {
		return nil, err
	}

	images := make([]Image, 0, len(raw))
	for _, item := range raw {
		name := strings.Join(item.RepoTags, ", ")
		if name == "" {
			name = "<none>:<none>"
		}
		images = append(images, Image{
			ID:     item.ID,
			Name:   name,
			Size:   item.Size,
			UsedBy: byImage[item.ID],
		})
	}

	sort.Slice(images, func(i, j int) bool { return images[i].Name < images[j].Name })
	return images, nil
}

// ListNetworks returns Docker networks together with the containers
// attached to each one.
func (m *Manager) ListNetworks(ctx context.Context) ([]Network, error) {
	raw, err := m.cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return nil, err
	}

	_, byNetwork, err := m.containerUsage(ctx)
	if err != nil {
		return nil, err
	}

	networks := make([]Network, 0, len(raw))
	for _, item := range raw {
		networks = append(networks, Network{
			ID:     item.ID,
			Name:   item.Name,
			Driver: item.Driver,
			Scope:  item.Scope,
			UsedBy: byNetwork[item.ID],
		})
	}

	sort.Slice(networks, func(i, j int) bool { return networks[i].Name < networks[j].Name })
	return networks, nil
}

// IsPredefinedNetwork reports whether name is one of Docker's built-in
// networks (bridge, host, none), which always exist and can never be
// removed.
func IsPredefinedNetwork(name string) bool {
	return predefinedNetworks[name]
}

// DeleteNetwork removes a single network. Unlike images, networks are
// deleted one at a time from the UI — there's no multi-select/batch action
// to keep in sync with a matching id list.
func (m *Manager) DeleteNetwork(ctx context.Context, id string) error {
	err := m.cli.NetworkRemove(ctx, id)
	if err == nil {
		return nil
	}
	if cerrdefs.IsNotFound(err) {
		return ErrNetworkNotFound
	}
	return err
}

// DeleteImages removes the supplied unused images without forcing removal.
// Docker remains the final authority and rejects any image that becomes used
// between listing and deletion.
func (m *Manager) DeleteImages(ctx context.Context, ids []string) error {
	for _, id := range ids {
		if strings.TrimSpace(id) == "" {
			return fmt.Errorf("%w: image id", ErrInvalidImage)
		}
		if _, err := m.cli.ImageRemove(ctx, id, image.RemoveOptions{}); err != nil {
			return err
		}
	}
	return nil
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
