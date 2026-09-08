// Package files provides filesystem browsing and editing for the file
// manager module. apanel already runs as root (see plan.txt stage 1), so
// Manager is rooted at "/" — there's no meaningful jail to enforce, beyond
// making sure a client-supplied path can never walk outside Root via "..".
package files

import (
	"bytes"
	"errors"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var (
	ErrNotFound    = errors.New("path not found")
	ErrInvalidPath = errors.New("invalid path")
	ErrTooLarge    = errors.New("file too large to preview")
	ErrNotText     = errors.New("file is not text")
)

// maxTextSize bounds what ReadFile will load into memory for the in-browser
// text preview/editor — large files (logs, binaries) should be downloaded
// instead, not round-tripped through a JSON response and a <textarea>.
const maxTextSize = 2 << 20 // 2MB

type Entry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

type Manager struct {
	Root string
}

func New() *Manager {
	return &Manager{Root: "/"}
}

// resolve turns a client-supplied slash path into an absolute filesystem
// path under Root, collapsing ".." so a request can never walk outside Root.
func (m *Manager) resolve(reqPath string) (string, error) {
	if reqPath == "" {
		reqPath = "/"
	}
	clean := path.Clean("/" + reqPath)
	root := filepath.Clean(m.Root)
	full := filepath.Join(root, clean)

	// root's own separator-terminated form, without doubling the slash when
	// root is itself "/" (root + separator would otherwise be "//", which
	// no cleaned path ever has as a prefix — rejecting everything under it).
	rootPrefix := root
	if rootPrefix != string(filepath.Separator) {
		rootPrefix += string(filepath.Separator)
	}
	if full != root && !strings.HasPrefix(full, rootPrefix) {
		return "", ErrInvalidPath
	}
	return full, nil
}

// Resolve exposes resolve for handlers that stream file content directly
// (download, upload) instead of going through a Manager method.
func (m *Manager) Resolve(reqPath string) (string, error) {
	return m.resolve(reqPath)
}

func (m *Manager) toClientPath(full string) string {
	rel, err := filepath.Rel(filepath.Clean(m.Root), full)
	if err != nil || rel == "." {
		return "/"
	}
	return "/" + filepath.ToSlash(rel)
}

// List returns the contents of reqPath, directories first, then
// alphabetically case-insensitive within each group.
func (m *Manager) List(reqPath string) ([]Entry, error) {
	full, err := m.resolve(reqPath)
	if err != nil {
		return nil, err
	}
	dirEntries, err := os.ReadDir(full)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	entries := make([]Entry, 0, len(dirEntries))
	for _, de := range dirEntries {
		info, err := de.Info()
		if err != nil {
			// broken symlink or a race with something else touching the
			// directory concurrently — skip it rather than fail the whole
			// listing over one entry.
			continue
		}
		entries = append(entries, Entry{
			Name:    de.Name(),
			Path:    m.toClientPath(filepath.Join(full, de.Name())),
			IsDir:   de.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return strings.ToLower(entries[i].Name) < strings.ToLower(entries[j].Name)
	})
	return entries, nil
}

// maxPathCompleteResults bounds how many directory names PathComplete
// returns, so a huge directory (or a one-character prefix matching most of
// it) can't balloon the response.
const maxPathCompleteResults = 100

// PathComplete returns candidate absolute directory paths for a
// filesystem-path input field: if reqPath is itself an existing directory,
// its subdirectories; otherwise the subdirectories of reqPath's parent
// whose name starts with reqPath's own last segment — the same way shell
// tab-completion turns "/usr/l" into "/usr/local". Directories only: this
// exists to help pick a directory, not browse files.
func (m *Manager) PathComplete(reqPath string) ([]string, error) {
	full, err := m.resolve(reqPath)
	if err != nil {
		return nil, err
	}

	if info, err := os.Stat(full); err == nil && info.IsDir() {
		return m.listSubdirs(full, "")
	}
	return m.listSubdirs(filepath.Dir(full), filepath.Base(full))
}

func (m *Manager) listSubdirs(dir, prefix string) ([]string, error) {
	dirEntries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}

	var names []string
	for _, de := range dirEntries {
		if !de.IsDir() {
			continue
		}
		if prefix != "" && !strings.HasPrefix(de.Name(), prefix) {
			continue
		}
		names = append(names, de.Name())
	}
	sort.Slice(names, func(i, j int) bool { return strings.ToLower(names[i]) < strings.ToLower(names[j]) })
	if len(names) > maxPathCompleteResults {
		names = names[:maxPathCompleteResults]
	}

	paths := make([]string, len(names))
	for i, name := range names {
		paths[i] = m.toClientPath(filepath.Join(dir, name))
	}
	return paths, nil
}

func (m *Manager) Mkdir(reqPath string) error {
	full, err := m.resolve(reqPath)
	if err != nil {
		return err
	}
	return os.Mkdir(full, 0o755)
}

// Delete removes a single file or, recursively, a directory. Deleting Root
// itself is refused.
func (m *Manager) Delete(reqPath string) error {
	full, err := m.resolve(reqPath)
	if err != nil {
		return err
	}
	if full == filepath.Clean(m.Root) {
		return ErrInvalidPath
	}
	return os.RemoveAll(full)
}

// Rename moves reqPath to newName within the same parent directory —
// newName is a bare filename, not a path, so this can't be used to move a
// file into a different directory.
func (m *Manager) Rename(reqPath, newName string) error {
	if newName == "" || strings.ContainsAny(newName, "/\\") {
		return ErrInvalidPath
	}
	full, err := m.resolve(reqPath)
	if err != nil {
		return err
	}
	dest := filepath.Join(filepath.Dir(full), newName)
	return os.Rename(full, dest)
}

// ReadFile returns a file's content for the in-browser preview/editor.
// Binary content (detected by a NUL byte in the first 8000 bytes, the same
// heuristic git and grep -I use) and anything over maxTextSize are refused
// up front — the editor round-trips the content through a plain <textarea>
// and a save writes it back verbatim, so accepting either would risk
// silently corrupting a file the user only meant to look at.
func (m *Manager) ReadFile(reqPath string) (string, error) {
	full, err := m.resolve(reqPath)
	if err != nil {
		return "", err
	}
	info, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return "", ErrNotFound
		}
		return "", err
	}
	if info.IsDir() {
		return "", ErrInvalidPath
	}
	if info.Size() > maxTextSize {
		return "", ErrTooLarge
	}

	data, err := os.ReadFile(full)
	if err != nil {
		return "", err
	}
	sniff := data
	if len(sniff) > 8000 {
		sniff = sniff[:8000]
	}
	if bytes.IndexByte(sniff, 0) != -1 {
		return "", ErrNotText
	}
	return string(data), nil
}

func (m *Manager) WriteFile(reqPath, content string) error {
	full, err := m.resolve(reqPath)
	if err != nil {
		return err
	}
	info, err := os.Stat(full)
	if err != nil {
		if os.IsNotExist(err) {
			return ErrNotFound
		}
		return err
	}
	if info.IsDir() {
		return ErrInvalidPath
	}
	return os.WriteFile(full, []byte(content), info.Mode().Perm())
}
