// Package firewall reads ufw's status and rule list. ufw has no daemon API
// (it's a CLI wrapper over iptables/nftables), so shelling out to it is the
// only option here — the same situation as sysstat/sadf.
package firewall

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

type Rule struct {
	Number int    `json:"number"`
	To     string `json:"to"`
	Action string `json:"action"`
	From   string `json:"from"`
}

type Status struct {
	Active bool   `json:"active"`
	Rules  []Rule `json:"rules"`
}

type Manager struct {
	ufwPath string
}

// New looks for ufw on PATH. A missing binary is not fatal — Available()
// just reports false and the firewall feature stays off.
func New() *Manager {
	path, err := exec.LookPath("ufw")
	if err != nil {
		return &Manager{}
	}
	return &Manager{ufwPath: path}
}

func (m *Manager) Available() bool {
	return m.ufwPath != ""
}

var numberedRule = regexp.MustCompile(`^\[\s*(\d+)\]\s*(.+)$`)
var fieldGap = regexp.MustCompile(`\s{2,}`)

func (m *Manager) Status(ctx context.Context) (Status, error) {
	if !m.Available() {
		return Status{}, fmt.Errorf("ufw is not available")
	}

	cmd := exec.CommandContext(ctx, m.ufwPath, "status", "numbered")
	out, err := cmd.Output()
	if err != nil {
		return Status{}, fmt.Errorf("running ufw status: %w", err)
	}
	return parseStatus(string(out)), nil
}

func parseStatus(out string) Status {
	var status Status
	for line := range strings.SplitSeq(out, "\n") {
		line = strings.TrimRight(line, " \t\r")
		trimmed := strings.TrimSpace(line)
		if rest, ok := strings.CutPrefix(trimmed, "Status:"); ok {
			status.Active = strings.TrimSpace(rest) == "active"
			continue
		}
		match := numberedRule.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		number, _ := strconv.Atoi(match[1])
		// ufw's table columns are padded to fixed widths and separated by
		// runs of spaces, so splitting on 2+ spaces recovers the three
		// fields regardless of which action/protocol they hold.
		fields := fieldGap.Split(strings.TrimSpace(match[2]), -1)
		if len(fields) < 3 {
			continue
		}
		status.Rules = append(status.Rules, Rule{
			Number: number,
			To:     fields[0],
			Action: fields[1],
			From:   fields[2],
		})
	}
	return status
}
