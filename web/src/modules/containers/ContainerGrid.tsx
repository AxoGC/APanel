import { Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ContainerActionName, ContainerInfo } from './api'
import { formatContainerStatus, STATE_LABELS, statusClasses } from './format'

// Each container is one grid cell (a card). The container uses the classic
// gap-px + background trick so a 1px gray-100 line shows through between
// cells in both directions without needing per-cell border bookkeeping
// across the responsive column-count breakpoints.
export function ContainerGrid({
  containers,
  pending,
  onAction,
  onShowLogs,
}: {
  containers: ContainerInfo[]
  pending: Record<string, ContainerActionName | undefined>
  onAction: (id: string, action: ContainerActionName) => void
  onShowLogs: (container: ContainerInfo) => void
}) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 dark:bg-gray-800">
      {containers.map((c) => {
        const busy = pending[c.id]
        const [dot, text] = statusClasses(c.state)
        return (
          <div
            key={c.id}
            className="flex flex-col gap-2 bg-background p-4 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <div className="flex flex-row items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-900 dark:text-gray-100">{c.name}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', dot)} />
                <span className={cn('text-xs', text)}>{STATE_LABELS[c.state] ? t(STATE_LABELS[c.state]) : c.state}</span>
              </div>
            </div>

            <div className="truncate text-xs text-gray-500">{formatContainerStatus(c.status, t)}</div>

            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs text-gray-500">{t('containers.image')}</span>
                <span className="truncate text-xs text-gray-500">{c.image}</span>
              </div>
              <div className="flex shrink-0 flex-row items-center justify-end gap-0.5">
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
          </div>
        )
      })}
    </div>
  )
}
