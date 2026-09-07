import { apiFetch } from '@/lib/api'
import { apiLinkUrl } from '@/lib/apiBase'

export interface ServiceUnit {
  name: string
  description: string
  loadState: string
  activeState: string
  subState: string
  unitFileState: string
}

export type StatusFilter = 'running' | 'failed' | 'stopped' | 'all'

export function listServices(params: { status: StatusFilter; q: string }) {
  const search = new URLSearchParams({ status: params.status })
  if (params.q) search.set('q', params.q)
  return apiFetch<ServiceUnit[]>(`/services?${search}`)
}

export function serviceEnablementStreamUrl() {
  return apiLinkUrl('/services/enablement/stream')
}

export type ServiceActionName = 'start' | 'stop' | 'restart' | 'enable' | 'disable'

export function runServiceAction(name: string, action: ServiceActionName) {
  return apiFetch<null>(`/services/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
}

export interface ServiceDetail {
  name: string
  description: string
  loadState: string
  activeState: string
  subState: string
  unitFileState: string
  fragmentPath: string
  mainPid: number
  exitCode: number
  activeSince: string | null
  restartPolicy: string
  user: string
  workingDirectory: string
  memoryCurrentBytes: number | null
  requires: string[] | null
  after: string[] | null
}

export function getServiceDetail(name: string) {
  return apiFetch<ServiceDetail>(`/services/${encodeURIComponent(name)}`)
}

export function getServiceLogs(name: string, lines: number) {
  return apiFetch<string[]>(`/services/${encodeURIComponent(name)}/logs?lines=${lines}`)
}

export function serviceLogsStreamUrl(name: string, lines: number) {
  return apiLinkUrl(`/services/${encodeURIComponent(name)}/logs/stream?lines=${lines}`)
}
