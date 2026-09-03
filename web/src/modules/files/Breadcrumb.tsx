import { ChevronRight, House } from 'lucide-react'
import { Fragment } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

// Splits "/a/b/c" into clickable ancestor segments, each carrying the full
// path up to and including itself, so clicking any segment jumps straight
// there instead of only supporting "go up one level".
function segments(path: string): { name: string; path: string }[] {
  const parts = path.split('/').filter(Boolean)
  let acc = ''
  return parts.map((name) => {
    acc += `/${name}`
    return { name, path: acc }
  })
}

export function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  return (
    <ScrollArea orientation="horizontal" className="min-w-0 max-w-full" viewportClassName="pb-2">
      <div className="flex w-max items-center gap-1 text-sm whitespace-nowrap">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className={
            path === '/'
              ? 'flex cursor-pointer items-center text-gray-900 dark:text-gray-100'
              : 'flex cursor-pointer items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }
          aria-label="Root"
        >
          <House className="size-4" />
        </button>
        {segments(path).map((seg, i, arr) => (
          <Fragment key={seg.path}>
            <ChevronRight className="size-3.5 shrink-0 text-gray-400" />
            <button
              type="button"
              onClick={() => onNavigate(seg.path)}
              className={
                i === arr.length - 1
                  ? 'cursor-pointer text-gray-900 dark:text-gray-100'
                  : 'cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }
            >
              {seg.name}
            </button>
          </Fragment>
        ))}
      </div>
    </ScrollArea>
  )
}
