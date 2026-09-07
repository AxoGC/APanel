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

export interface ContainerVolume {
  name: string
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

export function listContainerImageTags() {
  return apiFetch<string[]>('/containers/images/tags')
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

export function listContainerVolumes() {
  return apiFetch<ContainerVolume[]>('/containers/volumes')
}

export function containerVolumeSizeStreamUrl() {
  return '/api/containers/volumes/stream'
}

export function deleteContainerVolumes(names: string[]) {
  return apiFetch<null>('/containers/volumes/delete', {
    method: 'POST',
    body: JSON.stringify({ names }),
  })
}

export type ContainerActionName = 'start' | 'stop' | 'restart' | 'delete'

export function runContainerAction(id: string, action: ContainerActionName) {
  return apiFetch<null>(`/containers/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
}

export interface ContainerDetail {
  id: string
  name: string
  image: string
  command: string
  created: string
  state: string
  exitCode: number
  startedAt: string | null
  restartPolicy: string
  platform: string
  networks: string[] | null
  ports: string[] | null
  mounts: string[] | null
  env: string[] | null
}

export function getContainerDetail(id: string) {
  return apiFetch<ContainerDetail>(`/containers/${encodeURIComponent(id)}`)
}

export interface NewContainer {
  name: string
  image: string
  tty: boolean
  openStdin: boolean
  networkMode: string
  restartPolicy: string
  env: string[]
  volumes: string[]
}

export function createContainer(payload: NewContainer) {
  return apiFetch<{ id: string }>('/containers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getContainerLogs(id: string, lines: number) {
  return apiFetch<string[]>(`/containers/${encodeURIComponent(id)}/logs?lines=${lines}`)
}

export function containerLogsStreamUrl(id: string, lines: number) {
  return `/api/containers/${encodeURIComponent(id)}/logs/stream?lines=${lines}`
}

export function containerAttachSocketUrl(id: string) {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/containers/${encodeURIComponent(id)}/attach`
}
