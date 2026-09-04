import { useEffect, useState } from 'react'
import { getModuleDependency } from './dependency'
import type { DependencyModuleKey } from './modules'

// On entering a module's page, checks its dependency once and auto-opens
// the connection dialog if it's not healthy yet. The page's own toolbar
// button reopens the same dialog manually via setDialogOpen once healthy.
export function useDependencyGate(key: DependencyModuleKey) {
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getModuleDependency(key)
      .then((status) => {
        if (!cancelled && !status.healthy) setDialogOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [key])

  return { dialogOpen, setDialogOpen }
}
