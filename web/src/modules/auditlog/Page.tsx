import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ApiError } from '@/lib/api'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getAuditLog, type AuditLogEntry } from './api'

const PAGE_SIZE = 50

function actionLabel(entry: AuditLogEntry, t: (key: TranslationKey) => string): string {
  if (!entry.action) return `${entry.method} ${entry.path}`
  const key = `audit.action.${entry.action}` as TranslationKey
  const translated = t(key)
  return translated === key ? `${entry.method} ${entry.path}` : translated
}

function formatShortTime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm break-all text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

export default function AuditLogPage() {
  const { t, locale } = useI18n()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<AuditLogEntry | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAuditLog({ limit: PAGE_SIZE })
      .then((res) => {
        setEntries(res)
        setExhausted(res.length < PAGE_SIZE)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  async function loadMore() {
    if (entries.length === 0) return
    setLoadingMore(true)
    try {
      const res = await getAuditLog({ limit: PAGE_SIZE, beforeId: entries[entries.length - 1].id })
      setEntries((prev) => [...prev, ...res])
      setExhausted(res.length < PAGE_SIZE)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.auditlog')}</h1>
      </div>

      {error && <p className="mt-4 px-4 text-xs text-red-600 sm:px-6">{error}</p>}
      {!loading && entries.length === 0 && !error && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('auditlog.empty')}</p>
      )}

      {entries.length > 0 && (
        <>
          <div className="mt-4 hidden items-center gap-3 border-b border-gray-200 px-4 pb-1.5 text-xs text-gray-500 sm:px-6 md:flex">
            <div className="w-24 shrink-0">{t('auditlog.time')}</div>
            <div className="w-28 shrink-0">{t('auditlog.user')}</div>
            <div className="min-w-0 flex-1">{t('auditlog.action')}</div>
            <div className="w-14 shrink-0">{t('auditlog.status')}</div>
            <div className="hidden w-20 shrink-0 lg:block">{t('auditlog.method')}</div>
          </div>

          <ScrollArea className="mt-2 min-h-0 grow px-4 sm:px-6">
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setDetail(entry)}
                  className="flex cursor-pointer items-center gap-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="w-16 shrink-0 text-xs text-gray-500 md:w-24">{formatShortTime(entry.at)}</div>
                  <div className="w-16 shrink-0 truncate text-xs text-gray-700 md:w-28 dark:text-gray-300">
                    {entry.userRemark || t('auditlog.unknownUser')}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                    {actionLabel(entry, t)}
                  </div>
                  <div className={cn('hidden w-14 shrink-0 text-xs md:block', entry.status >= 400 ? 'text-red-600' : 'text-gray-500')}>
                    {entry.status}
                  </div>
                  <div className="hidden w-20 shrink-0 text-xs text-gray-500 lg:block">{entry.method}</div>
                </button>
              ))}
            </div>

            {!exhausted && (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
                  {loadingMore && <Loader2 className="animate-spin" />}
                  {t('auditlog.loadMore')}
                </Button>
              </div>
            )}
          </ScrollArea>
        </>
      )}

      <SectionedDialog
        open={detail !== null}
        onOpenChange={(nextOpen) => !nextOpen && setDetail(null)}
        title={t('auditlog.detail.title')}
        className="max-w-sm"
      >
        {detail && (
          <div className="flex flex-col gap-3">
            <DetailRow label={t('auditlog.time')} value={new Date(detail.at).toLocaleString(locale)} />
            <DetailRow label={t('auditlog.user')} value={detail.userRemark || t('auditlog.unknownUser')} />
            <DetailRow label={t('auditlog.action')} value={actionLabel(detail, t)} />
            <DetailRow label={t('auditlog.method')} value={detail.method} />
            <DetailRow label={t('auditlog.path')} value={detail.path} />
            <DetailRow label={t('auditlog.status')} value={String(detail.status)} />
          </div>
        )}
      </SectionedDialog>
    </div>
  )
}
