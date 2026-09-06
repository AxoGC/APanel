import { apiFetch } from '@/lib/api'

export interface SystemInfo {
  hostname: string
  distro: string
  kernel: string
  arch: string
  bootTime: string
  uptimeSeconds: number
}

export function getSystemInfo() {
  return apiFetch<SystemInfo>('/system/info')
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
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
