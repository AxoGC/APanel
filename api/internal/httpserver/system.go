package httpserver

import (
	"net/http"
	"time"

	"apanel/internal/response"
	"apanel/internal/sysinfo"
)

type systemInfoResponse struct {
	Hostname      string    `json:"hostname"`
	Distro        string    `json:"distro"`
	Kernel        string    `json:"kernel"`
	Arch          string    `json:"arch"`
	BootTime      time.Time `json:"bootTime"`
	UptimeSeconds float64   `json:"uptimeSeconds"`
}

func (s *Server) getSystemInfo(w http.ResponseWriter, r *http.Request) {
	info, err := sysinfo.Get()
	if err != nil {
		response.WriteInternalError(w, err)
		return
	}
	response.WriteOK(w, systemInfoResponse{
		Hostname:      info.Hostname,
		Distro:        info.Distro,
		Kernel:        info.Kernel,
		Arch:          info.Arch,
		BootTime:      info.BootTime,
		UptimeSeconds: time.Since(info.BootTime).Seconds(),
	})
}
