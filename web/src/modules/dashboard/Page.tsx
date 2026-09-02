import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { Gauge } from './Gauge'
import { ProcessGrid } from './ProcessGrid'
import { useDashboardStream, type ProcessSort } from './useDashboardStream'

export default function DashboardPage() {
  const { t } = useI18n()
  const [sort, setSort] = useState<ProcessSort>('mem')
  const overview = useDashboardStream(sort)

  const memPercent = overview ? (overview.memUsed / overview.memTotal) * 100 : 0

  return (
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-base text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{t('dashboard.sort')}</span>
            <Select value={sort} onValueChange={(v) => setSort(v as ProcessSort)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mem">{t('dashboard.memory')}</SelectItem>
                <SelectItem value="cpu">{t('dashboard.cpu')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="min-h-0 grow overflow-y-auto">
          <ProcessGrid processes={overview?.processes ?? []} />
        </div>
      </div>
    </div>
  )
}
