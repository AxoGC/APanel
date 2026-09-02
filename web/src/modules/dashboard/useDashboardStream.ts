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
  processes: ProcessInfo[]
}

/** Subscribes to the dashboard's live CPU/memory/process SSE stream. The
 * browser's EventSource retries on its own if the connection drops. */
export function useDashboardStream() {
  const [overview, setOverview] = useState<Overview | null>(null)

  useEffect(() => {
    const source = new EventSource('/api/dashboard/stream')
    source.onmessage = (event) => {
      setOverview(JSON.parse(event.data) as Overview)
    }
    return () => source.close()
  }, [])

  return overview
}
