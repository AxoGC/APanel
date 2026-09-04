import { useState } from 'react'
import { useLayout } from '@/lib/layout'

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

/** The stored grid/table preference on wide screens; always 'grid' on narrow
 * screens, where the setting has no effect. */
export function useDataLayout(): DataLayout {
  const { shell } = useLayout()
  const [stored] = useState(getStoredDataLayout)
  return shell === 'desktop' ? stored : 'grid'
}
