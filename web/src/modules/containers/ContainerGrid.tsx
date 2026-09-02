import { Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { useState } from 'react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { LogsDialog } from '@/components/LogsDialog'
import { Button } from '@/components/ui/button'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { containerLogsStreamUrl, getContainerLogs, type ContainerActionName, type ContainerInfo } from './api'

function statusClasses(state: string): [dot: string, text: string] {
  if (state === 'running') return ['bg-green-500', 'text-green-600 dark:text-green-400']
  if (state === 'dead') return ['bg-red-500', 'text-red-600 dark:text-red-400']
  return ['bg-gray-400', 'text-gray-500']
}

const STATE_LABELS: Record<string, TranslationKey> = {
  created: 'containers.state.created',
  running: 'containers.state.running',
  paused: 'containers.state.paused',
  restarting: 'containers.state.restarting',
  removing: 'containers.state.removing',
  exited: 'containers.state.exited',
  dead: 'containers.state.dead',
}

// Each container is one grid cell (a card); layout inside a card is flex-col
// of flex-row rows, not a shared table-like grid — this is what lets it
// reflow cleanly at every breakpoint instead of just collapsing columns.
export function ContainerGrid({
  containers,
  pending,
  onAction,
}: {
  containers: ContainerInfo[]
  pending: Record<string, ContainerActionName | undefined>
  onAction: (id: string, action: ContainerActionName) => void
}) {
  const { t } = useI18n()
  const [logsFor, setLogsFor] = useState<ContainerInfo | null>(null)

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {containers.map((c) => {
        const busy = pending[c.id]
        const [dot, text] = statusClasses(c.state)
        return (
          <div
            key={c.id}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-row items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-900 dark:text-gray-100">{c.name}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', dot)} />
                <span className={cn('text-xs', text)}>{STATE_LABELS[c.state] ? t(STATE_LABELS[c.state]) : c.state}</span>
              </div>
            </div>

            <div className="truncate text-xs text-gray-500">{c.status}</div>

            <div className="flex flex-row items-center justify-between gap-2">
              <span className="text-xs text-gray-500">{t('containers.image')}</span>
              <span className="truncate text-xs text-gray-500">{c.image}</span>
            </div>

            <div className="flex flex-row items-center justify-end gap-0.5">
              <Button variant="ghost" size="icon-sm" aria-label={t('containers.logs')} onClick={() => setLogsFor(c)}>
                <ScrollText />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('containers.start')}
                disabled={!!busy || c.state === 'running'}
                onClick={() => onAction(c.id, 'start')}
              >
                {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
              </Button>
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
                disabled={!!busy || c.state !== 'running'}
                onConfirm={() => onAction(c.id, 'stop')}
              />
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
      <LogsDialog
        open={logsFor !== null}
        onOpenChange={(open) => !open && setLogsFor(null)}
        title={logsFor ? `${logsFor.name} — ${t('containers.logs')}` : ''}
        id={logsFor?.id ?? ''}
        fetchLogs={getContainerLogs}
        streamUrl={containerLogsStreamUrl}
      />
    </div>
  )
}
