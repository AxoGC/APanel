import { Info, Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ContainerActionName, ContainerInfo } from './api'
import { formatContainerStatus, STATE_LABELS, statusClasses } from './format'

function ContainerActions({ container, busy, onAction, onShowLogs, onShowDetail }: {
  container: ContainerInfo
  busy: ContainerActionName | undefined
  onAction: (id: string, action: ContainerActionName) => void
  onShowLogs: (container: ContainerInfo) => void
  onShowDetail: (container: ContainerInfo) => void
}) {
  const { t } = useI18n()
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t('containers.detail')} onClick={() => onShowDetail(container)}><Info /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('containers.logs')} onClick={() => onShowLogs(container)}><ScrollText /></Button>
      {container.state !== 'running' && <Button variant="ghost" size="icon-sm" aria-label={t('containers.start')} disabled={!!busy} onClick={() => onAction(container.id, 'start')}>{busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}</Button>}
      {container.state === 'running' && <ConfirmIconButton icon={busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />} label={t('containers.stop')} actionLabel={t('containers.stop')} title={t('containers.confirmStop.title')} description={<><span className="font-medium text-gray-700 dark:text-gray-300">{container.name}</span>{' — '}{t('containers.confirmStop.description')}</>} disabled={!!busy} onConfirm={() => onAction(container.id, 'stop')} />}
      <ConfirmIconButton icon={busy === 'restart' ? <Loader2 className="animate-spin" /> : <RotateCw />} label={t('containers.restart')} actionLabel={t('containers.restart')} title={t('containers.confirmRestart.title')} description={<><span className="font-medium text-gray-700 dark:text-gray-300">{container.name}</span>{' — '}{t('containers.confirmRestart.description')}</>} disabled={!!busy} onConfirm={() => onAction(container.id, 'restart')} />
    </>
  )
}

export function ContainerTable({ containers, pending, onAction, onShowLogs, onShowDetail, hideHeader = false }: {
  containers: ContainerInfo[]
  pending: Record<string, ContainerActionName | undefined>
  onAction: (id: string, action: ContainerActionName) => void
  onShowLogs: (container: ContainerInfo) => void
  onShowDetail: (container: ContainerInfo) => void
  hideHeader?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col">
      {!hideHeader && <ContainerTableHeader />}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {containers.map((container) => {
          const busy = pending[container.id]
          const [dot, text] = statusClasses(container.state)
          const state = STATE_LABELS[container.state] ? t(STATE_LABELS[container.state]) : container.state
          return (
            <div key={container.id} className="flex flex-col gap-2 px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 md:flex-row md:items-center md:gap-3 md:py-2">
              <div className="hidden min-w-0 flex-1 md:block"><div className="truncate text-sm text-gray-900 dark:text-gray-100">{container.name}</div><div className="truncate text-xs text-gray-500">{formatContainerStatus(container.status, t)}</div></div>
              <div className="hidden w-40 shrink-0 truncate text-xs text-gray-500 lg:block">{container.image}</div>
              <div className="hidden w-28 shrink-0 items-center gap-1.5 md:flex"><span className={cn('size-1.5 rounded-full', dot)} /><span className={cn('text-xs', text)}>{state}</span></div>
              <div className="hidden w-28 shrink-0 items-center justify-end gap-0.5 md:flex"><ContainerActions container={container} busy={busy} onAction={onAction} onShowLogs={onShowLogs} onShowDetail={onShowDetail} /></div>

              <div className="flex flex-col gap-2 md:hidden">
                <div className="flex items-center justify-between gap-2"><span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{container.name}</span><div className="flex shrink-0 items-center gap-1.5"><span className={cn('size-1.5 rounded-full', dot)} /><span className={cn('text-xs', text)}>{formatContainerStatus(container.status, t)}</span></div></div>
                <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-xs text-gray-500">{t('containers.image')}</span><span className="truncate text-xs text-gray-500">{container.image}</span></div><div className="flex shrink-0 items-center justify-end gap-0.5"><ContainerActions container={container} busy={busy} onAction={onAction} onShowLogs={onShowLogs} onShowDetail={onShowDetail} /></div></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ContainerTableHeader() {
  const { t } = useI18n()
  return (
    <div className="hidden items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800 md:flex">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('containers.name')}</div>
      <div className="hidden w-40 shrink-0 text-xs text-gray-500 lg:block">{t('containers.image')}</div>
      <div className="w-28 shrink-0 text-xs text-gray-500">{t('containers.status')}</div>
      <div className="w-28 shrink-0 text-right text-xs text-gray-500">{t('containers.actions')}</div>
    </div>
  )
}
