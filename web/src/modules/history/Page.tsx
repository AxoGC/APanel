import { Columns2, Plug, RectangleVertical, Settings } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { formatBytes, formatBitrate } from '@/lib/format'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
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

// Only affects the narrowest breakpoint (below sm) — sm and up always use a
// fixed multi-column grid regardless of this preference.
const NARROW_COLUMNS_KEY = 'apanel:history-narrow-columns'

function getStoredNarrowColumns(): 1 | 2 {
  return localStorage.getItem(NARROW_COLUMNS_KEY) === '2' ? 2 : 1
}

function setStoredNarrowColumns(value: 1 | 2) {
  localStorage.setItem(NARROW_COLUMNS_KEY, String(value))
}

// The axis no longer shows a per-tick unit, so the whole chart is
// displayed in a single unit (picked from the day's peak, like a typical
// bandwidth graph) instead of formatBitrate's usual per-value Kbps/Mbps
// switch — that title-only unit only makes sense if every value shares it.
function bitrateUnit(maxBytesPerSec: number): 'Kbps' | 'Mbps' {
  return formatBitrate(maxBytesPerSec).unit
}

function toBitrateValue(bytesPerSec: number, unit: 'Kbps' | 'Mbps'): number {
  const bitsPerSec = Math.max(0, bytesPerSec) * 8
  return unit === 'Mbps' ? bitsPerSec / 1_000_000 : bitsPerSec / 1_000
}

function formatRate(value: number): string {
  return value.toFixed(1)
}

// Fixed, distinguishable per-metric colors (rather than the app's single
// user-switchable theme hue) so the charts read at a glance the way
// Windows Task Manager's performance graphs do — one color per resource.
const CHART_COLORS = {
  cpu: { line: 'text-blue-500', area: 'text-blue-100 dark:text-blue-950' },
  memory: { line: 'text-fuchsia-500', area: 'text-fuchsia-100 dark:text-fuchsia-950' },
  upload: { line: 'text-orange-500', area: 'text-orange-100 dark:text-orange-950' },
  disk: { line: 'text-green-500', area: 'text-green-100 dark:text-green-950' },
  load: { line: 'text-teal-500', area: 'text-teal-100 dark:text-teal-950' },
} as const

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

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<CollectionTargetName>('cpu')
  const [settings, setSettings] = useState<HistoryCollectionSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const { dialogOpen: dependencyOpen, setDialogOpen: setDependencyOpen } = useDependencyGate('history')

  const [narrowColumns, setNarrowColumns] = useState(getStoredNarrowColumns)

  function toggleNarrowColumns() {
    const next = narrowColumns === 1 ? 2 : 1
    setStoredNarrowColumns(next)
    setNarrowColumns(next)
  }

  useEffect(() => {
    getHistory(daysAgo)
      .then(setDay)
      .catch(() => {})
  }, [daysAgo])

  function openSettings() {
    setSettingsTarget('cpu')
    setSettingsOpen(true)
    getHistorySettings()
      .then(setSettings)
      .catch(() => {})
  }

  async function submitSettings(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSavingSettings(true)
    try {
      setSettings(await putHistorySettings(settings))
      setSettingsOpen(false)
    } catch {
      // surfaced by the global error dialog
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

  function formatLoadAvg(value: number): string {
    return value.toFixed(2)
  }

  // Shorter below sm when two narrow columns halve each chart's width, so
  // it doesn't stay as tall as it was at full width; sm+ is unaffected,
  // since narrowColumns only applies below that breakpoint.
  const chartHeightClassName = narrowColumns === 2 ? 'h-32 sm:h-48' : 'h-48'

  const netUnit = bitrateUnit(day ? Math.max(0, ...day.points.map((p) => p.netTxBytesPerSec)) : 0)

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
            aria-label={t('history.columns.toggle')}
            title={t('history.columns.toggle')}
            onClick={toggleNarrowColumns}
            className="sm:hidden"
          >
            {narrowColumns === 1 ? <RectangleVertical /> : <Columns2 />}
          </Button>
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

      {day && day.points.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('history.empty')}</p>
      )}

      {day && day.points.length > 0 && (
        <ScrollArea className="mt-4 min-h-0 grow px-4 sm:px-6">
          <div
            className={cn(
              // No horizontal gap below sm: narrow screens are tight on
              // space, and each chart's canvas already reserves its own
              // left/right padding (see HistoryChart's grid option), so a
              // column gap there is redundant.
              'grid gap-x-0 gap-y-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3',
              narrowColumns === 2 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            <HistoryChart
              label={t('history.cpu')}
              times={day.points.map((p) => p.time)}
              values={day.points.map((p) => p.cpuUsedPercent)}
              unit="%"
              heightClassName={chartHeightClassName}
              lineColorClassName={CHART_COLORS.cpu.line}
              areaColorClassName={CHART_COLORS.cpu.area}
            />
            <div className="flex flex-col gap-1">
              <HistoryChart
                label={t('history.memory')}
                times={day.points.map((p) => p.time)}
                values={day.points.map((p) => p.memUsedPercent)}
                unit="%"
                heightClassName={chartHeightClassName}
                lineColorClassName={CHART_COLORS.memory.line}
                areaColorClassName={CHART_COLORS.memory.area}
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
                values={day.points.map((p) => toBitrateValue(p.netTxBytesPerSec, netUnit))}
                max={null}
                unit={netUnit}
                formatValue={formatRate}
                heightClassName={chartHeightClassName}
                lineColorClassName={CHART_COLORS.upload.line}
                areaColorClassName={CHART_COLORS.upload.area}
              />
              {last && <span className="text-xs text-gray-500">{formatNetRate(last.netTxBytesPerSec)}</span>}
            </div>
            <HistoryChart
              label={t('history.disk')}
              times={day.points.map((p) => p.time)}
              values={day.points.map((p) => p.diskUtilPercent)}
              unit="%"
              heightClassName={chartHeightClassName}
              lineColorClassName={CHART_COLORS.disk.line}
              areaColorClassName={CHART_COLORS.disk.area}
            />
            <div className="flex flex-col gap-1">
              <HistoryChart
                label={t('history.load')}
                times={day.points.map((p) => p.time)}
                values={day.points.map((p) => p.loadAvg1)}
                max={null}
                formatValue={formatLoadAvg}
                heightClassName={chartHeightClassName}
                lineColorClassName={CHART_COLORS.load.line}
                areaColorClassName={CHART_COLORS.load.area}
              />
              {last && <span className="text-xs text-gray-500">{formatLoadAvg(last.loadAvg1)}</span>}
            </div>
          </div>
        </ScrollArea>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col">
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
