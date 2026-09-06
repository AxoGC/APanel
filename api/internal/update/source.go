package update

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
)

// Asset is one architecture's downloadable release artifact — always a
// gzip-compressed raw binary, matching install.sh/upgrade.sh's existing
// download convention.
type Asset struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256,omitempty"`
	Size   int64  `json:"size,omitempty"`
}

// Manifest is the "latest version summary" response of apanel's own
// two-request update protocol: request 1 fetches this; request 2 is a
// plain GET of Assets[CurrentArch()].URL. Every source — the hardcoded
// GitHub default or a self-hosted mirror — ends up producing this same
// shape: fetchGitHubManifest adapts GitHub's Releases API response into
// it, while a custom source is expected to serve it directly as JSON.
type Manifest struct {
	Version string           `json:"version"`
	Notes   string           `json:"notes,omitempty"`
	Assets  map[string]Asset `json:"assets"`
}

// defaultGitHubRepo is the hardcoded default source. apanel isn't public
// yet, so this doesn't resolve to anything until the first real release.
const defaultGitHubRepo = "axogc/apanel"

// githubAPIBase is a var (not a const) so tests can point it at an
// httptest server instead of the real GitHub API.
var githubAPIBase = "https://api.github.com"

// CurrentArch is the asset-map key for this build's architecture, matching
// install.sh's apanel-linux-<arch>.gz naming.
func CurrentArch() string { return runtime.GOARCH }

// FetchManifest retrieves the latest-version summary from source. An empty
// source means "use the hardcoded GitHub repo" (defaultGitHubRepo);
// anything else is treated as a URL that serves Manifest's JSON directly,
// letting a self-hosted mirror stand in for GitHub without having to speak
// its Releases API.
func FetchManifest(ctx context.Context, source string) (Manifest, error) {
	if source == "" {
		return fetchGitHubManifest(ctx, defaultGitHubRepo)
	}
	return fetchCustomManifest(ctx, source)
}

func fetchCustomManifest(ctx context.Context, url string) (Manifest, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return Manifest{}, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return Manifest{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Manifest{}, fmt.Errorf("update source returned %s", resp.Status)
	}
	var m Manifest
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return Manifest{}, fmt.Errorf("decoding update manifest: %w", err)
	}
	return m, nil
}

// githubRelease is the subset of GitHub's Releases API response
// (GET /repos/{owner}/{repo}/releases/latest) this package reads.
type githubRelease struct {
	TagName string `json:"tag_name"`
	Body    string `json:"body"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
		Size               int64  `json:"size"`
	} `json:"assets"`
}

// githubAssetName is install.sh's own download naming convention.
func githubAssetName(arch string) string { return fmt.Sprintf("apanel-linux-%s.gz", arch) }

// fetchGitHubManifest adapts GitHub's Releases API response into Manifest.
// GitHub doesn't publish a checksum alongside each asset, so Assets here
// never carry SHA256 — integrity rests on plain HTTPS to github.com, same
// as install.sh's existing manual download already does.
func fetchGitHubManifest(ctx context.Context, repo string) (Manifest, error) {
	url := fmt.Sprintf("%s/repos/%s/releases/latest", githubAPIBase, repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return Manifest{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return Manifest{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return Manifest{}, fmt.Errorf("github returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var rel githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return Manifest{}, fmt.Errorf("decoding github release: %w", err)
	}

	m := Manifest{Version: rel.TagName, Notes: rel.Body, Assets: map[string]Asset{}}
	for _, arch := range []string{"amd64", "arm64"} {
		want := githubAssetName(arch)
		for _, a := range rel.Assets {
			if a.Name == want {
				m.Assets[arch] = Asset{URL: a.BrowserDownloadURL, Size: a.Size}
				break
			}
		}
	}
	return m, nil
}
