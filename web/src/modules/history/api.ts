import { apiFetch } from '@/lib/api'

export interface HistoryPoint {
  time: string
  cpuUsedPercent: number
  memUsedPercent: number
  memUsed: number
  memTotal: number
  swapUsedPercent: number
  swapUsed: number
  swapTotal: number
}

export interface HistoryDay {
  date: string
  points: HistoryPoint[]
}

export function getHistory(daysAgo: number) {
  return apiFetch<HistoryDay>(`/history?daysAgo=${daysAgo}`)
}
