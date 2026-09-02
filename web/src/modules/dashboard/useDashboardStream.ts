import { useEffect, useState } from 'react'

export interface ProcessInfo {
  pid: number
  name: string
  user: string
  cpuPercent: number
  memRSS: number
}

export interface Overview {
  cpuPercent: number
  memTotal: number
  memUsed: number
  swapTotal: number
  swapUsed: number
  processes: ProcessInfo[]
}

export type ProcessSort = 'cpu' | 'mem'

/** Subscribes to the dashboard's live CPU/memory/process SSE stream. The
 * process sort is server-side (the backend only keeps the top 50 by
 * whichever metric is requested, so sorting client-side after the fact
 * would miss processes that never made that cut) — changing it reconnects
 * the stream. The browser's EventSource otherwise retries on its own if the
 * connection drops. */
export function useDashboardStream(sort: ProcessSort) {
  const [overview, setOverview] = useState<Overview | null>(null)

  useEffect(() => {
    const source = new EventSource(`/api/dashboard/stream?sort=${sort}`)
    source.onmessage = (event) => {
      setOverview(JSON.parse(event.data) as Overview)
    }
    return () => source.close()
  }, [sort])

  return overview
}
