package main

import (
	"log"
	"net/http"

	"apanel/internal/auth"
	"apanel/internal/config"
	"apanel/internal/db"
	"apanel/internal/httpserver"
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

	authSvc := auth.New(gormDB, cfg.Password)
	statsCollector := stats.NewCollector()
	server := httpserver.New(authSvc, statsCollector)

	log.Printf("apanel listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, server); err != nil {
		log.Fatalf("server: %v", err)
	}
}
