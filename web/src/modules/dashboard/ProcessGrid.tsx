import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buildProcessForest, collectDescendantNames, sortProcessForest, type ProcessNode } from './processTree'
import type { ProcessInfo, ProcessSort } from './useDashboardStream'

function ProcessRow({
  pid,
  name,
  user,
  cpuPercent,
  memRSS,
  count,
  descendantNames,
  depth,
  trigger,
  onShowDetail,
}: {
  pid: number
  name: string
  user: string
  cpuPercent: number
  memRSS: number
  count?: number
  descendantNames?: string[]
  depth: number
  trigger?: { expanded: boolean; onToggle: () => void }
  onShowDetail: (pid: number) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 py-0.5 last:border-b-0 dark:border-gray-900">
      <div className="flex min-w-0 flex-1 items-center gap-1" style={{ paddingLeft: depth * 16 }}>
        {trigger ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              onClick={trigger.onToggle}
              className="shrink-0 cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={trigger.expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={cn('size-3.5 transition-transform', trigger.expanded && 'rotate-90')} />
            </button>
          </CollapsibleTrigger>
        ) : (
          <span className="inline-block size-3.5 shrink-0" />
        )}
        <span
          className={cn(
            'truncate text-sm text-gray-700 dark:text-gray-300',
            trigger && 'cursor-pointer hover:text-gray-900 dark:hover:text-gray-100',
          )}
          onClick={trigger?.onToggle}
        >
          {name}
          {count !== undefined && (
            <span className="text-gray-400 sm:hidden"> ({count})</span>
          )}
          {descendantNames && (
            <span className="hidden text-gray-400 sm:inline"> ({collapsedChildrenLabel(descendantNames)})</span>
          )}
        </span>
      </div>
      <div className="hidden w-20 shrink-0 truncate text-sm text-gray-700 sm:block dark:text-gray-300">{user}</div>
      <div className="w-12 shrink-0 text-right text-sm text-gray-700 sm:w-14 dark:text-gray-300">
        {formatPercent(cpuPercent)}
      </div>
      <div className="w-16 shrink-0 text-right text-sm text-gray-700 sm:w-20 dark:text-gray-300">{formatBytes(memRSS)}</div>
      <div className="flex w-8 shrink-0 justify-end">
        <Button variant="ghost" size="icon-xs" aria-label={t('dashboard.more')} onClick={() => onShowDetail(pid)}>
          <MoreHorizontal />
        </Button>
      </div>
    </div>
  )
}

// collapsedChildrenLabel picks what a collapsed parent's wide-screen label
// shows in place of the narrow-screen "(N)" count: every descendant's name
// when there are 2 or fewer of them, otherwise the first two (by whichever
// metric the tree is sorted on) followed by "...等{n}个".
function collapsedChildrenLabel(descendantNames: string[]): string {
  if (descendantNames.length <= 2) return descendantNames.join(', ')
  return `${descendantNames.slice(0, 2).join(', ')}...等${descendantNames.length}个`
}

function ProcessTreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onShowDetail,
  sort,
}: {
  node: ProcessNode
  depth: number
  expanded: ReadonlySet<number>
  onToggle: (pid: number) => void
  onShowDetail: (pid: number) => void
  sort: ProcessSort
}) {
  const hasChildren = node.children.length > 0
  const collapsible = hasChildren
  const isExpanded = expanded.has(node.pid)
  const collapsed = collapsible && !isExpanded

  const row = (
    <ProcessRow
      pid={node.pid}
      name={node.name}
      user={node.user}
      cpuPercent={collapsed ? node.totalCpuPercent : node.cpuPercent}
      memRSS={collapsed ? node.totalMemRSS : node.memRSS}
      count={collapsed ? node.totalCount : undefined}
      descendantNames={collapsed ? collectDescendantNames(node, sort) : undefined}
      depth={depth}
      trigger={collapsible ? { expanded: isExpanded, onToggle: () => onToggle(node.pid) } : undefined}
      onShowDetail={onShowDetail}
    />
  )

  if (!hasChildren) return row

  const children = node.children.map((child) => (
    <ProcessTreeRow
      key={child.pid}
      node={child}
      depth={depth + 1}
      expanded={expanded}
      onToggle={onToggle}
      onShowDetail={onShowDetail}
      sort={sort}
    />
  ))

  if (!collapsible) {
    return (
      <>
        {row}
        {children}
      </>
    )
  }

  return (
    <Collapsible open={isExpanded}>
      {row}
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function ProcessGridHeader() {
  const { t } = useI18n()

  return (
  <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5 dark:border-gray-800">
    <div className="flex min-w-0 flex-1 items-center gap-1 pl-[calc(0.875rem+0.25rem)] text-xs text-gray-500">
      {t('dashboard.process')}
    </div>
    <div className="hidden w-20 shrink-0 text-xs text-gray-500 sm:block">{t('dashboard.user')}</div>
    <div className="w-12 shrink-0 text-right text-xs text-gray-500 sm:w-14">{t('dashboard.cpu')}</div>
    <div className="w-16 shrink-0 text-right text-xs text-gray-500 sm:w-20">{t('dashboard.memory')}</div>
    <div className="w-8 shrink-0 text-right text-xs text-gray-500">{t('dashboard.more')}</div>
  </div>
  )
}

// Object-array data uses rows, never a <table>: tables don't reflow onto
// small screens, and this panel is meant to be read from a phone. Tree mode
// renders each row as its own flex row (rather than sharing one CSS grid via
// `display: contents`, as the flat view and the other object grids do) so
// that Radix's Collapsible can freely mount/unmount a parent's descendant
// rows without breaking a shared grid's column tracks.
export function ProcessGrid({
  processes,
  sort,
  tree,
  expanded,
  onToggle,
  onShowDetail,
  hideHeader = false,
}: {
  processes: ProcessInfo[]
  sort: ProcessSort
  tree: boolean
  expanded: ReadonlySet<number>
  onToggle: (pid: number) => void
  onShowDetail: (pid: number) => void
  hideHeader?: boolean
}) {
  const forest = useMemo(() => {
    if (!tree) return []
    const roots = buildProcessForest(processes)
    sortProcessForest(roots, sort, expanded)
    return roots
  }, [processes, sort, tree, expanded])
  const visibleRoots = forest.length === 1 ? forest[0].children : forest

  return (
    <div className="w-full">
      {!hideHeader && <ProcessGridHeader />}
      {tree
        ? visibleRoots.map((root) => (
            <ProcessTreeRow
              key={root.pid}
              node={root}
              depth={0}
              expanded={expanded}
              onToggle={onToggle}
              sort={sort}
              onShowDetail={onShowDetail}
            />
          ))
        : processes.map((p) => (
            <ProcessRow
              key={p.pid}
              pid={p.pid}
              name={p.name}
              user={p.user}
              cpuPercent={p.cpuPercent}
              memRSS={p.memRSS}
              depth={0}
              onShowDetail={onShowDetail}
            />
          ))}
    </div>
  )
}
