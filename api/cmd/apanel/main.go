package main

import (
	"context"
	"log"
	"net/http"

	"apanel/internal/auth"
	"apanel/internal/config"
	"apanel/internal/db"
	"apanel/internal/httpserver"
	"apanel/internal/service"
	"apanel/internal/stats"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	gormDB, err := db.Open(cfg.DSN)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	services, err := service.New(context.Background())
	if err != nil {
		log.Fatalf("systemd: %v", err)
	}

	authSvc := auth.New(gormDB, cfg.Password)
	statsCollector := stats.NewCollector()
	server := httpserver.New(authSvc, statsCollector, services)

	log.Printf("apanel listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, server); err != nil {
		log.Fatalf("server: %v", err)
	}
}
