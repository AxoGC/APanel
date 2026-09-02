import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Gauge } from './Gauge'
import { ProcessGrid } from './ProcessGrid'
import { useDashboardStream, type ProcessSort } from './useDashboardStream'

export default function DashboardPage() {
  const { t } = useI18n()
  const [sort, setSort] = useState<ProcessSort>('mem')
  const [tree, setTree] = useState(true)
  const overview = useDashboardStream(sort)

  const memPercent = overview ? (overview.memUsed / overview.memTotal) * 100 : 0

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-base text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <Gauge
          label={t('dashboard.cpu')}
          value={overview?.cpuPercent ?? 0}
          percentText={overview ? formatPercent(overview.cpuPercent) : '–'}
        />
        <Gauge
          label={t('dashboard.memory')}
          value={memPercent}
          percentText={overview ? formatPercent(memPercent) : '–'}
          details={
            overview
              ? [
                  `${formatBytes(overview.memUsed)} / ${formatBytes(overview.memTotal)}`,
                  `${t('dashboard.swap')} ${formatBytes(overview.swapUsed)} / ${formatBytes(overview.swapTotal)}`,
                ]
              : undefined
          }
        />
      </div>

      <div className="flex min-h-0 grow flex-col">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">{t('dashboard.processes')}</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-pressed={tree}
              onClick={() => setTree((v) => !v)}
              className={cn(
                'cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors',
                tree
                  ? 'border-theme-200 bg-theme-50 text-theme-700 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {t('dashboard.tree')}
            </button>
            <SegmentedControl
              value={sort}
              onChange={setSort}
              options={[
                { value: 'mem', label: t('dashboard.memory') },
                { value: 'cpu', label: t('dashboard.cpu') },
              ]}
            />
          </div>
        </div>
        <div className="min-h-0 grow overflow-y-auto">
          <ProcessGrid processes={overview?.processes ?? []} sort={sort} tree={tree} />
        </div>
      </div>
    </div>
  )
}
