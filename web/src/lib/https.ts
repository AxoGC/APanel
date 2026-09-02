/** localhost/127.0.0.1 are treated as secure contexts (dev convenience);
 * everything else must be HTTPS, per plan: the operator sets up TLS
 * (directly or via a reverse proxy) before apanel lets them log in. */
export function isSecureContext(): boolean {
  const { protocol, hostname } = window.location
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'
}
