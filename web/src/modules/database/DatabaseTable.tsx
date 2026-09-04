import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { DatabaseInfo } from './api'

function DatabaseActions() {
  const { t } = useI18n()
  // Placeholder only — real per-database actions (drop, backup, ...) come
  // later; this stage is view-only.
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t('database.actions')} disabled>
      <MoreHorizontal />
    </Button>
  )
}

export function DatabaseTableHeader() {
  const { t } = useI18n()
  return (
    <div className="hidden items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800 md:flex">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('database.name')}</div>
      <div className="w-20 shrink-0 text-right text-xs text-gray-500">{t('database.tableCount')}</div>
      <div className="w-24 shrink-0 text-right text-xs text-gray-500">{t('database.usedSpace')}</div>
      <div className="w-9 shrink-0" />
    </div>
  )
}

export function DatabaseTable({
  databases,
  sizes,
  onSelect,
}: {
  databases: DatabaseInfo[]
  sizes: Record<string, number>
  onSelect: (name: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {databases.map((database) => {
        const size = sizes[database.name]
        const sizeLabel = size === undefined ? '…' : formatBytes(size)
        return (
          <div
            key={database.name}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(database.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(database.name)
              }
            }}
            className="flex cursor-pointer flex-col gap-2 px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 md:flex-row md:items-center md:gap-3 md:py-2"
          >
            <div className="hidden min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100 md:block">
              {database.name}
            </div>
            <div className="hidden w-20 shrink-0 text-right text-xs text-gray-500 md:block">{database.tableCount}</div>
            <div className="hidden w-24 shrink-0 text-right text-xs text-gray-500 md:block">{sizeLabel}</div>
            <div className="hidden w-9 shrink-0 items-center justify-end md:flex">
              <DatabaseActions />
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{database.name}</span>
                <span className="shrink-0 text-xs text-gray-500">
                  {t('database.tableCount.mobile', { n: database.tableCount })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-gray-500">{t('database.usedSpace')}</span>
                  <span className="truncate text-xs text-gray-500">{sizeLabel}</span>
                </div>
                <DatabaseActions />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
