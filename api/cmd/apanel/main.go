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

	settingsMgr := settings.New(gormDB)
	historyMgr := history.New(settingsMgr)
	firewallMgr := firewall.New()
	filesMgr := files.New()

	authSvc, err := auth.New(gormDB, cfg.Password)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	statsCollector := stats.NewCollector()
	server := httpserver.New(authSvc, statsCollector, settingsMgr, services, containers, historyMgr, firewallMgr, filesMgr)

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
