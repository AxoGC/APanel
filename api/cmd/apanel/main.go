package main

import (
	"context"
	"log"
	"net/http"

	"apanel/internal/auth"
	"apanel/internal/config"
	"apanel/internal/container"
	"apanel/internal/db"
	"apanel/internal/files"
	"apanel/internal/firewall"
	"apanel/internal/history"
	"apanel/internal/httpserver"
	"apanel/internal/service"
	"apanel/internal/settings"
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
	firewallMgr := firewall.New()
	filesMgr := files.New()

	authSvc := auth.New(gormDB, cfg.Password)
	statsCollector := stats.NewCollector()
	settingsMgr := settings.New(gormDB)
	server := httpserver.New(authSvc, statsCollector, services, containers, historyMgr, firewallMgr, filesMgr, settingsMgr)

	if cfg.TLSCert != "" {
		log.Printf("apanel listening on %s (https)", cfg.ListenAddr)
		err = http.ListenAndServeTLS(cfg.ListenAddr, cfg.TLSCert, cfg.TLSKey, server)
	} else {
		log.Printf("apanel listening on %s (http)", cfg.ListenAddr)
		err = http.ListenAndServe(cfg.ListenAddr, server)
	}
	if err != nil {
		log.Fatalf("server: %v", err)
	}
}
