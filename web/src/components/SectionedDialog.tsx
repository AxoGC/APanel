import { XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// A Dialog built on top of the primitives in ui/dialog, opinionated about
// structure instead of just styling: a title row, a scrollable content
// area, and an optional footer, separated by dividers — with the divider
// between content and footer only present when there is a footer at all.
// The outer shell declares no padding of its own; each row owns its own.
export function SectionedDialog({
  open,
  onOpenChange,
  title,
  footer,
  children,
  className,
  onOpenAutoFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  footer?: ReactNode
  children: ReactNode
  className?: string
  onOpenAutoFocus?: (event: Event) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn('flex flex-col gap-0 p-0', className)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <DialogTitle className="min-w-0 truncate">{title}</DialogTitle>
          <DialogClose className="shrink-0 cursor-pointer rounded-sm text-gray-500 outline-none hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-gray-300">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="scrollbar-shadcn min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>

        {footer && <div className="border-t border-gray-100 p-4 dark:border-gray-800">{footer}</div>}
      </DialogContent>
    </Dialog>
  )
}
