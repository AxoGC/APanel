// Package dependency defines the shared type registrars use to report a
// local dependency's install/service state (see httpserver.DependencyChecker)
// and the systemctl helpers used to probe and toggle that service. It lives
// here — rather than in httpserver or any one business package — so
// container/firewall/history can report their own dependency's systemd unit
// without importing httpserver, and httpserver can act on it without
// importing them.
package dependency

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// ConnectionSettingsKey is the settings key a module's saved connection
// config (host/port/username/password, any subset) lives under. It's
// defined here — rather than in httpserver, which owns the dependency
// dialog's HTTP endpoints — so a business package that needs its own saved
// config directly (see proxy.Manager) can read the exact same key without
// importing httpserver.
func ConnectionSettingsKey(moduleKey string) string {
	return "module." + moduleKey + ".connection"
}

// State is one business package's answer to "is my local dependency here
// and working". ServiceName is only set once the corresponding systemd
// unit is confirmed to exist, so httpserver knows whether offering an
// "enable service" action is meaningful at all.
type State struct {
	Installed     bool
	ServiceName   string
	ServiceActive bool
}

// Probe reports whether a systemd unit exists on this host and, if so,
// whether it's currently active. A unit systemd has never heard of reports
// exists=false rather than erroring, so callers can tell "installed but
// stopped" apart from "not installed at all".
func Probe(ctx context.Context, unit string) (exists bool, active bool) {
	cmd := exec.CommandContext(ctx, "systemctl", "is-active", unit)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, _ := cmd.Output()
	status := strings.TrimSpace(string(out))
	if status == "active" {
		return true, true
	}
	if strings.Contains(stderr.String(), "could not be found") {
		return false, false
	}
	return true, false
}

// Enable runs `systemctl enable --now <unit>`.
func Enable(ctx context.Context, unit string) error {
	out, err := exec.CommandContext(ctx, "systemctl", "enable", "--now", unit).CombinedOutput()
	if err != nil {
		return fmt.Errorf("systemctl enable --now %s: %w: %s", unit, err, strings.TrimSpace(string(out)))
	}
	return nil
}
