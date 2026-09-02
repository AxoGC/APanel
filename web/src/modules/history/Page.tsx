import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { getHistory, type HistoryDay } from './api'
import { HistoryChart } from './HistoryChart'

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6]

function dayLabel(daysAgo: number, today: string, yesterday: string): string {
  if (daysAgo === 0) return today
  if (daysAgo === 1) return yesterday
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default function HistoryPage() {
  const { t } = useI18n()
  const [daysAgo, setDaysAgo] = useState(0)
  const [day, setDay] = useState<HistoryDay | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    getHistory(daysAgo)
      .then(setDay)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [daysAgo])

  const last = day && day.points.length > 0 ? day.points[day.points.length - 1] : null

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{t('history.day')}</span>
        <Select value={String(daysAgo)} onValueChange={(v) => setDaysAgo(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {dayLabel(n, t('history.today'), t('history.yesterday'))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {day && day.points.length === 0 && <p className="text-sm text-gray-500">{t('history.empty')}</p>}

      {day && day.points.length > 0 && (
        <div className="flex min-h-0 grow flex-col gap-6 overflow-y-auto">
          <HistoryChart
            label={t('history.cpu')}
            times={day.points.map((p) => p.time)}
            values={day.points.map((p) => p.cpuUsedPercent)}
            unit="%"
          />
          <div className="flex flex-col gap-1">
            <HistoryChart
              label={t('history.memory')}
              times={day.points.map((p) => p.time)}
              values={day.points.map((p) => p.memUsedPercent)}
              unit="%"
            />
            {last && (
              <span className="text-xs text-gray-500">
                {formatBytes(last.memUsed)} / {formatBytes(last.memTotal)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
