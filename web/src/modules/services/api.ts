import { apiFetch } from '@/lib/api'

export interface ServiceUnit {
  name: string
  description: string
  loadState: string
  activeState: string
  subState: string
  unitFileState: string
}

export function listServices() {
  return apiFetch<ServiceUnit[]>('/services')
}

export type ServiceActionName = 'start' | 'stop' | 'restart' | 'enable' | 'disable'

export function runServiceAction(name: string, action: ServiceActionName) {
  return apiFetch<null>(`/services/${encodeURIComponent(name)}/${action}`, { method: 'POST' })
}
