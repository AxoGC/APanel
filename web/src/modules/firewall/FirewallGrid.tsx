import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'
import { actionClasses, portNameFor, tagsFor } from './format'

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

export function Tag({ label }: { label: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TAG_CLASSES[label])}>{label}</span>
}

// Each rule is one grid cell (a card), matching the services/containers card
// grids. The container uses the classic gap-px + background trick so a 1px
// gray-100 line shows through between cells in both directions without
// needing per-cell border bookkeeping across the responsive column-count
// breakpoints.
export function FirewallGrid({
  rules,
  deleting,
  onEdit,
  onDelete,
}: {
  rules: FirewallRule[]
  deleting: Record<string, boolean>
  onEdit: (rule: FirewallRule) => void
  onDelete: (rule: FirewallRule) => void
}) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 dark:bg-gray-800">
      {rules.map((rule) => {
        const key = rule.numbers.join('-')
        const portName = portNameFor(rule.to)
        const busy = deleting[key]
        return (
          <div key={key} className="flex flex-col gap-2 bg-background p-4 hover:bg-gray-100 dark:hover:bg-gray-800">
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
            <div className="flex flex-row items-center justify-end gap-0.5">
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
  )
}
