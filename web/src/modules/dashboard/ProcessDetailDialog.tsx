import { useEffect, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getProcessDetail, type ProcessDetail } from './useDashboardStream'

const STATE_LABELS: Record<string, TranslationKey> = {
  R: 'dashboard.state.R',
  S: 'dashboard.state.S',
  D: 'dashboard.state.D',
  Z: 'dashboard.state.Z',
  T: 'dashboard.state.T',
  t: 'dashboard.state.t',
  X: 'dashboard.state.X',
  I: 'dashboard.state.I',
}

function Field({ label, value, wrap }: { label: string; value: ReactNode; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-sm text-gray-700 dark:text-gray-300', wrap ? 'break-all' : 'truncate')}>{value}</span>
    </div>
  )
}

// Opens on any pid (a click on the flat list or the tree's row); closing
// resets pid back to null so re-opening the same process always refetches
// rather than showing stale detail.
export function ProcessDetailDialog({ pid, onOpenChange }: { pid: number | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<ProcessDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (pid === null) return
    setDetail(null)
    setError(null)
    getProcessDetail(pid)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [pid])

  return (
    <Dialog open={pid !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{detail ? detail.name : t('dashboard.detail.title')}</DialogTitle>
        </DialogHeader>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {detail && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('dashboard.detail.pid')} value={detail.pid} />
            <Field label={t('dashboard.detail.ppid')} value={detail.ppid} />
            <Field
              label={t('dashboard.detail.state')}
              value={STATE_LABELS[detail.state] ? t(STATE_LABELS[detail.state]) : detail.state}
            />
            <Field label={t('dashboard.user')} value={detail.user} />
            <Field label={t('dashboard.cpu')} value={formatPercent(detail.cpuPercent)} />
            <Field label={t('dashboard.memory')} value={formatBytes(detail.memRSS)} />
            <Field label={t('dashboard.detail.vmSize')} value={formatBytes(detail.vmSize)} />
            <Field label={t('dashboard.detail.vmSwap')} value={formatBytes(detail.vmSwap)} />
            <Field label={t('dashboard.detail.priority')} value={detail.priority} />
            <Field label={t('dashboard.detail.nice')} value={detail.nice} />
            <Field label={t('dashboard.detail.threads')} value={detail.threads} />
            <Field
              label={t('dashboard.detail.openFiles')}
              value={detail.openFiles >= 0 ? detail.openFiles : '—'}
            />
            <div className="col-span-2">
              <Field label={t('dashboard.detail.startTime')} value={new Date(detail.startTime).toLocaleString()} />
            </div>
            <div className="col-span-2">
              <Field label={t('dashboard.detail.cmdline')} value={detail.cmdline} wrap />
            </div>
            {detail.exe && (
              <div className="col-span-2">
                <Field label={t('dashboard.detail.exe')} value={detail.exe} wrap />
              </div>
            )}
            {detail.cwd && (
              <div className="col-span-2">
                <Field label={t('dashboard.detail.cwd')} value={detail.cwd} wrap />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
