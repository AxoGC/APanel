import { apiFetch } from '@/lib/api'

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

export type ServiceActionName = 'start' | 'stop' | 'restart' | 'enable' | 'disable'

export function runServiceAction(name: string, action: ServiceActionName) {
  return apiFetch<null>(`/services/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
}
