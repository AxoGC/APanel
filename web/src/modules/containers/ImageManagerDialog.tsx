import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { deleteContainerImages, listContainerImages, type ContainerImage } from './api'
import { CreateImageDialog } from './CreateImageDialog'
import { UsageCell } from './UsageCell'

type ImageFilter = 'all' | 'unused' | 'used'

export function ImageManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [images, setImages] = useState<ContainerImage[] | null>(null)
  const [filter, setFilter] = useState<ImageFilter>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const loadImages = async () => {
    try {
      setImages(await listContainerImages())
    } catch {
      // surfaced by the global error dialog
    }
  }

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    void loadImages()
  }, [open])

  const filteredImages = useMemo(() => {
    if (!images) return []
    if (filter === 'used') return images.filter((image) => image.usedBy.length > 0)
    if (filter === 'unused') return images.filter((image) => image.usedBy.length === 0)
    return images
  }, [filter, images])
  const selectableImages = filteredImages.filter((image) => image.usedBy.length === 0)
  const allSelectable = selectableImages.length > 0 && selectableImages.every((image) => selected.has(image.id))

  const toggleImage = (image: ContainerImage) => {
    if (image.usedBy.length > 0) return
    setSelected((current) => {
      const next = new Set(current)
      next.has(image.id) ? next.delete(image.id) : next.add(image.id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current)
      if (allSelectable) selectableImages.forEach((image) => next.delete(image.id))
      else selectableImages.forEach((image) => next.add(image.id))
      return next
    })
  }

  const deleteSelected = async () => {
    setDeleting(true)
    try {
      await deleteContainerImages(Array.from(selected))
      setSelected(new Set())
      await loadImages()
    } catch {
      // surfaced by the global error dialog
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('containers.images.title')} height="85vh" drawer>
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-gray-500 sm:inline">{t('containers.images.filter')}</span>
            <Select value={filter} onValueChange={(value) => setFilter(value as ImageFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('containers.images.filter.all')}</SelectItem>
                <SelectItem value="unused">{t('containers.images.filter.unused')}</SelectItem>
                <SelectItem value="used">{t('containers.images.filter.used')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              <span className="hidden sm:inline">{t('containers.images.create')}</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting}>
                  <Trash2 />
                  <span className="hidden sm:inline">{t('containers.images.delete')}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('containers.images.confirmDelete.title')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('containers.images.confirmDelete.description')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deleteSelected()}>{t('containers.images.delete')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex min-h-0 grow flex-col">
          <div className="flex items-center gap-1 border-b border-gray-200 px-2 pb-1.5 md:gap-3 dark:border-gray-800">
            <div className="w-4 shrink-0">
              <Checkbox
                checked={allSelectable}
                disabled={selectableImages.length === 0}
                onCheckedChange={toggleAll}
                aria-label={t('files.selectAll')}
              />
            </div>
            <div className="min-w-0 flex-1 text-xs text-gray-500">{t('containers.images.name')}</div>
            <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{t('containers.images.size')}</div>
            <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{t('containers.usage')}</div>
          </div>

          <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
            {images && filteredImages.length === 0 && <p className="px-2 py-4 text-sm text-gray-500">{t('containers.images.empty')}</p>}
            {filteredImages.map((image) => {
              const inUse = image.usedBy.length > 0
              return (
                <div
                  key={image.id}
                  className="flex items-center gap-1 border-b border-gray-100 px-2 py-2 last:border-b-0 hover:bg-gray-100 md:gap-3 dark:border-gray-900 dark:hover:bg-gray-800"
                >
                  <div className="w-4 shrink-0">
                    <Checkbox
                      checked={selected.has(image.id)}
                      disabled={inUse}
                      onCheckedChange={() => toggleImage(image)}
                      aria-label={image.name}
                    />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{image.name}</div>
                  <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{formatBytes(image.size)}</div>
                  <div className="w-14 shrink-0 text-right md:w-24">
                    <UsageCell usedBy={image.usedBy} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <CreateImageDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SectionedDialog>
  )
}
