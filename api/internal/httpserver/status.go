package httpserver

import (
	"context"
	"encoding/json"
	"net/http"

	"apanel/internal/response"
)

const enabledFeaturesSettingsKey = "navigation.enabledFeatures"

const invalidEnabledFeatures response.Code = "INVALID_ENABLED_FEATURES"

// moduleOrder is the fixed set of every togglable/reorderable module, in
// their default order. Whether one shows up in the nav, and in what order,
// is purely this explicit, admin-controlled list — never probed from the
// host. Auto-detecting a dependency (a reachable Docker daemon, an
// installed binary, ...) can't tell "not installed" apart from "reachable,
// just not from here" (a different port, a different IP), so it was never
// a reliable signal for this; a module whose backend isn't actually
// reachable simply fails at request time instead. (Dashboard and Settings
// aren't in this list — they're mandatory, pinned first and last.)
var moduleOrder = []string{
	"terminal", "services", "files",
	"containers", "history", "firewall", "proxy", "database", "auditlog",
}

// mandatoryEnabledFeatures start enabled — terminal, files, services, and
// auditlog depend on nothing external, so there's nothing to detect for
// them. "Mandatory" only describes this initial-detection default: like
// every other entry in moduleOrder, the admin can still toggle any of these
// off from the "enable modules" dialog.
var mandatoryEnabledFeatures = []string{"terminal", "services", "files", "auditlog"}

var knownModules = func() map[string]struct{} {
	m := make(map[string]struct{}, len(moduleOrder))
	for _, key := range moduleOrder {
		m[key] = struct{}{}
	}
	return m
}()

// moduleStatus is one row of GET /api/status's module list.
type moduleStatus struct {
	Key     string `json:"key"`
	Enabled bool   `json:"enabled"`
}

// featureStatus tells the frontend which extension modules are enabled and
// in what order: entries appear enabled-first in the admin's chosen nav
// order, then every remaining module. The "enable modules" dialog and Nav
// both render directly off this order.
type featureStatus struct {
	Modules []moduleStatus `json:"modules"`
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	enabled, err := s.enabledFeatures(r.Context())
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, featureStatus{Modules: buildModuleStatus(enabled)})
}

func (s *Server) putEnabledFeatures(w http.ResponseWriter, r *http.Request) {
	var body struct {
		EnabledFeatures []string `json:"enabledFeatures"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, invalidEnabledFeatures)
		return
	}

	enabled, ok := normalizeEnabledFeatures(body.EnabledFeatures)
	if !ok {
		response.WriteCode(w, http.StatusBadRequest, invalidEnabledFeatures)
		return
	}

	var err error
	if len(enabled) == 0 {
		err = s.settings.Delete(enabledFeaturesSettingsKey)
	} else {
		encoded, marshalErr := json.Marshal(enabled)
		if marshalErr != nil {
			response.WriteInternalError(w, marshalErr)
			return
		}
		err = s.settings.Set(enabledFeaturesSettingsKey, string(encoded))
	}
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	response.WriteOK(w, featureStatus{Modules: buildModuleStatus(enabled)})
}

// buildModuleStatus renders enabled modules first, in the caller's chosen
// order, followed by every remaining module in moduleOrder.
func buildModuleStatus(enabled []string) []moduleStatus {
	modules := make([]moduleStatus, 0, len(moduleOrder))
	seen := make(map[string]struct{}, len(enabled))
	for _, key := range enabled {
		modules = append(modules, moduleStatus{Key: key, Enabled: true})
		seen[key] = struct{}{}
	}
	for _, key := range moduleOrder {
		if _, ok := seen[key]; ok {
			continue
		}
		modules = append(modules, moduleStatus{Key: key, Enabled: false})
	}
	return modules
}

// enabledFeatures returns the persisted enabled-modules list, seeding it on
// first read: nothing saved yet means this is the persistence
// initialization stage, so it probes every optional module's local
// dependency once, persists the detected set, and returns that from then on.
// Any explicit save afterwards — even an empty one — is authoritative.
func (s *Server) enabledFeatures(ctx context.Context) ([]string, error) {
	raw, found, err := s.settings.Get(enabledFeaturesSettingsKey)
	if err != nil {
		return nil, err
	}
	if !found {
		detected := s.detectInitialEnabledFeatures(ctx)
		encoded, err := json.Marshal(detected)
		if err != nil {
			return nil, err
		}
		if err := s.settings.Set(enabledFeaturesSettingsKey, string(encoded)); err != nil {
			return nil, err
		}
		return detected, nil
	}

	var stored []string
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return []string{}, nil
	}
	enabled, _ := normalizeEnabledFeatures(stored)
	return enabled, nil
}

// detectInitialEnabledFeatures seeds a fresh install's enabled-modules list:
// the 3 core modules are always on, and every optional module gets a single
// local systemd probe (host-only — a dependency reachable only on some
// other host/port can't be told apart from "not installed", so it's never
// probed) to decide its initial state. A module whose dependency is found
// at all — installed but inactive counts — starts enabled; anything not
// found starts disabled and stays opt-in.
func (s *Server) detectInitialEnabledFeatures(ctx context.Context) []string {
	detected := make([]string, 0, len(mandatoryEnabledFeatures))
	detected = append(detected, mandatoryEnabledFeatures...)
	mandatory := make(map[string]struct{}, len(mandatoryEnabledFeatures))
	for _, key := range mandatoryEnabledFeatures {
		mandatory[key] = struct{}{}
	}

	for _, key := range moduleOrder {
		if _, skip := mandatory[key]; skip {
			continue
		}
		checker, ok := s.dependencyCheckers[key]
		if !ok {
			continue
		}
		state := checker.CheckDependency(ctx)
		if state.Installed || state.ServiceName != "" {
			detected = append(detected, key)
		}
	}
	return detected
}

func normalizeEnabledFeatures(values []string) ([]string, bool) {
	seen := make(map[string]struct{}, len(values))
	enabled := make([]string, 0, len(values))
	for _, value := range values {
		if _, known := knownModules[value]; !known {
			return nil, false
		}
		if _, duplicate := seen[value]; duplicate {
			continue
		}
		seen[value] = struct{}{}
		enabled = append(enabled, value)
	}
	return enabled, true
}
