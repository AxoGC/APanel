import type { FirewallRule } from './api'
import { PORT_SERVICES } from './ports'

export function actionClasses(action: string): string {
  if (action.startsWith('ALLOW')) return 'text-green-600 dark:text-green-400'
  if (action.startsWith('DENY') || action.startsWith('REJECT')) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500' // LIMIT and anything else
}

export function tagsFor(rule: FirewallRule): string[] {
  const tags: string[] = []
  if (rule.protocol === 'tcp') tags.push('TCP')
  if (rule.protocol === 'udp') tags.push('UDP')
  if (rule.ipv4) tags.push('IPv4')
  if (rule.ipv6) tags.push('IPv6')
  return tags
}

// rule.to is ufw's own text for the rule's destination — a bare port, a
// port range ("6000:6007"), comma-separated ports, or a named
// service/"Anywhere" with no port at all. Pulling out every number and
// looking each up covers all of those without parsing the specific shape.
export function portNameFor(to: string): string | null {
  const numbers = to.match(/\d{1,5}/g)
  if (!numbers) return null
  const names = new Set<string>()
  for (const n of numbers) {
    const name = PORT_SERVICES[n]
    if (name) names.add(name)
  }
  return names.size > 0 ? Array.from(names).join(' / ') : null
}
