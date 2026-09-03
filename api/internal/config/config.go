// Package config reads apanel's startup configuration straight from the
// process environment. It has no opinion on where those variables come
// from — in production that's systemd's EnvironmentFile= (see
// deploy/apanel.service and deploy/config.example.env); in development
// it's whatever the caller exported before running the binary.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	ListenAddr string
	DSN        string

	// Password is startup-critical: it's read directly from the env, never
	// given a default.
	Password string

	// TLSCert/TLSKey let apanel terminate HTTPS itself instead of requiring
	// a reverse proxy in front of it. Both empty means plain HTTP — the
	// deployer is expected to put a TLS-terminating reverse proxy in front
	// in that case instead. Set together or not at all.
	TLSCert string
	TLSKey  string
}

const defaultDSN = "sqlite://./apanel.db"

func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr: os.Getenv("APANEL_LISTEN_ADDR"),
		DSN:        os.Getenv("APANEL_DSN"),
		Password:   os.Getenv("APANEL_PASSWORD"),
		TLSCert:    os.Getenv("APANEL_TLS_CERT"),
		TLSKey:     os.Getenv("APANEL_TLS_KEY"),
	}
	if cfg.ListenAddr == "" {
		cfg.ListenAddr = ":8080"
	}
	if cfg.DSN == "" {
		cfg.DSN = defaultDSN
	}
	if cfg.Password == "" {
		return nil, fmt.Errorf("APANEL_PASSWORD environment variable is required")
	}
	if (cfg.TLSCert == "") != (cfg.TLSKey == "") {
		return nil, fmt.Errorf("APANEL_TLS_CERT and APANEL_TLS_KEY must both be set, or neither")
	}
	return cfg, nil
}
