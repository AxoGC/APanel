package httpserver

import (
	"net/http"
	"strconv"

	"apanel/internal/response"
)

// SYSSTAT_UNAVAILABLE is returned when sysstat (sadf) isn't installed on
// this host. There's no self-collection fallback in this stage, so the
// history feature is simply off — this code tells the frontend to say so
// rather than show an empty chart.
const SYSSTAT_UNAVAILABLE response.Code = "SYSSTAT_UNAVAILABLE"

const INVALID_DAYS_AGO response.Code = "INVALID_DAYS_AGO"

func (s *Server) getHistory(w http.ResponseWriter, r *http.Request) {
	if !s.history.Available() {
		response.WriteCode(w, http.StatusOK, SYSSTAT_UNAVAILABLE)
		return
	}

	daysAgo := 0
	if v := r.URL.Query().Get("daysAgo"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 || n > 6 {
			response.WriteCode(w, http.StatusBadRequest, INVALID_DAYS_AGO)
			return
		}
		daysAgo = n
	}

	day, err := s.history.Sample(r.Context(), daysAgo)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, day)
}
