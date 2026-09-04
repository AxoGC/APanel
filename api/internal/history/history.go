// Package history reads historical CPU/memory/swap utilization from
// sysstat (via sadf), when sysstat is installed on the host. This stage has
// no self-collection fallback: if sadf isn't present, the feature simply
// stays unavailable — see Manager.Available.
package history

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"

	"apanel/internal/dependency"
	"apanel/internal/settings"
)

type Point struct {
	Time           string  `json:"time"`
	CPUUsedPercent float64 `json:"cpuUsedPercent"`
	MemUsedPercent float64 `json:"memUsedPercent"`
	MemUsed        uint64  `json:"memUsed"`
	MemTotal       uint64  `json:"memTotal"`
}

type Day struct {
	Date   string  `json:"date"`
	Points []Point `json:"points"`
}

func emptyDay(date string) Day {
	return Day{Date: date, Points: []Point{}}
}

type Manager struct {
	sadfPath string
	settings *settings.Manager
}

// New looks for sadf on PATH. A missing binary is not a fatal error — it
// just means Available() reports false and the history feature stays off.
// settingsMgr backs the collection-settings endpoints (RegisterRoutes) —
// history itself still only ever reads live sysstat data through sadf.
func New(settingsMgr *settings.Manager) *Manager {
	path, err := exec.LookPath("sadf")
	if err != nil {
		return &Manager{settings: settingsMgr}
	}
	return &Manager{sadfPath: path, settings: settingsMgr}
}

func (m *Manager) Available(ctx context.Context) bool {
	return m.sadfPath != ""
}

// Key identifies this package's entry in httpserver's dependency endpoints.
func (m *Manager) Key() string { return "history" }

// CheckDependency reports whether sadf is on PATH and, if not, whether the
// sysstat systemd unit exists so httpserver can offer an "enable service"
// action instead of just an install link.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	if m.Available(ctx) {
		return dependency.State{Installed: true}
	}
	exists, active := dependency.Probe(ctx, "sysstat")
	if !exists {
		return dependency.State{}
	}
	return dependency.State{ServiceName: "sysstat", ServiceActive: active}
}

// Sample returns one day's CPU/memory/swap samples, daysAgo days before
// today (0 = today). The day is selected via sadf's own relative-file
// syntax ("-N"), which leaves finding sysstat's log directory entirely to
// sadf itself rather than guessing a path that varies by distro.
func (m *Manager) Sample(ctx context.Context, daysAgo int) (Day, error) {
	if !m.Available(ctx) {
		return Day{}, fmt.Errorf("sysstat is not available")
	}

	wantDate := time.Now().AddDate(0, 0, -daysAgo).Format("2006-01-02")

	cmd := exec.CommandContext(ctx, m.sadfPath, "-j", "--", "-u", "-r", fmt.Sprintf("-%d", daysAgo))
	out, err := cmd.Output()
	if err != nil {
		// No sa file exists for that offset (e.g. the host hasn't been up
		// that long) — an empty day, not a server error.
		return emptyDay(wantDate), nil
	}

	var parsed sadfOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return Day{}, fmt.Errorf("parsing sadf output: %w", err)
	}
	if len(parsed.Sysstat.Hosts) == 0 {
		return emptyDay(wantDate), nil
	}
	host := parsed.Sysstat.Hosts[0]

	// sysstat's per-day log files are named by day-of-month and get
	// reused across months; guard against a leftover/rotated file being
	// picked up for the wrong month by checking the date sadf actually
	// read matches the date we asked for.
	if host.FileDate != wantDate {
		return emptyDay(wantDate), nil
	}

	points := make([]Point, 0, len(host.Statistics))
	for _, s := range host.Statistics {
		if len(s.CPULoad) == 0 {
			continue
		}
		cpu := s.CPULoad[0]
		mem := s.Memory
		points = append(points, Point{
			Time:           s.Timestamp.Time,
			CPUUsedPercent: round2(100 - cpu.Idle),
			MemUsedPercent: mem.MemUsedPercent,
			MemUsed:        mem.MemUsed * 1024,
			MemTotal:       (mem.MemUsed + mem.MemFree + mem.Buffers + mem.Cached) * 1024,
		})
	}

	return Day{Date: host.FileDate, Points: points}, nil
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

type sadfOutput struct {
	Sysstat struct {
		Hosts []struct {
			FileDate   string `json:"file-date"`
			Statistics []struct {
				Timestamp struct {
					Time string `json:"time"`
				} `json:"timestamp"`
				CPULoad []struct {
					Idle float64 `json:"idle"`
				} `json:"cpu-load"`
				Memory struct {
					MemFree        uint64  `json:"memfree"`
					MemUsed        uint64  `json:"memused"`
					MemUsedPercent float64 `json:"memused-percent"`
					Buffers        uint64  `json:"buffers"`
					Cached         uint64  `json:"cached"`
				} `json:"memory"`
			} `json:"statistics"`
		} `json:"hosts"`
	} `json:"sysstat"`
}
