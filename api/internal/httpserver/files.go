package httpserver

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"apanel/internal/files"
	"apanel/internal/response"
)

const (
	FILE_NOT_FOUND response.Code = "FILE_NOT_FOUND"
	FILE_TOO_LARGE response.Code = "FILE_TOO_LARGE"
	FILE_NOT_TEXT  response.Code = "FILE_NOT_TEXT"
	INVALID_PATH   response.Code = "INVALID_PATH"
)

// writeFileError maps the files package's sentinel errors onto the
// endpoint-specific codes above; anything else falls back to the generic
// INTERNAL_SERVER_ERROR path.
func writeFileError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, files.ErrNotFound):
		response.WriteCode(w, http.StatusNotFound, FILE_NOT_FOUND)
	case errors.Is(err, files.ErrTooLarge):
		response.WriteCode(w, http.StatusRequestEntityTooLarge, FILE_TOO_LARGE)
	case errors.Is(err, files.ErrNotText):
		response.WriteCode(w, http.StatusUnprocessableEntity, FILE_NOT_TEXT)
	case errors.Is(err, files.ErrInvalidPath):
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
	default:
		response.WriteInternalError(w, err)
	}
}

func (s *Server) listFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := s.files.List(r.URL.Query().Get("path"))
	if err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, entries)
}

func (s *Server) mkdir(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := s.files.Mkdir(body.Path); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Server) renameFile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := s.files.Rename(body.Path, body.NewName); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Server) deleteFiles(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Paths) == 0 {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	for _, p := range body.Paths {
		if err := s.files.Delete(p); err != nil {
			writeFileError(w, err)
			return
		}
	}
	response.WriteOK(w, nil)
}

func (s *Server) readFileContent(w http.ResponseWriter, r *http.Request) {
	content, err := s.files.ReadFile(r.URL.Query().Get("path"))
	if err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, map[string]string{"content": content})
}

func (s *Server) writeFileContent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_PATH)
		return
	}
	if err := s.files.WriteFile(body.Path, body.Content); err != nil {
		writeFileError(w, err)
		return
	}
	response.WriteOK(w, nil)
}

func (s *Server) downloadFile(w http.ResponseWriter, r *http.Request) {
	full, err := s.files.Resolve(r.URL.Query().Get("path"))
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
func (s *Server) uploadFile(w http.ResponseWriter, r *http.Request) {
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
		if err := s.saveUpload(dir, fh); err != nil {
			writeFileError(w, err)
			return
		}
	}
	response.WriteOK(w, nil)
}

func (s *Server) saveUpload(dir string, fh *multipart.FileHeader) error {
	name := filepath.Base(fh.Filename)
	destFull, err := s.files.Resolve(dir + "/" + name)
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
