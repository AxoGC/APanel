import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatBytes, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildProcessForest, sortProcessForest, type ProcessNode } from './processTree'
import type { ProcessInfo, ProcessSort } from './useDashboardStream'

function ProcessRow({
  name,
  user,
  cpuPercent,
  memRSS,
  count,
  depth,
  trigger,
}: {
  name: string
  user: string
  cpuPercent: number
  memRSS: number
  count?: number
  depth: number
  trigger?: { expanded: boolean; onToggle: () => void }
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
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
        <span className="truncate text-sm text-gray-700 dark:text-gray-300">
          {name}
          {count !== undefined && <span className="text-gray-400"> ({count})</span>}
        </span>
      </div>
      <div className="hidden w-20 shrink-0 truncate text-sm text-gray-700 sm:block dark:text-gray-300">{user}</div>
      <div className="w-14 shrink-0 text-right text-sm text-gray-700 dark:text-gray-300">
        {formatPercent(cpuPercent)}
      </div>
      <div className="w-20 shrink-0 text-right text-sm text-gray-700 dark:text-gray-300">{formatBytes(memRSS)}</div>
    </div>
  )
}

function ProcessTreeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: ProcessNode
  depth: number
  expanded: ReadonlySet<number>
  onToggle: (pid: number) => void
}) {
  const hasChildren = node.children.length > 0
  // The root level (depth 0) is always systemd/kthreadd's whole-machine
  // subtree — collapsing it away would hide almost everything, so it has no
  // collapse affordance at all and is always shown expanded.
  const collapsible = depth > 0 && hasChildren
  const isExpanded = expanded.has(node.pid)
  const collapsed = collapsible && !isExpanded

  const row = (
    <ProcessRow
      name={node.name}
      user={node.user}
      cpuPercent={collapsed ? node.totalCpuPercent : node.cpuPercent}
      memRSS={collapsed ? node.totalMemRSS : node.memRSS}
      count={collapsed ? node.totalCount : undefined}
      depth={depth}
      trigger={collapsible ? { expanded: isExpanded, onToggle: () => onToggle(node.pid) } : undefined}
    />
  )

  if (!hasChildren) return row

  const children = node.children.map((child) => (
    <ProcessTreeRow key={child.pid} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
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

const HEADER_ROW = (
  <div className="flex items-center gap-2 pb-1.5">
    <div className="flex min-w-0 flex-1 items-center gap-1 pl-[calc(0.875rem+0.25rem)] text-xs text-gray-500">
      Process
    </div>
    <div className="hidden w-20 shrink-0 text-xs text-gray-500 sm:block">User</div>
    <div className="w-14 shrink-0 text-right text-xs text-gray-500">CPU</div>
    <div className="w-20 shrink-0 text-right text-xs text-gray-500">Memory</div>
  </div>
)

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
}: {
  processes: ProcessInfo[]
  sort: ProcessSort
  tree: boolean
}) {
  // Empty by default: every collapsible (depth > 0) node starts collapsed.
  // Root nodes render pre-expanded regardless (see ProcessTreeRow), so the
  // tree still opens showing systemd/kthreadd's direct children.
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set())

  const toggle = (pid: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  const forest = useMemo(() => {
    if (!tree) return []
    const roots = buildProcessForest(processes)
    sortProcessForest(roots, sort, expanded)
    return roots
  }, [processes, sort, tree, expanded])

  return (
    <div className="max-w-2xl">
      {HEADER_ROW}
      {tree
        ? forest.map((root) => (
            <ProcessTreeRow key={root.pid} node={root} depth={0} expanded={expanded} onToggle={toggle} />
          ))
        : processes.map((p) => (
            <ProcessRow key={p.pid} name={p.name} user={p.user} cpuPercent={p.cpuPercent} memRSS={p.memRSS} depth={0} />
          ))}
    </div>
  )
}
