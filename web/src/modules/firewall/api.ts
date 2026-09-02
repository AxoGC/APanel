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

export interface NewFirewallRule {
  action: 'allow' | 'deny' | 'reject' | 'limit'
  from: string
  port: string
  protocol: 'any' | 'tcp' | 'udp'
  family: 'any' | 'ipv4' | 'ipv6'
}

export function addFirewallRule(rule: NewFirewallRule) {
  return apiFetch<FirewallStatus>('/firewall/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  })
}
