// Package service manages systemd .service units over D-Bus: list, start,
// stop, restart, enable, disable. This is deliberately separate from the
// containers module (Docker) — the plan keeps systemd- and Docker-managed
// services as two distinct concepts rather than one unified abstraction.
package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	systemdDbus "github.com/coreos/go-systemd/v22/dbus"
)

var ErrNotFound = errors.New("unit not found")

type Unit struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	LoadState     string `json:"loadState"`
	ActiveState   string `json:"activeState"`
	SubState      string `json:"subState"`
	UnitFileState string `json:"unitFileState"`
}

type Manager struct {
	conn *systemdDbus.Conn
}

func New(ctx context.Context) (*Manager, error) {
	conn, err := systemdDbus.NewSystemConnectionContext(ctx)
	if err != nil {
		return nil, err
	}
	return &Manager{conn: conn}, nil
}

// templateUnitFileName maps a template instance's unit name (e.g.
// "postgres@18-main.service") to its template's on-disk file name (e.g.
// "postgres@.service"), which is what ListUnitFilesContext reports the
// enablement state under. Names without "@" are returned unchanged.
func templateUnitFileName(name string) string {
	at := strings.IndexByte(name, '@')
	if at < 0 {
		return name
	}
	return name[:at+1] + filepath.Ext(name)
}

// List returns .service units without their enablement state — that comes
// from a separate, much slower call (see UnitFileStream below) and is left
// blank here so a request never has to wait on it. With states set, it
// filters at the D-Bus level via systemd's own ListUnitsFiltered (e.g.
// []string{"running"}); with states empty, it lists every unit systemd
// currently has loaded. Either way this only sees loaded units — a service
// that's installed but was never started won't appear until
// UnitFileStream's Run reports it, which the frontend adds as a new row.
// Template units (name@.service) are only included when states is set,
// since a bare template has no state of its own to report in the
// no-filter view.
func (m *Manager) List(ctx context.Context, states []string) ([]Unit, error) {
	var loaded []systemdDbus.UnitStatus
	var err error
	if len(states) > 0 {
		loaded, err = m.conn.ListUnitsFilteredContext(ctx, states)
	} else {
		loaded, err = m.conn.ListUnitsContext(ctx)
	}
	if err != nil {
		return nil, err
	}

	units := make([]Unit, 0, len(loaded))
	for _, st := range loaded {
		if !strings.HasSuffix(st.Name, ".service") {
			continue
		}
		if len(states) == 0 && strings.Contains(st.Name, "@") {
			continue
		}
		units = append(units, Unit{
			Name:        st.Name,
			Description: st.Description,
			LoadState:   st.LoadState,
			ActiveState: st.ActiveState,
			SubState:    st.SubState,
		})
	}
	sort.Slice(units, func(i, j int) bool { return units[i].Name < units[j].Name })
	return units, nil
}

// UnitEnablement is one message of the unit-file enablement stream: a
// single service's on-disk enabled/disabled/static/masked state.
type UnitEnablement struct {
	Name  string `json:"name"`
	State string `json:"state"`
}

// UnitFileStream reports every service's enablement state, one message at
// a time, so the frontend can fill in List's fast response (and add rows
// for installed-but-never-loaded services List couldn't see) as results
// arrive instead of every request blocking on the same slow call.
//
// It owns its own D-Bus connection rather than sharing Manager's: systemd
// processes D-Bus calls on its own side serially regardless of which
// connection they arrive on, so a client that disconnects mid-stream (e.g.
// the page was navigated away from) doesn't stop systemd from spending the
// full ~550ms+ on the already-sent ListUnitFiles call — and on the shared
// connection, that left every other request (including the next page load's
// fast List call) queued behind it. A dedicated, short-lived connection
// means an abandoned stream can only ever block itself.
type UnitFileStream struct {
	conn *systemdDbus.Conn
}

// OpenUnitFileStream opens the dedicated connection described above. The
// route handler calling this has a place to fail before committing to the
// SSE response, mirroring the rest of the codebase's stream constructors.
func (m *Manager) OpenUnitFileStream(ctx context.Context) (*UnitFileStream, error) {
	conn, err := systemdDbus.NewSystemConnectionContext(ctx)
	if err != nil {
		return nil, err
	}
	return &UnitFileStream{conn: conn}, nil
}

func (s *UnitFileStream) Close() { s.conn.Close() }

// Run does the actual work: one ListUnitFiles call — measured at ~550ms for
// a few hundred units, since it walks and parses every unit file on disk,
// unlike the sub-2ms live-state calls List() uses — plus one ListUnits call
// to resolve any loaded template instances (e.g. postgres@18-main.service)
// to their template's enablement, since an instance has no unit file of its
// own. This mirrors what List() used to do inline on every request.
func (s *UnitFileStream) Run(ctx context.Context, emit func(UnitEnablement)) error {
	files, err := s.conn.ListUnitFilesContext(ctx)
	if err != nil {
		return err
	}

	templates := make(map[string]string, len(files))
	entries := make(map[string]string, len(files))
	for _, f := range files {
		name := filepath.Base(f.Path)
		if !strings.HasSuffix(name, ".service") {
			continue
		}
		if strings.Contains(name, "@") {
			templates[name] = f.Type
			continue
		}
		entries[name] = f.Type
	}

	if loaded, err := s.conn.ListUnitsContext(ctx); err == nil {
		for _, u := range loaded {
			if !strings.HasSuffix(u.Name, ".service") || !strings.Contains(u.Name, "@") {
				continue
			}
			if _, ok := entries[u.Name]; ok {
				continue
			}
			if state, ok := templates[templateUnitFileName(u.Name)]; ok {
				entries[u.Name] = state
			}
		}
	}

	for name, state := range entries {
		emit(UnitEnablement{Name: name, State: state})
	}
	return nil
}

// Detail describes everything the service detail dialog shows, gathered
// from a single GetAllProperties D-Bus call (which merges the generic Unit
// interface with the Service-type-specific one) rather than List's
// lighter-weight per-row fields.
type Detail struct {
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	LoadState        string     `json:"loadState"`
	ActiveState      string     `json:"activeState"`
	SubState         string     `json:"subState"`
	UnitFileState    string     `json:"unitFileState"`
	FragmentPath     string     `json:"fragmentPath"`
	MainPID          int        `json:"mainPid"`
	ExitCode         int        `json:"exitCode"`
	ActiveSince      *time.Time `json:"activeSince"`
	RestartPolicy    string     `json:"restartPolicy"`
	User             string     `json:"user"`
	WorkingDirectory string     `json:"workingDirectory"`
	// MemoryCurrentBytes is nil when the cgroup memory accounting isn't
	// available (systemd reports this via a sentinel max-uint64 value
	// rather than omitting the property).
	MemoryCurrentBytes *uint64  `json:"memoryCurrentBytes"`
	Requires           []string `json:"requires"`
	After              []string `json:"after"`
}

func propString(props map[string]any, key string) string {
	v, _ := props[key].(string)
	return v
}

func propUint32(props map[string]any, key string) uint32 {
	v, _ := props[key].(uint32)
	return v
}

func propUint64(props map[string]any, key string) uint64 {
	v, _ := props[key].(uint64)
	return v
}

func propInt32(props map[string]any, key string) int32 {
	v, _ := props[key].(int32)
	return v
}

func propStringSlice(props map[string]any, key string) []string {
	v, _ := props[key].([]string)
	return v
}

// Detail inspects a single unit for the detail dialog. Unlike List, which is
// tuned for rendering many rows cheaply from cached/bulk D-Bus calls, this
// makes one full properties fetch and is only ever used for one unit at a
// time.
func (m *Manager) Detail(ctx context.Context, name string) (Detail, error) {
	if err := m.exists(ctx, name); err != nil {
		return Detail{}, err
	}

	props, err := m.conn.GetAllPropertiesContext(ctx, name)
	if err != nil {
		return Detail{}, err
	}

	var activeSince *time.Time
	if usec := propUint64(props, "ActiveEnterTimestamp"); usec > 0 {
		t := time.UnixMicro(int64(usec))
		activeSince = &t
	}

	var memCurrent *uint64
	if v := propUint64(props, "MemoryCurrent"); v > 0 && v != math.MaxUint64 {
		memCurrent = &v
	}

	return Detail{
		Name:               name,
		Description:        propString(props, "Description"),
		LoadState:          propString(props, "LoadState"),
		ActiveState:        propString(props, "ActiveState"),
		SubState:           propString(props, "SubState"),
		UnitFileState:      propString(props, "UnitFileState"),
		FragmentPath:       propString(props, "FragmentPath"),
		MainPID:            int(propUint32(props, "MainPID")),
		ExitCode:           int(propInt32(props, "ExecMainStatus")),
		ActiveSince:        activeSince,
		RestartPolicy:      propString(props, "Restart"),
		User:               propString(props, "User"),
		WorkingDirectory:   propString(props, "WorkingDirectory"),
		MemoryCurrentBytes: memCurrent,
		Requires:           propStringSlice(props, "Requires"),
		After:              propStringSlice(props, "After"),
	}, nil
}

func (m *Manager) exists(ctx context.Context, name string) error {
	units, err := m.conn.ListUnitsByNamesContext(ctx, []string{name})
	if err != nil {
		return err
	}
	if len(units) == 0 || units[0].LoadState == "not-found" {
		return ErrNotFound
	}
	return nil
}

// runJob issues a start/stop/restart job and waits for systemd to report it
// done, translating a missing unit into ErrNotFound up front.
func (m *Manager) runJob(ctx context.Context, name string, issue func(chan<- string) (int, error)) error {
	if err := m.exists(ctx, name); err != nil {
		return err
	}
	ch := make(chan string, 1)
	if _, err := issue(ch); err != nil {
		return err
	}
	select {
	case result := <-ch:
		if result != "done" {
			return fmt.Errorf("%s: job result %q", name, result)
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (m *Manager) Start(ctx context.Context, name string) error {
	return m.runJob(ctx, name, func(ch chan<- string) (int, error) {
		return m.conn.StartUnitContext(ctx, name, "replace", ch)
	})
}

func (m *Manager) Stop(ctx context.Context, name string) error {
	return m.runJob(ctx, name, func(ch chan<- string) (int, error) {
		return m.conn.StopUnitContext(ctx, name, "replace", ch)
	})
}

func (m *Manager) Restart(ctx context.Context, name string) error {
	return m.runJob(ctx, name, func(ch chan<- string) (int, error) {
		return m.conn.RestartUnitContext(ctx, name, "replace", ch)
	})
}

func (m *Manager) Enable(ctx context.Context, name string) error {
	if err := m.exists(ctx, name); err != nil {
		return err
	}
	_, _, err := m.conn.EnableUnitFilesContext(ctx, []string{name}, false, false)
	return err
}

func (m *Manager) Disable(ctx context.Context, name string) error {
	if err := m.exists(ctx, name); err != nil {
		return err
	}
	_, err := m.conn.DisableUnitFilesContext(ctx, []string{name}, false)
	return err
}

// Logs returns the unit's last n journal lines, oldest first. Shelling out
// to journalctl is the only option here, same as ufw/sadf elsewhere — the
// journal has no D-Bus query API of its own that this project depends on.
func (m *Manager) Logs(ctx context.Context, name string, lines int) (string, error) {
	if err := m.exists(ctx, name); err != nil {
		return "", err
	}
	out, err := exec.CommandContext(ctx, "journalctl", "-u", name, "-n", strconv.Itoa(lines), "--no-pager", "-o", "short-iso").Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}

// StreamLogs seeds with the unit's last n journal lines, then follows new
// ones as journalctl -f writes them. The returned reader's Close stops the
// underlying process; it also stops on its own when ctx is done.
func (m *Manager) StreamLogs(ctx context.Context, name string, lines int) (io.ReadCloser, error) {
	if err := m.exists(ctx, name); err != nil {
		return nil, err
	}
	cmd := exec.CommandContext(ctx, "journalctl", "-u", name, "-n", strconv.Itoa(lines), "-f", "--no-pager", "-o", "short-iso")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return &cmdLogReader{ReadCloser: stdout, cmd: cmd}, nil
}

// cmdLogReader ties a pipe's lifetime to its owning process: closing it
// (e.g. when the SSE client disconnects) kills journalctl -f instead of
// leaving it running against a reader nobody's draining anymore.
type cmdLogReader struct {
	io.ReadCloser
	cmd *exec.Cmd
}

func (c *cmdLogReader) Close() error {
	_ = c.ReadCloser.Close()
	if c.cmd.Process != nil {
		_ = c.cmd.Process.Kill()
	}
	_ = c.cmd.Wait()
	return nil
}
