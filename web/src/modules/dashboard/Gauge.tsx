export function Gauge({
  label,
  value,
  percentText,
  details,
}: {
  label: string
  value: number
  percentText: string
  details?: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <span className="text-2xl leading-tight font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {percentText}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-theme-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {details && details.length > 0 && (
        <div className="flex flex-col">
          {details.map((line) => (
            <span key={line} className="text-xs text-gray-400">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
