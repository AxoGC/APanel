import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

// A single click always picks the option, unlike a <select> which needs one
// click to open and a second to choose.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex w-fit items-center gap-0.5 rounded-md bg-gray-100 p-0.5 dark:bg-gray-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-6 shrink-0 cursor-pointer rounded-sm px-2 text-xs whitespace-nowrap transition-colors',
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
