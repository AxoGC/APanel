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
