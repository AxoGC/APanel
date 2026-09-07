import { apiOrigin, isStandalone } from './apiBase'

/** localhost/127.0.0.1 are treated as secure contexts (dev convenience);
 * everything else must be HTTPS, per plan: the operator sets up TLS
 * (directly or via a reverse proxy) before apanel lets them log in.
 *
 * In the standalone build, the Tauri webview itself is always a secure
 * context regardless of the scheme of the remote server it's actually
 * talking to — window.location reflects the app's own local origin, not
 * the API's, so this checks the stored server address instead. */
export function isSecureContext(): boolean {
  if (isStandalone) {
    const origin = apiOrigin()
    if (!origin) return true // no server configured yet — nothing to warn about
    const { protocol, hostname } = new URL(origin)
    return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
  }
  const { protocol, hostname } = window.location
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
}
