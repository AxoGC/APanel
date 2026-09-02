package httpserver

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
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

var terminalShells = map[string]string{
	"bash": "bash",
	"sh":   "sh",
	"zsh":  "zsh",
	"fish": "fish",
}

func terminalShell(name string) (string, error) {
	if name == "" {
		name = "bash"
	}
	binary, ok := terminalShells[name]
	if !ok {
		return "", fmt.Errorf("unsupported shell")
	}
	path, err := exec.LookPath(binary)
	if err != nil {
		return "", fmt.Errorf("%s is unavailable", name)
	}
	return path, nil
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
	shell, err := terminalShell(r.URL.Query().Get("shell"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	conn, err := terminalUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	cmd := exec.Command(shell)
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
