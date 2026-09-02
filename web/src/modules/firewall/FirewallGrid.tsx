import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'
import { PORT_SERVICES } from './ports'

function actionClasses(action: string): string {
  if (action.startsWith('ALLOW')) return 'text-green-600 dark:text-green-400'
  if (action.startsWith('DENY') || action.startsWith('REJECT')) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500' // LIMIT and anything else
}

// Tag colors are fixed, not theme-derived — unlike the rest of the UI, this
// is a small closed set of protocol/family badges, so a stable color per
// tag (never affected by the user's theme-color choice) makes them easier
// to visually parse at a glance across rules. Text + background only, no
// border, per the same request.
const TAG_CLASSES: Record<string, string> = {
  TCP: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  UDP: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  IPv4: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  IPv6: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

function Tag({ label }: { label: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TAG_CLASSES[label])}>{label}</span>
}

function tagsFor(rule: FirewallRule): string[] {
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
function portNameFor(to: string): string | null {
  const numbers = to.match(/\d{1,5}/g)
  if (!numbers) return null
  const names = new Set<string>()
  for (const n of numbers) {
    const name = PORT_SERVICES[n]
    if (name) names.add(name)
  }
  return names.size > 0 ? Array.from(names).join(' / ') : null
}

// Each rule is one grid cell (a card); layout inside a card is flex-col of
// flex-row rows, matching the services/containers card grids.
export function FirewallGrid({ rules }: { rules: FirewallRule[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {rules.map((rule) => {
        const portName = portNameFor(rule.to)
        return (
          <div key={rule.numbers.join('-')} className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-sm text-gray-900 dark:text-gray-100">{rule.to}</span>
                {portName && <span className="shrink-0 text-xs text-gray-500">{portName}</span>}
              </div>
              <span className={cn('shrink-0 text-xs', actionClasses(rule.action))}>{rule.action}</span>
            </div>
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex shrink-0 items-center gap-1">
                {tagsFor(rule).map((label) => (
                  <Tag key={label} label={label} />
                ))}
              </div>
              <span className="truncate text-xs text-gray-500">{rule.from}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
