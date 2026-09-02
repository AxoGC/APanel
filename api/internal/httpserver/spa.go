package httpserver

import (
	"io/fs"
	"net/http"
)

// spaHandler serves files from dist, falling back to index.html for any
// path that doesn't match a real file so client-side routing works on
// hard reload / deep links.
func spaHandler(dist fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "/index.html"
		}
		if f, err := dist.Open(path[1:]); err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
