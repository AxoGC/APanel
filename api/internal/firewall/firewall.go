// Package firewall reads ufw's status and rule list. ufw has no daemon API
// (it's a CLI wrapper over iptables/nftables), so shelling out to it is the
// only option here — the same situation as sysstat/sadf.
package firewall

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"apanel/internal/dependency"
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

func (m *Manager) Available(ctx context.Context) bool {
	return m.ufwPath != ""
}

// Key identifies this package's entry in httpserver's dependency endpoints.
func (m *Manager) Key() string { return "firewall" }

// CheckDependency reports whether ufw is on PATH and, if not, whether its
// systemd unit exists so httpserver can offer an "enable service" action
// instead of just an install link.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	if m.Available(ctx) {
		return dependency.State{Installed: true}
	}
	exists, active := dependency.Probe(ctx, "ufw")
	if !exists {
		return dependency.State{}
	}
	return dependency.State{ServiceName: "ufw", ServiceActive: active}
}

var numberedRule = regexp.MustCompile(`^\[\s*(\d+)\]\s*(.+)$`)
var fieldGap = regexp.MustCompile(`\s{2,}`)
var protoSuffix = regexp.MustCompile(`(?i)/(tcp|udp)$`)

func (m *Manager) Status(ctx context.Context) (Status, error) {
	if !m.Available(ctx) {
		return Status{}, fmt.Errorf("ufw is not available")
	}

	cmd := exec.CommandContext(ctx, m.ufwPath, "status", "numbered")
	out, err := cmd.Output()
	if err != nil {
		return Status{}, fmt.Errorf("running ufw status: %w", err)
	}
	return parseStatus(string(out)), nil
}

var ErrInvalidRule = fmt.Errorf("invalid firewall rule")

var validActions = map[string]bool{"allow": true, "deny": true, "reject": true, "limit": true}
var portPattern = regexp.MustCompile(`^\d{1,5}(:\d{1,5})?$`)

// AddRule adds a rule via ufw's "full" command syntax, e.g.
// "ufw allow from 10.0.0.0/8 to any port 22 proto tcp". ufw has no single
// syntax for "any address, but only this family", so wantIPv4/wantIPv6
// each get their own ufw invocation — one per selected family, defaulting
// to that family's catch-all address (0.0.0.0/0 / ::/0) when its from
// field is left blank. ufw normalizes both the "any" keyword and an
// explicit catch-all address to "Anywhere" in its status output, so
// parseStatus still merges a default-both-families rule back into one
// display row exactly as it did when this used ufw's own "any" keyword.
//
// An empty or "any" protocol omits the proto clause entirely, matching
// both TCP and UDP.
func (m *Manager) AddRule(ctx context.Context, action, fromIPv4, fromIPv6, port, protocol string, wantIPv4, wantIPv6 bool) error {
	if !m.Available(ctx) {
		return fmt.Errorf("ufw is not available")
	}

	action = strings.ToLower(strings.TrimSpace(action))
	if !validActions[action] {
		return fmt.Errorf("%w: action", ErrInvalidRule)
	}

	port = strings.TrimSpace(port)
	if !portPattern.MatchString(port) {
		return fmt.Errorf("%w: port", ErrInvalidRule)
	}

	protocol = strings.ToLower(strings.TrimSpace(protocol))
	if protocol != "" && protocol != "any" && protocol != "tcp" && protocol != "udp" {
		return fmt.Errorf("%w: protocol", ErrInvalidRule)
	}

	if !wantIPv4 && !wantIPv6 {
		return fmt.Errorf("%w: family", ErrInvalidRule)
	}

	families := []struct {
		want    bool
		from    string
		anyAddr string
	}{
		{wantIPv4, strings.TrimSpace(fromIPv4), "0.0.0.0/0"},
		{wantIPv6, strings.TrimSpace(fromIPv6), "::/0"},
	}

	for _, f := range families {
		if !f.want {
			continue
		}
		from := f.from
		if from == "" {
			from = f.anyAddr
		}
		if strings.HasPrefix(from, "-") {
			return fmt.Errorf("%w: from", ErrInvalidRule)
		}

		args := []string{action, "from", from, "to", "any", "port", port}
		if protocol != "" && protocol != "any" {
			args = append(args, "proto", protocol)
		}

		cmd := exec.CommandContext(ctx, m.ufwPath, args...)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("running ufw %s: %w: %s", action, err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

// DeleteRule removes one or more numbered rules — a merged Rule can carry
// both an IPv4 and an IPv6 ufw rule number. Deleting a rule shifts every
// higher-numbered rule down by one, so numbers are deleted highest-first
// to keep the rest of the batch valid. --force skips ufw's interactive
// y/n confirmation, which would otherwise block waiting on stdin.
func (m *Manager) DeleteRule(ctx context.Context, numbers []int) error {
	if !m.Available(ctx) {
		return fmt.Errorf("ufw is not available")
	}
	if len(numbers) == 0 {
		return fmt.Errorf("%w: numbers", ErrInvalidRule)
	}

	sorted := append([]int(nil), numbers...)
	sort.Sort(sort.Reverse(sort.IntSlice(sorted)))

	for _, n := range sorted {
		if n <= 0 {
			return fmt.Errorf("%w: numbers", ErrInvalidRule)
		}
		cmd := exec.CommandContext(ctx, m.ufwPath, "--force", "delete", strconv.Itoa(n))
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("running ufw delete: %w: %s", err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

// UpdateRule replaces a rule in place. ufw has no "edit" verb, so this
// adds the replacement rule(s) first and only deletes the old numbered
// rule(s) afterwards — if the delete step then fails, the old rule is
// left behind alongside the new one (a harmless duplicate the user can
// remove by hand) rather than silently disappearing, which is the safer
// of the two failure modes since there's no atomic way to do both at once.
func (m *Manager) UpdateRule(ctx context.Context, numbers []int, action, fromIPv4, fromIPv6, port, protocol string, wantIPv4, wantIPv6 bool) error {
	if err := m.AddRule(ctx, action, fromIPv4, fromIPv6, port, protocol, wantIPv4, wantIPv6); err != nil {
		return err
	}
	return m.DeleteRule(ctx, numbers)
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
	status := Status{Rules: []Rule{}}
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
