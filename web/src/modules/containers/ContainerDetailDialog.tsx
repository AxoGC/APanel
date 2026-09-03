import { useEffect, useState, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getContainerDetail, type ContainerDetail } from './api'
import { RESTART_POLICY_LABELS, STATE_LABELS } from './format'

function Field({ label, value, wrap }: { label: string; value: ReactNode; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-sm text-gray-700 dark:text-gray-300', wrap ? 'break-all' : 'truncate')}>{value}</span>
    </div>
  )
}

function ListValue({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <span key={i} className="break-all">
          {item}
        </span>
      ))}
    </div>
  )
}

// Opens on any container id; closing resets id back to null so re-opening
// the same container always refetches rather than showing stale detail —
// same lifecycle as ProcessDetailDialog.
export function ContainerDetailDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<ContainerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id === null) return
    setDetail(null)
    setError(null)
    getContainerDetail(id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [id])

  return (
    <Dialog open={id !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{detail ? detail.name : t('containers.detail.title')}</DialogTitle>
        </DialogHeader>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {detail && (
          <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label={t('containers.detail.id')} value={detail.id} wrap />
              </div>
              <Field label={t('containers.detail.name')} value={detail.name} />
              <Field
                label={t('containers.detail.state')}
                value={STATE_LABELS[detail.state] ? t(STATE_LABELS[detail.state]) : detail.state}
              />
              <div className="col-span-2">
                <Field label={t('containers.detail.image')} value={detail.image} wrap />
              </div>
              <div className="col-span-2">
                <Field label={t('containers.detail.command')} value={detail.command || '—'} wrap />
              </div>
              <Field label={t('containers.detail.created')} value={new Date(detail.created).toLocaleString()} />
              {detail.state !== 'running' && (
                <Field label={t('containers.detail.exitCode')} value={detail.exitCode} />
              )}
              {detail.startedAt && (
                <Field label={t('containers.detail.startedAt')} value={new Date(detail.startedAt).toLocaleString()} />
              )}
              <Field
                label={t('containers.detail.restartPolicy')}
                value={
                  RESTART_POLICY_LABELS[detail.restartPolicy] ? t(RESTART_POLICY_LABELS[detail.restartPolicy]) : detail.restartPolicy
                }
              />
              <Field label={t('containers.detail.platform')} value={detail.platform || '—'} />
              {detail.networks && detail.networks.length > 0 && (
                <div className="col-span-2">
                  <Field label={t('containers.detail.networks')} value={<ListValue items={detail.networks} />} />
                </div>
              )}
              {detail.ports && detail.ports.length > 0 && (
                <div className="col-span-2">
                  <Field label={t('containers.detail.ports')} value={<ListValue items={detail.ports} />} />
                </div>
              )}
              {detail.mounts && detail.mounts.length > 0 && (
                <div className="col-span-2">
                  <Field label={t('containers.detail.mounts')} value={<ListValue items={detail.mounts} />} />
                </div>
              )}
              {detail.env && detail.env.length > 0 && (
                <div className="col-span-2">
                  <Field label={t('containers.detail.env')} value={<ListValue items={detail.env} />} />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
