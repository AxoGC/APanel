import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

const LINE_OPTIONS = [100, 500, 1000, 2000]

// Read-only, so there's no footer/action row — clicking the backdrop or the
// header's close button is already how you dismiss it. Shared by the
// services and containers modules, which each just supply their own
// fetch/stream endpoints for the given id.
export function LogsDialog({
  open,
  onOpenChange,
  title,
  id,
  fetchLogs,
  streamUrl,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  id: string
  fetchLogs: (id: string, lines: number) => Promise<string[]>
  streamUrl: (id: string, lines: number) => string
}) {
  const { t } = useI18n()
  const [lines, setLines] = useState(500)
  const [follow, setFollow] = useState(true)
  const [content, setContent] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || follow) return
    let cancelled = false
    setError(null)
    fetchLogs(id, lines)
      .then((ls) => {
        if (!cancelled) setContent(ls)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [open, follow, id, lines, fetchLogs])

  useEffect(() => {
    if (!open || !follow) return
    setContent([])
    setError(null)
    const source = new EventSource(streamUrl(id, lines))
    source.onmessage = (event) => {
      setContent((prev) => [...prev, event.data as string])
    }
    source.onerror = () => {
      setError(t('logs.error'))
      source.close()
    }
    return () => source.close()
  }, [open, follow, id, lines, streamUrl, t])

  useEffect(() => {
    if (bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [content])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-2xl flex-col gap-0 p-0" showCloseButton={false}>
        <div className="flex items-center justify-between gap-2 p-4 pb-3">
          <DialogTitle className="truncate">{title}</DialogTitle>
          <DialogClose className="shrink-0 cursor-pointer rounded-sm text-gray-500 outline-none hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-gray-300">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <SegmentedControl
            options={LINE_OPTIONS.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
            value={String(lines)}
            onChange={(v) => setLines(Number(v))}
          />
          <label className="flex items-center gap-2 text-xs text-gray-500">
            {t('logs.follow')}
            <Switch checked={follow} onCheckedChange={setFollow} />
          </label>
        </div>

        {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}

        <div className="border-t border-gray-200 dark:border-gray-800" />

        <div ref={bodyRef} className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
          <div className="p-4 font-mono text-xs text-gray-700 dark:text-gray-300">
            {content.length === 0 ? (
              <p className="text-gray-500">{t('logs.empty')}</p>
            ) : (
              content.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
