import { Loader2, Play, RotateCw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ServiceActionName, ServiceUnit } from './api'

function statusClasses(subState: string): [dot: string, text: string] {
  if (subState === 'running') return ['bg-green-500', 'text-green-600 dark:text-green-400']
  if (subState === 'dead') return ['bg-red-500', 'text-red-600 dark:text-red-400']
  return ['bg-gray-400', 'text-gray-500']
}

// The status column reuses the filter's own vocabulary (services.filter.*)
// so a card's displayed status always matches whichever filter option would
// select it — see statesForStatus on the backend for the running/exited/dead
// SubState mapping this mirrors.
const SUBSTATE_LABELS: Record<string, TranslationKey> = {
  running: 'services.filter.running',
  exited: 'services.filter.stopped',
  dead: 'services.filter.failed',
}

const UNIT_FILE_STATE_LABELS: Record<string, TranslationKey> = {
  enabled: 'services.unitFileState.enabled',
  static: 'services.unitFileState.static',
  alias: 'services.unitFileState.alias',
  disabled: 'services.unitFileState.disabled',
  masked: 'services.unitFileState.masked',
  'enabled-runtime': 'services.unitFileState.enabledRuntime',
  bad: 'services.unitFileState.bad',
}

// Display only — actions still key off the full unit name (u.name), since
// systemd needs the ".service" suffix for the actual API calls.
function displayName(name: string): string {
  return name.endsWith('.service') ? name.slice(0, -'.service'.length) : name
}

// Each unit is one grid cell (a card); layout inside a card is flex-col of
// flex-row rows, not a shared table-like grid — this is what lets it reflow
// cleanly at every breakpoint instead of just collapsing columns.
export function ServiceGrid({
  units,
  pending,
  onAction,
}: {
  units: ServiceUnit[]
  pending: Record<string, ServiceActionName | undefined>
  onAction: (name: string, action: ServiceActionName) => void
}) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {units.map((u) => {
        const busy = pending[u.name]
        const [dot, text] = statusClasses(u.subState)
        const togglable = u.unitFileState === 'enabled' || u.unitFileState === 'disabled'
        return (
          <div
            key={u.name}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-row items-center justify-between gap-2">
              <span className="truncate text-sm text-gray-900 dark:text-gray-100">{displayName(u.name)}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', dot)} />
                <span className={cn('text-xs', text)}>
                  {SUBSTATE_LABELS[u.subState] ? t(SUBSTATE_LABELS[u.subState]) : u.subState}
                </span>
              </div>
            </div>

            {u.description && u.description !== u.name && (
              <div className="truncate text-xs text-gray-500">{u.description}</div>
            )}

            <div className="flex flex-row items-center justify-between gap-2">
              <span className="text-xs text-gray-500">{t('services.enablement')}</span>
              {togglable ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => onAction(u.name, u.unitFileState === 'enabled' ? 'disable' : 'enable')}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-gray-300"
                >
                  {UNIT_FILE_STATE_LABELS[u.unitFileState] ? t(UNIT_FILE_STATE_LABELS[u.unitFileState]) : u.unitFileState}
                </button>
              ) : (
                <span className="text-xs text-gray-500">
                  {UNIT_FILE_STATE_LABELS[u.unitFileState] ? t(UNIT_FILE_STATE_LABELS[u.unitFileState]) : u.unitFileState}
                </span>
              )}
            </div>

            <div className="flex flex-row items-center justify-end gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('services.start')}
                disabled={!!busy || u.activeState === 'active'}
                onClick={() => onAction(u.name, 'start')}
              >
                {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('services.stop')}
                disabled={!!busy || u.activeState !== 'active'}
                onClick={() => onAction(u.name, 'stop')}
              >
                {busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('services.restart')}
                disabled={!!busy}
                onClick={() => onAction(u.name, 'restart')}
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
