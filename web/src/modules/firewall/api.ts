import { apiFetch } from '@/lib/api'

export interface FirewallRule {
  number: number
  to: string
  action: string
  from: string
}

export interface FirewallStatus {
  active: boolean
  rules: FirewallRule[]
}

export function getFirewallStatus() {
  return apiFetch<FirewallStatus>('/firewall/status')
}
