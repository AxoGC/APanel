import { apiFetch } from '@/lib/api'

export interface UserInfo {
  id: number
  remark: string
}

export function listUsers() {
  return apiFetch<UserInfo[]>('/users')
}

export function createUser(password: string, remark: string) {
  return apiFetch<UserInfo>('/users', {
    method: 'POST',
    body: JSON.stringify({ password, remark }),
  })
}

export function updateUser(id: number, fields: { password?: string; remark: string }) {
  return apiFetch<UserInfo[]>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ password: fields.password ?? '', remark: fields.remark }),
  })
}

export function deleteUser(id: number) {
  return apiFetch<UserInfo[]>(`/users/${id}`, { method: 'DELETE' })
}
