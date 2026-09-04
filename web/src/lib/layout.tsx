import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface Layout {
  /** >= 768px is 'desktop', regardless of pointer type — see AGENTS/plans/adaptive-ui-layer.md. */
  shell: 'mobile' | 'desktop'
  /** `pointer: coarse` — true for touch screens, including desktop-width tablets. */
  touch: boolean
  /** < 640px, narrower than the desktop breakpoint — used by the dashboard Gauge. */
  isNarrow: boolean
}

const DESKTOP_QUERY = '(min-width: 768px)'
const TOUCH_QUERY = '(pointer: coarse)'
const NARROW_QUERY = '(max-width: 639px)'

function readLayout(): Layout {
  return {
    shell: window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'mobile',
    touch: window.matchMedia(TOUCH_QUERY).matches,
    isNarrow: window.matchMedia(NARROW_QUERY).matches,
  }
}

const LayoutContext = createContext<Layout | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState(readLayout)

  useEffect(() => {
    const queries = [DESKTOP_QUERY, TOUCH_QUERY, NARROW_QUERY].map((query) => window.matchMedia(query))
    const update = () => setLayout(readLayout())
    queries.forEach((mql) => mql.addEventListener('change', update))
    return () => queries.forEach((mql) => mql.removeEventListener('change', update))
  }, [])

  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
}

export function useLayout(): Layout {
  const layout = useContext(LayoutContext)
  if (!layout) throw new Error('useLayout must be used within a LayoutProvider')
  return layout
}
