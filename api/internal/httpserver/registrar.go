package httpserver

import (
	"context"
	"net/http"
)

// RouteRegistrar is implemented by business packages that own a slice of
// the API (container, service, firewall, history, files, ...) — each one
// wires its own routes onto the shared mux itself. httpserver never imports
// these packages; it just calls RegisterRoutes on whatever it was handed at
// construction time (see New), so adding or removing a business package
// never touches this package.
type RouteRegistrar interface {
	RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler)
}

// Feature is implemented by registrars that are optional, host-dependent
// capabilities — containers need a reachable Docker daemon, history needs
// sysstat, firewall needs ufw. GET /api/status aggregates these into its
// per-feature availability map without needing to know which concrete
// packages provide them; a registrar that's always available (service,
// files) simply doesn't implement this.
type Feature interface {
	RouteRegistrar
	FeatureName() string
	Available(ctx context.Context) bool
}
