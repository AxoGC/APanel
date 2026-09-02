// Package response implements the backend's response envelope.
//
// Every API response is { code, error, data }. code is a string union type;
// OK and INTERNAL_SERVER_ERROR are defined here as the common baseline,
// other codes are defined next to the endpoint that returns them.
package response

import (
	"encoding/json"
	"log"
	"net/http"
)

type Code string

const (
	OK                    Code = "OK"
	INTERNAL_SERVER_ERROR Code = "INTERNAL_SERVER_ERROR"
)

type Envelope struct {
	Code  Code   `json:"code"`
	Error string `json:"error,omitempty"`
	Data  any    `json:"data,omitempty"`
}

func write(w http.ResponseWriter, status int, env Envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(env)
}

// WriteOK writes a 200 response with code OK.
func WriteOK(w http.ResponseWriter, data any) {
	write(w, http.StatusOK, Envelope{Code: OK, Data: data})
}

// WriteCode writes a response with an endpoint-specific, non-error code.
// The error field is intentionally left empty: it only carries meaning for
// INTERNAL_SERVER_ERROR.
func WriteCode(w http.ResponseWriter, status int, code Code) {
	write(w, status, Envelope{Code: code})
}

// WriteInternalError logs the underlying error and sends the same message,
// verbatim, to the frontend. This is an admin-only backend: the operator has
// no reason to attack their own server, and hiding the error just forces
// them to go dig through logs to learn what we already know.
func WriteInternalError(w http.ResponseWriter, err error) {
	log.Printf("internal server error: %v", err)
	write(w, http.StatusInternalServerError, Envelope{
		Code:  INTERNAL_SERVER_ERROR,
		Error: err.Error(),
	})
}
