import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'
import { actionClasses, portNameFor, tagsFor } from './format'
import { Tag } from './FirewallGrid'

// Row-based rather than a literal <table> — matches the app's own
// object-array-data convention (see ProcessGrid) — with a gray-200 divider
// under the header and gray-100 dividers between rows.
export function FirewallTable({ rules }: { rules: FirewallRule[] }) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800">
        <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.to')}</div>
        <div className="w-32 shrink-0 text-xs text-gray-500">{t('firewall.tags')}</div>
        <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.addRule.from')}</div>
        <div className="w-20 shrink-0 text-right text-xs text-gray-500">{t('firewall.addRule.action')}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rules.map((rule) => {
          const portName = portNameFor(rule.to)
          return (
            <div key={rule.numbers.join('-')} className="flex items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                <span className="truncate text-sm text-gray-900 dark:text-gray-100">{rule.to}</span>
                {portName && <span className="shrink-0 text-xs text-gray-500">{portName}</span>}
              </div>

              <div className="flex w-32 shrink-0 items-center gap-1">
                {tagsFor(rule).map((label) => (
                  <Tag key={label} label={label} />
                ))}
              </div>

              <div className="min-w-0 flex-1 truncate text-xs text-gray-500">{rule.from}</div>

              <div className={cn('w-20 shrink-0 text-right text-xs', actionClasses(rule.action))}>{rule.action}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
