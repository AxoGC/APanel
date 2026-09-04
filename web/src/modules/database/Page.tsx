import { ArrowLeft, Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ApiError } from '@/lib/api'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'
import {
  databaseSizeStreamUrl,
  listDatabases,
  listTables,
  tableStatsStreamUrl,
  type DatabaseInfo,
  type TableInfo,
} from './api'
import { DatabaseTable, DatabaseTableHeader } from './DatabaseTable'
import { TableList, TableListHeader } from './TableList'

interface TableStat {
  rows: number
  bytes: number
}

export default function DatabasePage() {
  const { t } = useI18n()
  const { dialogOpen, setDialogOpen } = useDependencyGate('database')

  const [databases, setDatabases] = useState<DatabaseInfo[] | null>(null)
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)
  const [tables, setTables] = useState<TableInfo[] | null>(null)
  const [tableStats, setTableStats] = useState<Record<string, TableStat>>({})
  const [error, setError] = useState<string | null>(null)

  // Step 1: the database list itself (name + table count), a plain request.
  useEffect(() => {
    if (selectedDatabase !== null) return
    setDatabases(null)
    setSizes({})
    setError(null)
    listDatabases()
      .then(setDatabases)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [selectedDatabase])

  // Step 2: each database's used space, filled in as the backend's parallel
  // scan streams results in (cached ones arrive almost immediately).
  useEffect(() => {
    if (selectedDatabase !== null || databases === null) return
    const source = new EventSource(databaseSizeStreamUrl())
    source.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { name: string; bytes: number }
      setSizes((prev) => ({ ...prev, [data.name]: data.bytes }))
    }
    source.addEventListener('done', () => source.close())
    source.addEventListener('failed', (event) => {
      const data = JSON.parse((event as MessageEvent).data as string) as { message: string }
      setError(data.message)
      source.close()
    })
    source.onerror = () => source.close()
    return () => source.close()
  }, [selectedDatabase, databases])

  // Step 1: one database's table list (name + column count).
  useEffect(() => {
    if (selectedDatabase === null) return
    setTables(null)
    setTableStats({})
    setError(null)
    listTables(selectedDatabase)
      .then(setTables)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [selectedDatabase])

  // Step 2: each table's row count and used space, same streaming/caching
  // design as the database list's own space column.
  useEffect(() => {
    if (selectedDatabase === null || tables === null) return
    const source = new EventSource(tableStatsStreamUrl(selectedDatabase))
    source.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { schema: string; name: string; rows: number; bytes: number }
      setTableStats((prev) => ({ ...prev, [`${data.schema}.${data.name}`]: { rows: data.rows, bytes: data.bytes } }))
    }
    source.addEventListener('done', () => source.close())
    source.addEventListener('failed', (event) => {
      const data = JSON.parse((event as MessageEvent).data as string) as { message: string }
      setError(data.message)
      source.close()
    })
    source.onerror = () => source.close()
    return () => source.close()
  }, [selectedDatabase, tables])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
        {selectedDatabase === null ? (
          <>
            <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.database')}</h1>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('dependency.configure')}
              title={t('dependency.configure')}
              onClick={() => setDialogOpen(true)}
            >
              <Plug />
            </Button>
          </>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('database.back')}
              title={t('database.back')}
              onClick={() => setSelectedDatabase(null)}
            >
              <ArrowLeft />
            </Button>
            <h1 className="min-w-0 truncate text-base text-gray-900 dark:text-gray-100">{selectedDatabase}</h1>
          </div>
        )}
      </div>

      {error && <p className="mt-3 px-4 text-xs text-red-600 sm:px-6">{error}</p>}

      {selectedDatabase === null ? (
        <>
          {databases && databases.length === 0 && (
            <p className="mt-3 px-4 text-sm text-gray-500 sm:px-6">{t('database.empty')}</p>
          )}
          {databases && databases.length > 0 && (
            <>
              <div className="mt-3 px-4 sm:px-6">
                <DatabaseTableHeader />
              </div>
              <ScrollArea className="min-h-0 grow px-4 sm:px-6">
                <DatabaseTable databases={databases} sizes={sizes} onSelect={setSelectedDatabase} />
              </ScrollArea>
            </>
          )}
        </>
      ) : (
        <>
          {tables && tables.length === 0 && (
            <p className="mt-3 px-4 text-sm text-gray-500 sm:px-6">{t('database.table.empty')}</p>
          )}
          {tables && tables.length > 0 && (
            <>
              <div className="mt-3 px-4 sm:px-6">
                <TableListHeader />
              </div>
              <ScrollArea className="min-h-0 grow px-4 sm:px-6">
                <TableList tables={tables} stats={tableStats} />
              </ScrollArea>
            </>
          )}
        </>
      )}

      <DependencyDialog moduleKey="database" open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
