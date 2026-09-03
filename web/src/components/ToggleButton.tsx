import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// A pill-shaped two-state button (dashboard's "Tree"/"Expand all" toggles,
// and any other on/off control that isn't a checkbox). Active gets the
// theme-colored border+background; inactive keeps a plain gray border
// rather than none, so the pill outline still reads without the fill.
export function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-theme-200 bg-theme-50 text-theme-700 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300'
          : 'border-gray-200 text-gray-500 hover:text-gray-700 dark:border-gray-800 dark:hover:text-gray-300',
      )}
    >
      {children}
    </button>
  )
}
