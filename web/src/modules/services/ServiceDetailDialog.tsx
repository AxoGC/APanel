import { useEffect, useState, type ReactNode } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getServiceDetail, type ServiceDetail } from './api'
import { displayName, SUBSTATE_LABELS, UNIT_FILE_STATE_LABELS } from './format'

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

// Opens on any unit name; closing resets name back to null so re-opening
// the same unit always refetches rather than showing stale detail — same
// lifecycle as ContainerDetailDialog.
export function ServiceDetailDialog({ name, onOpenChange }: { name: string | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<ServiceDetail | null>(null)

  useEffect(() => {
    if (name === null) return
    setDetail(null)
    getServiceDetail(name)
      .then(setDetail)
      .catch(() => {})
  }, [name])

  return (
    <SectionedDialog
      open={name !== null}
      onOpenChange={onOpenChange}
      title={detail ? displayName(detail.name) : t('services.detail.title')}
      className="max-w-lg"
    >
      {detail && (
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('services.detail.name')} value={displayName(detail.name)} />
          <Field
            label={t('services.detail.subState')}
            value={SUBSTATE_LABELS[detail.subState] ? t(SUBSTATE_LABELS[detail.subState]) : detail.subState}
          />
          {detail.description && detail.description !== detail.name && (
            <div className="col-span-2">
              <Field label={t('services.detail.description')} value={detail.description} wrap />
            </div>
          )}
          <div className="col-span-2">
            <Field label={t('services.detail.fragmentPath')} value={detail.fragmentPath || '—'} wrap />
          </div>
          <Field label={t('services.detail.loadState')} value={detail.loadState || '—'} />
          <Field
            label={t('services.detail.unitFileState')}
            value={UNIT_FILE_STATE_LABELS[detail.unitFileState] ? t(UNIT_FILE_STATE_LABELS[detail.unitFileState]) : detail.unitFileState}
          />
          {detail.mainPid > 0 && <Field label={t('services.detail.mainPid')} value={detail.mainPid} />}
          {detail.activeState !== 'active' && <Field label={t('services.detail.exitCode')} value={detail.exitCode} />}
          {detail.activeSince && (
            <Field label={t('services.detail.activeSince')} value={new Date(detail.activeSince).toLocaleString()} />
          )}
          <Field label={t('services.detail.restartPolicy')} value={detail.restartPolicy || '—'} />
          <Field label={t('services.detail.user')} value={detail.user || 'root'} />
          <div className="col-span-2">
            <Field label={t('services.detail.workingDirectory')} value={detail.workingDirectory || '—'} wrap />
          </div>
          {detail.memoryCurrentBytes !== null && (
            <Field label={t('services.detail.memory')} value={formatBytes(detail.memoryCurrentBytes)} />
          )}
          {detail.requires && detail.requires.length > 0 && (
            <div className="col-span-2">
              <Field label={t('services.detail.requires')} value={<ListValue items={detail.requires} />} />
            </div>
          )}
          {detail.after && detail.after.length > 0 && (
            <div className="col-span-2">
              <Field label={t('services.detail.after')} value={<ListValue items={detail.after} />} />
            </div>
          )}
        </div>
      )}
    </SectionedDialog>
  )
}
