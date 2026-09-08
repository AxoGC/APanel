import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedInputSegment {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFocus?: () => void
  onBlur?: () => void
}

// A single bordered field split into independently-editable text segments
// joined by a fixed separator — e.g. Docker's "source:target" mount syntax —
// so it reads as one value instead of a row of unrelated inputs. `suffix`
// is for a trailing in-field control (a mode toggle, a unit label, ...)
// that should sit inside the same border rather than after it.
export function SegmentedInput({
  segments,
  separator = ':',
  suffix,
  className,
}: {
  segments: SegmentedInputSegment[]
  separator?: ReactNode
  suffix?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-8 min-w-0 items-stretch overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        className,
      )}
    >
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="flex items-center text-muted-foreground select-none">{separator}</span>}
          <input
            className="min-w-0 flex-1 px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground"
            value={segment.value}
            onChange={(e) => segment.onChange(e.target.value)}
            onFocus={segment.onFocus}
            onBlur={segment.onBlur}
            placeholder={segment.placeholder}
          />
        </Fragment>
      ))}
      {suffix}
    </div>
  )
}
