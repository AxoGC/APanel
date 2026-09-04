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
// checkable dependency — a binary on PATH, a reachable local daemon (Docker,
// ufw, sysstat), or a reachable remote controller/instance (proxy's
// clash/mihomo controller, database's Postgres instance). httpserver's
// dependency endpoints type-assert for it the same way New type-asserts for
// RouteRegistrar.
type DependencyChecker interface {
	// Key identifies which module (see moduleOrder in status.go) this
	// check is for.
	Key() string
	CheckDependency(ctx context.Context) dependency.State
}
