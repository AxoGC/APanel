import { Plug, Settings } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/adaptive/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { formatBytes, formatBitrate } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'
import {
  getHistory,
  getHistorySettings,
  putHistorySettings,
  type CollectionTargetName,
  type HistoryCollectionSettings,
  type HistoryDay,
} from './api'
import { HistoryChart } from './HistoryChart'

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6]
const TARGETS: CollectionTargetName[] = ['cpu', 'memory', 'swap']

function dayLabel(daysAgo: number, today: string, yesterday: string): string {
  if (daysAgo === 0) return today
  if (daysAgo === 1) return yesterday
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

export default function HistoryPage() {
  const { t } = useI18n()
  const [daysAgo, setDaysAgo] = useState(0)
  const [day, setDay] = useState<HistoryDay | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<CollectionTargetName>('cpu')
  const [settings, setSettings] = useState<HistoryCollectionSettings | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const { dialogOpen: dependencyOpen, setDialogOpen: setDependencyOpen } = useDependencyGate('history')

  useEffect(() => {
    setError(null)
    getHistory(daysAgo)
      .then(setDay)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [daysAgo])

  function openSettings() {
    setSettingsError(null)
    setSettingsTarget('cpu')
    setSettingsOpen(true)
    getHistorySettings()
      .then(setSettings)
      .catch((err) => setSettingsError(err instanceof ApiError ? err.message : String(err)))
  }

  async function submitSettings(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSavingSettings(true)
    setSettingsError(null)
    try {
      setSettings(await putHistorySettings(settings))
      setSettingsOpen(false)
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const last = day && day.points.length > 0 ? day.points[day.points.length - 1] : null
  const target = settings?.[settingsTarget]

  function formatNetRate(bytesPerSec: number): string {
    const { value, unit } = formatBitrate(bytesPerSec)
    return `${value} ${unit}`
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('history.day')}</span>
          <Select value={String(daysAgo)} onValueChange={(v) => setDaysAgo(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {dayLabel(n, t('history.today'), t('history.yesterday'))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('dependency.configure')}
            title={t('dependency.configure')}
            onClick={() => setDependencyOpen(true)}
          >
            <Plug />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label={t('history.settings')} onClick={openSettings}>
            <Settings />
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 px-4 text-xs text-red-600 sm:px-6">{error}</p>}

      {day && day.points.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('history.empty')}</p>
      )}

      {day && day.points.length > 0 && (
        <ScrollArea className="mt-4 min-h-0 grow px-4 sm:px-6">
          <div className="flex flex-col gap-6">
            <HistoryChart
              label={t('history.cpu')}
              times={day.points.map((p) => p.time)}
              values={day.points.map((p) => p.cpuUsedPercent)}
              unit="%"
            />
            <div className="flex flex-col gap-1">
              <HistoryChart
                label={t('history.memory')}
                times={day.points.map((p) => p.time)}
                values={day.points.map((p) => p.memUsedPercent)}
                unit="%"
              />
              {last && (
                <span className="text-xs text-gray-500">
                  {formatBytes(last.memUsed)} / {formatBytes(last.memTotal)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <HistoryChart
                label={t('history.upload')}
                times={day.points.map((p) => p.time)}
                values={day.points.map((p) => p.netTxBytesPerSec)}
                max={null}
                formatValue={formatNetRate}
              />
              {last && <span className="text-xs text-gray-500">{formatNetRate(last.netTxBytesPerSec)}</span>}
            </div>
          </div>
        </ScrollArea>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="flex flex-col" desktopClassName="max-h-[85vh]">
          <form onSubmit={submitSettings} className="flex min-h-0 flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('history.settings.title')}</DialogTitle>
            </DialogHeader>

            <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
              <div className="flex flex-col gap-4 pr-1">
                <SegmentedControl
                  options={TARGETS.map((name) => ({ value: name, label: t(`history.settings.target.${name}`) }))}
                  value={settingsTarget}
                  onChange={setSettingsTarget}
                />

                {target && settings && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{t('history.settings.enabled')}</span>
                      <Switch
                        checked={target.enabled}
                        onCheckedChange={(enabled) =>
                          setSettings({ ...settings, [settingsTarget]: { ...target, enabled } })
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{t('history.settings.interval')}</span>
                      <Input
                        type="number"
                        min={1}
                        value={target.intervalMinutes}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [settingsTarget]: { ...target, intervalMinutes: Number(e.target.value) },
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{t('history.settings.retention')}</span>
                      <Input
                        type="number"
                        min={1}
                        value={target.retentionDays}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            [settingsTarget]: { ...target, retentionDays: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </>
                )}

                {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                {t('confirm.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!settings || savingSettings}
                className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
              >
                {t('files.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DependencyDialog moduleKey="history" open={dependencyOpen} onOpenChange={setDependencyOpen} />
    </div>
  )
}
