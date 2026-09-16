import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  )
}

// Below this drag distance, releasing the drawer handle snaps it back open
// instead of dismissing the dialog.
const DRAWER_CLOSE_THRESHOLD_PX = 96

function DialogContent({
  className,
  children,
  showCloseButton = true,
  height,
  style,
  drawer,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; height?: string; drawer?: boolean }) {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragY, setDragY] = React.useState(0)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // The drawer layout only applies below sm — at sm and up this is a
    // centered modal, where a vertical drag has no matching visual meaning.
    if (window.matchMedia('(min-width: 640px)').matches) return
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.dataset.startY = String(event.clientY)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const startY = Number(event.currentTarget.dataset.startY)
    setDragY(Math.max(0, event.clientY - startY))
  }

  const endDrag = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (dragY > DRAWER_CLOSE_THRESHOLD_PX) {
      // Reset immediately so Radix's own exit animation isn't fighting an
      // inline transform left over from the drag.
      setDragY(0)
      closeRef.current?.click()
    } else {
      // Defer the snap-back a frame so the transition (only applied once
      // isDragging is false) has a starting value to animate from.
      requestAnimationFrame(() => setDragY(0))
    }
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{
          ...style,
          ...(height ? { height } : null),
          ...(drawer && (isDragging || dragY !== 0)
            ? { transform: `translateY(${dragY}px)`, transition: isDragging ? 'none' : 'transform 200ms ease-out' }
            : null),
        }}
        className={cn(
          drawer
            ? 'fixed inset-x-0 bottom-0 top-auto left-0 z-50 grid max-h-[85vh] w-full translate-x-0 translate-y-0 gap-4 overflow-y-auto rounded-t-2xl bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:data-open:fade-in-0 sm:data-open:zoom-in-95 sm:data-closed:fade-out-0 sm:data-closed:zoom-out-95'
            : 'fixed top-1/2 left-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg bg-popover p-6 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      >
        {drawer && (
          <div
            className="absolute inset-x-0 top-0 flex h-6 touch-none items-center justify-center sm:hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="absolute top-4 right-4 cursor-pointer rounded-sm text-gray-500 outline-none hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-gray-300">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
        {drawer && <DialogPrimitive.Close ref={closeRef} className="hidden" tabIndex={-1} aria-hidden />}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-2', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex flex-row justify-end gap-2', className)} {...props} />
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-base text-gray-900 dark:text-gray-100', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-gray-500', className)}
      {...props}
    />
  )
}

export { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
