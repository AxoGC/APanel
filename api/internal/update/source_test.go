package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFetchCustomManifest(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"version":"v0.2.0","notes":"fixes","assets":{"amd64":{"url":"https://example.com/apanel-linux-amd64.gz","sha256":"abc","size":123}}}`))
	}))
	defer srv.Close()

	m, err := fetchCustomManifest(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("fetchCustomManifest: %v", err)
	}
	if m.Version != "v0.2.0" {
		t.Errorf("Version = %q, want v0.2.0", m.Version)
	}
	asset, ok := m.Assets["amd64"]
	if !ok {
		t.Fatalf("missing amd64 asset")
	}
	if asset.URL != "https://example.com/apanel-linux-amd64.gz" || asset.SHA256 != "abc" || asset.Size != 123 {
		t.Errorf("unexpected asset: %+v", asset)
	}
}

func TestFetchCustomManifest_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	if _, err := fetchCustomManifest(context.Background(), srv.URL); err == nil {
		t.Fatal("expected an error for a non-200 response")
	}
}

func TestFetchGitHubManifest_MapsMatchingAssetsByArch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"tag_name": "v1.2.3",
			"body": "release notes",
			"assets": [
				{"name": "apanel-linux-amd64.gz", "browser_download_url": "https://dl/amd64.gz", "size": 111},
				{"name": "apanel-linux-arm64.gz", "browser_download_url": "https://dl/arm64.gz", "size": 222},
				{"name": "apanel-linux-amd64.gz.sha256", "browser_download_url": "https://dl/amd64.sha256", "size": 1}
			]
		}`))
	}))
	defer srv.Close()

	orig := githubAPIBase
	githubAPIBase = srv.URL
	defer func() { githubAPIBase = orig }()

	m, err := fetchGitHubManifest(context.Background(), "axogc/apanel")
	if err != nil {
		t.Fatalf("fetchGitHubManifest: %v", err)
	}
	if m.Version != "v1.2.3" || m.Notes != "release notes" {
		t.Errorf("unexpected manifest: %+v", m)
	}
	if len(m.Assets) != 2 {
		t.Fatalf("Assets = %+v, want exactly amd64+arm64 (the .sha256 asset must not match)", m.Assets)
	}
	if m.Assets["amd64"].URL != "https://dl/amd64.gz" {
		t.Errorf("amd64 asset = %+v", m.Assets["amd64"])
	}
	if m.Assets["arm64"].URL != "https://dl/arm64.gz" {
		t.Errorf("arm64 asset = %+v", m.Assets["arm64"])
	}
}
