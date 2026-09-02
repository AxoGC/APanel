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

// Rule is a display-ready firewall rule. ufw itself always manages IPv4 and
// IPv6 as two separate rules (e.g. "allow 22/tcp" creates one rule per
// family) — parseStatus merges a family pair back into a single Rule when
// they're otherwise identical, so the frontend shows one card per logical
// rule with IPv4/IPv6 (and TCP/UDP, when the rule is protocol-specific) as
// tags instead of duplicating the card per family.
type Rule struct {
	Numbers  []int  `json:"numbers"`
	To       string `json:"to"`
	Action   string `json:"action"`
	From     string `json:"from"`
	Protocol string `json:"protocol,omitempty"`
	IPv4     bool   `json:"ipv4"`
	IPv6     bool   `json:"ipv6"`
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
var protoSuffix = regexp.MustCompile(`(?i)/(tcp|udp)$`)

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

// rawRule is one line of ufw's numbered status, before v4/v6 pairing.
type rawRule struct {
	number   int
	to       string
	action   string
	from     string
	protocol string
	ipv6     bool
}

// ruleKey identifies rules that are the same logical rule across the IPv4
// and IPv6 families — everything but the address family itself.
type ruleKey struct {
	to, action, from, protocol string
}

func (r rawRule) key() ruleKey {
	return ruleKey{to: r.to, action: r.action, from: r.from, protocol: r.protocol}
}

// parseRawRule splits ufw's "(v6)" family marker and "/tcp"|"/udp" protocol
// suffix out of the raw To/From columns, so the caller is left with plain
// display text plus the two facts as structured fields.
//
// ufw only prints the "(v6)" marker to disambiguate its implicit, default
// "Anywhere" rule pair — a rule scoped to a literal IPv6 address or CIDR
// (which can only ever be a v6 rule, never paired with a v4 twin) carries
// no such marker, so family detection also has to fall back to spotting a
// ':' in the address literal itself.
func parseRawRule(number int, to, action, from string) rawRule {
	ipv6 := strings.Contains(to, "(v6)") || strings.Contains(from, "(v6)") ||
		strings.Contains(to, ":") || strings.Contains(from, ":")
	to = strings.TrimSpace(strings.ReplaceAll(to, "(v6)", ""))
	from = strings.TrimSpace(strings.ReplaceAll(from, "(v6)", ""))

	protocol := ""
	if m := protoSuffix.FindString(to); m != "" {
		protocol = strings.ToLower(strings.TrimPrefix(m, "/"))
		to = strings.TrimSpace(strings.TrimSuffix(to, m))
	}

	return rawRule{number: number, to: to, action: action, from: from, protocol: protocol, ipv6: ipv6}
}

func parseStatus(out string) Status {
	var status Status
	var raws []rawRule

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
		raws = append(raws, parseRawRule(number, fields[0], fields[1], fields[2]))
	}

	// ufw lists every IPv4 rule before its IPv6 rules, so pairing each v4
	// entry against the next unclaimed v6 entry with a matching key (and
	// falling back to appending any leftover, address-family-specific v6
	// rules afterwards) reproduces that same order in the merged output.
	var v4s, v6s []rawRule
	for _, r := range raws {
		if r.ipv6 {
			v6s = append(v6s, r)
		} else {
			v4s = append(v4s, r)
		}
	}

	claimed := make([]bool, len(v6s))
	for _, v4 := range v4s {
		rule := Rule{Numbers: []int{v4.number}, To: v4.to, Action: v4.action, From: v4.from, Protocol: v4.protocol, IPv4: true}
		for i, v6 := range v6s {
			if !claimed[i] && v6.key() == v4.key() {
				claimed[i] = true
				rule.Numbers = append(rule.Numbers, v6.number)
				rule.IPv6 = true
				break
			}
		}
		status.Rules = append(status.Rules, rule)
	}
	for i, v6 := range v6s {
		if claimed[i] {
			continue
		}
		status.Rules = append(status.Rules, Rule{Numbers: []int{v6.number}, To: v6.to, Action: v6.action, From: v6.from, Protocol: v6.protocol, IPv6: true})
	}

	return status
}
