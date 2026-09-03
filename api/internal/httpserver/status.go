package httpserver

import (
	"encoding/json"
	"net/http"

	"apanel/internal/response"
)

const disabledFeaturesSettingsKey = "navigation.disabledFeatures"

const invalidDisabledFeatures response.Code = "INVALID_DISABLED_FEATURES"

var knownFeatures = map[string]struct{}{
	"dashboard":  {},
	"terminal":   {},
	"services":   {},
	"files":      {},
	"containers": {},
	"history":    {},
	"firewall":   {},
}

// featureStatus tells the frontend which optional, dependency-gated
// features are actually usable on this host and which available entries the
// operator has explicitly hidden from navigation.
type featureStatus struct {
	Containers       bool     `json:"containers"`
	History          bool     `json:"history"`
	Firewall         bool     `json:"firewall"`
	DisabledFeatures []string `json:"disabledFeatures"`
}

func (s *Server) getStatus(w http.ResponseWriter, r *http.Request) {
	disabled, err := s.disabledFeatures()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	response.WriteOK(w, featureStatus{
		Containers:       s.containers.Available(r.Context()),
		History:          s.history.Available(),
		Firewall:         s.firewall.Available(),
		DisabledFeatures: disabled,
	})
}

func (s *Server) putDisabledFeatures(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DisabledFeatures []string `json:"disabledFeatures"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.WriteCode(w, http.StatusBadRequest, invalidDisabledFeatures)
		return
	}

	disabled, ok := normalizeDisabledFeatures(body.DisabledFeatures)
	if !ok {
		response.WriteCode(w, http.StatusBadRequest, invalidDisabledFeatures)
		return
	}
	var err error
	if len(disabled) == 0 {
		err = s.settings.Delete(disabledFeaturesSettingsKey)
	} else {
		encoded, marshalErr := json.Marshal(disabled)
		if marshalErr != nil {
			response.WriteInternalError(w, marshalErr)
			return
		}
		err = s.settings.Set(disabledFeaturesSettingsKey, string(encoded))
	}
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}

	response.WriteOK(w, featureStatus{
		Containers:       s.containers.Available(r.Context()),
		History:          s.history.Available(),
		Firewall:         s.firewall.Available(),
		DisabledFeatures: disabled,
	})
}

// disabledFeatures intentionally defaults to an empty list: absence from the
// config table means enabled. Invalid legacy values are ignored rather than
// letting a navigation preference make the entire application unavailable.
func (s *Server) disabledFeatures() ([]string, error) {
	raw, found, err := s.settings.Get(disabledFeaturesSettingsKey)
	if err != nil || !found {
		return []string{}, err
	}

	var stored []string
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return []string{}, nil
	}
	disabled, _ := normalizeDisabledFeatures(stored)
	return disabled, nil
}

func normalizeDisabledFeatures(values []string) ([]string, bool) {
	seen := make(map[string]struct{}, len(values))
	disabled := make([]string, 0, len(values))
	for _, value := range values {
		if _, known := knownFeatures[value]; !known {
			return nil, false
		}
		if _, duplicate := seen[value]; duplicate {
			continue
		}
		seen[value] = struct{}{}
		disabled = append(disabled, value)
	}
	return disabled, true
}
