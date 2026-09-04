import { Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ProxyOption } from './api'

function delayClasses(delay: number): string {
  if (delay <= 0) return 'text-gray-400'
  if (delay <= 300) return 'text-emerald-600 dark:text-emerald-400'
  if (delay <= 800) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function DelayLabel({ delay }: { delay: number }) {
  const { t } = useI18n()
  if (delay <= 0) return <span className={delayClasses(delay)}>{t('proxy.delay.untested')}</span>
  return <span className={delayClasses(delay)}>{delay}ms</span>
}

export function ProxyTableHeader() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 pb-1.5 dark:border-gray-800">
      <div className="w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-xs text-gray-500">{t('proxy.column.name')}</div>
      <div className="w-20 shrink-0 truncate text-xs text-gray-500 sm:w-28">{t('proxy.column.type')}</div>
      <div className="w-12 shrink-0 truncate text-right text-xs text-gray-500 sm:w-16">{t('proxy.column.delay')}</div>
    </div>
  )
}

// Always a single-row-per-option table, at every viewport width — no
// card-stacking fallback on mobile, unlike the other modules' tables.
export function ProxyTable({
  options,
  now,
  pending,
  onSelect,
}: {
  options: ProxyOption[]
  now: string
  pending: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {options.map((opt) => {
        const selected = opt.name === now
        const busy = pending === opt.name
        return (
          <button
            key={opt.name}
            type="button"
            disabled={busy}
            onClick={() => onSelect(opt.name)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-3 px-2 py-2 text-left hover:bg-gray-100 disabled:cursor-default dark:hover:bg-gray-800',
              selected && 'bg-theme-50 dark:bg-theme-950',
            )}
          >
            <div className="w-5 shrink-0">
              {selected && <Check className="size-3.5 text-theme-700 dark:text-theme-300" />}
            </div>
            <div
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                selected ? 'text-theme-700 dark:text-theme-300' : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {opt.name}
            </div>
            <div className="w-20 shrink-0 truncate text-xs text-gray-500 sm:w-28">{opt.type}</div>
            <div className="w-12 shrink-0 truncate text-right text-xs sm:w-16">
              <DelayLabel delay={opt.delay} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
