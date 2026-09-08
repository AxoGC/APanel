import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

// Popover content is portaled onto <body>, which puts it outside the DOM
// subtree of any Dialog it was opened from. A modal Dialog locks background
// scrolling with react-remove-scroll, and that lock cancels every
// wheel/touchmove event whose target sits outside the dialog — so scrollable
// content inside a popover (a long suggestion list) refused to scroll by
// mouse wheel or touch, even though dragging its scrollbar still worked,
// since dragging scrolls programmatically instead of through those events.
// Keeping wheel/touchmove from bubbling as far as that document-level
// listener restores normal scrolling; the browser scrolls the element under
// the pointer on its own, without needing the event to propagate.
function isolateScrollEvents(node: HTMLElement | null) {
  if (!node) return
  const stopPropagation = (event: Event) => event.stopPropagation()
  node.addEventListener('wheel', stopPropagation, { passive: false })
  node.addEventListener('touchmove', stopPropagation, { passive: false })
  return () => {
    node.removeEventListener('wheel', stopPropagation)
    node.removeEventListener('touchmove', stopPropagation)
  }
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={isolateScrollEvents}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverAnchor, PopoverTrigger, PopoverContent }
