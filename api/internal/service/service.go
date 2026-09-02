// Package service manages systemd .service units over D-Bus: list, start,
// stop, restart, enable, disable. This is deliberately separate from the
// containers module (Docker) — the plan keeps systemd- and Docker-managed
// services as two distinct concepts rather than one unified abstraction.
package service

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

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

// List returns every installed .service unit (not just the ones systemd
// currently has loaded), enriched with live state where available.
// Template units (name@.service) are skipped: they have no single state.
func (m *Manager) List(ctx context.Context) ([]Unit, error) {
	files, err := m.conn.ListUnitFilesContext(ctx)
	if err != nil {
		return nil, err
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
	return err
}

func (m *Manager) Disable(ctx context.Context, name string) error {
	if err := m.exists(ctx, name); err != nil {
		return err
	}
	_, err := m.conn.DisableUnitFilesContext(ctx, []string{name}, false)
	return err
}
