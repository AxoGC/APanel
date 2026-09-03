import { apiFetch } from '@/lib/api'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  state: string
  status: string
}

export interface ContainerRef {
  id: string
  name: string
}

export interface ContainerImage {
  id: string
  name: string
  size: number
  usedBy: ContainerRef[]
}

export interface ContainerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  usedBy: ContainerRef[]
}

export type StatusFilter = 'running' | 'exited' | 'all'

export function listContainers(params: { status: StatusFilter; q: string }) {
  const search = new URLSearchParams({ status: params.status })
  if (params.q) search.set('q', params.q)
  return apiFetch<ContainerInfo[]>(`/containers?${search}`)
}

export function listContainerImages() {
  return apiFetch<ContainerImage[]>('/containers/images')
}

export function deleteContainerImages(ids: string[]) {
  return apiFetch<null>('/containers/images/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export function listContainerNetworks() {
  return apiFetch<ContainerNetwork[]>('/containers/networks')
}

export function deleteContainerNetwork(id: string) {
  return apiFetch<null>(`/containers/networks/${encodeURIComponent(id)}/delete`, { method: 'POST' })
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
