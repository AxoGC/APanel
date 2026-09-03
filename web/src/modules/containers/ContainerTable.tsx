import { Info, Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ContainerActionName, ContainerInfo } from './api'
import { formatContainerStatus, STATE_LABELS, statusClasses } from './format'

// Row-based rather than a literal <table> — matches the app's own
// object-array-data convention (see ProcessGrid) — with a gray-200 divider
// under the header and gray-100 dividers between rows.
export function ContainerTable({
  containers,
  pending,
  onAction,
  onShowLogs,
  onShowDetail,
}: {
  containers: ContainerInfo[]
  pending: Record<string, ContainerActionName | undefined>
  onAction: (id: string, action: ContainerActionName) => void
  onShowLogs: (container: ContainerInfo) => void
  onShowDetail: (container: ContainerInfo) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800">
        <div className="min-w-0 flex-1 text-xs text-gray-500">{t('containers.name')}</div>
        <div className="hidden w-40 shrink-0 text-xs text-gray-500 lg:block">{t('containers.image')}</div>
        <div className="w-28 shrink-0 text-xs text-gray-500">{t('containers.status')}</div>
        <div className="w-28 shrink-0 text-right text-xs text-gray-500">{t('containers.actions')}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {containers.map((c) => {
          const busy = pending[c.id]
          const [dot, text] = statusClasses(c.state)
          return (
            <div key={c.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-gray-900 dark:text-gray-100">{c.name}</div>
                <div className="truncate text-xs text-gray-500">{formatContainerStatus(c.status, t)}</div>
              </div>

              <div className="hidden w-40 shrink-0 truncate text-xs text-gray-500 lg:block">{c.image}</div>

              <div className="flex w-28 shrink-0 items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', dot)} />
                <span className={cn('text-xs', text)}>{STATE_LABELS[c.state] ? t(STATE_LABELS[c.state]) : c.state}</span>
              </div>

              <div className="flex w-28 shrink-0 items-center justify-end gap-0.5">
                <Button variant="ghost" size="icon-sm" aria-label={t('containers.detail')} onClick={() => onShowDetail(c)}>
                  <Info />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t('containers.logs')} onClick={() => onShowLogs(c)}>
                  <ScrollText />
                </Button>
                {c.state !== 'running' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('containers.start')}
                    disabled={!!busy}
                    onClick={() => onAction(c.id, 'start')}
                  >
                    {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
                  </Button>
                )}
                {c.state === 'running' && (
                  <ConfirmIconButton
                    icon={busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
                    label={t('containers.stop')}
                    actionLabel={t('containers.stop')}
                    title={t('containers.confirmStop.title')}
                    description={
                      <>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{c.name}</span>
                        {' — '}
                        {t('containers.confirmStop.description')}
                      </>
                    }
                    disabled={!!busy}
                    onConfirm={() => onAction(c.id, 'stop')}
                  />
                )}
                <ConfirmIconButton
                  icon={busy === 'restart' ? <Loader2 className="animate-spin" /> : <RotateCw />}
                  label={t('containers.restart')}
                  actionLabel={t('containers.restart')}
                  title={t('containers.confirmRestart.title')}
                  description={
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{c.name}</span>
                      {' — '}
                      {t('containers.confirmRestart.description')}
                    </>
                  }
                  disabled={!!busy}
                  onConfirm={() => onAction(c.id, 'restart')}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
