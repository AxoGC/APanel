import { KeyRound, ListTree } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { listColumns, type ColumnInfo, type TableInfo } from './api'

function Tag({ children, tone }: { children: ReactNode; tone: 'nullable' | 'unique' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded border px-1 py-0.5 text-[10px] leading-none',
        tone === 'nullable'
          ? 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
          : 'border-theme-200 text-theme-600 dark:border-theme-800 dark:text-theme-400',
      )}
    >
      {children}
    </span>
  )
}

function displayName(table: TableInfo): string {
  return table.schema === 'public' ? table.name : `${table.schema}.${table.name}`
}

// Opens on any table (see TableList's action button); closing resets table
// back to null so re-opening the same table always refetches rather than
// showing stale columns — same lifecycle as ContainerDetailDialog.
export function ColumnsDialog({
  database,
  table,
  onOpenChange,
}: {
  database: string
  table: TableInfo | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null)

  useEffect(() => {
    if (table === null) return
    setColumns(null)
    listColumns(database, table.schema, table.name)
      .then(setColumns)
      .catch(() => {})
  }, [database, table])

  return (
    <SectionedDialog
      open={table !== null}
      onOpenChange={onOpenChange}
      title={table ? displayName(table) : t('database.columns.action')}
      className="sm:max-w-2xl"
      drawer
    >
      <div className="flex items-center gap-1 border-b border-gray-200 pb-1.5 md:gap-3 dark:border-gray-800">
        <div className="w-26 shrink-0 text-xs text-gray-500 md:w-32">{t('database.columns.name')}</div>
        <div className="min-w-0 flex-1 text-xs text-gray-500">{t('database.columns.type')}</div>
        <div className="w-18 shrink-0 text-xs text-gray-500 md:w-40">{t('database.columns.comment')}</div>
      </div>

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-900">
        {columns === null && <p className="px-2 py-4 text-sm text-gray-500">{t('database.columns.loading')}</p>}
        {columns && columns.length === 0 && (
          <p className="px-2 py-4 text-sm text-gray-500">{t('database.columns.empty')}</p>
        )}
        {columns?.map((col) => (
          <div key={col.name} className="flex items-center gap-1 py-2 md:gap-3">
            <div className="flex w-26 shrink-0 items-center gap-0.5 md:w-32 md:gap-1">
              <span className="truncate text-sm text-gray-900 dark:text-gray-100">{col.name}</span>
              {col.isPrimaryKey && (
                <KeyRound className="size-3.5 shrink-0 text-amber-500" aria-label={t('database.columns.primaryKey')} />
              )}
              {col.hasIndex && (
                <ListTree className="size-3.5 shrink-0 text-gray-400" aria-label={t('database.columns.indexed')} />
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-0.5 md:gap-1.5">
              <span className="truncate text-sm text-gray-700 dark:text-gray-300">{col.dataType}</span>
              {col.nullable && <Tag tone="nullable">{t('database.columns.nullable')}</Tag>}
              {col.isUnique && <Tag tone="unique">{t('database.columns.unique')}</Tag>}
            </div>
            <div className="w-18 shrink-0 truncate text-xs text-gray-500 md:w-40">{col.comment || '—'}</div>
          </div>
        ))}
      </div>
    </SectionedDialog>
  )
}
