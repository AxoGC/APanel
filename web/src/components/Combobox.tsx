import { useMemo, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/lib/i18n'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  emptyText?: string
}

function useFiltered(value: string, options: string[]) {
  return useMemo(() => {
    const q = value.trim().toLowerCase()
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
    return list.slice(0, 50)
  }, [options, value])
}

// A free-text input with a filtered suggestion dropdown — not a strict
// single-select: the value is whatever's typed, options are just
// autocomplete hints (e.g. locally-pulled image tags that may not cover
// every image the user wants to reference).
export function Combobox(props: ComboboxProps) {
  const { shell } = useLayout()
  return shell === 'mobile' ? <MobileCombobox {...props} /> : <DesktopCombobox {...props} />
}

// Popover anchored to the input works on desktop, but on mobile the on-screen
// keyboard eats half the viewport and there's no room left for a floating
// list — so this opens a full-screen panel instead, input pinned to the top.
function MobileCombobox({ value, onChange, options, placeholder, emptyText }: ComboboxProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const filtered = useFiltered(value, options)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{value || placeholder || emptyText}</span>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col gap-2 bg-popover p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[env(safe-area-inset-bottom)] text-popover-foreground data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <DialogPrimitive.Title className="sr-only">{t('combobox.search.title')}</DialogPrimitive.Title>
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder || emptyText}
              autoComplete="off"
              className="flex-1"
            />
            <DialogPrimitive.Close className="shrink-0 cursor-pointer px-1 text-sm text-gray-500 dark:text-gray-400">
              {t('confirm.done')}
            </DialogPrimitive.Close>
          </div>
          <ScrollArea className="min-h-0 grow" viewportClassName="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">{emptyText}</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={cn(
                    'block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-gray-800',
                    opt === value && 'bg-gray-100 dark:bg-gray-800',
                  )}
                >
                  {opt}
                </button>
              ))
            )}
          </ScrollArea>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function DesktopCombobox({ value, onChange, options, placeholder, emptyText }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const filtered = useFiltered(value, options)

  return (
    <Popover open={open && filtered.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          data-combobox-input=""
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || emptyText}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Radix only exempts Popover.Trigger's own element from counting as
        // an "outside" interaction; Popover.Anchor isn't tracked the same
        // way, so focusing the anchor input itself was read as a
        // focus-outside event and closed the popover the instant it opened.
        onInteractOutside={(e) => {
          if (e.target instanceof HTMLElement && e.target.hasAttribute('data-combobox-input')) {
            e.preventDefault()
          }
        }}
        className="w-(--radix-popover-trigger-width) p-1"
      >
        <ScrollArea className="max-h-56" viewportClassName="max-h-56">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={cn(
                'block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                opt === value && 'bg-gray-100 dark:bg-gray-800',
              )}
            >
              {opt}
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
