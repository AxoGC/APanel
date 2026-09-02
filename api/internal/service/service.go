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
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
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

// unitFilesTTL bounds how stale the cached unit-file catalog (see
// unitFiles below) can get. ListUnitFilesContext measured at ~550ms for a
// few hundred units — it walks and parses every unit file on disk, unlike
// the live-state D-Bus calls (sub-2ms) — so List() would otherwise pay that
// cost on every request, including every debounced keystroke in the
// frontend's search box.
const unitFilesTTL = 5 * time.Second

type Manager struct {
	conn *systemdDbus.Conn

	mu      sync.Mutex
	files   []systemdDbus.UnitFile
	filesAt time.Time
}

func New(ctx context.Context) (*Manager, error) {
	conn, err := systemdDbus.NewSystemConnectionContext(ctx)
	if err != nil {
		return nil, err
	}
	return &Manager{conn: conn}, nil
}

// unitFiles returns the installed unit-file catalog, cached for unitFilesTTL.
// invalidateUnitFiles drops the cache immediately after our own Enable/
// Disable calls; a short TTL otherwise covers changes made outside apanel
// (e.g. a package install symlinking a new unit).
func (m *Manager) unitFiles(ctx context.Context) ([]systemdDbus.UnitFile, error) {
	m.mu.Lock()
	if m.files != nil && time.Since(m.filesAt) < unitFilesTTL {
		files := m.files
		m.mu.Unlock()
		return files, nil
	}
	m.mu.Unlock()

	files, err := m.conn.ListUnitFilesContext(ctx)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	m.files = files
	m.filesAt = time.Now()
	m.mu.Unlock()
	return files, nil
}

func (m *Manager) invalidateUnitFiles() {
	m.mu.Lock()
	m.files = nil
	m.mu.Unlock()
}

// List returns .service units. With states set, it filters at the D-Bus
// level via systemd's own ListUnitsFiltered (e.g. []string{"running"}) — this
// only sees units systemd currently has loaded. With states empty, it falls
// back to the full installed catalog (ListUnitFiles merged with live state),
// so services that are installed but were never started still show up.
// Template units (name@.service) are skipped: they have no single state.
func (m *Manager) List(ctx context.Context, states []string) ([]Unit, error) {
	files, err := m.unitFiles(ctx)
	if err != nil {
		return nil, err
	}
	enablement := make(map[string]string, len(files))
	for _, f := range files {
		enablement[filepath.Base(f.Path)] = f.Type
	}

	if len(states) > 0 {
		loaded, err := m.conn.ListUnitsFilteredContext(ctx, states)
		if err != nil {
			return nil, err
		}
		var units []Unit
		for _, st := range loaded {
			if !strings.HasSuffix(st.Name, ".service") {
				continue
			}
			units = append(units, Unit{
				Name:          st.Name,
				Description:   st.Description,
				LoadState:     st.LoadState,
				ActiveState:   st.ActiveState,
				SubState:      st.SubState,
				UnitFileState: enablement[st.Name],
			})
		}
		sort.Slice(units, func(i, j int) bool { return units[i].Name < units[j].Name })
		return units, nil
	}

	loaded, err := m.conn.ListUnitsContext(ctx)
	if err != nil {
		return nil, err
	}
	live := make(map[string]systemdDbus.UnitStatus, len(loaded))
	for _, u := range loaded {
		live[u.Name] = u
	}

	seen := make(map[string]bool, len(files))
	var units []Unit
	for _, f := range files {
		name := filepath.Base(f.Path)
		if !strings.HasSuffix(name, ".service") || strings.Contains(name, "@") || seen[name] {
			continue
		}
		seen[name] = true

		u := Unit{Name: name, UnitFileState: f.Type, ActiveState: "inactive", SubState: "dead"}
		if st, ok := live[name]; ok {
			u.Description = st.Description
			u.LoadState = st.LoadState
			u.ActiveState = st.ActiveState
			u.SubState = st.SubState
		}
		units = append(units, u)
	}

	sort.Slice(units, func(i, j int) bool { return units[i].Name < units[j].Name })
	return units, nil
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
	if err != nil {
		return err
	}
	m.invalidateUnitFiles()
	return nil
}

func (m *Manager) Disable(ctx context.Context, name string) error {
	if err := m.exists(ctx, name); err != nil {
		return err
	}
	_, err := m.conn.DisableUnitFilesContext(ctx, []string{name}, false)
	if err != nil {
		return err
	}
	m.invalidateUnitFiles()
	return nil
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
