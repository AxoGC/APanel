package httpserver

import "net/http"

// RouteRegistrar is implemented by business packages that own a slice of
// the API (container, service, firewall, history, files, ...) — each one
// wires its own routes onto the shared mux itself. httpserver never imports
// these packages; it just calls RegisterRoutes on whatever it was handed at
// construction time (see New), so adding or removing a business package
// never touches this package.
type RouteRegistrar interface {
	RegisterRoutes(mux *http.ServeMux, requireAuth func(http.Handler) http.Handler)
}
