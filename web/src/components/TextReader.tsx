import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { getStoredReaderLineNumbers, getStoredReaderTextWrap } from '@/lib/readerPrefs'

// A bare multi-line text viewer — no background, no border, so it drops
// into whatever container already provides those. Line numbers and wrap
// come from the user's global reader preferences (Settings page); mono is
// a per-call prop since it depends on the kind of content being shown
// (e.g. env vars), not on user preference.
export function TextReader({
  lines,
  mono,
  className,
}: {
  lines: string[]
  mono?: boolean
  className?: string
}) {
  const [showLineNumbers] = useState(getStoredReaderLineNumbers)
  const [wrap] = useState(getStoredReaderTextWrap)
  const gutterWidth = `${String(lines.length).length}ch`

  return (
    <ScrollArea className={className} orientation={wrap ? 'vertical' : 'both'}>
      <div className={cn('text-xs text-gray-700 dark:text-gray-300', mono && 'font-mono', !wrap && 'w-max min-w-full')}>
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3">
            {showLineNumbers && (
              <span
                className="shrink-0 text-right text-gray-400 select-none dark:text-gray-600"
                style={{ width: gutterWidth }}
              >
                {i + 1}
              </span>
            )}
            <span className={wrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-all' : 'whitespace-pre'}>
              {line || ' '}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
