package httpserver

import (
	"context"
	"errors"
	"net/http"

	"apanel/internal/response"
	"apanel/internal/service"
)

// SERVICE_NOT_FOUND is returned when the requested systemd unit doesn't exist.
const SERVICE_NOT_FOUND response.Code = "SERVICE_NOT_FOUND"

func (s *Server) listServices(w http.ResponseWriter, r *http.Request) {
	units, err := s.services.List(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, units)
}

func (s *Server) serviceAction(action func(context.Context, string) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if err := action(r.Context(), name); err != nil {
			if errors.Is(err, service.ErrNotFound) {
				response.WriteCode(w, http.StatusNotFound, SERVICE_NOT_FOUND)
				return
			}
			response.WriteInternalError(w, err)
			return
		}
		response.WriteOK(w, nil)
	}
}
