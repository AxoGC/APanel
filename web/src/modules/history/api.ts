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

export type CollectionTargetName = 'cpu' | 'memory' | 'swap'

export interface CollectionTarget {
  enabled: boolean
  intervalMinutes: number
  retentionDays: number
}

export type HistoryCollectionSettings = Record<CollectionTargetName, CollectionTarget>

export function getHistorySettings() {
  return apiFetch<HistoryCollectionSettings>('/history/settings')
}

export function putHistorySettings(settings: HistoryCollectionSettings) {
  return apiFetch<HistoryCollectionSettings>('/history/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
