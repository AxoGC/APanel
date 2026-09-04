package httpserver

import (
	"context"
	"encoding/json"
	"net/http"

	"apanel/internal/dependency"
	"apanel/internal/response"
)

const (
	invalidModule     response.Code = "INVALID_MODULE"
	invalidDependency response.Code = "INVALID_DEPENDENCY_CONFIG"
)

// dependencyModules is the subset of moduleOrder that can have a checkable
// local dependency at all — dashboard/terminal/services/files are core,
// always-local features with nothing to configure or detect.
var dependencyModules = map[string]struct{}{
	"containers": {},
	"history":    {},
	"firewall":   {},
	"proxy":      {},
	"database":   {},
}

// moduleFields lists which connection fields a module's dependency dialog
// should collect — any subset of host/port/url/username/password, chosen
// per what that dependency actually authenticates with. containers,
// firewall, and history are checked locally and have nothing to configure.
// proxy takes a full URL rather than a host/port pair since a plain
// host:port can't express http vs. https.
var moduleFields = map[string][]string{
	"containers": {"host", "port"},
	"proxy":      {"url", "password"},
	"database":   {"host", "port", "username", "password"},
}

// requiredFields lists which of a module's fields (see moduleFields) can't
// just fall back to a sensible default and be left blank — database's host,
// port, and username all have one (127.0.0.1, 5432, postgres), but a bare
// TCP connection to Postgres essentially always needs a real password, so
// that's the one field the dialog won't let the admin save empty. A module
// with no entry here has nothing required.
var requiredFields = map[string][]string{
	"database": {"password"},
}

type dependencyStatus struct {
	Key            string            `json:"key"`
	Healthy        bool              `json:"healthy"`
	Reason         string            `json:"reason,omitempty"` // "unavailable" | "serviceInactive" | "unconfigured"
	ServiceName    string            `json:"serviceName,omitempty"`
	Fields         []string          `json:"fields"`
	RequiredFields []string          `json:"requiredFields"`
	Config         map[string]string `json:"config"`
	DocsURL        string            `json:"docsUrl"`
}

// moduleDependencyStatus reports a module's health via its live
// DependencyChecker: containers, firewall, and history probe a local
// daemon/binary; proxy and database instead probe a reachable controller/
// instance at their saved or default connection settings.
func (s *Server) moduleDependencyStatus(ctx context.Context, key string) (dependencyStatus, error) {
	config, err := s.dependencyConfig(key)
	if err != nil {
		return dependencyStatus{}, err
	}

	status := dependencyStatus{
		Key:            key,
		Fields:         moduleFields[key],
		RequiredFields: requiredFields[key],
		Config:         config,
		DocsURL:        "https://apanel.axogc.net/feature/" + key + "/install.html",
	}

	if checker, ok := s.dependencyCheckers[key]; ok {
		state := checker.CheckDependency(ctx)
		status.ServiceName = state.ServiceName
		switch {
		case state.Installed:
			status.Healthy = true
		case state.ServiceName != "":
			status.Reason = "serviceInactive"
		default:
			status.Reason = "unavailable"
		}
		return status, nil
	}

	status.Healthy = len(config) > 0
	if !status.Healthy {
		status.Reason = "unconfigured"
	}
	return status, nil
}

func (s *Server) dependencyConfig(key string) (map[string]string, error) {
	raw, found, err := s.settings.Get(dependency.ConnectionSettingsKey(key))
	if err != nil || !found {
		return map[string]string{}, err
	}
	var config map[string]string
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		return map[string]string{}, nil
	}
	return config, nil
}

func (s *Server) getModuleDependency(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if _, known := dependencyModules[key]; !known {
		response.WriteCode(w, http.StatusNotFound, invalidModule)
		return
	}
	status, err := s.moduleDependencyStatus(r.Context(), key)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (s *Server) putModuleDependency(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if _, known := dependencyModules[key]; !known {
		response.WriteCode(w, http.StatusNotFound, invalidModule)
		return
	}

	var body struct {
		Config map[string]string `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, invalidDependency)
		return
	}

	allowed := make(map[string]bool, len(moduleFields[key]))
	for _, f := range moduleFields[key] {
		allowed[f] = true
	}
	config := make(map[string]string, len(body.Config))
	for k, v := range body.Config {
		if !allowed[k] {
			response.WriteCode(w, http.StatusBadRequest, invalidDependency)
			return
		}
		if v != "" {
			config[k] = v
		}
	}
	for _, f := range requiredFields[key] {
		if config[f] == "" {
			response.WriteCode(w, http.StatusBadRequest, invalidDependency)
			return
		}
	}

	var err error
	if len(config) == 0 {
		err = s.settings.Delete(dependency.ConnectionSettingsKey(key))
	} else {
		encoded, marshalErr := json.Marshal(config)
		if marshalErr != nil {
			response.WriteInternalError(w, marshalErr)
			return
		}
		err = s.settings.Set(dependency.ConnectionSettingsKey(key), string(encoded))
	}
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	// A checker that keeps its own derived-data cache (database's disk-
	// usage/row-count numbers) ties that cache to whichever instance it was
	// pointed at when computed — saving new connection settings must throw
	// it away, or it would keep answering for the old instance for up to an
	// hour.
	if checker, ok := s.dependencyCheckers[key]; ok {
		if invalidator, ok := checker.(interface{ InvalidateCache() }); ok {
			invalidator.InvalidateCache()
		}
	}

	status, err := s.moduleDependencyStatus(r.Context(), key)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}

func (s *Server) enableModuleService(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	checker, ok := s.dependencyCheckers[key]
	if !ok {
		response.WriteCode(w, http.StatusNotFound, invalidModule)
		return
	}
	state := checker.CheckDependency(r.Context())
	if state.ServiceName == "" {
		response.WriteCode(w, http.StatusBadRequest, invalidModule)
		return
	}
	if err := dependency.Enable(r.Context(), state.ServiceName); err != nil {
		response.WriteInternalError(w, err)
		return
	}

	status, err := s.moduleDependencyStatus(r.Context(), key)
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, status)
}
