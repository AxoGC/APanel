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
	"time"

	cerrdefs "github.com/containerd/errdefs"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"

	"apanel/internal/dependency"
)

var (
	ErrNotFound        = errors.New("container not found")
	ErrNotRunning      = errors.New("container is not running")
	ErrInvalidImage    = errors.New("invalid image")
	ErrInvalidVolume   = errors.New("invalid volume")
	ErrNetworkNotFound = errors.New("network not found")
	ErrInvalidCreate   = errors.New("invalid container configuration")
	ErrNameConflict    = errors.New("container name already in use")
)

var createRestartPolicies = map[string]bool{"no": true, "on-failure": true, "always": true, "unless-stopped": true}

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

// Volume is a Docker volume without its on-disk size — computing that
// requires a slow system-wide disk-usage scan, so it's reported separately
// by VolumeSizeStream (see ListVolumes/OpenVolumeSizeStream).
type Volume struct {
	Name   string         `json:"name"`
	UsedBy []ContainerRef `json:"usedBy"`
}

// VolumeSize is one volume-size event of the volume size stream.
type VolumeSize struct {
	Name  string `json:"name"`
	Bytes int64  `json:"bytes"`
}

// Detail describes everything the container detail dialog shows, gathered
// from a single Docker inspect call rather than List's lighter-weight
// summary.
type Detail struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Image         string     `json:"image"`
	Command       string     `json:"command"`
	Created       time.Time  `json:"created"`
	State         string     `json:"state"`
	ExitCode      int        `json:"exitCode"`
	StartedAt     *time.Time `json:"startedAt"`
	RestartPolicy string     `json:"restartPolicy"`
	Platform      string     `json:"platform"`
	// OpenStdin reports whether the container was created with stdin kept
	// open — the logs dialog uses it to decide whether Attach mode is worth
	// offering at all, before ever opening the attach WebSocket.
	OpenStdin bool `json:"openStdin"`
	// Networks holds one entry per attached network, formatted as "name"
	// or "name (ip)" when the endpoint has an address.
	Networks []string `json:"networks"`
	// Ports holds one entry per exposed port, e.g. "80/tcp" for an
	// unpublished port or "0.0.0.0:8080 -> 80/tcp" for a published one.
	Ports  []string `json:"ports"`
	Mounts []string `json:"mounts"`
	Env    []string `json:"env"`
}

type Manager struct {
	cli *client.Client
}

// AttachSession is a live connection to the standard streams of a
// container's main process. Unlike ContainerLogs, the hijacked connection
// is bidirectional and can forward browser input when OpenStdin is enabled.
type AttachSession struct {
	response  types.HijackedResponse
	TTY       bool
	Stdin     bool
	StdinOnce bool
}

func (s *AttachSession) CopyOutput(w io.Writer) error {
	if s.TTY {
		_, err := io.Copy(w, s.response.Reader)
		return err
	}
	_, err := stdcopy.StdCopy(w, w, s.response.Reader)
	return err
}

func (s *AttachSession) WriteInput(p []byte) (int, error) {
	if !s.Stdin {
		return 0, fmt.Errorf("container stdin is not open")
	}
	return s.response.Conn.Write(p)
}

func (s *AttachSession) Close() {
	s.response.Close()
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

// Key identifies this package's entry in httpserver's dependency endpoints.
func (m *Manager) Key() string { return "containers" }

// CheckDependency reports whether Docker is reachable and, if not, whether
// its systemd unit exists so httpserver can offer an "enable service"
// action instead of just an install link.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	if m.Available(ctx) {
		return dependency.State{Installed: true}
	}
	exists, active := dependency.Probe(ctx, "docker")
	if !exists {
		return dependency.State{}
	}
	return dependency.State{ServiceName: "docker", ServiceActive: active}
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
// networks/volumes) and groups them by the image ID, network IDs, and
// volume names they use, so ListImages/ListNetworks/ListVolumes can report
// which containers are using each entry without a per-entry inspect call.
func (m *Manager) containerUsage(ctx context.Context) (byImage, byNetwork, byVolume map[string][]ContainerRef, err error) {
	raw, err := m.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, nil, nil, err
	}

	byImage = make(map[string][]ContainerRef)
	byNetwork = make(map[string][]ContainerRef)
	byVolume = make(map[string][]ContainerRef)
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

		for _, mnt := range c.Mounts {
			if mnt.Type == mount.TypeVolume && mnt.Name != "" {
				byVolume[mnt.Name] = append(byVolume[mnt.Name], ref)
			}
		}
	}
	return byImage, byNetwork, byVolume, nil
}

// usedByRefs looks up id in m, returning an empty (never nil) slice when
// absent — a nil []ContainerRef marshals to JSON null, which the frontend's
// `.usedBy.length` would crash on.
func usedByRefs(m map[string][]ContainerRef, id string) []ContainerRef {
	if refs := m[id]; refs != nil {
		return refs
	}
	return []ContainerRef{}
}

// ListImages returns local images together with the containers that
// reference each one. Images in use are intentionally exposed so the UI can
// keep them out of destructive bulk-selection actions.
func (m *Manager) ListImages(ctx context.Context) ([]Image, error) {
	raw, err := m.cli.ImageList(ctx, image.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	byImage, _, _, err := m.containerUsage(ctx)
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
			UsedBy: usedByRefs(byImage, item.ID),
		})
	}

	sort.Slice(images, func(i, j int) bool { return images[i].Name < images[j].Name })
	return images, nil
}

// ListImageTags returns every "repo:tag" reference across local images —
// unlike ListImages's Name (which joins all of an image's tags into one
// display string), this is flattened so each is usable on its own as a
// container-create image reference. Untagged (<none>) images are excluded.
func (m *Manager) ListImageTags(ctx context.Context) ([]string, error) {
	raw, err := m.cli.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return nil, err
	}

	tags := make([]string, 0, len(raw))
	for _, item := range raw {
		tags = append(tags, item.RepoTags...)
	}

	sort.Strings(tags)
	return tags, nil
}

// ListNetworks returns Docker networks together with the containers
// attached to each one.
func (m *Manager) ListNetworks(ctx context.Context) ([]Network, error) {
	raw, err := m.cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return nil, err
	}

	_, byNetwork, _, err := m.containerUsage(ctx)
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
			UsedBy: usedByRefs(byNetwork, item.ID),
		})
	}

	sort.Slice(networks, func(i, j int) bool { return networks[i].Name < networks[j].Name })
	return networks, nil
}

// ListVolumes returns local volumes, together with the containers that
// mount each one, but not their on-disk size — see OpenVolumeSizeStream for
// that, since it requires a slow system-wide disk-usage scan.
func (m *Manager) ListVolumes(ctx context.Context) ([]Volume, error) {
	raw, err := m.cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}

	_, _, byVolume, err := m.containerUsage(ctx)
	if err != nil {
		return nil, err
	}

	volumes := make([]Volume, 0, len(raw.Volumes))
	for _, item := range raw.Volumes {
		volumes = append(volumes, Volume{
			Name:   item.Name,
			UsedBy: usedByRefs(byVolume, item.Name),
		})
	}

	sort.Slice(volumes, func(i, j int) bool { return volumes[i].Name < volumes[j].Name })
	return volumes, nil
}

// VolumeSizeStream is a size scan that has already listed every volume name
// — so a listing failure can be reported as a normal error response — and
// is ready to run the (possibly slow) disk-usage scan once the caller has
// committed to an SSE response.
type VolumeSizeStream struct {
	m     *Manager
	names []string
}

func (m *Manager) OpenVolumeSizeStream(ctx context.Context) (*VolumeSizeStream, error) {
	raw, err := m.cli.VolumeList(ctx, volume.ListOptions{})
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(raw.Volumes))
	for _, item := range raw.Volumes {
		names = append(names, item.Name)
	}
	return &VolumeSizeStream{m: m, names: names}, nil
}

func (s *VolumeSizeStream) Close() {}

// Run computes every volume's on-disk size via a single system-wide
// disk-usage scan (Docker doesn't expose per-volume size any cheaper way),
// then calls emit once per volume so the frontend can render each result as
// it arrives rather than waiting on the whole scan. emit is never called
// concurrently. A volume without usage data (a non-local driver) reports 0.
func (s *VolumeSizeStream) Run(ctx context.Context, emit func(VolumeSize)) error {
	usage, err := s.m.cli.DiskUsage(ctx, types.DiskUsageOptions{Types: []types.DiskUsageObject{types.VolumeObject}})
	if err != nil {
		return err
	}

	sizes := make(map[string]int64, len(usage.Volumes))
	for _, v := range usage.Volumes {
		if v.UsageData != nil {
			sizes[v.Name] = v.UsageData.Size
		}
	}

	for _, name := range s.names {
		emit(VolumeSize{Name: name, Bytes: sizes[name]})
	}
	return nil
}

// DeleteVolumes removes the supplied unused volumes without forcing
// removal. Docker remains the final authority and rejects any volume that
// becomes used between listing and deletion.
func (m *Manager) DeleteVolumes(ctx context.Context, names []string) error {
	for _, name := range names {
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("%w: volume name", ErrInvalidVolume)
		}
		if err := m.cli.VolumeRemove(ctx, name, false); err != nil {
			return err
		}
	}
	return nil
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

// CreateOptions describes a new container's configuration, one field per
// field of the create-container form.
type CreateOptions struct {
	Name          string
	Image         string
	TTY           bool
	OpenStdin     bool
	NetworkMode   string
	RestartPolicy string
	Env           []string
	// Binds is Docker's own "host_path:container_path[:ro]" bind-mount
	// syntax, one entry per line of the form's volumes textarea — passed
	// straight through since the daemon already validates the format.
	Binds []string
}

// Create makes a new container from opts and starts it immediately: the
// dialog's "Create" action is meant to behave like `docker run`, not the
// create-without-starting `docker create`.
func (m *Manager) Create(ctx context.Context, opts CreateOptions) (string, error) {
	image := strings.TrimSpace(opts.Image)
	if image == "" {
		return "", fmt.Errorf("%w: image is required", ErrInvalidCreate)
	}

	restartPolicy := opts.RestartPolicy
	if restartPolicy == "" {
		restartPolicy = "no"
	}
	if !createRestartPolicies[restartPolicy] {
		return "", fmt.Errorf("%w: restart policy", ErrInvalidCreate)
	}

	config := &container.Config{
		Image:     image,
		Env:       opts.Env,
		Tty:       opts.TTY,
		OpenStdin: opts.OpenStdin,
		StdinOnce: opts.OpenStdin,
	}
	hostConfig := &container.HostConfig{
		Binds:         opts.Binds,
		NetworkMode:   container.NetworkMode(opts.NetworkMode),
		RestartPolicy: container.RestartPolicy{Name: container.RestartPolicyMode(restartPolicy)},
	}

	created, err := m.cli.ContainerCreate(ctx, config, hostConfig, nil, nil, strings.TrimSpace(opts.Name))
	if err != nil {
		if cerrdefs.IsConflict(err) {
			return "", ErrNameConflict
		}
		if cerrdefs.IsNotFound(err) {
			return "", fmt.Errorf("%w: image %q not found locally", ErrInvalidCreate, image)
		}
		if cerrdefs.IsInvalidArgument(err) {
			return "", fmt.Errorf("%w: %s", ErrInvalidCreate, err)
		}
		return "", err
	}

	if err := m.cli.ContainerStart(ctx, created.ID, container.StartOptions{}); err != nil {
		return created.ID, err
	}
	return created.ID, nil
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

// Delete removes a container. It doesn't force-remove a running one — the
// frontend only offers this action once a container is already stopped, and
// Docker's own "container is running" rejection is a reasonable backstop for
// anything that races past that.
func (m *Manager) Delete(ctx context.Context, id string) error {
	err := m.cli.ContainerRemove(ctx, id, container.RemoveOptions{})
	return translateNotFound(err)
}

// Attach opens a live connection to the running container's main process.
// Historical output is excluded because the frontend keeps the log content
// it fetched before switching into attach mode.
func (m *Manager) Attach(ctx context.Context, id string) (*AttachSession, error) {
	insp, err := m.cli.ContainerInspect(ctx, id)
	if err != nil {
		return nil, translateNotFound(err)
	}
	if insp.State == nil || !insp.State.Running {
		return nil, ErrNotRunning
	}

	tty := insp.Config != nil && insp.Config.Tty
	stdin := insp.Config != nil && insp.Config.OpenStdin
	stdinOnce := insp.Config != nil && insp.Config.StdinOnce
	response, err := m.cli.ContainerAttach(ctx, id, container.AttachOptions{
		Stream: true,
		Stdin:  stdin,
		Stdout: true,
		Stderr: true,
		Logs:   false,
	})
	if err != nil {
		return nil, translateNotFound(err)
	}

	return &AttachSession{response: response, TTY: tty, Stdin: stdin, StdinOnce: stdinOnce}, nil
}

func (m *Manager) Resize(ctx context.Context, id string, cols, rows uint) error {
	err := m.cli.ContainerResize(ctx, id, container.ResizeOptions{Width: cols, Height: rows})
	return translateNotFound(err)
}

// Detail inspects a single container for the detail dialog. Unlike List,
// which is tuned for rendering many rows cheaply, this makes one full
// inspect call and is only ever used for one container at a time.
func (m *Manager) Detail(ctx context.Context, id string) (Detail, error) {
	insp, err := m.cli.ContainerInspect(ctx, id)
	if err != nil {
		return Detail{}, translateNotFound(err)
	}

	command := insp.Path
	if len(insp.Args) > 0 {
		command = command + " " + strings.Join(insp.Args, " ")
	}

	created, _ := time.Parse(time.RFC3339Nano, insp.Created)

	var state string
	var exitCode int
	var startedAt *time.Time
	if insp.State != nil {
		state = string(insp.State.Status)
		exitCode = insp.State.ExitCode
		if t, err := time.Parse(time.RFC3339Nano, insp.State.StartedAt); err == nil && !t.IsZero() {
			startedAt = &t
		}
	}

	restartPolicy := "no"
	if insp.HostConfig != nil && insp.HostConfig.RestartPolicy.Name != "" {
		restartPolicy = string(insp.HostConfig.RestartPolicy.Name)
	}

	var networks []string
	if insp.NetworkSettings != nil {
		for name, ep := range insp.NetworkSettings.Networks {
			if ep != nil && ep.IPAddress != "" {
				networks = append(networks, fmt.Sprintf("%s (%s)", name, ep.IPAddress))
			} else {
				networks = append(networks, name)
			}
		}
		sort.Strings(networks)
	}

	var ports []string
	if insp.NetworkSettings != nil {
		for port, bindings := range insp.NetworkSettings.Ports {
			if len(bindings) == 0 {
				ports = append(ports, string(port))
				continue
			}
			for _, b := range bindings {
				ports = append(ports, fmt.Sprintf("%s:%s -> %s", b.HostIP, b.HostPort, port))
			}
		}
		sort.Strings(ports)
	}

	var mounts []string
	for _, mnt := range insp.Mounts {
		mode := "ro"
		if mnt.RW {
			mode = "rw"
		}
		source := mnt.Source
		if mnt.Name != "" {
			source = mnt.Name
		}
		mounts = append(mounts, fmt.Sprintf("%s -> %s (%s)", source, mnt.Destination, mode))
	}

	var env []string
	var image string
	var openStdin bool
	if insp.Config != nil {
		env = insp.Config.Env
		image = insp.Config.Image
		openStdin = insp.Config.OpenStdin
	}

	name := strings.TrimPrefix(insp.Name, "/")

	return Detail{
		ID:            insp.ID,
		Name:          name,
		Image:         image,
		Command:       strings.TrimSpace(command),
		Created:       created,
		State:         state,
		ExitCode:      exitCode,
		StartedAt:     startedAt,
		RestartPolicy: restartPolicy,
		Platform:      insp.Platform,
		Networks:      networks,
		Ports:         ports,
		Mounts:        mounts,
		Env:           env,
		OpenStdin:     openStdin,
	}, nil
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
