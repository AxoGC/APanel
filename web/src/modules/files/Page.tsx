import { ArrowUp, FolderPlus, Loader2, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { Breadcrumb } from './Breadcrumb'
import { FileGrid } from './FileGrid'
import {
  deleteFiles,
  downloadUrl,
  listFiles,
  mkdir,
  readFileContent,
  renameFile,
  uploadFiles,
  writeFileContent,
  type FileEntry,
} from './api'

type PreviewState =
  | { status: 'loading' }
  | { status: 'text'; content: string }
  | { status: 'unavailable'; code: string }

function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

function parentOf(dir: string): string | null {
  if (dir === '/') return null
  const idx = dir.lastIndexOf('/')
  return idx <= 0 ? '/' : dir.slice(0, idx)
}

export default function FilesPage() {
  const { t } = useI18n()
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [previewTarget, setPreviewTarget] = useState<FileEntry | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [savingPreview, setSavingPreview] = useState(false)

  const [confirmDeletePaths, setConfirmDeletePaths] = useState<string[] | null>(null)

  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    return listFiles(path).then(setEntries)
  }

  useEffect(() => {
    setQuery('')
    setSelected(new Set())
    setError(null)
    listFiles(path)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return q ? entries.filter((e) => e.name.toLowerCase().includes(q)) : entries
  }, [entries, query])

  function toggleSelect(p: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((s) => {
      const allSelected = filtered.length > 0 && filtered.every((e) => s.has(e.path))
      return allSelected ? new Set() : new Set(filtered.map((e) => e.path))
    })
  }

  function openEntry(entry: FileEntry) {
    if (entry.isDir) {
      setPath(entry.path)
      return
    }
    setPreviewTarget(entry)
    setPreview({ status: 'loading' })
    readFileContent(entry.path)
      .then(({ content }) => setPreview({ status: 'text', content }))
      .catch((err) => {
        if (err instanceof ApiError && (err.code === 'FILE_TOO_LARGE' || err.code === 'FILE_NOT_TEXT')) {
          setPreview({ status: 'unavailable', code: err.code })
          return
        }
        setError(err instanceof ApiError ? err.message : String(err))
        setPreviewTarget(null)
        setPreview(null)
      })
  }

  async function savePreview() {
    if (!previewTarget || preview?.status !== 'text') return
    setSavingPreview(true)
    try {
      await writeFileContent(previewTarget.path, preview.content)
      setPreviewTarget(null)
      setPreview(null)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSavingPreview(false)
    }
  }

  function openRename(entry: FileEntry) {
    setRenameTarget(entry)
    setRenameValue(entry.name)
  }

  async function submitRename(e: FormEvent) {
    e.preventDefault()
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name || name === renameTarget.name) {
      setRenameTarget(null)
      return
    }
    try {
      await renameFile(renameTarget.path, name)
      setRenameTarget(null)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    }
  }

  async function submitMkdir(e: FormEvent) {
    e.preventDefault()
    const name = newFolderName.trim()
    if (!name) return
    try {
      await mkdir(joinPath(path, name))
      setMkdirOpen(false)
      setNewFolderName('')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    }
  }

  async function confirmDelete() {
    if (!confirmDeletePaths) return
    const paths = confirmDeletePaths
    try {
      await deleteFiles(paths)
      setSelected((s) => {
        const next = new Set(s)
        for (const p of paths) next.delete(p)
        return next
      })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setConfirmDeletePaths(null)
    }
  }

  async function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    try {
      await uploadFiles(path, fileList)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const parent = parentOf(path)

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('files.up')}
          disabled={parent === null}
          onClick={() => parent !== null && setPath(parent)}
        >
          <ArrowUp />
        </Button>
        <Breadcrumb path={path} onNavigate={setPath} />
        <div className="flex grow items-center justify-end gap-2">
          <div className="relative w-40 sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('files.search')}
              className="pl-8"
            />
          </div>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeletePaths(Array.from(selected))}
            >
              {t('files.delete')} ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMkdirOpen(true)}>
            <FolderPlus />
            <span className="hidden md:inline">{t('files.newFolder')}</span>
          </Button>
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            <span className="hidden md:inline">{t('files.upload')}</span>
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesSelected} />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="min-h-0 grow overflow-y-auto">
        {entries && filtered.length === 0 && <p className="text-sm text-gray-500">{t('files.empty')}</p>}
        {entries && filtered.length > 0 && (
          <FileGrid
            entries={filtered}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpen={openEntry}
            onRename={openRename}
            onDeleteOne={(p) => setConfirmDeletePaths([p])}
          />
        )}
      </div>

      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <form onSubmit={submitMkdir}>
            <DialogHeader>
              <DialogTitle>{t('files.newFolder.title')}</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t('files.newFolder.placeholder')}
              className="mt-4"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setMkdirOpen(false)}>
                {t('confirm.cancel')}
              </Button>
              <Button type="submit">{t('files.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>{t('files.rename.title')}</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t('files.rename.placeholder')}
              className="mt-4"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                {t('confirm.cancel')}
              </Button>
              <Button type="submit">{t('files.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTarget(null)
            setPreview(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTarget?.name}</DialogTitle>
          </DialogHeader>
          {preview?.status === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-gray-400" />
            </div>
          )}
          {preview?.status === 'unavailable' && (
            <div className="flex flex-col items-start gap-3 py-2">
              <DialogDescription>
                {preview.code === 'FILE_TOO_LARGE' ? t('files.preview.tooLarge') : t('files.preview.binary')}
              </DialogDescription>
              {previewTarget && (
                <Button variant="outline" size="sm" asChild>
                  <a href={downloadUrl(previewTarget.path)} download={previewTarget.name}>
                    {t('files.download')}
                  </a>
                </Button>
              )}
            </div>
          )}
          {preview?.status === 'text' && (
            <>
              <textarea
                value={preview.content}
                onChange={(e) => setPreview({ status: 'text', content: e.target.value })}
                spellCheck={false}
                className="h-96 w-full resize-none rounded-lg border border-input bg-transparent p-2.5 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPreviewTarget(null)
                    setPreview(null)
                  }}
                >
                  {t('confirm.cancel')}
                </Button>
                <Button type="button" disabled={savingPreview} onClick={savePreview}>
                  {savingPreview && <Loader2 className="animate-spin" />}
                  {t('files.save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeletePaths !== null} onOpenChange={(open) => !open && setConfirmDeletePaths(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('files.confirmDelete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('files.confirmDelete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('files.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
