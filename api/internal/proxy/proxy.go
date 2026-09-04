// Package proxy talks to a locally (or remotely) running clash/mihomo
// external controller over its REST API — see
// https://wiki.metacubex.one/api/ — to report and drive proxy mode,
// policy groups, and per-proxy selection. Unlike container/firewall/history,
// this dependency genuinely can live on another host or port, so every call
// reads its connection settings fresh (see config) rather than caching a
// client at startup; a saved change takes effect on the very next request.
package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"apanel/internal/dependency"
	"apanel/internal/settings"
)

var (
	// ErrUnreachable means the request never got a response at all — wrong
	// host/port, or nothing listening there.
	ErrUnreachable = errors.New("proxy controller unreachable")
	// ErrUnauthorized means the controller answered but rejected the
	// configured secret (or none was given but one is required).
	ErrUnauthorized  = errors.New("proxy controller rejected credentials")
	ErrGroupNotFound = errors.New("proxy group not found")
	ErrInvalidMode   = errors.New("invalid proxy mode")
)

var validModes = map[string]bool{"global": true, "rule": true, "direct": true}

type Manager struct {
	settings *settings.Manager
	client   *http.Client
}

func New(settingsMgr *settings.Manager) *Manager {
	return &Manager{settings: settingsMgr, client: &http.Client{Timeout: 6 * time.Second}}
}

// Key identifies this package's entry in httpserver's dependency endpoints.
func (m *Manager) Key() string { return "proxy" }

type connConfig struct {
	baseURL, secret string
}

// defaultBaseURL is what a fresh install, with no credentials saved at all,
// talks to — mihomo's own default controller address (and the one this
// package's author found already running on this machine). A plain
// host:port pair can't express http vs. https, so the saved field is a
// full URL instead.
const defaultBaseURL = "http://127.0.0.1:9090"

// config reads the admin's saved controller URL/password, falling back to
// defaultBaseURL with no secret when nothing has been saved.
func (m *Manager) config() connConfig {
	cfg := connConfig{baseURL: defaultBaseURL}
	raw, found, err := m.settings.Get(dependency.ConnectionSettingsKey("proxy"))
	if err != nil || !found {
		return cfg
	}
	var saved map[string]string
	if json.Unmarshal([]byte(raw), &saved) != nil {
		return cfg
	}
	if v := strings.TrimSuffix(strings.TrimSpace(saved["url"]), "/"); v != "" {
		cfg.baseURL = v
	}
	cfg.secret = saved["password"]
	return cfg
}

// CheckDependency reports whether the configured controller is reachable at
// all. A wrong or missing secret still counts as "installed" — the
// controller answered, it just refused this request — so the dependency
// dialog treats that as reachable-but-misconfigured rather than not-found;
// individual proxy calls surface ErrUnauthorized to the caller separately.
func (m *Manager) CheckDependency(ctx context.Context) dependency.State {
	cfg := m.config()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, cfg.baseURL+"/version", nil)
	if err != nil {
		return dependency.State{}
	}
	if cfg.secret != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.secret)
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return dependency.State{}
	}
	defer resp.Body.Close()
	return dependency.State{Installed: true}
}

// do issues one request against the configured controller and, when out is
// non-nil, decodes the JSON response body into it.
func (m *Manager) do(ctx context.Context, method, path string, query url.Values, body any, out any) error {
	cfg := m.config()
	target := cfg.baseURL + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}

	var reqBody io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, target, reqBody)
	if err != nil {
		return err
	}
	if cfg.secret != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.secret)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnreachable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return ErrUnauthorized
	}
	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("proxy controller: %s: %s", resp.Status, strings.TrimSpace(string(respBody)))
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// ProxyOption is one selectable member of a policy group.
type ProxyOption struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Delay int    `json:"delay"` // ms; 0 means never tested (or unreachable)
}

// Group is a policy group's current selection and members, ready for the
// proxy table.
type Group struct {
	Name    string        `json:"name"`
	Now     string        `json:"now"`
	Options []ProxyOption `json:"options"`
}

// Overview is the top of the proxy page: the current mode, plus every
// policy group available for "rule" mode's group row (GLOBAL is excluded —
// it's what "global" mode's own table is built from instead).
type Overview struct {
	Mode   string   `json:"mode"`
	Groups []string `json:"groups"`
}

func (m *Manager) Overview(ctx context.Context) (Overview, error) {
	var configs struct {
		Mode string `json:"mode"`
	}
	if err := m.do(ctx, http.MethodGet, "/configs", nil, nil, &configs); err != nil {
		return Overview{}, err
	}

	var groupList struct {
		Proxies []struct {
			Name string `json:"name"`
		} `json:"proxies"`
	}
	if err := m.do(ctx, http.MethodGet, "/group", nil, nil, &groupList); err != nil {
		return Overview{}, err
	}

	groups := make([]string, 0, len(groupList.Proxies))
	for _, g := range groupList.Proxies {
		if g.Name == "GLOBAL" {
			continue
		}
		groups = append(groups, g.Name)
	}
	return Overview{Mode: configs.Mode, Groups: groups}, nil
}

// SetMode switches global/rule/direct mode and returns the resulting
// overview.
func (m *Manager) SetMode(ctx context.Context, mode string) (Overview, error) {
	if !validModes[mode] {
		return Overview{}, ErrInvalidMode
	}
	if err := m.do(ctx, http.MethodPatch, "/configs", nil, map[string]string{"mode": mode}, nil); err != nil {
		return Overview{}, err
	}
	return m.Overview(ctx)
}

// rawProxy is one entry of GET /proxies' bulk "proxies" map — the shape is
// shared by both policy groups (which set All) and leaf proxies (which set
// History instead).
type rawProxy struct {
	Type    string   `json:"type"`
	Now     string   `json:"now,omitempty"`
	All     []string `json:"all,omitempty"`
	History []struct {
		Delay int `json:"delay"`
	} `json:"history"`
}

func (m *Manager) allProxies(ctx context.Context) (map[string]rawProxy, error) {
	var list struct {
		Proxies map[string]rawProxy `json:"proxies"`
	}
	if err := m.do(ctx, http.MethodGet, "/proxies", nil, nil, &list); err != nil {
		return nil, err
	}
	return list.Proxies, nil
}

// Group fetches one policy group's members, each annotated with its type
// and most recent delay test result (0 if it's never been tested).
func (m *Manager) Group(ctx context.Context, name string) (Group, error) {
	all, err := m.allProxies(ctx)
	if err != nil {
		return Group{}, err
	}
	self, ok := all[name]
	if !ok {
		return Group{}, ErrGroupNotFound
	}

	options := make([]ProxyOption, 0, len(self.All))
	for _, memberName := range self.All {
		opt := ProxyOption{Name: memberName}
		if member, ok := all[memberName]; ok {
			opt.Type = member.Type
			if n := len(member.History); n > 0 {
				opt.Delay = member.History[n-1].Delay
			}
		}
		options = append(options, opt)
	}
	return Group{Name: name, Now: self.Now, Options: options}, nil
}

// Select switches a policy group's active member and returns the group's
// refreshed state.
func (m *Manager) Select(ctx context.Context, group, proxyName string) (Group, error) {
	path := "/proxies/" + url.PathEscape(group)
	if err := m.do(ctx, http.MethodPut, path, nil, map[string]string{"name": proxyName}, nil); err != nil {
		return Group{}, err
	}
	return m.Group(ctx, group)
}

// testURL/testTimeout mirror what real clash dashboards (yacd, metacubexd)
// default to for a health-check request.
const (
	testURL     = "https://www.gstatic.com/generate_204"
	testTimeout = "5000"
)

// DelayResult is emitted as soon as one proxy option finishes its delay
// test. A negative delay means the individual test timed out or failed.
type DelayResult struct {
	Name  string `json:"name"`
	Delay int    `json:"delay"`
}

func (m *Manager) testProxyDelay(ctx context.Context, name string) (int, error) {
	query := url.Values{"timeout": {testTimeout}, "url": {testURL}}
	var result struct {
		Delay int `json:"delay"`
	}
	if err := m.do(ctx, http.MethodGet, "/proxies/"+url.PathEscape(name)+"/delay", query, nil, &result); err != nil {
		return 0, err
	}
	return result.Delay, nil
}

// TestDelays tests all supplied options concurrently through mihomo's
// per-proxy delay endpoint, then emits results in completion order. This
// lets the HTTP layer stream each finished row instead of waiting for the
// slowest member in the group.
func (m *Manager) TestDelays(ctx context.Context, options []ProxyOption, emit func(DelayResult)) error {
	results := make(chan DelayResult, len(options))
	for _, option := range options {
		go func(name string) {
			delay, err := m.testProxyDelay(ctx, name)
			if err != nil {
				delay = -1
			}
			select {
			case results <- DelayResult{Name: name, Delay: delay}:
			case <-ctx.Done():
			}
		}(option.Name)
	}

	for range options {
		select {
		case result := <-results:
			emit(result)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}
