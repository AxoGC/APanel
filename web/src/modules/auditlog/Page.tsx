import { Loader2, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SectionedDialog } from '@/components/SectionedDialog'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getAuditLog, type AuditLogEntry } from './api'
import { AuditLogSettingsDialog } from './AuditLogSettingsDialog'

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

function statusTagClasses(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
  if (status >= 400) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
}

function StatusTag({ status }: { status: number }) {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', statusTagClasses(status))}>{status}</span>
  )
}

export default function AuditLogPage() {
  const { t, locale } = useI18n()
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [detail, setDetail] = useState<AuditLogEntry | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setLoadFailed(false)
    getAuditLog({ limit: PAGE_SIZE })
      .then((res) => {
        setEntries(res)
        setExhausted(res.length < PAGE_SIZE)
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [])

  async function loadMore() {
    if (entries.length === 0) return
    setLoadingMore(true)
    try {
      const res = await getAuditLog({ limit: PAGE_SIZE, beforeId: entries[entries.length - 1].id })
      setEntries((prev) => [...prev, ...res])
      setExhausted(res.length < PAGE_SIZE)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.auditlog')}</h1>
        <Button variant="outline" size="icon-sm" aria-label={t('auditlog.settings.title')} onClick={() => setSettingsOpen(true)}>
          <Settings />
        </Button>
      </div>

      {!loading && entries.length === 0 && !loadFailed && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('auditlog.empty')}</p>
      )}

      {entries.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-1 border-b border-gray-200 px-4 pb-1.5 text-xs text-gray-500 sm:px-6 md:gap-3">
            <div className="w-18 shrink-0 md:w-24">{t('auditlog.time')}</div>
            <div className="w-22 shrink-0 md:w-28">{t('auditlog.user')}</div>
            <div className="min-w-0 flex-1">{t('auditlog.action')}</div>
            <div className="hidden w-14 shrink-0 md:block">{t('auditlog.status')}</div>
            <div className="hidden w-32 shrink-0 lg:block">{t('auditlog.ip')}</div>
          </div>

          <ScrollArea className="mt-2 min-h-0 grow px-4 sm:px-6">
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setDetail(entry)}
                  className="flex cursor-pointer items-center gap-1 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 md:gap-3"
                >
                  <div className="w-18 shrink-0 text-xs text-gray-500 md:w-24">{formatShortTime(entry.at)}</div>
                  <div className="w-22 shrink-0 truncate text-xs text-gray-700 md:w-28 dark:text-gray-300">
                    {entry.userRemark || t('auditlog.unknownUser')}
                  </div>
                  <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                    {actionLabel(entry, t)}
                  </div>
                  <div className="hidden w-14 shrink-0 md:block">
                    <StatusTag status={entry.status} />
                  </div>
                  <div className="hidden w-32 shrink-0 truncate text-xs text-gray-500 lg:block">{entry.ip}</div>
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
        className="sm:max-w-sm"
        drawer
      >
        {detail && (
          <div className="flex flex-col gap-3">
            <DetailRow label={t('auditlog.time')} value={new Date(detail.at).toLocaleString(locale)} />
            <DetailRow label={t('auditlog.user')} value={detail.userRemark || t('auditlog.unknownUser')} />
            <DetailRow label={t('auditlog.action')} value={actionLabel(detail, t)} />
            <DetailRow label={t('auditlog.method')} value={detail.method} />
            <DetailRow label={t('auditlog.path')} value={detail.path} />
            <DetailRow label={t('auditlog.ip')} value={detail.ip} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-500">{t('auditlog.status')}</span>
              <div><StatusTag status={detail.status} /></div>
            </div>
          </div>
        )}
      </SectionedDialog>

      <AuditLogSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
