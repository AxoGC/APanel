package main

import (
	"context"
	"log"
	"net/http"

	"apanel/internal/auditlog"
	"apanel/internal/auth"
	"apanel/internal/config"
	"apanel/internal/container"
	"apanel/internal/database"
	"apanel/internal/db"
	"apanel/internal/files"
	"apanel/internal/firewall"
	"apanel/internal/history"
	"apanel/internal/httpserver"
	"apanel/internal/proxy"
	"apanel/internal/service"
	"apanel/internal/settings"
	"apanel/internal/stats"
	"apanel/internal/update"
	"apanel/internal/users"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	sqliteDB, err := db.Open()
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

	settingsMgr := settings.New(sqliteDB)
	historyMgr := history.New(settingsMgr)
	firewallMgr := firewall.New()
	filesMgr := files.New()
	proxyMgr := proxy.New(settingsMgr)
	databaseMgr := database.New(settingsMgr)
	updateMgr := update.New(settingsMgr)
	updateMgr.Start(context.Background())
	usersMgr := users.New(sqliteDB)
	auditMgr := auditlog.New(sqliteDB, settingsMgr)

	authSvc, err := auth.New(sqliteDB, usersMgr, auditMgr)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}
	statsCollector := stats.NewCollector()
	server := httpserver.New(authSvc, statsCollector, settingsMgr, auditMgr, services, containers, historyMgr, firewallMgr, filesMgr, proxyMgr, databaseMgr, updateMgr, usersMgr)

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
