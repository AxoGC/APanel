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
}

const defaultDSN = "sqlite://./apanel.db"

func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr: os.Getenv("APANEL_LISTEN_ADDR"),
		DSN:        os.Getenv("APANEL_DSN"),
		Password:   os.Getenv("APANEL_PASSWORD"),
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
	return cfg, nil
}
