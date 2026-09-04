import { apiFetch } from '@/lib/api'

export interface DatabaseInfo {
  name: string
  tableCount: number
}

export interface TableInfo {
  schema: string
  name: string
  columnCount: number
}

export function listDatabases() {
  return apiFetch<DatabaseInfo[]>('/database/databases')
}

export function listTables(database: string) {
  return apiFetch<TableInfo[]>(`/database/databases/${encodeURIComponent(database)}/tables`)
}

export function databaseSizeStreamUrl() {
  return '/api/database/databases/stream'
}

export function tableStatsStreamUrl(database: string) {
  return `/api/database/databases/${encodeURIComponent(database)}/tables/stream`
}
