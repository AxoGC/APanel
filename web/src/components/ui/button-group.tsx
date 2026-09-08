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
        '[&>*]:!rounded-none [&>*:not(:first-child)]:!border-l-border',
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup }
