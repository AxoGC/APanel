import { apiFetch } from '@/lib/api'

export interface FirewallRule {
  numbers: number[]
  to: string
  action: string
  from: string
  protocol?: 'tcp' | 'udp'
  ipv4: boolean
  ipv6: boolean
}

export interface FirewallStatus {
  active: boolean
  rules: FirewallRule[]
}

export function getFirewallStatus() {
  return apiFetch<FirewallStatus>('/firewall/status')
}
