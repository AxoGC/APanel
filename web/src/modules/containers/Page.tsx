import { Images, Network, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import {
  listContainers,
  runContainerAction,
  type ContainerActionName,
  type ContainerInfo,
  type StatusFilter,
} from './api'
import { ContainerDetailDialog } from './ContainerDetailDialog'
import { ContainerGrid } from './ContainerGrid'
import { ContainerLogsDialog } from './ContainerLogsDialog'
import { CreateContainerDialog } from './CreateContainerDialog'
import { ImageManagerDialog } from './ImageManagerDialog'
import { NetworkManagerDialog } from './NetworkManagerDialog'
import { ContainerTable } from './ContainerTable'

export default function ContainersPage() {
  const { t } = useI18n()
  const dataLayout = useDataLayout()
  const [containers, setContainers] = useState<ContainerInfo[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('running')
  const [pending, setPending] = useState<Record<string, ContainerActionName | undefined>>({})
  const [error, setError] = useState<string | null>(null)
  const [logsFor, setLogsFor] = useState<ContainerInfo | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [networksOpen, setNetworksOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  function refresh() {
    return listContainers({ status, q: query }).then(setContainers)
  }

  // The backend owns filtering (status maps straight onto Docker's own
  // container state filter); a fresh request goes out on every filter
  // change, debounced so typing doesn't fire one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh().catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query])

  async function handleAction(id: string, action: ContainerActionName) {
    setError(null)
    setPending((p) => ({ ...p, [id]: action }))
    try {
      await runContainerAction(id, action)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setPending((p) => ({ ...p, [id]: undefined }))
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="relative w-48 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('containers.search')}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImagesOpen(true)}>
            <Images />
            {t('containers.images')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNetworksOpen(true)}>
            <Network />
            {t('containers.networks')}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            {t('containers.create')}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="min-h-0 grow overflow-y-auto">
        {containers && containers.length === 0 && <p className="text-sm text-gray-500">{t('containers.empty')}</p>}
        {containers &&
          containers.length > 0 &&
          (dataLayout === 'table' ? (
            <ContainerTable
              containers={containers}
              pending={pending}
              onAction={handleAction}
              onShowLogs={setLogsFor}
              onShowDetail={(c) => setDetailFor(c.id)}
            />
          ) : (
            <ContainerGrid
              containers={containers}
              pending={pending}
              onAction={handleAction}
              onShowLogs={setLogsFor}
              onShowDetail={(c) => setDetailFor(c.id)}
            />
          ))}
      </div>

      <ContainerLogsDialog
        open={logsFor !== null}
        onOpenChange={(open) => !open && setLogsFor(null)}
        container={logsFor}
      />
      <ContainerDetailDialog id={detailFor} onOpenChange={(open) => !open && setDetailFor(null)} />
      <ImageManagerDialog open={imagesOpen} onOpenChange={setImagesOpen} />
      <NetworkManagerDialog open={networksOpen} onOpenChange={setNetworksOpen} />
      <CreateContainerDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
