package httpserver

import "os/exec"

// multiplexerSession and multiplexerWindow describe just the concepts every
// mainstream terminal multiplexer shares — enough for the frontend to offer
// two selects (session, window) without knowing which multiplexer backs them.
type multiplexerSession struct {
	Name string `json:"name"`
}

type multiplexerWindow struct {
	Index string `json:"index"`
	Name  string `json:"name"`
}

// terminalMultiplexer abstracts a persistent terminal multiplexer (tmux,
// screen, ...) so terminal.go's websocket handler and the list/create
// endpoints don't need to know which one is in use. Only tmux is
// implemented today; a screen backend would satisfy the same interface.
type terminalMultiplexer interface {
	// Name identifies the multiplexer, surfaced to the frontend for display only.
	Name() string
	// Sessions lists currently running sessions.
	Sessions() ([]multiplexerSession, error)
	// Windows lists the windows within a session. A session that doesn't
	// exist yet (e.g. one the frontend just picked but hasn't created)
	// returns an empty list rather than an error.
	Windows(session string) ([]multiplexerWindow, error)
	// NewSession creates a new, detached session.
	NewSession(name string) error
	// NewWindow creates a new window in an existing session and returns it.
	NewWindow(session string) (multiplexerWindow, error)
	// AttachCmd returns the command that attaches to the given session
	// (creating it first if it doesn't exist), optionally selecting a
	// specific window. It's meant to run under a pty, replacing a plain
	// shell command — the multiplexer's own server survives the pty (and
	// the process attached to it) going away, which is the entire point.
	AttachCmd(session, window string) *exec.Cmd
}

// availableTerminalMultiplexer probes for a supported multiplexer on PATH,
// returning nil if none is installed so callers can fall back to a plain
// shell.
func availableTerminalMultiplexer() terminalMultiplexer {
	if _, err := exec.LookPath("tmux"); err == nil {
		return tmuxMultiplexer{}
	}
	return nil
}
