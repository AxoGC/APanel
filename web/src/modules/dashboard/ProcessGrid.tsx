import { formatBytes, formatPercent } from '@/lib/format'
import type { ProcessInfo } from './useDashboardStream'

// Object-array data uses a grid, never a <table>: tables don't reflow onto
// small screens, and this panel is meant to be read from a phone.
export function ProcessGrid({ processes }: { processes: ProcessInfo[] }) {
  return (
    <div className="grid max-w-2xl grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 sm:grid-cols-[1fr_auto_auto_auto]">
      <div className="text-xs text-gray-500">Process</div>
      <div className="hidden text-xs text-gray-500 sm:block">User</div>
      <div className="text-right text-xs text-gray-500">CPU</div>
      <div className="text-right text-xs text-gray-500">Memory</div>

      {processes.map((p) => (
        <div key={p.pid} className="contents">
          <div className="truncate text-sm text-gray-700 dark:text-gray-300">{p.name}</div>
          <div className="hidden truncate text-sm text-gray-700 sm:block dark:text-gray-300">{p.user}</div>
          <div className="text-right text-sm text-gray-700 dark:text-gray-300">{formatPercent(p.cpuPercent)}</div>
          <div className="text-right text-sm text-gray-700 dark:text-gray-300">{formatBytes(p.memRSS)}</div>
        </div>
      ))}
    </div>
  )
}
