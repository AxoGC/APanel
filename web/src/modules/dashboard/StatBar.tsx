export function StatBar({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-500">{detail}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-theme-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  )
}
