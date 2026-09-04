package httpserver

import (
	"context"
	"net/http"

	"apanel/internal/dependency"
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

// DependencyChecker is implemented by registrars whose module has a
// checkable local dependency (a binary on PATH, a reachable local daemon —
// Docker, ufw, sysstat). httpserver's dependency endpoints type-assert for
// it the same way New type-asserts for RouteRegistrar; a registrar that
// doesn't implement it (proxy, database — no backend package yet) simply
// has no live probe, and its status is derived from whether connection
// settings have been saved instead (see dependency.go).
type DependencyChecker interface {
	// Key identifies which module (see moduleOrder in status.go) this
	// check is for.
	Key() string
	CheckDependency(ctx context.Context) dependency.State
}
