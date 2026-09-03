import { Info, Loader2, Play, RotateCw, ScrollText, Square } from 'lucide-react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ServiceActionName, ServiceUnit } from './api'
import { displayName, enablementClasses, statusClasses, SUBSTATE_LABELS, UNIT_FILE_STATE_LABELS } from './format'

function ServiceActions({ unit, busy, onAction, onShowLogs, onShowDetail }: {
  unit: ServiceUnit
  busy: ServiceActionName | undefined
  onAction: (name: string, action: ServiceActionName) => void
  onShowLogs: (unit: ServiceUnit) => void
  onShowDetail: (unit: ServiceUnit) => void
}) {
  const { t } = useI18n()

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={t('services.detail')} onClick={() => onShowDetail(unit)}><Info /></Button>
      <Button variant="ghost" size="icon-sm" aria-label={t('services.logs')} onClick={() => onShowLogs(unit)}><ScrollText /></Button>
      {unit.activeState !== 'active' && (
        <Button variant="ghost" size="icon-sm" aria-label={t('services.start')} disabled={!!busy} onClick={() => onAction(unit.name, 'start')}>
          {busy === 'start' ? <Loader2 className="animate-spin" /> : <Play />}
        </Button>
      )}
      {unit.activeState === 'active' && (
        <ConfirmIconButton
          icon={busy === 'stop' ? <Loader2 className="animate-spin" /> : <Square />}
          label={t('services.stop')}
          actionLabel={t('services.stop')}
          title={t('services.confirmStop.title')}
          description={<><span className="font-medium text-gray-700 dark:text-gray-300">{displayName(unit.name)}</span>{' — '}{t('services.confirmStop.description')}</>}
          disabled={!!busy}
          onConfirm={() => onAction(unit.name, 'stop')}
        />
      )}
      <ConfirmIconButton
        icon={busy === 'restart' ? <Loader2 className="animate-spin" /> : <RotateCw />}
        label={t('services.restart')}
        actionLabel={t('services.restart')}
        title={t('services.confirmRestart.title')}
        description={<><span className="font-medium text-gray-700 dark:text-gray-300">{displayName(unit.name)}</span>{' — '}{t('services.confirmRestart.description')}</>}
        disabled={!!busy}
        onConfirm={() => onAction(unit.name, 'restart')}
      />
    </>
  )
}

// A single vertical list at every breakpoint. Desktop exposes its columns in
// one row; mobile uses the former card's compact, nested rows instead.
export function ServiceTable({ units, pending, onAction, onShowLogs, onShowDetail, hideHeader = false }: {
  units: ServiceUnit[]
  pending: Record<string, ServiceActionName | undefined>
  onAction: (name: string, action: ServiceActionName) => void
  onShowLogs: (unit: ServiceUnit) => void
  onShowDetail: (unit: ServiceUnit) => void
  hideHeader?: boolean
}) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col">
      {!hideHeader && <ServiceTableHeader />}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
        {units.map((unit) => {
          const busy = pending[unit.name]
          const [dot, text] = statusClasses(unit.subState)
          const [enableDot, enableText] = enablementClasses(unit.unitFileState)
          const togglable = unit.unitFileState === 'enabled' || unit.unitFileState === 'disabled'
          const enablement = UNIT_FILE_STATE_LABELS[unit.unitFileState] ? t(UNIT_FILE_STATE_LABELS[unit.unitFileState]) : unit.unitFileState
          const state = SUBSTATE_LABELS[unit.subState] ? t(SUBSTATE_LABELS[unit.subState]) : unit.subState

          return (
            <div key={unit.name} className="flex flex-col gap-2 px-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 md:flex-row md:items-center md:gap-3 md:py-2">
              <div className="hidden min-w-0 flex-1 md:block">
                <div className="truncate text-sm text-gray-900 dark:text-gray-100">{displayName(unit.name)}</div>
                {unit.description && unit.description !== unit.name && <div className="truncate text-xs text-gray-500">{unit.description}</div>}
              </div>
              <div className="hidden w-32 shrink-0 md:block">
                {togglable ? (
                  <button type="button" disabled={!!busy} onClick={() => onAction(unit.name, unit.unitFileState === 'enabled' ? 'disable' : 'enable')} className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-gray-300">
                    {enablement}
                  </button>
                ) : <span className="text-xs text-gray-500">{enablement}</span>}
              </div>
              <div className="hidden w-24 shrink-0 items-center gap-1.5 md:flex"><span className={cn('size-1.5 rounded-full', dot)} /><span className={cn('text-xs', text)}>{state}</span></div>
              <div className="hidden w-28 shrink-0 items-center justify-end gap-0.5 md:flex"><ServiceActions unit={unit} busy={busy} onAction={onAction} onShowLogs={onShowLogs} onShowDetail={onShowDetail} /></div>

              <div className="flex flex-col gap-2 md:hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{displayName(unit.name)}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', enableDot)} /><span className={cn('text-xs', enableText)}>{enablement}</span></div>
                    <div className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', dot)} /><span className={cn('text-xs', text)}>{state}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {unit.description && unit.description !== unit.name ? (
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{unit.description}</span>
                  ) : (
                    <span className="min-w-0 flex-1" />
                  )}
                  <div className="flex shrink-0 items-center justify-end gap-0.5"><ServiceActions unit={unit} busy={busy} onAction={onAction} onShowLogs={onShowLogs} onShowDetail={onShowDetail} /></div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ServiceTableHeader() {
  const { t } = useI18n()
  return (
    <div className="hidden items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800 md:flex">
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('services.name')}</div>
      <div className="w-32 shrink-0 text-xs text-gray-500">{t('services.enablement')}</div>
      <div className="w-24 shrink-0 text-xs text-gray-500">{t('services.status')}</div>
      <div className="w-28 shrink-0 text-right text-xs text-gray-500">{t('services.actions')}</div>
    </div>
  )
}
