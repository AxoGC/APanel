import * as React from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent as ModalContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SheetContent } from '@/components/ui/sheet'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'

// Shares one Root/Portal/state (re-exported straight from ui/dialog) and
// only swaps the Content presentation layer — see
// AGENTS/plans/adaptive-ui-layer.md §2. `desktopClassName` carries sizing
// that only makes sense for a centered modal (max-w-*, h-[85vh], …); it's
// dropped on mobile, where the sheet is always full-width and bounded by
// its own max-h.
function DialogContent({
  className,
  desktopClassName,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof ModalContent> & { desktopClassName?: string }) {
  const { shell } = useLayout()
  if (shell === 'mobile') return <SheetContent className={className} {...props} />
  return <ModalContent className={cn(className, desktopClassName)} showCloseButton={showCloseButton} {...props} />
}

export { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
