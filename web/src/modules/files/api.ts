import { apiFetch, ApiError } from '@/lib/api'
import { MOCK } from '@/lib/mock'

export interface FileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modTime: string
}

export function listFiles(path: string) {
  return apiFetch<FileEntry[]>(`/files?${new URLSearchParams({ path })}`)
}

export function mkdir(path: string) {
  return apiFetch<null>('/files/mkdir', { method: 'POST', body: JSON.stringify({ path }) })
}

export function renameFile(path: string, newName: string) {
  return apiFetch<null>('/files/rename', { method: 'POST', body: JSON.stringify({ path, newName }) })
}

export function deleteFiles(paths: string[]) {
  return apiFetch<null>('/files/delete', { method: 'POST', body: JSON.stringify({ paths }) })
}

export function readFileContent(path: string) {
  return apiFetch<{ content: string }>(`/files/content?${new URLSearchParams({ path })}`)
}

export function writeFileContent(path: string, content: string) {
  return apiFetch<null>('/files/content', { method: 'PUT', body: JSON.stringify({ path, content }) })
}

export function downloadUrl(path: string) {
  return `/api/files/download?${new URLSearchParams({ path })}`
}

export async function uploadFiles(dir: string, fileList: FileList) {
  if (MOCK) return
  const form = new FormData()
  for (const file of Array.from(fileList)) form.append('files', file)
  const res = await fetch(`/api/files/upload?${new URLSearchParams({ path: dir })}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  const body = (await res.json()) as { code: string; error?: string }
  if (body.code !== 'OK') throw new ApiError(body.code, body.error)
}
