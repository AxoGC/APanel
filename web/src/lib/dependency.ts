import { apiFetch } from './api'
import type { DependencyModuleKey } from './modules'

export type DependencyField = 'host' | 'port' | 'url' | 'username' | 'password'
export type DependencyReason = 'unavailable' | 'serviceInactive' | 'unconfigured'

export interface DependencyStatus {
  key: DependencyModuleKey
  healthy: boolean
  reason?: DependencyReason
  serviceName?: string
  fields: DependencyField[]
  requiredFields: DependencyField[]
  config: Record<string, string>
  docsUrl: string
}

// silent: this is a background health probe fired whenever a module page
// mounts or its dependency dialog opens, not a user-initiated action — a
// failure here surfaces as the dialog's own "unhealthy" state, not a global
// error popup.
export function getModuleDependency(key: DependencyModuleKey) {
  return apiFetch<DependencyStatus>(`/modules/${key}/dependency`, undefined, { silent: true })
}

export function putModuleDependency(key: DependencyModuleKey, config: Record<string, string>) {
  return apiFetch<DependencyStatus>(`/modules/${key}/dependency`, {
    method: 'PUT',
    body: JSON.stringify({ config }),
  })
}

export function enableModuleDependencyService(key: DependencyModuleKey) {
  return apiFetch<DependencyStatus>(`/modules/${key}/dependency/enable-service`, { method: 'POST' })
}
