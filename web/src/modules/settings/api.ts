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
