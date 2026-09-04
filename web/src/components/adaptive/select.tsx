import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import * as React from 'react'
import {
  Select as DesktopSelect,
  SelectContent as DesktopSelectContent,
  SelectGroup,
  SelectItem as DesktopSelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger as DesktopSelectTrigger,
  SelectValue as DesktopSelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useI18n } from '@/lib/i18n'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'

// Radix Select's Content is a positioned popper anchored to the trigger —
// there's no "full screen" mode to swap in like adaptive/dialog.tsx does.
// So on mobile this doesn't reuse SelectPrimitive at all: Root tracks
// open/value itself and Trigger/Content/Item render as plain buttons inside
// the phase-1 sheet, sharing the same value/onValueChange call-site API.
const TRIGGER_CLASSES =
  'flex w-32 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4'

interface MobileSelectState {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  open: boolean
  setOpen: (open: boolean) => void
  labelMap: Map<string, React.ReactNode>
}

const MobileSelectContext = React.createContext<MobileSelectState | null>(null)

function buildLabelMap(children: React.ReactNode): Map<string, React.ReactNode> {
  const map = new Map<string, React.ReactNode>()
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === SelectContent) {
      const contentProps = child.props as { children?: React.ReactNode }
      React.Children.forEach(contentProps.children, (item) => {
        if (!React.isValidElement(item) || item.type !== SelectItem) return
        const itemProps = item.props as { value: string; children?: React.ReactNode }
        map.set(itemProps.value, itemProps.children)
      })
    }
  })
  return map
}

function Select({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const { shell } = useLayout()
  const [open, setOpen] = React.useState(false)
  const labelMap = React.useMemo(() => buildLabelMap(children), [children])

  if (shell === 'desktop') {
    return (
      <DesktopSelect value={value} onValueChange={onValueChange} disabled={disabled}>
        {children}
      </DesktopSelect>
    )
  }

  return (
    <MobileSelectContext.Provider value={{ value, onValueChange, disabled, open, setOpen, labelMap }}>
      {children}
    </MobileSelectContext.Provider>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof DesktopSelectTrigger>) {
  const { shell } = useLayout()
  const ctx = React.useContext(MobileSelectContext)
  if (shell === 'desktop') {
    return (
      <DesktopSelectTrigger className={className} size={size} {...props}>
        {children}
      </DesktopSelectTrigger>
    )
  }
  if (!ctx) throw new Error('Select.* must be rendered within <Select>')

  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      disabled={ctx.disabled}
      onClick={() => ctx.setOpen(true)}
      className={cn(TRIGGER_CLASSES, className)}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </button>
  )
}

function SelectValue({ placeholder, ...props }: React.ComponentProps<typeof DesktopSelectValue>) {
  const { shell } = useLayout()
  const ctx = React.useContext(MobileSelectContext)
  if (shell === 'desktop') return <DesktopSelectValue placeholder={placeholder} {...props} />
  if (!ctx) throw new Error('Select.* must be rendered within <Select>')

  const label = ctx.value !== undefined ? ctx.labelMap.get(ctx.value) : undefined
  return (
    <span data-slot="select-value" className={cn('flex items-center gap-1.5', !label && 'text-muted-foreground')}>
      {label ?? placeholder}
    </span>
  )
}

function SelectContent({ className, children, ...props }: React.ComponentProps<typeof DesktopSelectContent>) {
  const { shell } = useLayout()
  const { t } = useI18n()
  const ctx = React.useContext(MobileSelectContext)
  if (shell === 'desktop') {
    return (
      <DesktopSelectContent className={className} {...props}>
        {children}
      </DesktopSelectContent>
    )
  }
  if (!ctx) throw new Error('Select.* must be rendered within <Select>')

  return (
    <Sheet open={ctx.open} onOpenChange={ctx.setOpen}>
      <SheetContent className="gap-2 p-2">
        <SheetTitle className="sr-only">{t('select.picker.title')}</SheetTitle>
        <div className={cn('scrollbar-shadcn flex max-h-[60dvh] min-h-0 flex-col gap-0.5 overflow-y-auto', className)}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SelectItem({ className, children, value, disabled, ...props }: React.ComponentProps<typeof DesktopSelectItem>) {
  const { shell } = useLayout()
  const ctx = React.useContext(MobileSelectContext)
  if (shell === 'desktop') {
    return (
      <DesktopSelectItem className={className} value={value} disabled={disabled} {...props}>
        {children}
      </DesktopSelectItem>
    )
  }
  if (!ctx) throw new Error('Select.* must be rendered within <Select>')

  const selected = ctx.value === value
  return (
    <button
      type="button"
      data-slot="select-item"
      disabled={disabled}
      onClick={() => {
        ctx.onValueChange?.(value)
        ctx.setOpen(false)
      }}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-left text-sm outline-hidden select-none disabled:pointer-events-none disabled:opacity-50',
        selected ? 'bg-accent text-accent-foreground' : 'active:bg-accent/50',
        className,
      )}
    >
      <span>{children}</span>
      {selected && <CheckIcon className="size-4 shrink-0" />}
    </button>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
