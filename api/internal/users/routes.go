package users

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"apanel/internal/response"
)

const (
	PASSWORD_TOO_SHORT response.Code = "PASSWORD_TOO_SHORT"
	PASSWORD_DUPLICATE response.Code = "PASSWORD_DUPLICATE"
	LAST_USER          response.Code = "LAST_USER"
	USER_NOT_FOUND     response.Code = "USER_NOT_FOUND"
	INVALID_USER       response.Code = "INVALID_USER"
)

// RegisterRoutes wires the /api/users/* routes onto mux — see
// httpserver.RouteRegistrar.
func (m *Manager) RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /api/users", requireAuth(http.HandlerFunc(m.list)))
	mux.Handle("POST /api/users", requireAuth(http.HandlerFunc(m.create)))
	mux.Handle("PUT /api/users/{id}", requireAuth(http.HandlerFunc(m.update)))
	mux.Handle("DELETE /api/users/{id}", requireAuth(http.HandlerFunc(m.delete)))
}

func (m *Manager) list(w http.ResponseWriter, r *http.Request) {
	infos, err := m.List()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func (m *Manager) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
		Remark   string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_USER)
		return
	}
	info, err := m.Create(body.Password, body.Remark)
	if err != nil {
		writeUserErr(w, err)
		return
	}
	response.WriteOK(w, info)
}

func (m *Manager) update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_USER)
		return
	}
	var body struct {
		Password string `json:"password"`
		Remark   string `json:"remark"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_USER)
		return
	}

	if err := m.SetRemark(uint(id), body.Remark); err != nil {
		writeUserErr(w, err)
		return
	}
	if body.Password != "" {
		if err := m.SetPassword(uint(id), body.Password); err != nil {
			writeUserErr(w, err)
			return
		}
	}

	infos, err := m.List()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func (m *Manager) delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.WriteCode(w, http.StatusBadRequest, INVALID_USER)
		return
	}
	if err := m.Delete(uint(id)); err != nil {
		writeUserErr(w, err)
		return
	}

	infos, err := m.List()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, infos)
}

func writeUserErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPasswordTooShort):
		response.WriteCode(w, http.StatusBadRequest, PASSWORD_TOO_SHORT)
	case errors.Is(err, ErrPasswordDuplicate):
		response.WriteCode(w, http.StatusBadRequest, PASSWORD_DUPLICATE)
	case errors.Is(err, ErrLastUser):
		response.WriteCode(w, http.StatusBadRequest, LAST_USER)
	case errors.Is(err, ErrNotFound):
		response.WriteCode(w, http.StatusNotFound, USER_NOT_FOUND)
	default:
		response.WriteInternalError(w, err)
	}
}
