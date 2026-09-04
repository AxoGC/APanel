import { ArrowUp, Eye, FolderPlus, Loader2, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ToggleButton } from '@/components/ToggleButton'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Breadcrumb } from './Breadcrumb'
import { FileGrid, FileGridHeader } from './FileGrid'
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

const PATH_STORAGE_KEY = 'apanel:files-path'

export default function FilesPage() {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem(PATH_STORAGE_KEY) || '/')
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  function refresh() {
    return listFiles(path).then(setEntries)
  }

  useEffect(() => {
    localStorage.setItem(PATH_STORAGE_KEY, path)
    setQuery('')
    setSelected(new Set())
    setError(null)
    listFiles(path)
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus()
  }, [mobileSearchOpen])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return entries.filter((e) => (showHidden || !e.name.startsWith('.')) && (!q || e.name.toLowerCase().includes(q)))
  }, [entries, query, showHidden])

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
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-6',
          mobileSearchOpen && 'max-md:block',
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('files.up')}
          disabled={parent === null}
          onClick={() => parent !== null && setPath(parent)}
          className={cn(mobileSearchOpen && 'max-md:hidden')}
        >
          <ArrowUp />
        </Button>
        <div className={cn(mobileSearchOpen && 'max-md:hidden')}>
          <Breadcrumb path={path} onNavigate={setPath} />
        </div>
        <div className={cn('flex grow items-center justify-end gap-2', mobileSearchOpen && 'max-md:w-full')}>
          <button
            type="button"
            aria-label={t('files.search')}
            onClick={() => setMobileSearchOpen(true)}
            className={cn(
              'flex size-8 cursor-pointer items-center justify-center rounded-lg border border-input text-gray-500 hover:bg-accent hover:text-gray-700 dark:bg-input/30 dark:hover:bg-input/50 dark:hover:text-gray-300 md:hidden',
              mobileSearchOpen && 'hidden',
            )}
          >
            <Search className="size-4" />
          </button>
          <div className={cn('relative w-full md:w-56', mobileSearchOpen ? 'block' : 'hidden md:block')}>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setMobileSearchOpen(false)}
              placeholder={t('files.search')}
              className="pl-8"
            />
          </div>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              aria-label={t('files.delete')}
              onClick={() => setConfirmDeletePaths(Array.from(selected))}
              className={cn(mobileSearchOpen && 'max-md:hidden')}
            >
              <Trash2 />
              <span className="hidden md:inline">{t('files.delete')} ({selected.size})</span>
            </Button>
          )}
          <ToggleButton
            active={showHidden}
            onClick={() => setShowHidden((v) => !v)}
            ariaLabel={t('files.showHidden')}
            title={t('files.showHidden')}
            className={cn('h-8', mobileSearchOpen && 'max-md:hidden')}
          >
            <Eye className="size-3.5" />
            <span className="hidden md:inline">{t('files.showHidden')}</span>
          </ToggleButton>
          <Button variant="outline" size="sm" aria-label={t('files.newFolder')} onClick={() => setMkdirOpen(true)} className={cn('h-8', mobileSearchOpen && 'max-md:hidden')}>
            <FolderPlus />
            <span className="hidden md:inline">{t('files.newFolder')}</span>
          </Button>
          <Button variant="outline" size="sm" aria-label={t('files.upload')} disabled={uploading} onClick={() => fileInputRef.current?.click()} className={cn('h-8', mobileSearchOpen && 'max-md:hidden')}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            <span className="hidden md:inline">{t('files.upload')}</span>
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesSelected} />
        </div>
      </div>

      {error && <p className="mt-4 px-4 text-xs text-red-600 sm:px-6">{error}</p>}

      {entries && filtered.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('files.empty')}</p>
      )}
      {entries && filtered.length > 0 && (
        <>
          <div className="mt-4 px-4 sm:px-6">
            <FileGridHeader entries={filtered} selected={selected} onToggleSelectAll={toggleSelectAll} />
          </div>
          <ScrollArea className="min-h-0 grow px-4 sm:px-6">
            <FileGrid
              entries={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onOpen={openEntry}
              onRename={openRename}
              onDeleteOne={(p) => setConfirmDeletePaths([p])}
              hideHeader
            />
          </ScrollArea>
        </>
      )}

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

      <SectionedDialog
        open={previewTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewTarget(null)
            setPreview(null)
          }
        }}
        title={previewTarget?.name ?? ''}
        className="h-[85vh] max-w-2xl"
        bodyClassName="p-0"
        footer={
          preview?.status === 'text' ? (
            <div className="flex justify-end gap-2">
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
            </div>
          ) : undefined
        }
      >
        {preview?.status === 'loading' && (
          <div className="flex justify-center px-4 py-8">
            <Loader2 className="size-5 animate-spin text-gray-400" />
          </div>
        )}
        {preview?.status === 'unavailable' && (
          <div className="flex flex-col items-start gap-3 px-4 py-2">
            <p className="text-sm text-gray-500">
              {preview.code === 'FILE_TOO_LARGE' ? t('files.preview.tooLarge') : t('files.preview.binary')}
            </p>
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
          <textarea
            value={preview.content}
            onChange={(e) => setPreview({ status: 'text', content: e.target.value })}
            spellCheck={false}
            className="h-full min-h-0 w-full resize-none bg-transparent p-4 font-mono text-xs outline-none"
          />
        )}
      </SectionedDialog>

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
