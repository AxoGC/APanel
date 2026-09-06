// Package update implements apanel's self-update: a periodic check against
// a version source (GitHub releases by default, or a self-hosted mirror
// serving the same Manifest JSON — see source.go) and, if enabled, an
// automatic download-replace-restart when a newer version is found.
//
// There is deliberately no rollback here. If a newly installed version
// fails to come back up, systemd will keep restarting it (Restart=on-failure
// in apanel.service) but nothing here detects or reverts that — recovering
// means SSHing in and fixing it by hand, the same as a failed manual
// upgrade today. Auto-update is opt-in and off by default precisely
// because of this.
package update

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"apanel/internal/settings"
	"apanel/internal/version"
)

const settingsKey = "update.settings"

// serviceName is apanel.service's unit name — see install.sh/apanel.service
// at the repo root, both of which hardcode the same name.
const serviceName = "apanel"

const checkInterval = 6 * time.Hour

// Settings is check and auto-apply as a single switch: there's no
// "check-and-notify-only" mode, because a background process silently
// finding an update and not doing anything with it is of no use to an
// admin who isn't watching logs — the settings UI's own "check now" button
// (see routes.go) already covers the notify-only case on demand.
type Settings struct {
	Enabled bool   `json:"enabled"`
	Source  string `json:"source"`
}

// CheckResult is the outcome of the most recent check (manual or
// scheduled), kept for the settings UI regardless of whether Enabled is
// currently on.
type CheckResult struct {
	At              time.Time `json:"at"`
	LatestVersion   string    `json:"latestVersion,omitempty"`
	UpdateAvailable bool      `json:"updateAvailable"`
	Error           string    `json:"error,omitempty"`
}

// Status is the settings UI's single read of everything it needs to render.
type Status struct {
	CurrentVersion string       `json:"currentVersion"`
	Settings       Settings     `json:"settings"`
	LastCheck      *CheckResult `json:"lastCheck,omitempty"`
	Applying       bool         `json:"applying"`
}

type Manager struct {
	settings *settings.Manager

	mu        sync.Mutex
	lastCheck *CheckResult
	applying  bool
}

func New(settingsMgr *settings.Manager) *Manager {
	return &Manager{settings: settingsMgr}
}

// Start launches the background check loop; it exits when ctx is canceled.
// Re-reading settings every tick (rather than once at startup) means
// toggling the setting takes effect on the next tick without a restart.
func (m *Manager) Start(ctx context.Context) {
	go m.loop(ctx)
}

func (m *Manager) loop(ctx context.Context) {
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()
	for {
		if s := m.loadSettings(); s.Enabled {
			m.checkAndMaybeApply(ctx, s)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// checkAndMaybeApply runs one scheduled check-and-apply cycle. It's also
// what a manual "check now" would call if it applied, but the manual path
// (see routes.go) deliberately doesn't — only the enabled background loop
// ever calls apply, per Settings' single-switch design above.
func (m *Manager) checkAndMaybeApply(ctx context.Context, s Settings) {
	m.mu.Lock()
	busy := m.applying
	m.mu.Unlock()
	if busy {
		return
	}

	manifest, newer, err := m.check(ctx, s)
	if err != nil {
		log.Printf("update: check failed: %v", err)
		return
	}
	if !newer {
		return
	}

	log.Printf("update: applying %s (current: %s)", manifest.Version, version.Current())
	if err := m.apply(ctx, manifest); err != nil {
		log.Printf("update: apply failed: %v", err)
	}
}

// check fetches the manifest from s.Source, records the result as the
// latest CheckResult, and reports whether it's newer than the running
// build. A "dev" build (not built off a release tag — see internal/version)
// never reports newer, so it's never a candidate for auto-apply even if
// somehow enabled.
func (m *Manager) check(ctx context.Context, s Settings) (Manifest, bool, error) {
	manifest, err := FetchManifest(ctx, s.Source)
	result := &CheckResult{At: time.Now()}
	if err != nil {
		result.Error = err.Error()
		m.setLastCheck(result)
		return Manifest{}, false, err
	}

	newer := version.Current() != "dev" && version.IsNewer(manifest.Version, version.Current())
	result.LatestVersion = manifest.Version
	result.UpdateAvailable = newer
	m.setLastCheck(result)
	return manifest, newer, nil
}

// apply downloads, verifies, and installs manifest's build for this
// machine's architecture, then asks systemd to restart the service. It
// never returns after a successful restart request — the current process
// is about to receive SIGTERM as part of that restart.
func (m *Manager) apply(ctx context.Context, manifest Manifest) error {
	asset, ok := manifest.Assets[CurrentArch()]
	if !ok {
		return fmt.Errorf("release %s has no asset for arch %s", manifest.Version, CurrentArch())
	}

	m.mu.Lock()
	if m.applying {
		m.mu.Unlock()
		return fmt.Errorf("an update is already in progress")
	}
	m.applying = true
	m.mu.Unlock()
	defer func() {
		m.mu.Lock()
		m.applying = false
		m.mu.Unlock()
	}()

	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolving own executable path: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(execPath); err == nil {
		execPath = resolved
	}

	log.Printf("update: downloading %s from %s", manifest.Version, asset.URL)
	data, err := downloadAndDecompress(ctx, asset.URL)
	if err != nil {
		return fmt.Errorf("downloading update: %w", err)
	}

	if asset.SHA256 != "" {
		sum := sha256.Sum256(data)
		if !strings.EqualFold(hex.EncodeToString(sum[:]), asset.SHA256) {
			return fmt.Errorf("checksum mismatch for %s", manifest.Version)
		}
	}

	// Written into the same directory as execPath so the rename below is
	// same-filesystem (and therefore atomic, not a copy-then-delete that
	// could leave a half-written binary in place).
	tmp, err := os.CreateTemp(filepath.Dir(execPath), ".apanel-update-*")
	if err != nil {
		return fmt.Errorf("creating temp file: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath) // no-op once the rename below succeeds

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("writing new binary: %w", err)
	}
	if err := tmp.Chmod(0o755); err != nil {
		tmp.Close()
		return fmt.Errorf("chmod new binary: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("closing new binary: %w", err)
	}

	if err := os.Rename(tmpPath, execPath); err != nil {
		return fmt.Errorf("installing new binary: %w", err)
	}

	log.Printf("update: installed %s, restarting %s", manifest.Version, serviceName)
	// Started, not waited on: `systemctl restart` will deliver SIGTERM to
	// this very process as part of stopping the old unit, so blocking on
	// the child would just mean getting killed mid-wait — the restart job
	// itself proceeds in systemd regardless.
	if err := exec.Command("systemctl", "restart", serviceName).Start(); err != nil {
		return fmt.Errorf("restarting service: %w", err)
	}
	return nil
}

func downloadAndDecompress(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download returned %s", resp.Status)
	}
	gz, err := gzip.NewReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("opening gzip stream: %w", err)
	}
	defer gz.Close()
	return io.ReadAll(gz)
}

func (m *Manager) setLastCheck(r *CheckResult) {
	m.mu.Lock()
	m.lastCheck = r
	m.mu.Unlock()
}

func (m *Manager) loadSettings() Settings {
	raw, ok, err := m.settings.Get(settingsKey)
	if err != nil || !ok {
		return Settings{}
	}
	var s Settings
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return Settings{}
	}
	return s
}

func (m *Manager) saveSettings(s Settings) error {
	encoded, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return m.settings.Set(settingsKey, string(encoded))
}

func (m *Manager) status() Status {
	s := m.loadSettings()
	m.mu.Lock()
	lastCheck := m.lastCheck
	applying := m.applying
	m.mu.Unlock()
	return Status{
		CurrentVersion: version.Current(),
		Settings:       s,
		LastCheck:      lastCheck,
		Applying:       applying,
	}
}
