import { apiFetch } from '@/lib/api'

export interface SystemInfo {
  hostname: string
  distro: string
  kernel: string
  arch: string
  bootTime: string
  uptimeSeconds: number
}

// silent: background best-effort fetch for the settings page header; a
// failure just leaves the fields at their placeholder dashes.
export function getSystemInfo() {
  return apiFetch<SystemInfo>('/system/info', undefined, { silent: true })
}

export interface DiskPartition {
  device: string
  mountPoint: string
  fsType: string
  totalBytes: number
  usedBytes: number
  availBytes: number
}

export function getDiskUsage() {
  return apiFetch<DiskPartition[]>('/system/disk', undefined, { silent: true })
}

export interface UpdateSettings {
  enabled: boolean
  source: string
}

export interface UpdateCheckResult {
  at: string
  latestVersion?: string
  updateAvailable: boolean
  error?: string
}

export interface UpdateStatus {
  currentVersion: string
  settings: UpdateSettings
  lastCheck?: UpdateCheckResult
  applying: boolean
}

export function getUpdateStatus() {
  return apiFetch<UpdateStatus>('/update/status')
}

export function putUpdateSettings(settings: UpdateSettings) {
  return apiFetch<UpdateStatus>('/update/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function checkForUpdate() {
  return apiFetch<UpdateStatus>('/update/check', { method: 'POST' })
}
