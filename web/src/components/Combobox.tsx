import { useMemo, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// A free-text input with a filtered suggestion dropdown — not a strict
// single-select: the value is whatever's typed, options are just
// autocomplete hints (e.g. locally-pulled image tags that may not cover
// every image the user wants to reference).
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
    return list.slice(0, 50)
  }, [options, value])

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
