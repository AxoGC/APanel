import { Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ServiceActionName, ServiceUnit } from './api'
import { displayName, statusClasses, SUBSTATE_LABELS, UNIT_FILE_STATE_LABELS } from './format'

// Row-based rather than a literal <table> — matches the app's own
// object-array-data convention (see ProcessGrid) — with a gray-200 divider
// under the header and gray-100 dividers between rows.
export function ServiceTable({
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
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800">
        <div className="min-w-0 flex-1 text-xs text-gray-500">{t('services.name')}</div>
        <div className="hidden w-32 shrink-0 text-xs text-gray-500 lg:block">{t('services.enablement')}</div>
        <div className="w-24 shrink-0 text-xs text-gray-500">{t('services.status')}</div>
        <div className="w-28 shrink-0 text-right text-xs text-gray-500">{t('services.actions')}</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {units.map((u) => {
          const busy = pending[u.name]
          const [dot, text] = statusClasses(u.subState)
          const togglable = u.unitFileState === 'enabled' || u.unitFileState === 'disabled'
          return (
            <div key={u.name} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-gray-900 dark:text-gray-100">{displayName(u.name)}</div>
                {u.description && u.description !== u.name && (
                  <div className="truncate text-xs text-gray-500">{u.description}</div>
                )}
              </div>

              <div className="hidden w-32 shrink-0 lg:block">
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

              <div className="flex w-24 shrink-0 items-center gap-1.5">
                <span className={cn('size-1.5 rounded-full', dot)} />
                <span className={cn('text-xs', text)}>
                  {SUBSTATE_LABELS[u.subState] ? t(SUBSTATE_LABELS[u.subState]) : u.subState}
                </span>
              </div>

              <div className="flex w-28 shrink-0 items-center justify-end gap-0.5">
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
    </div>
  )
}
