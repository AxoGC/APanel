// Package config loads apanel's startup configuration: env vars for
// secrets/critical settings, an optional YAML file for everything else.
package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	ListenAddr string `yaml:"listen_addr"`
	DSN        string `yaml:"dsn"`

	// Password is startup-critical and never read from the config file.
	Password string `yaml:"-"`
}

const defaultConfigPath = "/etc/apanel/config.yaml"
const defaultDSN = "sqlite://./apanel.db"

func Load() (*Config, error) {
	cfg := &Config{
		ListenAddr: ":8080",
	}

	path := os.Getenv("APANEL_CONFIG")
	if path == "" {
		path = defaultConfigPath
	}
	if data, err := os.ReadFile(path); err == nil {
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("parse config %s: %w", path, err)
		}
	} else if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}

	cfg.Password = os.Getenv("APANEL_PASSWORD")
	if cfg.Password == "" {
		return nil, fmt.Errorf("APANEL_PASSWORD environment variable is required")
	}
	if cfg.DSN == "" {
		cfg.DSN = defaultDSN
	}
	return cfg, nil
}
