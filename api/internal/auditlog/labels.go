package auditlog

// actionLabels maps a mutating route's exact registered mux pattern (as
// returned by http.ServeMux.Handler, e.g. "POST /api/containers/{id}/restart")
// to a short key the frontend translates under "audit.action.<key>". A
// pattern with no entry here still gets recorded — Method and Path are
// always stored regardless (see Record) — the frontend just falls back to
// showing the raw method and path instead of a translated action name.
//
// This list has to be kept in sync by hand with every RegisterRoutes across
// the backend; there's no way to derive it automatically without coupling
// this package to every other one. Forgetting an entry degrades gracefully
// (see above), so it's a maintenance nuisance, not a correctness bug.
var actionLabels = map[string]string{
	"POST /api/login":  "auth.login",
	"POST /api/logout": "auth.logout",

	"POST /api/dashboard/processes/{pid}/terminate":      "process.terminate",
	"POST /api/dashboard/processes/{pid}/terminate-tree": "process.terminateTree",
	"PUT /api/dashboard/network-settings":                "dashboard.networkSettings",
	"PUT /api/status/features":                           "settings.enabledFeatures",
	"PUT /api/modules/{key}/dependency":                  "module.dependency",
	"POST /api/modules/{key}/dependency/enable-service":  "module.enableService",

	"POST /api/containers":                      "container.create",
	"POST /api/containers/images/delete":        "containerImage.delete",
	"POST /api/containers/networks/{id}/delete": "containerNetwork.delete",
	"POST /api/containers/volumes/delete":       "containerVolume.delete",
	"POST /api/containers/{id}/start":           "container.start",
	"POST /api/containers/{id}/stop":            "container.stop",
	"POST /api/containers/{id}/restart":         "container.restart",
	"POST /api/containers/{id}/delete":          "container.delete",

	"POST /api/services/{name}/start":   "service.start",
	"POST /api/services/{name}/stop":    "service.stop",
	"POST /api/services/{name}/restart": "service.restart",
	"POST /api/services/{name}/enable":  "service.enable",
	"POST /api/services/{name}/disable": "service.disable",

	"PUT /api/proxy/mode":                    "proxy.mode",
	"PUT /api/proxy/groups/{name}/selection": "proxy.selection",

	"POST /api/firewall/rules":   "firewall.addRule",
	"PUT /api/firewall/rules":    "firewall.updateRule",
	"DELETE /api/firewall/rules": "firewall.deleteRule",

	"PUT /api/files/content": "file.write",
	"POST /api/files/mkdir":  "file.mkdir",
	"POST /api/files/rename": "file.rename",
	"POST /api/files/delete": "file.delete",
	"POST /api/files/upload": "file.upload",

	"PUT /api/history/settings": "history.settings",

	"PUT /api/update/settings": "update.settings",
	"POST /api/update/check":   "update.check",

	"POST /api/users":        "user.create",
	"PUT /api/users/{id}":    "user.update",
	"DELETE /api/users/{id}": "user.delete",
}

func actionFor(pattern string) string {
	return actionLabels[pattern]
}
