import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FirewallRule } from './api'
import { actionClasses, actionLabel, portNameFor, tagsFor } from './format'

const TAG_CLASSES: Record<string, string> = {
  TCP: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  UDP: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  IPv4: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  IPv6: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
}

function Tag({ label }: { label: string }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TAG_CLASSES[label])}>{label}</span>
}

function FirewallActions({ rule, busy, onEdit, onDelete }: {
  rule: FirewallRule
  busy: boolean
  onEdit: (rule: FirewallRule) => void
  onDelete: (rule: FirewallRule) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t('firewall.editRule')} disabled={busy} onClick={() => onEdit(rule)}><Pencil /></Button>
      <ConfirmIconButton
        icon={busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
        label={t('firewall.deleteRule')}
        actionLabel={t('firewall.deleteRule')}
        title={t('firewall.confirmDelete.title')}
        description={<><span className="font-medium text-gray-700 dark:text-gray-300">{rule.to}</span>{' — '}{t('firewall.confirmDelete.description')}</>}
        disabled={busy}
        onConfirm={() => onDelete(rule)}
      />
    </>
  )
}

export function FirewallTable({ rules, deleting, onEdit, onDelete, hideHeader = false }: {
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
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {rules.map((rule) => {
          const key = rule.numbers.join('-')
          const portName = portNameFor(rule.to)
          const busy = !!deleting[key]
          const tags = tagsFor(rule)
          return (
            <div key={key} className="flex flex-col gap-2 px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 md:flex-row md:items-center md:gap-3 md:py-2">
              <div className="hidden min-w-0 flex-1 items-baseline gap-1.5 md:flex"><span className="truncate text-sm text-gray-900 dark:text-gray-100">{rule.to}</span>{portName && <span className="shrink-0 text-xs text-gray-500">{portName}</span>}</div>
              <div className="hidden w-32 shrink-0 items-center gap-1 md:flex">{tags.map((label) => <Tag key={label} label={label} />)}</div>
              <div className="hidden min-w-0 flex-1 truncate text-xs text-gray-500 md:block">{rule.from}</div>
              <div className={cn('hidden w-20 shrink-0 text-right text-xs md:block', actionClasses(rule.action))}>{actionLabel(rule.action, t)}</div>
              <div className="hidden w-16 shrink-0 items-center justify-end gap-0.5 md:flex"><FirewallActions rule={rule} busy={busy} onEdit={onEdit} onDelete={onDelete} /></div>

              <div className="flex flex-col gap-2 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="truncate text-sm text-gray-900 dark:text-gray-100">{rule.to}</span>
                    {portName && <span className="shrink-0 text-xs text-gray-500">{portName}</span>}
                  </div>
                  <div className="flex min-w-0 shrink items-center gap-1.5">
                    {rule.from !== 'Anywhere' && <span className="min-w-0 truncate text-xs text-gray-500">{rule.from}</span>}
                    <span className={cn('shrink-0 text-xs', actionClasses(rule.action))}>{actionLabel(rule.action, t)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex shrink-0 items-center gap-1">{tags.map((label) => <Tag key={label} label={label} />)}</div>
                  <div className="flex items-center justify-end gap-0.5"><FirewallActions rule={rule} busy={busy} onEdit={onEdit} onDelete={onDelete} /></div>
                </div>
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
    <div className="hidden items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800 md:flex">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.to')}</div>
      <div className="w-32 shrink-0 text-xs text-gray-500">{t('firewall.tags')}</div>
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('firewall.addRule.from')}</div>
      <div className="w-20 shrink-0 text-right text-xs text-gray-500">{t('firewall.addRule.action')}</div>
      <div className="w-16 shrink-0" />
    </div>
  )
}
