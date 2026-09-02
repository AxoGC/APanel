import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { ProcessGrid } from './ProcessGrid'
import { StatBar } from './StatBar'
import { useDashboardStream } from './useDashboardStream'

export default function DashboardPage() {
  const { t } = useI18n()
  const overview = useDashboardStream()

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-base text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatBar
          label={t('dashboard.cpu')}
          value={overview?.cpuPercent ?? 0}
          detail={overview ? formatPercent(overview.cpuPercent) : '–'}
        />
        <StatBar
          label={t('dashboard.memory')}
          value={overview ? (overview.memUsed / overview.memTotal) * 100 : 0}
          detail={overview ? `${formatBytes(overview.memUsed)} / ${formatBytes(overview.memTotal)}` : '–'}
        />
      </div>

      <div>
        <p className="mb-2 text-xs text-gray-500">{t('dashboard.processes')}</p>
        <ProcessGrid processes={overview?.processes ?? []} />
      </div>
    </div>
  )
}
