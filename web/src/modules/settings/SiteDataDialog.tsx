import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SectionedDialog } from '@/components/SectionedDialog'
import { useI18n } from '@/lib/i18n'

interface Entry {
  key: string
  value: string
}

function readEntries(): Entry[] {
  const entries: Entry[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key === null) continue
    entries.push({ key, value: localStorage.getItem(key) ?? '' })
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key))
}

export function SiteDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<Entry[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setEntries(readEntries())
      setSelected(new Set())
    }
  }, [open])

  function toggleSelect(key: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((s) => {
      const allSelected = entries.length > 0 && entries.every((e) => s.has(e.key))
      return allSelected ? new Set() : new Set(entries.map((e) => e.key))
    })
  }

  function confirmDelete() {
    for (const key of selected) localStorage.removeItem(key)
    setEntries(readEntries())
    setSelected(new Set())
    setConfirmOpen(false)
  }

  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.key))

  return (
    <>
      <SectionedDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('settings.siteData.title')}
        className="max-w-lg"
        drawer
        footer={
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 />
              {t('settings.siteData.delete')} ({selected.size})
            </Button>
          </div>
        }
      >
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">{t('settings.siteData.empty')}</p>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-gray-200 pb-2 text-xs text-gray-500 dark:border-gray-800">
              <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label={t('settings.siteData.selectAll')} />
              <span className="w-2/5 shrink-0">{t('settings.siteData.key')}</span>
              <span className="flex-1">{t('settings.siteData.value')}</span>
            </div>
            {entries.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-900"
              >
                <Checkbox
                  checked={selected.has(entry.key)}
                  onCheckedChange={() => toggleSelect(entry.key)}
                  aria-label={entry.key}
                />
                <span className="w-2/5 shrink-0 truncate text-xs text-gray-900 dark:text-gray-100" title={entry.key}>
                  {entry.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={entry.value}>
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionedDialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.siteData.confirmDelete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('settings.siteData.confirmDelete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('settings.siteData.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
