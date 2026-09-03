import { useMemo, useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Gauge } from './Gauge'
import { buildProcessForest, type ProcessNode } from './processTree'
import { ProcessDetailDialog } from './ProcessDetailDialog'
import { ProcessGrid } from './ProcessGrid'
import { useDashboardStream, type ProcessSort } from './useDashboardStream'

function toggleButtonClasses(active: boolean) {
  return cn(
    'cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors',
    active
      ? 'border-theme-200 bg-theme-50 text-theme-700 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300'
      : 'border-gray-200 text-gray-500 hover:text-gray-700 dark:border-gray-800 dark:hover:text-gray-300',
  )
}

export default function DashboardPage() {
  const { t } = useI18n()
  const [sort, setSort] = useState<ProcessSort>('mem')
  const [tree, setTree] = useState(true)
  // Empty by default: every node with children starts collapsed. Lifted up
  // from ProcessGrid (rather than owned there) so "expand all" can drive it.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())
  const [detailPid, setDetailPid] = useState<number | null>(null)
  const overview = useDashboardStream(sort)

  const memPercent = overview ? (overview.memUsed / overview.memTotal) * 100 : 0

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
    <div className="flex h-full flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-base text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <Gauge
          label={t('dashboard.cpu')}
          value={overview?.cpuPercent ?? 0}
          percentText={overview ? formatPercent(overview.cpuPercent) : '–'}
        />
        <Gauge
          label={t('dashboard.memory')}
          value={memPercent}
          percentText={overview ? formatPercent(memPercent) : '–'}
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

      <div className="flex min-h-0 grow flex-col">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">{t('dashboard.processes')}</p>
          <div className="flex items-center gap-4">
            <button type="button" aria-pressed={tree} onClick={() => setTree((v) => !v)} className={toggleButtonClasses(tree)}>
              {t('dashboard.tree')}
            </button>
            {tree && (
              <button
                type="button"
                aria-pressed={allExpanded}
                onClick={toggleExpandAll}
                className={toggleButtonClasses(allExpanded)}
              >
                {t('dashboard.expandAll')}
              </button>
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
        <div className="min-h-0 grow overflow-y-auto">
          <ProcessGrid
            processes={overview?.processes ?? []}
            sort={sort}
            tree={tree}
            expanded={expanded}
            onToggle={toggleExpanded}
            onShowDetail={setDetailPid}
          />
        </div>
      </div>

      <ProcessDetailDialog pid={detailPid} onOpenChange={(open) => !open && setDetailPid(null)} />
    </div>
  )
}
