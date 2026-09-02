import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'

function actionClasses(action: string): string {
  if (action.startsWith('ALLOW')) return 'text-green-600 dark:text-green-400'
  if (action.startsWith('DENY') || action.startsWith('REJECT')) return 'text-red-600 dark:text-red-400'
  return 'text-gray-500' // LIMIT and anything else
}

// Each rule is one grid cell (a card); layout inside a card is flex-col of
// flex-row rows, matching the services/containers card grids.
export function FirewallGrid({ rules }: { rules: FirewallRule[] }) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {rules.map((rule) => (
        <div key={rule.number} className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="truncate text-sm text-gray-900 dark:text-gray-100">{rule.to}</span>
            <span className={cn('shrink-0 text-xs', actionClasses(rule.action))}>{rule.action}</span>
          </div>
          <div className="flex flex-row items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{t('firewall.from')}</span>
            <span className="truncate text-xs text-gray-500">{rule.from}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
