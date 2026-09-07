import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { TableInfo } from './api'

function TableActions({ onViewSchema }: { onViewSchema: () => void }) {
  const { t } = useI18n()
  return (
    <Button variant="ghost" size="icon-sm" aria-label={t('database.columns.action')} title={t('database.columns.action')} onClick={onViewSchema}>
      <Columns3 />
    </Button>
  )
}

function displayName(table: TableInfo): string {
  return table.schema === 'public' ? table.name : `${table.schema}.${table.name}`
}

export function TableListHeader() {
  const { t } = useI18n()
  return (
    <div className="hidden items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800 md:flex">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('database.name')}</div>
      <div className="w-16 shrink-0 text-right text-xs text-gray-500">{t('database.columnCount')}</div>
      <div className="w-20 shrink-0 text-right text-xs text-gray-500">{t('database.rowCount')}</div>
      <div className="w-24 shrink-0 text-right text-xs text-gray-500">{t('database.usedSpace')}</div>
      <div className="w-9 shrink-0" />
    </div>
  )
}

export function TableList({
  tables,
  stats,
  onViewSchema,
}: {
  tables: TableInfo[]
  stats: Record<string, { rows: number; bytes: number }>
  onViewSchema: (table: TableInfo) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {tables.map((table) => {
        const key = `${table.schema}.${table.name}`
        const stat = stats[key]
        const rowsLabel = stat === undefined ? '…' : stat.rows.toLocaleString()
        const sizeLabel = stat === undefined ? '…' : formatBytes(stat.bytes)
        return (
          <div
            key={key}
            className="flex flex-col gap-2 px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 md:flex-row md:items-center md:gap-3 md:py-2"
          >
            <div className="hidden min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100 md:block">
              {displayName(table)}
            </div>
            <div className="hidden w-16 shrink-0 text-right text-xs text-gray-500 md:block">{table.columnCount}</div>
            <div className="hidden w-20 shrink-0 text-right text-xs text-gray-500 md:block">{rowsLabel}</div>
            <div className="hidden w-24 shrink-0 text-right text-xs text-gray-500 md:block">{sizeLabel}</div>
            <div className="hidden w-9 shrink-0 items-center justify-end md:flex">
              <TableActions onViewSchema={() => onViewSchema(table)} />
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                  {displayName(table)}
                </span>
                <span className="shrink-0 text-xs text-gray-500">
                  {t('database.columnCount.mobile', { n: table.columnCount })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-xs text-gray-500">
                    {t('database.rowCount.mobile', { n: rowsLabel })}
                  </span>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-xs text-gray-500">{t('database.usedSpace')}</span>
                    <span className="truncate text-xs text-gray-500">{sizeLabel}</span>
                  </div>
                </div>
                <TableActions onViewSchema={() => onViewSchema(table)} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
