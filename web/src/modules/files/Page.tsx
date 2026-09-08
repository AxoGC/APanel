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
import { ButtonGroup } from '@/components/ui/button-group'
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
import { isImageFile } from './format'

type PreviewState =
  | { status: 'loading' }
  | { status: 'text'; content: string }
  | { status: 'image'; width: number; height: number }
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

// Lets the footer's submit button (rendered as a sibling of the form, not a
// descendant — see SectionedDialog) still submit this form via the HTML
// form="..." attribute.
const MKDIR_FORM_ID = 'files-mkdir-form'

// The preview dialog has no horizontal chrome (its body has no padding)
// and a header a bit under 4rem tall, so the desktop image box is capped
// against the viewport minus that allowance to keep the whole dialog
// on-screen.
const PREVIEW_HEADER_ALLOWANCE = 64

// Scales (naturalWidth, naturalHeight) down (never up) by the same factor
// on both axes so the result fits within (maxWidth, maxHeight) while
// exactly preserving the image's aspect ratio — unlike capping width and
// height independently, which can leave a box whose ratio no longer
// matches the image once one axis clamps before the other.
function fitWithinBox(naturalWidth: number, naturalHeight: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight)
  return { width: naturalWidth * scale, height: naturalHeight * scale }
}

export default function FilesPage() {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem(PATH_STORAGE_KEY) || '/')
  const [entries, setEntries] = useState<FileEntry[] | null>(null)
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [previewTarget, setPreviewTarget] = useState<FileEntry | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [savingPreview, setSavingPreview] = useState(false)
  const [viewportSize, setViewportSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

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
    listFiles(path)
      .then(setEntries)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus()
  }, [mobileSearchOpen])

  // Tracked for the page's whole lifetime, not just while an image preview
  // is open — a resize that happens before the preview opens must still be
  // picked up, since the desktop preview box is sized against this value.
  useEffect(() => {
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
    if (isImageFile(entry.name)) {
      setPreview({ status: 'loading' })
      const probe = new window.Image()
      probe.onload = () => setPreview({ status: 'image', width: probe.naturalWidth, height: probe.naturalHeight })
      probe.onerror = () => setPreview({ status: 'unavailable', code: 'FILE_NOT_TEXT' })
      probe.src = downloadUrl(entry.path)
      return
    }
    setPreview({ status: 'loading' })
    readFileContent(entry.path)
      .then(({ content }) => setPreview({ status: 'text', content }))
      .catch((err) => {
        if (err instanceof ApiError && (err.code === 'FILE_TOO_LARGE' || err.code === 'FILE_NOT_TEXT')) {
          setPreview({ status: 'unavailable', code: err.code })
          return
        }
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
    } catch {
      // surfaced by the global error dialog
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
    } catch {
      // surfaced by the global error dialog
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
    } catch {
      // surfaced by the global error dialog
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
    } catch {
      // surfaced by the global error dialog
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
    } catch {
      // surfaced by the global error dialog
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const parent = parentOf(path)

  // Desktop: shrink-wrap the dialog to the image, capped to the viewport.
  // Below the md breakpoint the dialog's width is fixed instead (see
  // SectionedDialog's className below), so there's nothing to compute.
  const previewBox =
    preview?.status === 'image' && viewportSize.w >= 768
      ? fitWithinBox(
          preview.width,
          preview.height,
          viewportSize.w * 0.9,
          viewportSize.h * 0.85 - PREVIEW_HEADER_ALLOWANCE,
        )
      : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-nowrap items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
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
        <div className={cn('min-w-0 grow', mobileSearchOpen && 'max-md:hidden')}>
          <Breadcrumb path={path} onNavigate={setPath} />
        </div>
        <div className={cn('flex shrink-0 items-center justify-end gap-2', mobileSearchOpen && 'max-md:w-full')}>
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

          {/* Desktop: individually bordered buttons with labels. */}
          <div className="hidden items-center gap-2 md:flex">
            <ToggleButton
              active={showHidden}
              onClick={() => setShowHidden((v) => !v)}
              ariaLabel={t('files.showHidden')}
              title={t('files.showHidden')}
              className="h-8"
            >
              <Eye className="size-3.5" />
              <span>{t('files.showHidden')}</span>
            </ToggleButton>
            <Button variant="outline" size="sm" aria-label={t('files.newFolder')} onClick={() => setMkdirOpen(true)} className="h-8">
              <FolderPlus />
              <span>{t('files.newFolder')}</span>
            </Button>
            <Button variant="outline" size="sm" aria-label={t('files.upload')} disabled={uploading} onClick={() => fileInputRef.current?.click()} className="h-8">
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              <span>{t('files.upload')}</span>
            </Button>
          </div>

          {/* Mobile: icon-only buttons collapsed into a single button group. */}
          <ButtonGroup className={cn('md:hidden', mobileSearchOpen && 'hidden')}>
            <Button variant="ghost" size="icon-sm" aria-label={t('files.search')} onClick={() => setMobileSearchOpen(true)}>
              <Search />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-pressed={showHidden}
              aria-label={t('files.showHidden')}
              onClick={() => setShowHidden((v) => !v)}
              className={cn(showHidden && 'text-theme-600 dark:text-theme-400')}
            >
              <Eye />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('files.newFolder')} onClick={() => setMkdirOpen(true)}>
              <FolderPlus />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('files.upload')} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            </Button>
          </ButtonGroup>
          <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesSelected} />
        </div>
      </div>

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

      <SectionedDialog
        open={mkdirOpen}
        onOpenChange={setMkdirOpen}
        title={t('files.newFolder.title')}
        className="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMkdirOpen(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button type="submit" form={MKDIR_FORM_ID}>
              {t('files.create')}
            </Button>
          </div>
        }
      >
        <form id={MKDIR_FORM_ID} onSubmit={submitMkdir}>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('files.newFolder.placeholder')}
          />
        </form>
      </SectionedDialog>

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
        className={cn('max-w-2xl overflow-hidden', preview?.status === 'image' && 'md:w-fit md:max-w-none')}
        height={preview?.status === 'image' ? undefined : '85vh'}
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
        {preview?.status === 'image' && previewTarget && (
          <div
            style={
              previewBox
                ? { width: previewBox.width, height: previewBox.height }
                : { aspectRatio: `${preview.width} / ${preview.height}` }
            }
            className={cn('mx-auto bg-gray-100 dark:bg-gray-900', !previewBox && 'w-full max-h-[calc(85vh-4rem)]')}
          >
            <img
              src={downloadUrl(previewTarget.path)}
              alt={previewTarget.name}
              className="h-full w-full object-contain"
            />
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
