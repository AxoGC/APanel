import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LogsDialog } from '@/components/LogsDialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import {
  getServiceLogs,
  listServices,
  runServiceAction,
  serviceLogsStreamUrl,
  type ServiceActionName,
  type ServiceUnit,
  type StatusFilter,
} from './api'
import { displayName } from './format'
import { ServiceDetailDialog } from './ServiceDetailDialog'
import { ServiceGrid } from './ServiceGrid'
import { ServiceTable, ServiceTableHeader } from './ServiceTable'

export default function ServicesPage() {
  const { t } = useI18n()
  const dataLayout = useDataLayout()
  const [units, setUnits] = useState<ServiceUnit[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('running')
  const [pending, setPending] = useState<Record<string, ServiceActionName | undefined>>({})
  const [error, setError] = useState<string | null>(null)
  const [logsFor, setLogsFor] = useState<ServiceUnit | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)

  function refresh() {
    return listServices({ status, q: query }).then(setUnits)
  }

  // The backend owns filtering (status maps straight to systemd's own
  // ListUnitsFiltered where possible); a fresh request goes out on every
  // filter change, debounced so typing doesn't fire one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh().catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query])

  async function handleAction(name: string, action: ServiceActionName) {
    setError(null)
    setPending((p) => ({ ...p, [name]: action }))
    try {
      await runServiceAction(name, action)
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setPending((p) => ({ ...p, [name]: undefined }))
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
              placeholder={t('services.search')}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-gray-500 md:inline">{t('services.status')}</span>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="running">{t('services.filter.running')}</SelectItem>
              <SelectItem value="failed">{t('services.filter.failed')}</SelectItem>
              <SelectItem value="stopped">{t('services.filter.stopped')}</SelectItem>
              <SelectItem value="all">{t('services.filter.all')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {units && units.length === 0 && <p className="text-sm text-gray-500">{t('services.empty')}</p>}
      {units && units.length > 0 && dataLayout === 'table' && (
        <div className="flex min-h-0 grow flex-col">
          <ServiceTableHeader />
          <ScrollArea className="min-h-0 grow">
            <ServiceTable
              units={units}
              pending={pending}
              onAction={handleAction}
              onShowLogs={setLogsFor}
              onShowDetail={(u) => setDetailFor(u.name)}
              hideHeader
            />
          </ScrollArea>
        </div>
      )}
      {units && units.length > 0 && dataLayout === 'grid' && (
        <ScrollArea className="min-h-0 grow">
          <ServiceGrid
            units={units}
            pending={pending}
            onAction={handleAction}
            onShowLogs={setLogsFor}
            onShowDetail={(u) => setDetailFor(u.name)}
          />
        </ScrollArea>
      )}

      <LogsDialog
        open={logsFor !== null}
        onOpenChange={(open) => !open && setLogsFor(null)}
        title={logsFor ? `${displayName(logsFor.name)} — ${t('services.logs')}` : ''}
        id={logsFor?.name ?? ''}
        fetchLogs={getServiceLogs}
        streamUrl={serviceLogsStreamUrl}
      />
      <ServiceDetailDialog name={detailFor} onOpenChange={(open) => !open && setDetailFor(null)} />
    </div>
  )
}
