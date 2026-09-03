package httpserver

import (
	"errors"
	"net/http"
	"strconv"

	"apanel/internal/response"
	"apanel/internal/stats"
)

// PROCESS_NOT_FOUND is returned when the requested pid isn't a valid
// integer, or the process has already exited.
const PROCESS_NOT_FOUND response.Code = "PROCESS_NOT_FOUND"

func (s *Server) processDetail(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.Atoi(r.PathValue("pid"))
	if err != nil {
		response.WriteCode(w, http.StatusBadRequest, PROCESS_NOT_FOUND)
		return
	}

	detail, err := s.stats.ProcessDetail(pid)
	if err != nil {
		if errors.Is(err, stats.ErrProcessNotFound) {
			response.WriteCode(w, http.StatusNotFound, PROCESS_NOT_FOUND)
			return
		}
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, detail)
}
