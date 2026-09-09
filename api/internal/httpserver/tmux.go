package httpserver

import (
	"fmt"
	"os/exec"
	"strings"
)

// tmuxMultiplexer implements terminalMultiplexer over the tmux CLI. Every
// call shells out rather than talking to tmux's control-mode socket
// directly — the traffic here is a handful of admin-triggered list/create
// calls, not a hot path, so the extra process spawn per call is a
// non-issue.
type tmuxMultiplexer struct{}

func (tmuxMultiplexer) Name() string { return "tmux" }

func (tmuxMultiplexer) Sessions() ([]multiplexerSession, error) {
	out, err := exec.Command("tmux", "list-sessions", "-F", "#{session_name}").Output()
	if err != nil {
		// tmux exits non-zero (with "no server running on ...") when no
		// session has ever been created yet — that's not a real error.
		return []multiplexerSession{}, nil
	}
	sessions := []multiplexerSession{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		sessions = append(sessions, multiplexerSession{Name: line})
	}
	return sessions, nil
}

func (tmuxMultiplexer) Windows(session string) ([]multiplexerWindow, error) {
	if session == "" {
		return []multiplexerWindow{}, nil
	}
	out, err := exec.Command("tmux", "list-windows", "-t", session, "-F", "#{window_index}:#{window_name}").Output()
	if err != nil {
		// Most likely the session doesn't exist yet — treat that as "no
		// windows yet" rather than an error, since the frontend may be
		// asking about a session it's about to create.
		return []multiplexerWindow{}, nil
	}
	windows := []multiplexerWindow{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		index, name, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		windows = append(windows, multiplexerWindow{Index: index, Name: name})
	}
	return windows, nil
}

func (tmuxMultiplexer) NewSession(name string) error {
	if err := exec.Command("tmux", "new-session", "-d", "-s", name).Run(); err != nil {
		return fmt.Errorf("create tmux session: %w", err)
	}
	return nil
}

func (tmuxMultiplexer) NewWindow(session string) (multiplexerWindow, error) {
	out, err := exec.Command("tmux", "new-window", "-t", session, "-P", "-F", "#{window_index}:#{window_name}").Output()
	if err != nil {
		return multiplexerWindow{}, fmt.Errorf("create tmux window: %w", err)
	}
	index, name, ok := strings.Cut(strings.TrimSpace(string(out)), ":")
	if !ok {
		return multiplexerWindow{}, fmt.Errorf("unexpected tmux output: %q", out)
	}
	return multiplexerWindow{Index: index, Name: name}, nil
}

func (tmuxMultiplexer) AttachCmd(session, window string) *exec.Cmd {
	// "-A" makes new-session behave as attach-if-exists, so this both
	// creates a brand-new session and reattaches an existing one. Closing
	// the pty this runs under only kills this attach client — the tmux
	// server (and anything running in its panes) is a separate process
	// tree that keeps going.
	args := []string{"new-session", "-A", "-s", session}
	if window != "" {
		// tmux reads a literal ";" argument as a command separator when
		// invoked directly (no shell involved), chaining a second command
		// onto the same invocation.
		args = append(args, ";", "select-window", "-t", fmt.Sprintf("%s:%s", session, window))
	}
	return exec.Command("tmux", args...)
}
