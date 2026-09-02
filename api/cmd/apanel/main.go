package main

import (
	"context"
	"log"
	"net/http"

	"apanel/internal/auth"
	"apanel/internal/config"
	"apanel/internal/container"
	"apanel/internal/db"
	"apanel/internal/history"
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

	containers, err := container.New()
	if err != nil {
		log.Fatalf("docker: %v", err)
	}

	historyMgr := history.New()

	authSvc := auth.New(gormDB, cfg.Password)
	statsCollector := stats.NewCollector()
	server := httpserver.New(authSvc, statsCollector, services, containers, historyMgr)

	log.Printf("apanel listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, server); err != nil {
		log.Fatalf("server: %v", err)
	}
}
