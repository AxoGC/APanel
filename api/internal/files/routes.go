package files

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"apanel/internal/response"
)

const (
	FILE_NOT_FOUND response.Code = "FILE_NOT_FOUND"
	FILE_TOO_LARGE response.Code = "FILE_TOO_LARGE"
	FILE_NOT_TEXT  response.Code = "FILE_NOT_TEXT"
	INVALID_PATH   response.Code = "INVALID_PATH"
)

// RegisterRoutes wires the /api/files/* routes onto mux — see
// httpserver.RouteRegistrar. httpserver never imports this package; it just
// calls this method on whatever it was given at construction time.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/files", requireAuth(http.HandlerFunc(m.listFiles)))
	mux.Handle("GET /api/files/content", requireAuth(http.HandlerFunc(m.readFileContent)))
	mux.Handle("PUT /api/files/content", requireAuth(http.HandlerFunc(m.writeFileContent)))
	mux.Handle("POST /api/files/mkdir", requireAuth(http.HandlerFunc(m.mkdir)))
	mux.Handle("POST /api/files/rename", requireAuth(http.HandlerFunc(m.renameFile)))
	mux.Handle("POST /api/files/delete", requireAuth(http.HandlerFunc(m.deleteFiles)))
	mux.Handle("GET /api/files/download", requireAuth(http.HandlerFunc(m.downloadFile)))
	mux.Handle("POST /api/files/upload", requireAuth(http.HandlerFunc(m.uploadFile)))
}

// writeFileError maps the files package's sentinel errors onto the
// endpoint-specific codes above; anything else falls back to the generic
// INTERNAL_SERVER_ERROR path.
func writeFileError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		response.WriteCode(w, http.StatusNotFound, FILE_NOT_FOUND)
	case errors.Is(err, ErrTooLarge):
		response.WriteCode(w, http.StatusRequestEntityTooLarge, FILE_TOO_LARGE)
	case errors.Is(err, ErrNotText):
		response.WriteCode(w, http.StatusUnprocessableEntity, FILE_NOT_TEXT)
	case errors.Is(err, ErrInvalidPath):
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
	default:
		response.WriteInternalError(w, err)
	}
}

func (m *Manager) listFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := m.List(r.URL.Query().Get("path"))
	if err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, entries)
}

func (m *Manager) mkdir(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := m.Mkdir(body.Path); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) renameFile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := m.Rename(body.Path, body.NewName); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) deleteFiles(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Paths) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	for _, p := range body.Paths {
		if err := m.Delete(p); err != nil {
			writeFileError(w, err)
			return
		}
	}
	response.WriteOK(w, nil)
}

func (m *Manager) readFileContent(w http.ResponseWriter, r *http.Request) {
	content, err := m.ReadFile(r.URL.Query().Get("path"))
	if err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, map[string]string{"content": content})
}

func (m *Manager) writeFileContent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := m.WriteFile(body.Path, body.Content); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (m *Manager) downloadFile(w http.ResponseWriter, r *http.Request) {
	full, err := m.Resolve(r.URL.Query().Get("path"))
	if err != nil {
		writeFileError(w, err)
		return
	}
	f, err := os.Open(full)
	if err != nil {
		if os.IsNotExist(err) {
			response.WriteCode(w, http.StatusNotFound, FILE_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	if info.IsDir() {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filepath.Base(full)))
	http.ServeContent(w, r, filepath.Base(full), info.ModTime(), f)
}

// uploadFile accepts one or more files under the multipart field name
// "files" and writes each into the directory named by the "path" query
// param, using only the client-supplied basename (never the full relative
// path a browser may send) so an upload can't be used to write outside the
// target directory.
func (m *Manager) uploadFile(w http.ResponseWriter, r *http.Request) {
	dir := r.URL.Query().Get("path")
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		response.WriteInternalError(w, err)
		return
	}
	headers := r.MultipartForm.File["files"]
	if len(headers) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}

	for _, fh := range headers {
		if err := m.saveUpload(dir, fh); err != nil {
			writeFileError(w, err)
			return
		}
	}
	response.WriteOK(w, nil)
}

func (m *Manager) saveUpload(dir string, fh *multipart.FileHeader) error {
	name := filepath.Base(fh.Filename)
	destFull, err := m.Resolve(dir + "/" + name)
	if err != nil {
		return err
	}

	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.Create(destFull)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	return err
}
