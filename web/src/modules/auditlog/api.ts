import { apiFetch } from '@/lib/api'

export interface AuditLogEntry {
  id: number
  at: string
  userRemark: string
  action?: string
  method: string
  path: string
  status: number
}

export function getAuditLog(params: { limit?: number; beforeId?: number } = {}) {
  const query = new URLSearchParams()
  if (params.limit) query.set('limit', String(params.limit))
  if (params.beforeId) query.set('beforeId', String(params.beforeId))
  const qs = query.toString()
  return apiFetch<AuditLogEntry[]>(`/auditlog${qs ? `?${qs}` : ''}`)
}
