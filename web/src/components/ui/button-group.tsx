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
        'flex items-stretch divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800',
        '[&>*]:!rounded-none',
        className,
      )}
      {...props}
    />
  )
}

export { ButtonGroup }
