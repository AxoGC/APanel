package httpserver

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"

	"github.com/creack/pty"
	"github.com/gorilla/websocket"

	"apanel/internal/response"
)

var terminalUpgrader = websocket.Upgrader{}

type terminalMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

type terminalDirectory struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type terminalDirectories struct {
	Cwd         string              `json:"cwd"`
	Directories []terminalDirectory `json:"directories"`
}

// terminalShellOrder is both the set of shells apanel knows how to offer and
// the order they're presented in — preferred/most common first — since a
// Go map wouldn't give a stable iteration order for either purpose.
var terminalShellOrder = []string{"bash", "zsh", "fish", "sh"}

func terminalShell(name string) (string, error) {
	if name == "" {
		name = "bash"
	}
	if !slices.Contains(terminalShellOrder, name) {
		return "", fmt.Errorf("unsupported shell")
	}
	path, err := exec.LookPath(name)
	if err != nil {
		return "", fmt.Errorf("%s is unavailable", name)
	}
	return path, nil
}

// availableTerminalShells probes PATH for each shell apanel knows how to
// offer, returning only the ones actually installed on this system — so the
// frontend's shell picker never lists an option that would fail to connect.
func availableTerminalShells() []string {
	shells := make([]string, 0, len(terminalShellOrder))
	for _, name := range terminalShellOrder {
		if _, err := exec.LookPath(name); err == nil {
			shells = append(shells, name)
		}
	}
	return shells
}

func (s *Server) listTerminalShells(w http.ResponseWriter, r *http.Request) {
	response.WriteOK(w, availableTerminalShells())
}

type terminalMultiplexerInfo struct {
	Available bool                 `json:"available"`
	Name      string               `json:"name,omitempty"`
	Sessions  []multiplexerSession `json:"sessions"`
}

func (s *Server) listTerminalMultiplexerSessions(w http.ResponseWriter, r *http.Request) {
	mux := availableTerminalMultiplexer()
	if mux == nil {
		response.WriteOK(w, terminalMultiplexerInfo{Sessions: []multiplexerSession{}})
		return
	}
	sessions, err := mux.Sessions()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, terminalMultiplexerInfo{Available: true, Name: mux.Name(), Sessions: sessions})
}

func (s *Server) createTerminalMultiplexerSession(w http.ResponseWriter, r *http.Request) {
	mux := availableTerminalMultiplexer()
	if mux == nil {
		http.Error(w, "no terminal multiplexer available", http.StatusBadRequest)
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if err := mux.NewSession(body.Name); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, multiplexerSession{Name: body.Name})
}

func (s *Server) listTerminalMultiplexerWindows(w http.ResponseWriter, r *http.Request) {
	mux := availableTerminalMultiplexer()
	if mux == nil {
		response.WriteOK(w, []multiplexerWindow{})
		return
	}
	windows, err := mux.Windows(r.URL.Query().Get("session"))
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, windows)
}

func (s *Server) createTerminalMultiplexerWindow(w http.ResponseWriter, r *http.Request) {
	mux := availableTerminalMultiplexer()
	if mux == nil {
		http.Error(w, "no terminal multiplexer available", http.StatusBadRequest)
		return
	}
	var body struct {
		Session string `json:"session"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Session == "" {
		http.Error(w, "session is required", http.StatusBadRequest)
		return
	}
	window, err := mux.NewWindow(body.Session)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, window)
}

func (s *Server) listTerminalDirectories(w http.ResponseWriter, r *http.Request) {
	cwd := r.URL.Query().Get("cwd")
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			response.WriteInternalError(w, err)
			return
		}
	}
	if !filepath.IsAbs(cwd) {
		http.Error(w, "directory must be absolute", http.StatusBadRequest)
		return
	}
	cwd = filepath.Clean(cwd)

	entries, err := os.ReadDir(cwd)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	directories := make([]terminalDirectory, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			directories = append(directories, terminalDirectory{Name: entry.Name(), Path: filepath.Join(cwd, entry.Name())})
		}
	}
	sort.Slice(directories, func(i, j int) bool { return directories[i].Name < directories[j].Name })
	response.WriteOK(w, terminalDirectories{Cwd: cwd, Directories: directories})
}

// terminal upgrades an authenticated same-origin WebSocket connection to a
// local shell attached to a pseudo-terminal. The browser exchanges JSON
// input and resize messages, while PTY output is streamed as binary frames.
func (s *Server) terminal(w http.ResponseWriter, r *http.Request) {
	session := r.URL.Query().Get("session")

	var cmd *exec.Cmd
	if session != "" {
		mux := availableTerminalMultiplexer()
		if mux == nil {
			http.Error(w, "no terminal multiplexer available", http.StatusBadRequest)
			return
		}
		cmd = mux.AttachCmd(session, r.URL.Query().Get("window"))
	} else {
		shell, err := terminalShell(r.URL.Query().Get("shell"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		cmd = exec.Command(shell)
	}

	conn, err := terminalUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	ptmx, err := pty.Start(cmd)
	if err != nil {
		return
	}
	defer ptmx.Close()

	outputDone := make(chan struct{})
	go func() {
		defer close(outputDone)
		buf := make([]byte, 32*1024)
		for {
			n, readErr := ptmx.Read(buf)
			if n > 0 {
				if writeErr := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); writeErr != nil {
					return
				}
			}
			if readErr != nil {
				return
			}
		}
	}()

readLoop:
	for {
		_, payload, readErr := conn.ReadMessage()
		if readErr != nil {
			break
		}

		var message terminalMessage
		if json.Unmarshal(payload, &message) != nil {
			continue
		}
		switch message.Type {
		case "input":
			if message.Data != "" {
				if _, err := io.WriteString(ptmx, message.Data); err != nil {
					break readLoop
				}
			}
		case "resize":
			if message.Cols > 0 && message.Rows > 0 {
				_ = pty.Setsize(ptmx, &pty.Winsize{Cols: message.Cols, Rows: message.Rows})
			}
		}
	}

	_ = ptmx.Close()
	<-outputDone
	_ = cmd.Wait()
}
