import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LogsDialog } from '@/components/LogsDialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import {
  getServiceLogs,
  listServices,
  runServiceAction,
  serviceEnablementStreamUrl,
  serviceLogsStreamUrl,
  type ServiceActionName,
  type ServiceUnit,
  type StatusFilter,
} from './api'
import { displayName } from './format'
import { ServiceDetailDialog } from './ServiceDetailDialog'
import { ServiceTable, ServiceTableHeader } from './ServiceTable'

export default function ServicesPage() {
  const { t } = useI18n()
  const [units, setUnits] = useState<ServiceUnit[] | null>(null)
  const [enablement, setEnablement] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('running')
  const [pending, setPending] = useState<Record<string, ServiceActionName | undefined>>({})
  const [logsFor, setLogsFor] = useState<ServiceUnit | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)

  function refresh() {
    return listServices({ status, q: query }).then(setUnits)
  }

  // The backend owns filtering (status maps straight to systemd's own
  // ListUnitsFiltered where possible); a fresh request goes out on every
  // filter change, debounced so typing doesn't fire one per keystroke. This
  // list is fast because it never reads unit files — see the enablement
  // stream below for that.
  //
  // The very first run (mount) skips the debounce — there's no keystroke to
  // coalesce yet, so waiting 250ms here only delayed the initial load for no
  // reason.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      refresh().catch(() => {})
      return
    }
    const timer = setTimeout(() => {
      refresh().catch(() => {})
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, query])

  // Every service's on-disk enabled/disabled state, filled in as it arrives
  // — one SSE message per service, independent of the filter/search above so
  // typing doesn't restart it. ListUnitFiles (which this is built from) took
  // ~550ms for a few hundred units in testing since it walks and parses
  // every unit file on disk, so it runs once in the background rather than
  // blocking every list request the way it used to. Opened on mount, in
  // parallel with the list request: with only two requests in flight, well
  // under the browser's per-origin connection limit, there's no contention
  // to stagger them for — an EventSource is a background resource and
  // doesn't block rendering either way. (An earlier version of this effect
  // waited for the list to load first, on the theory that it was competing
  // with the list request for a connection; that wasn't actually the
  // mechanism — the list's delay was the debounce below, since fixed — so
  // staggering them only made this stream finish later for no benefit.)
  useEffect(() => {
    const source = new EventSource(serviceEnablementStreamUrl())
    source.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { name: string; state: string }
      setEnablement((prev) => ({ ...prev, [data.name]: data.state }))
    }
    source.addEventListener('done', () => source.close())
    source.addEventListener('failed', () => source.close())
    source.onerror = () => source.close()
    return () => source.close()
  }, [])

  // Merges the enablement stream into whatever List returned. Under the
  // "all" filter this also adds rows for services List() couldn't see at
  // all — installed but never started, so never loaded by systemd — as
  // their enablement arrives; every other filter only sees loaded units to
  // begin with, so there's nothing to add there.
  const displayedUnits = useMemo(() => {
    if (!units) return null
    const known = new Set(units.map((u) => u.name))
    const merged = units.map((u) => ({ ...u, unitFileState: enablement[u.name] ?? u.unitFileState }))
    if (status === 'all') {
      const q = query.trim().toLowerCase()
      for (const [name, state] of Object.entries(enablement)) {
        if (known.has(name) || (q && !name.toLowerCase().includes(q))) continue
        merged.push({ name, description: '', loadState: '', activeState: 'inactive', subState: 'dead', unitFileState: state })
      }
      merged.sort((a, b) => a.name.localeCompare(b.name))
    }
    return merged
  }, [units, enablement, status, query])

  async function handleAction(name: string, action: ServiceActionName) {
    setPending((p) => ({ ...p, [name]: action }))
    try {
      await runServiceAction(name, action)
      await refresh()
    } catch {
      // surfaced by the global error dialog
    } finally {
      setPending((p) => ({ ...p, [name]: undefined }))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
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

      {displayedUnits && displayedUnits.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('services.empty')}</p>
      )}
      {displayedUnits && displayedUnits.length > 0 && (
        <>
          <div className="mt-4 px-4 sm:px-6">
            <ServiceTableHeader />
          </div>
          <ScrollArea className="min-h-0 grow px-4 sm:px-6">
            <ServiceTable
              units={displayedUnits}
              pending={pending}
              onAction={handleAction}
              onShowLogs={setLogsFor}
              onShowDetail={(u) => setDetailFor(u.name)}
              hideHeader
            />
          </ScrollArea>
        </>
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
