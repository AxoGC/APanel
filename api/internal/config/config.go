// Package config loads apanel's startup configuration from environment
// variables, optionally pre-populated from a dotenv-style file (default
// /etc/apanel/config.env). Real environment variables always win over the
// file, matching godotenv's load semantics.
package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ListenAddr string
	DSN        string

	// Password is startup-critical: it's read directly from the env, never
	// given a default.
	Password string
}

const defaultConfigPath = "/etc/apanel/config.env"
const defaultDSN = "sqlite://./apanel.db"

func Load() (*Config, error) {
	path := os.Getenv("APANEL_CONFIG")
	if path == "" {
		path = defaultConfigPath
	}
	if _, err := os.Stat(path); err == nil {
		if err := godotenv.Load(path); err != nil {
			return nil, fmt.Errorf("read config %s: %w", path, err)
		}
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}

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
