import { apiFetch, ApiError, reportApiError } from '@/lib/api'
import { apiLinkUrl, apiOrigin, apiWsUrl, getStoredToken, isStandalone } from '@/lib/apiBase'

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

// What ContainerLogsDialog actually needs to identify and describe its
// target — satisfied by both the list's ContainerInfo rows and the fuller
// ContainerDetail returned right after creation, so the dialog can be
// opened from either without reshaping one into the other.
export type ContainerLogsTarget = Pick<ContainerInfo, 'id' | 'name' | 'state'>

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

// The container paths an image's Dockerfile declared with VOLUME — used to
// pre-fill the create-container form's mount rows. Best-effort: an
// unrecognized/still-being-typed ref just comes back empty, not an error.
export function listImageVolumes(ref: string) {
  return apiFetch<string[]>(`/containers/images/volumes?ref=${encodeURIComponent(ref)}`)
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
  return apiLinkUrl('/containers/volumes/stream')
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
  openStdin: boolean
}

export function getContainerDetail(id: string) {
  return apiFetch<ContainerDetail>(`/containers/${encodeURIComponent(id)}`)
}

export interface NewContainer {
  name: string
  image: string
  imageAutoUpdate: boolean
  tty: boolean
  openStdin: boolean
  networkMode: string
  restartPolicy: string
  cpuLimit: string
  memoryLimit: string
  env: string[]
  volumes: string[]
  ports: string[]
}

// When imageAutoUpdate is off, this is a plain create call. When it's on,
// the backend pulls the image first and streams progress back as
// text/event-stream instead of a single JSON envelope — onProgress reports
// each 0-100 update along the way so the caller can show it somewhere (the
// submit button, currently) instead of a plain spinner for however long the
// pull takes.
export async function createContainer(payload: NewContainer, onProgress?: (percent: number) => void) {
  if (!payload.imageAutoUpdate) {
    return apiFetch<{ id: string }>('/containers', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  const token = getStoredToken()
  const res = await fetch(`${apiOrigin()}/api/containers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: isStandalone ? 'omit' : 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok || !res.body) {
    const err = new ApiError('INTERNAL_ERROR')
    reportApiError(err)
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let id: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sepIndex: number
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sepIndex)
      buffer = buffer.slice(sepIndex + 2)
      const eventName = /^event: (.+)$/m.exec(chunk)?.[1] ?? 'message'
      const dataLine = /^data: (.*)$/m.exec(chunk)?.[1]
      const data = dataLine ? JSON.parse(dataLine) : {}
      if (eventName === 'failed') {
        const err = new ApiError('INTERNAL_ERROR', data.message)
        reportApiError(err)
        throw err
      }
      if (typeof data.percent === 'number') onProgress?.(data.percent)
      if (typeof data.id === 'string') id = data.id
    }
  }
  if (!id) {
    const err = new ApiError('INTERNAL_ERROR')
    reportApiError(err)
    throw err
  }
  return { id }
}

export function getContainerLogs(id: string, lines: number) {
  return apiFetch<string[]>(`/containers/${encodeURIComponent(id)}/logs?lines=${lines}`)
}

export function containerLogsStreamUrl(id: string, lines: number) {
  return apiLinkUrl(`/containers/${encodeURIComponent(id)}/logs/stream?lines=${lines}`)
}

export function containerAttachSocketUrl(id: string) {
  return apiWsUrl(`/containers/${encodeURIComponent(id)}/attach`)
}
