// Package config reads apanel's startup configuration straight from the
// process environment. It has no opinion on where those variables come
// from — in production that's Environment= lines inlined directly into
// deploy/apanel.service (there is no config file to edit); in development
// it's whatever the caller exported before running the binary.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	// ListenAddr defaults to :8123. Override it by adding an
	// Environment=APANEL_LISTEN_ADDR=... line to the systemd unit.
	ListenAddr string

	// TLSCert/TLSKey let apanel terminate HTTPS itself instead of requiring
	// a reverse proxy in front of it. Both empty means plain HTTP — the
	// deployer is expected to put a TLS-terminating reverse proxy in front
	// in that case instead. Set together or not at all.
	TLSCert string
	TLSKey  string
}

const defaultListenAddr = ":8123"

func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr: os.Getenv("APANEL_LISTEN_ADDR"),
		TLSCert:    os.Getenv("APANEL_TLS_CERT"),
		TLSKey:     os.Getenv("APANEL_TLS_KEY"),
	}
	if cfg.ListenAddr == "" {
		cfg.ListenAddr = defaultListenAddr
	}
	if (cfg.TLSCert == "") != (cfg.TLSKey == "") {
		return nil, fmt.Errorf("APANEL_TLS_CERT and APANEL_TLS_KEY must both be set, or neither")
	}
	return cfg, nil
}
