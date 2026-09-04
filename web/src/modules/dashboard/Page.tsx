import { Info, Settings } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ToggleButton } from '@/components/ToggleButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { formatBitrate, formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useLayout } from '@/lib/layout'
import { Gauge } from './Gauge'
import { buildProcessForest, type ProcessNode } from './processTree'
import { ProcessDetailDialog } from './ProcessDetailDialog'
import { ProcessGrid, ProcessGridHeader } from './ProcessGrid'
import {
  getDashboardNetworkSettings,
  putDashboardNetworkSettings,
  useDashboardStream,
  type ProcessSort,
} from './useDashboardStream'

const DEFAULT_MAX_MBPS = 10
const NETWORK_SETTINGS_FORM_ID = 'dashboard-network-settings-form'

export default function DashboardPage() {
  const { t } = useI18n()
  const { shell } = useLayout()
  const [sort, setSort] = useState<ProcessSort>('mem')
  const [tree, setTree] = useState(true)
  // Empty by default: every node with children starts collapsed. Lifted up
  // from ProcessGrid (rather than owned there) so "expand all" can drive it.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  const [detailPid, setDetailPid] = useState<number | null>(null)
  const overview = useDashboardStream(sort)

  // What the upload gauge's 100% mark represents. Loaded once (it's a
  // rarely-changed setting, not part of the live stream) and defaulted
  // in-memory until the fetch resolves so the gauge never divides by zero.
  const [maxMbps, setMaxMbps] = useState(DEFAULT_MAX_MBPS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMaxMbps, setSettingsMaxMbps] = useState(String(DEFAULT_MAX_MBPS))
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    getDashboardNetworkSettings()
      .then((s) => setMaxMbps(s.maxMbps))
      .catch(() => {})
  }, [])

  function openSettings() {
    setSettingsError(null)
    setSettingsMaxMbps(String(maxMbps))
    setSettingsOpen(true)
  }

  async function submitSettings(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(settingsMaxMbps)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSettingsError(t('dashboard.networkSettings.maxMbps'))
      return
    }
    setSavingSettings(true)
    setSettingsError(null)
    try {
      const saved = await putDashboardNetworkSettings({ maxMbps: parsed })
      setMaxMbps(saved.maxMbps)
      setSettingsOpen(false)
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const memPercent = overview ? (overview.memUsed / overview.memTotal) * 100 : 0
  const uploadMbps = overview ? (overview.netTxBytesPerSec * 8) / 1_000_000 : 0
  const netPercent = maxMbps > 0 ? (uploadMbps / maxMbps) * 100 : 0
  const uploadRate = overview ? formatBitrate(overview.netTxBytesPerSec) : null
  const downloadRate = overview ? formatBitrate(overview.netRxBytesPerSec) : null

  function toggleExpanded(pid: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  // All pids that have children, i.e. every pid the "expand all" toggle
  // and per-row triggers can act on. Recomputed whenever the process list
  // changes so the toggle's active state stays in sync with reality.
  const expandablePids = useMemo(() => {
    const pids = new Set<number>()
    const visit = (node: ProcessNode) => {
      if (node.children.length > 0) pids.add(node.pid)
      node.children.forEach(visit)
    }
    buildProcessForest(overview?.processes ?? []).forEach(visit)
    return pids
  }, [overview])
  const allExpanded = expandablePids.size > 0 && [...expandablePids].every((pid) => expanded.has(pid))

  function toggleExpandAll() {
    setExpanded(allExpanded ? new Set() : expandablePids)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
        <Button variant="ghost" size="icon-sm" aria-label={t('dashboard.networkSettings')} onClick={openSettings}>
          <Settings />
        </Button>
      </div>

      <div className="mt-4 flex flex-nowrap gap-1 px-4 sm:mt-6 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <Gauge
            label={t('dashboard.cpu')}
            value={overview?.cpuPercent ?? 0}
            mainText={overview ? overview.cpuPercent.toFixed(1) : '–'}
            unitText={overview ? '%' : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Gauge
            label={t('dashboard.memory')}
            value={memPercent}
            mainText={overview ? memPercent.toFixed(1) : '–'}
            unitText={overview ? '%' : undefined}
            details={
              overview
                ? [
                    `${formatBytes(overview.memUsed)} / ${formatBytes(overview.memTotal)}`,
                    `${t('dashboard.swap')} ${formatBytes(overview.swapUsed)} / ${formatBytes(overview.swapTotal)}`,
                  ]
                : undefined
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <Gauge
            label={overview?.netInterface ? `${overview.netInterface} ${t('dashboard.upload')}` : t('dashboard.upload')}
            value={netPercent}
            mainText={uploadRate?.value ?? '–'}
            unitText={uploadRate?.unit}
            details={downloadRate ? [`${t('dashboard.download')} ${downloadRate.value} ${downloadRate.unit}`] : undefined}
          />
        </div>
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between px-4 sm:mt-6 sm:px-6">
        <p className="text-xs text-gray-500">{t('dashboard.processes')}</p>
        <div className="flex items-center gap-4">
          <ToggleButton active={tree} onClick={() => setTree((v) => !v)}>
            {t('dashboard.tree')}
          </ToggleButton>
          {tree && (
            <ToggleButton active={allExpanded} onClick={toggleExpandAll}>
              {t('dashboard.expandAll')}
            </ToggleButton>
          )}
          <SegmentedControl
            value={sort}
            onChange={setSort}
            options={[
              { value: 'mem', label: t('dashboard.memory') },
              { value: 'cpu', label: t('dashboard.cpu') },
            ]}
          />
        </div>
      </div>
      <div className="px-4 sm:px-6">
        <ProcessGridHeader />
      </div>
      <ScrollArea className="min-h-0 grow px-4 sm:px-6">
        <ProcessGrid
          processes={overview?.processes ?? []}
          sort={sort}
          tree={tree}
          expanded={expanded}
          onToggle={toggleExpanded}
          onShowDetail={setDetailPid}
          hideHeader
        />
      </ScrollArea>

      <ProcessDetailDialog pid={detailPid} onOpenChange={(open) => !open && setDetailPid(null)} />

      <SectionedDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={t('dashboard.networkSettings.title')}
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button
              type="submit"
              form={NETWORK_SETTINGS_FORM_ID}
              disabled={savingSettings}
              className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
            >
              {t('files.save')}
            </Button>
          </div>
        }
      >
        <form id={NETWORK_SETTINGS_FORM_ID} onSubmit={submitSettings} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {shell === 'mobile' ? (
              <span className="flex w-36 shrink-0 items-center gap-1 text-xs text-gray-500">
                {t('dashboard.networkSettings.maxMbps')}
                <Info className="size-3" />
              </span>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex w-36 shrink-0 cursor-help items-center gap-1 text-xs text-gray-500">
                    {t('dashboard.networkSettings.maxMbps')}
                    <Info className="size-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('dashboard.networkSettings.maxMbps.tooltip')}</TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={settingsMaxMbps}
                onChange={(e) => setSettingsMaxMbps(e.target.value)}
                className="w-24"
              />
              <span className="text-xs text-gray-500">Mbps</span>
            </div>
          </div>
          {shell === 'mobile' && <p className="text-xs text-gray-500">{t('dashboard.networkSettings.maxMbps.tooltip')}</p>}
          {settingsError && <p className="text-xs text-red-600">{settingsError}</p>}
        </form>
      </SectionedDialog>
    </div>
  )
}
