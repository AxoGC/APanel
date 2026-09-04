import { apiFetch } from '@/lib/api'

export type ProxyMode = 'global' | 'rule' | 'direct'

export interface ProxyOverview {
  mode: ProxyMode
  groups: string[]
}

export interface ProxyOption {
  name: string
  type: string
  delay: number
}

export interface ProxyGroup {
  name: string
  now: string
  options: ProxyOption[]
}

export interface ProxyDelayResult {
  name: string
  delay: number
}

export function getProxyOverview() {
  return apiFetch<ProxyOverview>('/proxy/overview')
}

export function setProxyMode(mode: ProxyMode) {
  return apiFetch<ProxyOverview>('/proxy/mode', {
    method: 'PUT',
    body: JSON.stringify({ mode }),
  })
}

export function getProxyGroup(name: string) {
  return apiFetch<ProxyGroup>(`/proxy/groups/${encodeURIComponent(name)}`)
}

export function selectProxyOption(group: string, name: string) {
  return apiFetch<ProxyGroup>(`/proxy/groups/${encodeURIComponent(group)}/selection`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export function proxyDelayStreamUrl(group: string) {
  return `/api/proxy/groups/${encodeURIComponent(group)}/test/stream`
}
