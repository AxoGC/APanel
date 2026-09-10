import type { ProcessInfo } from './useDashboardStream'

export interface ProcessNode extends ProcessInfo {
  children: ProcessNode[]
  /** This node plus every descendant. */
  totalCount: number
  totalCpuPercent: number
  totalMemRSS: number
}

/** Links the flat process list into a forest by pid/ppid, and rolls up each
 * node's own usage into a subtree total (count, cpu, mem) covering itself
 * and every descendant. A process whose ppid isn't present in the list
 * (already exited, or a kernel thread parented to pid 0) becomes a root —
 * there can be more than one root, hence a forest rather than a single tree. */
export function buildProcessForest(processes: ProcessInfo[]): ProcessNode[] {
  const nodes = new Map<number, ProcessNode>()
  for (const p of processes) {
    nodes.set(p.pid, { ...p, children: [], totalCount: 1, totalCpuPercent: p.cpuPercent, totalMemRSS: p.memRSS })
  }

  const roots: ProcessNode[] = []
  for (const node of nodes.values()) {
    const parent = node.ppid !== node.pid ? nodes.get(node.ppid) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function aggregate(node: ProcessNode): void {
    for (const child of node.children) {
      aggregate(child)
      node.totalCount += child.totalCount
      node.totalCpuPercent += child.totalCpuPercent
      node.totalMemRSS += child.totalMemRSS
    }
  }
  for (const root of roots) aggregate(root)

  return roots
}

export type ProcessMetric = 'cpu' | 'mem'

function metricValue(node: ProcessNode, metric: ProcessMetric): number {
  return metric === 'cpu' ? node.totalCpuPercent : node.totalMemRSS
}

/** Flattens every descendant of `node` (not just direct children), sorted by
 * the given metric — used to pick which child names to surface in a
 * collapsed parent's label on wide screens (see ProcessGrid's ProcessRow). */
export function collectDescendantNames(node: ProcessNode, metric: ProcessMetric): string[] {
  const descendants: ProcessNode[] = []
  function visit(n: ProcessNode): void {
    for (const child of n.children) {
      descendants.push(child)
      visit(child)
    }
  }
  visit(node)
  descendants.sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
  return descendants.map((n) => n.name)
}

/** Sorts a forest in place, recursively, by the given metric. Always sorts
 * by each node's subtree total (equal to its own value for a leaf), even
 * when expanded — expanding a node changes what's *displayed* for it (see
 * ProcessTreeRow), not where it sits in the order, so a row never jumps
 * position just because the user opened it. */
export function sortProcessForest(
  nodes: ProcessNode[],
  metric: ProcessMetric,
  expanded: ReadonlySet<number>,
  depth = 0,
): void {
  nodes.sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
  for (const node of nodes) {
    if (node.children.length > 0 && (depth === 0 || expanded.has(node.pid))) {
      sortProcessForest(node.children, metric, expanded, depth + 1)
    }
  }
}
