// Thin client for the backend's { code, error, data } response envelope.

import { apiOrigin, getStoredToken, isStandalone } from './apiBase'

export class ApiError extends Error {
  code: string
  // The envelope's optional free-text `error` field — extra, non-enum detail
  // (e.g. a driver error string) alongside `code`. Kept separate from
  // `message` so the global error dialog (see lib/errorFeedback.tsx) can
  // show a translated `code` up front and this raw text only behind a
  // collapsed "details" toggle.
  detail?: string
  constructor(code: string, detail?: string) {
    super(detail ?? code)
    this.code = code
    this.detail = detail
  }
}

type ErrorListener = (err: ApiError) => void
let errorListener: ErrorListener | null = null

// Set once by the app root's <ErrorFeedbackDialog/> so every failed request
// surfaces through one global, out-of-flow confirm dialog instead of each
// call site rendering its own inline error text. See lib/errorFeedback.tsx.
export function setApiErrorListener(listener: ErrorListener | null) {
  errorListener = listener
}

// For call sites that talk to the backend without apiFetch (e.g. a
// text/event-stream response, since apiFetch only speaks the plain
// {code,error,data} envelope) but still want a failure to surface through
// the same global error dialog as everything else.
export function reportApiError(err: ApiError) {
  errorListener?.(err)
}

interface Envelope<T> {
  code: string
  error?: string
  data?: T
}

// `silent: true` opts a call out of the global error dialog — for
// best-effort background probes (polling, dependency checks) and forms that
// already render their own dedicated error UI (e.g. the login form).
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  opts?: { silent?: boolean },
): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${apiOrigin()}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    credentials: isStandalone ? 'omit' : 'same-origin',
  })
  const body = (await res.json()) as Envelope<T>
  if (body.code !== 'OK') {
    const err = new ApiError(body.code, body.error)
    if (!opts?.silent) errorListener?.(err)
    throw err
  }
  return body.data as T
}
