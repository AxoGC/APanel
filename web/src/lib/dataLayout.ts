import { useEffect, useState } from 'react'

export type DataLayout = 'grid' | 'table'

const DATA_LAYOUT_STORAGE_KEY = 'apanel:data-layout'
const DEFAULT_DATA_LAYOUT: DataLayout = 'table'

export function getStoredDataLayout(): DataLayout {
  const stored = localStorage.getItem(DATA_LAYOUT_STORAGE_KEY)
  return stored === 'grid' || stored === 'table' ? stored : DEFAULT_DATA_LAYOUT
}

export function setStoredDataLayout(layout: DataLayout) {
  localStorage.setItem(DATA_LAYOUT_STORAGE_KEY, layout)
}

// Matches the nav's own desktop/mobile split (md, 768px) — see Nav.tsx.
const WIDE_QUERY = '(min-width: 768px)'

function useIsWideScreen(): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE_QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(WIDE_QUERY)
    const update = () => setIsWide(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isWide
}

/** The stored grid/table preference on wide screens; always 'grid' on narrow
 * screens, where the setting has no effect. */
export function useDataLayout(): DataLayout {
  const isWide = useIsWideScreen()
  const [stored] = useState(getStoredDataLayout)
  return isWide ? stored : 'grid'
}
