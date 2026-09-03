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
  fromIPv4: string
  fromIPv6: string
  port: string
  protocol: 'any' | 'tcp' | 'udp'
  ipv4: boolean
  ipv6: boolean
}

export function addFirewallRule(rule: NewFirewallRule) {
  return apiFetch<FirewallStatus>('/firewall/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  })
}

export function updateFirewallRule(numbers: number[], rule: NewFirewallRule) {
  return apiFetch<FirewallStatus>('/firewall/rules', {
    method: 'PUT',
    body: JSON.stringify({ numbers, ...rule }),
  })
}

export function deleteFirewallRule(numbers: number[]) {
  return apiFetch<FirewallStatus>('/firewall/rules', {
    method: 'DELETE',
    body: JSON.stringify({ numbers }),
  })
}
