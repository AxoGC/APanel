import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'
import { actionClasses, portNameFor, tagsFor } from './format'
import { Tag } from './FirewallGrid'

// Row-based rather than a literal <table> — matches the app's own
// object-array-data convention (see ProcessGrid) — with a gray-200 divider
// under the header and gray-100 dividers between rows.
export function FirewallTable({
  rules,
  deleting,
  onEdit,
  onDelete,
  hideHeader = false,
}: {
  rules: FirewallRule[]
  deleting: Record<string, boolean>
  onEdit: (rule: FirewallRule) => void
  onDelete: (rule: FirewallRule) => void
  hideHeader?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col">
      {!hideHeader && <FirewallTableHeader />}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rules.map((rule) => {
          const key = rule.numbers.join('-')
          const portName = portNameFor(rule.to)
          const busy = deleting[key]
          return (
            <div key={key} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800">
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

              <div className="flex w-16 shrink-0 items-center justify-end gap-0.5">
                <Button variant="ghost" size="icon-sm" aria-label={t('firewall.editRule')} disabled={busy} onClick={() => onEdit(rule)}>
                  <Pencil />
                </Button>
                <ConfirmIconButton
                  icon={busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  label={t('firewall.deleteRule')}
                  actionLabel={t('firewall.deleteRule')}
                  title={t('firewall.confirmDelete.title')}
                  description={
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{rule.to}</span>
                      {' — '}
                      {t('firewall.confirmDelete.description')}
                    </>
                  }
                  disabled={busy}
                  onConfirm={() => onDelete(rule)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FirewallTableHeader() {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.to')}</div>
      <div className="w-32 shrink-0 text-xs text-gray-500">{t('firewall.tags')}</div>
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.addRule.from')}</div>
      <div className="w-20 shrink-0 text-right text-xs text-gray-500">{t('firewall.addRule.action')}</div>
      <div className="w-16 shrink-0" />
    </div>
  )
}
