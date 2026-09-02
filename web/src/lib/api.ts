// Thin client for the backend's { code, error, data } response envelope.

export class ApiError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

interface Envelope<T> {
  code: string
  error?: string
  data?: T
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'same-origin',
  })
  const body = (await res.json()) as Envelope<T>
  if (body.code !== 'OK') {
    throw new ApiError(body.code, body.error)
  }
  return body.data as T
}
