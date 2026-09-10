import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { apiLinkUrl } from '@/lib/apiBase'

export interface ProcessInfo {
  pid: number
  ppid: number
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
  netInterface: string
  netRxBytesPerSec: number
  netTxBytesPerSec: number
  load1: number
  load5: number
  load15: number
  processes: ProcessInfo[]
}

export interface NetworkGaugeSettings {
  maxMbps: number
}

// silent: fetched once in the background to seed the gauge; its own dialog
// re-fetches and surfaces errors normally when the admin opens it to edit.
export function getDashboardNetworkSettings() {
  return apiFetch<NetworkGaugeSettings>('/dashboard/network-settings', undefined, { silent: true })
}

export function putDashboardNetworkSettings(settings: NetworkGaugeSettings) {
  return apiFetch<NetworkGaugeSettings>('/dashboard/network-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export type ProcessSort = 'cpu' | 'mem'

// State is /proc's raw one-letter code (R, S, D, Z, T, t, X, I — see
// proc(5)); translated client-side, same as the services/containers
// modules translate their own backend enums.
export interface ProcessDetail {
  pid: number
  ppid: number
  name: string
  state: string
  user: string
  cpuPercent: number
  memRSS: number
  cmdline: string
  exe: string
  cwd: string
  startTime: string
  priority: number
  nice: number
  threads: number
  vmSize: number
  vmSwap: number
  openFiles: number
}

export function getProcessDetail(pid: number) {
  return apiFetch<ProcessDetail>(`/dashboard/processes/${pid}`)
}

export function terminateProcess(pid: number) {
  return apiFetch<null>(`/dashboard/processes/${pid}/terminate`, { method: 'POST' })
}

export interface TerminateTreeResult {
  count: number
}

export function terminateProcessTree(pid: number) {
  return apiFetch<TerminateTreeResult>(`/dashboard/processes/${pid}/terminate-tree`, { method: 'POST' })
}

/** Subscribes to the dashboard's live CPU/memory/process SSE stream. The
 * server sends every process (with its default sort order set by `sort`,
 * used by the flat view); the tree view re-sorts client-side by
 * collapsed-subtree totals instead. Changing `sort` reconnects the stream.
 * The browser's EventSource otherwise retries on its own if the connection
 * drops. */
export function useDashboardStream(sort: ProcessSort) {
  const [overview, setOverview] = useState<Overview | null>(null)

  useEffect(() => {
    const source = new EventSource(apiLinkUrl(`/dashboard/stream?sort=${sort}`))
    source.onmessage = (event) => {
      setOverview(JSON.parse(event.data) as Overview)
    }
    return () => source.close()
  }, [sort])

  return overview
}
