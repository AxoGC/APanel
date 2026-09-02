import { apiFetch } from '@/lib/api'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  state: string
  status: string
}

export type StatusFilter = 'running' | 'exited' | 'all'

export function listContainers(params: { status: StatusFilter; q: string }) {
  const search = new URLSearchParams({ status: params.status })
  if (params.q) search.set('q', params.q)
  return apiFetch<ContainerInfo[]>(`/containers?${search}`)
}

export type ContainerActionName = 'start' | 'stop' | 'restart'

export function runContainerAction(id: string, action: ContainerActionName) {
  return apiFetch<null>(`/containers/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
}

export function getContainerLogs(id: string, lines: number) {
  return apiFetch<string[]>(`/containers/${encodeURIComponent(id)}/logs?lines=${lines}`)
}

export function containerLogsStreamUrl(id: string, lines: number) {
  return `/api/containers/${encodeURIComponent(id)}/logs/stream?lines=${lines}`
}
