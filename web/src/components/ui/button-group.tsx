import * as React from 'react'
import { cn } from '@/lib/utils'

// Wraps a row of icon buttons into a single bordered pill for tight spaces:
// the group carries the outer border, children lose their own borders and
// are separated by a divider line instead.
function ButtonGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(
        'flex items-stretch overflow-hidden rounded-lg border border-border',
        // divide-x relies on child border-left, but Button's own base class
        // already sets a (transparent) border on every side, at equal
        // specificity to divide-x's color utility — so it's a coin flip
        // which one wins. Force it instead of hoping divide-x does.
        // Button's own size variants set a fixed height (e.g. h-7 for "sm"),
        // which wins over items-stretch since stretch only fills a child
        // with auto height — so force it back to auto/full or the divider
        // stops short of the group's own height.
        '[&>*]:!h-full [&>*]:!rounded-none [&>*:not(:first-child)]:!border-l-border',
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup }
