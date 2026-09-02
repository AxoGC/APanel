import { Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ServiceActionName, ServiceUnit } from './api'
import { displayName, statusClasses, SUBSTATE_LABELS, UNIT_FILE_STATE_LABELS } from './format'

// Each unit is one grid cell (a card). The container uses the classic
// gap-px + background trick so a 1px gray-100 line shows through between
// cells in both directions without needing per-cell border bookkeeping
// across the responsive column-count breakpoints.
export function ServiceGrid({
  units,
  pending,
  onAction,
  onShowLogs,
}: {
  units: ServiceUnit[]
  pending: Record<string, ServiceActionName | undefined>
  onAction: (name: string, action: ServiceActionName) => void
  onShowLogs: (unit: ServiceUnit) => void
}) {
  const { t } = useI18n()

  return (
    <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 dark:bg-gray-800">
      {units.map((u) => {
        const busy = pending[u.name]
        const [dot, text] = statusClasses(u.subState)
        const togglable = u.unitFileState === 'enabled' || u.unitFileState === 'disabled'
        return (
          <div
            key={u.name}
            className="flex flex-col gap-2 bg-background p-4"
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
                  className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-gray-300"
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
              <Button variant="ghost" size="icon-sm" aria-label={t('services.logs')} onClick={() => onShowLogs(u)}>
                <ScrollText />
              </Button>
              {u.activeState !== 'active' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('services.start')}
                  disabled={!!busy}
                  onClick={() => onAction(u.name, 'start')}
                >
                  {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
                </Button>
              )}
              {u.activeState === 'active' && (
                <ConfirmIconButton
                  icon={busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
                  label={t('services.stop')}
                  actionLabel={t('services.stop')}
                  title={t('services.confirmStop.title')}
                  description={
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{displayName(u.name)}</span>
                      {' — '}
                      {t('services.confirmStop.description')}
                    </>
                  }
                  disabled={!!busy}
                  onConfirm={() => onAction(u.name, 'stop')}
                />
              )}
              <ConfirmIconButton
                icon={busy === 'restart' ? <Loader2 className="animate-spin" /> : <RotateCw />}
                label={t('services.restart')}
                actionLabel={t('services.restart')}
                title={t('services.confirmRestart.title')}
                description={
                  <>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{displayName(u.name)}</span>
                    {' — '}
                    {t('services.confirmRestart.description')}
                  </>
                }
                disabled={!!busy}
                onConfirm={() => onAction(u.name, 'restart')}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
