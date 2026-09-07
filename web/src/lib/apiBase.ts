// Resolves where the API actually lives, and how to reach it, for the two
// build modes this app can ship as:
//
// - integrated (default `pnpm build`): embedded in the Go binary, always
//   same-origin. Every helper below degrades to exactly the relative
//   `/api/...` paths this app has always used — zero behavior change.
// - standalone (`pnpm build -- --mode standalone`, packaged by Tauri):
//   a desktop app that isn't served by any apanel instance — it talks to
//   a remote server address entered at login, over a cross-origin
//   connection authenticated with a bearer token instead of the session
//   cookie a same-origin browser tab would get (see lib/auth.tsx and the
//   backend's tokenFromRequest). credentials are explicitly omitted in
//   this mode — there's never a cookie worth sending.
export const isStandalone = import.meta.env.VITE_STANDALONE === 'true'

const SERVER_KEY = 'apanel:standalone-server'
const TOKEN_KEY = 'apanel:standalone-token'

export function getStoredServer(): string {
  return isStandalone ? (localStorage.getItem(SERVER_KEY) ?? '') : ''
}

export function setStoredServer(origin: string) {
  localStorage.setItem(SERVER_KEY, origin)
}

export function clearStoredServer() {
  localStorage.removeItem(SERVER_KEY)
}

export function getStoredToken(): string | null {
  return isStandalone ? localStorage.getItem(TOKEN_KEY) : null
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// Accepts a bare `host:port` (assumed http://) or a full `http(s)://...`
// URL, and normalizes it down to a scheme+host origin with no trailing
// slash — the shape every helper below concatenates `/api/...` onto.
export function normalizeServerAddress(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  return new URL(withScheme).origin
}

// '' in integrated mode, so `${apiOrigin()}/api/...` is just `/api/...`.
export function apiOrigin(): string {
  return isStandalone ? getStoredServer() : ''
}

function withToken(url: string): string {
  const token = getStoredToken()
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

// For WebSocket connections, which can't set an Authorization header — the
// token travels as a query param instead (see the backend's
// tokenFromRequest).
export function apiWsUrl(path: string): string {
  if (!isStandalone) {
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${scheme}//${window.location.host}/api${path}`
  }
  const origin = getStoredServer().replace(/^http/i, 'ws')
  return withToken(`${origin}/api${path}`)
}

// For EventSource connections and plain <a href>/navigation links (file
// downloads) — neither can set an Authorization header either, same
// query-param fallback as apiWsUrl.
export function apiLinkUrl(path: string): string {
  return withToken(`${apiOrigin()}/api${path}`)
}
