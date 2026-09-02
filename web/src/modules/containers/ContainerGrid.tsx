import { Loader2, Play, RotateCw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ContainerActionName, ContainerInfo } from './api'

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

// Object-array data uses a grid, never a <table>: it needs to reflow onto a
// phone screen, same reasoning as the dashboard's process list.
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

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="text-xs text-gray-500">{t('containers.name')}</div>
      <div className="hidden text-xs text-gray-500 sm:block">{t('containers.image')}</div>
      <div className="text-xs text-gray-500">{t('containers.status')}</div>
      <div className="text-right text-xs text-gray-500">{t('containers.actions')}</div>

      {containers.map((c) => {
        const busy = pending[c.id]
        const [dot, text] = statusClasses(c.state)
        return (
          <div key={c.id} className="contents">
            <div className="min-w-0 self-center">
              <div className="truncate text-sm text-gray-700 dark:text-gray-300">{c.name}</div>
              <div className="truncate text-xs text-gray-500">{c.status}</div>
            </div>

            <div className="hidden items-center sm:flex">
              <span className="truncate text-xs text-gray-500">{c.image}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', dot)} />
              <span className={cn('text-xs', text)}>{STATE_LABELS[c.state] ? t(STATE_LABELS[c.state]) : c.state}</span>
            </div>

            <div className="flex items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('containers.start')}
                disabled={!!busy || c.state === 'running'}
                onClick={() => onAction(c.id, 'start')}
              >
                {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('containers.stop')}
                disabled={!!busy || c.state !== 'running'}
                onClick={() => onAction(c.id, 'stop')}
              >
                {busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('containers.restart')}
                disabled={!!busy}
                onClick={() => onAction(c.id, 'restart')}
              >
                {busy === 'restart' ? <Loader2 className="animate-spin" /> : <RotateCw />}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
