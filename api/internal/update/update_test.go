package update

import (
	"bytes"
	"compress/gzip"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func gzipBytes(t *testing.T, data []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(data); err != nil {
		t.Fatalf("gzip write: %v", err)
	}
	if err := gw.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}
	return buf.Bytes()
}

func TestDownloadAndDecompress(t *testing.T) {
	want := []byte("pretend this is a binary")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(gzipBytes(t, want))
	}))
	defer srv.Close()

	got, err := downloadAndDecompress(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("downloadAndDecompress: %v", err)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestDownloadAndDecompress_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	if _, err := downloadAndDecompress(context.Background(), srv.URL); err == nil {
		t.Fatal("expected an error for a 404 response")
	}
}

func TestDownloadAndDecompress_NotGzip(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not actually gzip"))
	}))
	defer srv.Close()

	if _, err := downloadAndDecompress(context.Background(), srv.URL); err == nil {
		t.Fatal("expected an error for a non-gzip body")
	}
}

func TestManagerCheck_DevBuildNeverNewer(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"version":"v99.0.0","assets":{}}`))
	}))
	defer srv.Close()

	m := New(nil)
	_, newer, err := m.check(context.Background(), Settings{Source: srv.URL})
	if err != nil {
		t.Fatalf("check: %v", err)
	}
	if newer {
		t.Error("a dev build (version.Current() == \"dev\") must never be reported as needing an update")
	}
}

func TestManagerCheck_RecordsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	m := New(nil)
	if _, _, err := m.check(context.Background(), Settings{Source: srv.URL}); err == nil {
		t.Fatal("expected an error")
	}
	m.mu.Lock()
	last := m.lastCheck
	m.mu.Unlock()
	if last == nil || last.Error == "" {
		t.Errorf("expected lastCheck to record the error, got %+v", last)
	}
}
