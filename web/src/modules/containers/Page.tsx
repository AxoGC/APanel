import { HardDrive, Images, Network, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  listContainers,
  runContainerAction,
  type ContainerActionName,
  type ContainerInfo,
  type StatusFilter,
} from './api'
import { ContainerDetailDialog } from './ContainerDetailDialog'
import { ContainerLogsDialog } from './ContainerLogsDialog'
import { CreateContainerDialog } from './CreateContainerDialog'
import { ImageManagerDialog } from './ImageManagerDialog'
import { NetworkManagerDialog } from './NetworkManagerDialog'
import { VolumeManagerDialog } from './VolumeManagerDialog'
import { ContainerTable, ContainerTableHeader } from './ContainerTable'

export default function ContainersPage() {
  const { t } = useI18n()
  const [containers, setContainers] = useState<ContainerInfo[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('running')
  const [pending, setPending] = useState<Record<string, ContainerActionName | undefined>>({})
  const [logsFor, setLogsFor] = useState<ContainerInfo | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [networksOpen, setNetworksOpen] = useState(false)
  const [volumesOpen, setVolumesOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    return listContainers({ status, q: query }).then(setContainers)
  }

  // The backend owns filtering (status maps straight onto Docker's own
  // container state filter); a fresh request goes out on every filter
  // change, debounced so typing doesn't fire one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh().catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query])

  useEffect(() => {
    if (mobileSearchOpen) searchInputRef.current?.focus()
  }, [mobileSearchOpen])

  async function handleAction(id: string, action: ContainerActionName) {
    setPending((p) => ({ ...p, [id]: action }))
    try {
      await runContainerAction(id, action)
      await refresh()
    } catch {
      // surfaced by the global error dialog
    } finally {
      setPending((p) => ({ ...p, [id]: undefined }))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          aria-label={t('containers.search')}
          onClick={() => setMobileSearchOpen(true)}
          className={cn(
            'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-input text-gray-500 hover:bg-accent hover:text-gray-700 dark:bg-input/30 dark:hover:bg-input/50 dark:hover:text-gray-300 md:hidden',
            mobileSearchOpen && 'hidden',
          )}
        >
          <Search className="size-4" />
        </button>
        <div className={cn('relative w-full md:w-64', mobileSearchOpen ? 'block' : 'hidden md:block')}>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setMobileSearchOpen(false)}
            placeholder={t('containers.search')}
            className="pl-8"
          />
        </div>
        <div className={cn('flex min-w-0 shrink items-center gap-2', mobileSearchOpen && 'max-md:hidden')}>
          <span className="hidden text-xs text-gray-500 md:inline">{t('containers.status')}</span>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="running">{t('containers.state.running')}</SelectItem>
              <SelectItem value="exited">{t('containers.state.exited')}</SelectItem>
              <SelectItem value="all">{t('containers.filter.all')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className={cn('ml-auto flex items-center gap-2', mobileSearchOpen && 'max-md:hidden')}>
          <Button variant="outline" size="sm" className="h-8" aria-label={t('containers.images')} onClick={() => setImagesOpen(true)}>
            <Images />
            <span className="hidden md:inline">{t('containers.images')}</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8" aria-label={t('containers.networks')} onClick={() => setNetworksOpen(true)}>
            <Network />
            <span className="hidden md:inline">{t('containers.networks')}</span>
          </Button>
          <Button variant="outline" size="sm" className="h-8" aria-label={t('containers.volumes')} onClick={() => setVolumesOpen(true)}>
            <HardDrive />
            <span className="hidden md:inline">{t('containers.volumes')}</span>
          </Button>
          <Button
            size="sm"
            aria-label={t('containers.create')}
            onClick={() => setCreateOpen(true)}
            className="h-8 border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
          >
            <Plus />
            <span className="hidden md:inline">{t('containers.create')}</span>
          </Button>
        </div>
      </div>

      {containers && containers.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('containers.empty')}</p>
      )}
      {containers && containers.length > 0 && (
        <>
          <div className="mt-4 px-4 sm:px-6">
            <ContainerTableHeader />
          </div>
          <ScrollArea className="min-h-0 grow px-4 sm:px-6">
            <ContainerTable
              containers={containers}
              pending={pending}
              onAction={handleAction}
              onShowLogs={setLogsFor}
              onShowDetail={(c) => setDetailFor(c.id)}
              hideHeader
            />
          </ScrollArea>
        </>
      )}

      <ContainerLogsDialog
        open={logsFor !== null}
        onOpenChange={(open) => !open && setLogsFor(null)}
        container={logsFor}
      />
      <ContainerDetailDialog id={detailFor} onOpenChange={(open) => !open && setDetailFor(null)} />
      <ImageManagerDialog open={imagesOpen} onOpenChange={setImagesOpen} />
      <NetworkManagerDialog open={networksOpen} onOpenChange={setNetworksOpen} />
      <VolumeManagerDialog open={volumesOpen} onOpenChange={setVolumesOpen} />
      <CreateContainerDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
    </div>
  )
}
