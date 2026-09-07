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
import { containerVolumeSizeStreamUrl, deleteContainerVolumes, listContainerVolumes, type ContainerVolume } from './api'
import { CreateVolumeDialog } from './CreateVolumeDialog'
import { UsageCell } from './UsageCell'

type VolumeFilter = 'all' | 'unused' | 'used'

export function VolumeManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [volumes, setVolumes] = useState<ContainerVolume[] | null>(null)
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<VolumeFilter>('all')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const loadVolumes = async () => {
    try {
      setVolumes(await listContainerVolumes())
    } catch {
      // surfaced by the global error dialog
    }
  }

  // Step 1: name + usage, a plain request.
  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setSizes({})
    void loadVolumes()
  }, [open])

  // Step 2: each volume's on-disk size, filled in as the backend's scan
  // streams results in — one SSE message per volume, closed once every
  // volume has been reported.
  useEffect(() => {
    if (!open || volumes === null) return
    const source = new EventSource(containerVolumeSizeStreamUrl())
    source.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { name: string; bytes: number }
      setSizes((prev) => ({ ...prev, [data.name]: data.bytes }))
    }
    source.addEventListener('done', () => source.close())
    source.addEventListener('failed', () => source.close())
    source.onerror = () => source.close()
    return () => source.close()
  }, [open, volumes])

  const filteredVolumes = useMemo(() => {
    if (!volumes) return []
    if (filter === 'used') return volumes.filter((volume) => volume.usedBy.length > 0)
    if (filter === 'unused') return volumes.filter((volume) => volume.usedBy.length === 0)
    return volumes
  }, [filter, volumes])
  const selectableVolumes = filteredVolumes.filter((volume) => volume.usedBy.length === 0)
  const allSelectable = selectableVolumes.length > 0 && selectableVolumes.every((volume) => selected.has(volume.name))

  const toggleVolume = (volume: ContainerVolume) => {
    if (volume.usedBy.length > 0) return
    setSelected((current) => {
      const next = new Set(current)
      next.has(volume.name) ? next.delete(volume.name) : next.add(volume.name)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current)
      if (allSelectable) selectableVolumes.forEach((volume) => next.delete(volume.name))
      else selectableVolumes.forEach((volume) => next.add(volume.name))
      return next
    })
  }

  const deleteSelected = async () => {
    setDeleting(true)
    try {
      await deleteContainerVolumes(Array.from(selected))
      setSelected(new Set())
      await loadVolumes()
    } catch {
      // surfaced by the global error dialog
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('containers.volumes.title')} className="max-w-3xl" height="85vh">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-gray-500 sm:inline">{t('containers.volumes.filter')}</span>
            <Select value={filter} onValueChange={(value) => setFilter(value as VolumeFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('containers.volumes.filter.all')}</SelectItem>
                <SelectItem value="unused">{t('containers.volumes.filter.unused')}</SelectItem>
                <SelectItem value="used">{t('containers.volumes.filter.used')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              <span className="hidden sm:inline">{t('containers.volumes.create')}</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting}>
                  <Trash2 />
                  <span className="hidden sm:inline">{t('containers.volumes.delete')}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('containers.volumes.confirmDelete.title')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('containers.volumes.confirmDelete.description')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void deleteSelected()}>{t('containers.volumes.delete')}</AlertDialogAction>
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
                disabled={selectableVolumes.length === 0}
                onCheckedChange={toggleAll}
                aria-label={t('files.selectAll')}
              />
            </div>
            <div className="min-w-0 flex-1 text-xs text-gray-500">{t('containers.volumes.name')}</div>
            <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{t('containers.volumes.size')}</div>
            <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{t('containers.usage')}</div>
          </div>

          <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
            {volumes && filteredVolumes.length === 0 && (
              <p className="px-2 py-4 text-sm text-gray-500">{t('containers.volumes.empty')}</p>
            )}
            {filteredVolumes.map((volume) => {
              const inUse = volume.usedBy.length > 0
              const size = sizes[volume.name]
              return (
                <div
                  key={volume.name}
                  className="flex items-center gap-1 border-b border-gray-100 px-2 py-2 last:border-b-0 hover:bg-gray-100 md:gap-3 dark:border-gray-900 dark:hover:bg-gray-800"
                >
                  <div className="w-4 shrink-0">
                    <Checkbox
                      checked={selected.has(volume.name)}
                      disabled={inUse}
                      onCheckedChange={() => toggleVolume(volume)}
                      aria-label={volume.name}
                    />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{volume.name}</div>
                  <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">
                    {size === undefined ? '…' : formatBytes(size)}
                  </div>
                  <div className="w-14 shrink-0 text-right md:w-24">
                    <UsageCell usedBy={volume.usedBy} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <CreateVolumeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </SectionedDialog>
  )
}
