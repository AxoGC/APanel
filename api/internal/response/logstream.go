package response

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const (
	defaultLogLines = 200
	maxLogLines     = 5000
)

// LogLines parses the "lines" query param (how much history to fetch or
// seed a follow stream with), falling back to defaultLogLines for anything
// missing or out of range.
func LogLines(r *http.Request) int {
	if v := r.URL.Query().Get("lines"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= maxLogLines {
			return n
		}
	}
	return defaultLogLines
}

// SplitLogLines turns raw command/API output into display lines, dropping
// the single trailing empty element strings.Split leaves from the final
// newline.
func SplitLogLines(raw string) []string {
	raw = strings.TrimRight(raw, "\n")
	if raw == "" {
		return []string{}
	}
	return strings.Split(raw, "\n")
}

// StreamLogLines relays each line from r as its own SSE event, until r is
// exhausted (the process exited or ctx was canceled, closing the pipe) or
// the client goes away (Fprintf starts failing).
func StreamLogLines(w http.ResponseWriter, flusher http.Flusher, r io.Reader) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for scanner.Scan() {
		if _, err := fmt.Fprintf(w, "data: %s\n\n", scanner.Text()); err != nil {
			return
		}
		flusher.Flush()
	}
}

// WriteLogStreamHeaders starts the SSE response after the log source has
// already been opened successfully, so a not-found/error case can still be
// reported as a normal JSON envelope instead of a broken event stream.
func WriteLogStreamHeaders(w http.ResponseWriter, flusher http.Flusher) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
}

// RequireFlusher reports whether w supports streaming, writing an internal
// error response itself when it doesn't.
func RequireFlusher(w http.ResponseWriter) (http.Flusher, bool) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		WriteInternalError(w, fmt.Errorf("streaming unsupported"))
		return nil, false
	}
	return flusher, true
}
