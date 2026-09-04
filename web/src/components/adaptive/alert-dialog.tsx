import * as React from 'react'
import {
  AlertDialog as DesktopAlertDialog,
  AlertDialogAction as DesktopAlertDialogAction,
  AlertDialogCancel as DesktopAlertDialogCancel,
  AlertDialogContent as DesktopAlertDialogContent,
  AlertDialogDescription as DesktopAlertDialogDescription,
  AlertDialogFooter as DesktopAlertDialogFooter,
  AlertDialogHeader as DesktopAlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle as DesktopAlertDialogTitle,
  AlertDialogTrigger as DesktopAlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'

// AlertDialog and Dialog are separate Radix primitives (separate context
// scopes) — unlike adaptive/dialog.tsx this can't share one Root and swap
// only Content. Every piece below independently picks its primitive per
// shell; the two sides just happen to expose matching prop shapes.

function AlertDialog(props: React.ComponentProps<typeof DesktopAlertDialog>) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <Sheet {...props} /> : <DesktopAlertDialog {...props} />
}

function AlertDialogTrigger(props: React.ComponentProps<typeof DesktopAlertDialogTrigger>) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <SheetTrigger {...props} /> : <DesktopAlertDialogTrigger {...props} />
}

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof DesktopAlertDialogContent>) {
  const { shell } = useLayout()
  if (shell === 'mobile') return <SheetContent className={className} {...props} />
  return <DesktopAlertDialogContent className={className} {...props} />
}

function AlertDialogHeader(props: React.ComponentProps<typeof DesktopAlertDialogHeader>) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <SheetHeader {...props} /> : <DesktopAlertDialogHeader {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<typeof DesktopAlertDialogFooter>) {
  const { shell } = useLayout()
  // Stacked full-width buttons read better than a cramped side-by-side row
  // in a bottom sheet; reversed so the primary/destructive action lands on
  // top and Cancel sits at the very bottom, iOS action-sheet style.
  if (shell === 'mobile') return <SheetFooter className={cn('flex-col-reverse', className)} {...props} />
  return <DesktopAlertDialogFooter className={className} {...props} />
}

function AlertDialogTitle(props: React.ComponentProps<typeof DesktopAlertDialogTitle>) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <SheetTitle {...props} /> : <DesktopAlertDialogTitle {...props} />
}

function AlertDialogDescription(props: React.ComponentProps<typeof DesktopAlertDialogDescription>) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <SheetDescription {...props} /> : <DesktopAlertDialogDescription {...props} />
}

// Radix's real AlertDialogAction/Cancel are both just DialogPrimitive.Close
// under the hood (see @radix-ui/react-alert-dialog source) — clicking either
// runs the caller's onClick then closes. SheetClose is the same Close
// primitive under a different alias, so it reproduces that behavior exactly.

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof DesktopAlertDialogAction>) {
  const { shell } = useLayout()
  if (shell === 'mobile') {
    return (
      <SheetClose className={cn(buttonVariants({ variant: 'destructive', size: 'lg' }), 'w-full', className)} {...props} />
    )
  }
  return <DesktopAlertDialogAction className={className} {...props} />
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof DesktopAlertDialogCancel>) {
  const { shell } = useLayout()
  if (shell === 'mobile') {
    return <SheetClose className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full', className)} {...props} />
  }
  return <DesktopAlertDialogCancel className={className} {...props} />
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
