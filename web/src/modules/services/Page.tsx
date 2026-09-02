import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { listServices, runServiceAction, type ServiceActionName, type ServiceUnit } from './api'
import { ServiceGrid } from './ServiceGrid'

type StatusFilter = 'running' | 'failed' | 'stopped' | 'all'

export default function ServicesPage() {
  const { t } = useI18n()
  const [units, setUnits] = useState<ServiceUnit[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('running')
  const [pending, setPending] = useState<Record<string, ServiceActionName | undefined>>({})
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    return listServices().then(setUnits)
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [])

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

  const filtered = useMemo(() => {
    if (!units) return []
    let result = units
    if (status === 'running') result = result.filter((u) => u.subState === 'running')
    else if (status === 'failed') result = result.filter((u) => u.subState === 'failed')
    else if (status === 'stopped') result = result.filter((u) => u.subState !== 'running' && u.subState !== 'failed')

    const q = query.trim().toLowerCase()
    if (q) result = result.filter((u) => u.name.toLowerCase().includes(q) || u.description.toLowerCase().includes(q))
    return result
  }, [units, query, status])

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="relative w-48 sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('services.search')}
            className="pl-8"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="running">{t('services.filter.running')}</option>
          <option value="failed">{t('services.filter.failed')}</option>
          <option value="stopped">{t('services.filter.stopped')}</option>
          <option value="all">{t('services.filter.all')}</option>
        </select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="min-h-0 grow overflow-y-auto">
        {units && filtered.length === 0 && <p className="text-sm text-gray-500">{t('services.empty')}</p>}
        {filtered.length > 0 && <ServiceGrid units={filtered} pending={pending} onAction={handleAction} />}
      </div>
    </div>
  )
}
