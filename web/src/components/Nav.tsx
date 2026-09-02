import { Box, ChevronLeft, ChevronRight, FolderOpen, Gauge, History, Server, Settings, Shield } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useFeatures, type Features } from '@/lib/features'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', labelKey: 'nav.dashboard', icon: Gauge },
  { to: '/services', labelKey: 'nav.services', icon: Server },
  { to: '/files', labelKey: 'nav.files', icon: FolderOpen },
  { to: '/containers', labelKey: 'nav.containers', icon: Box, feature: 'containers' },
  { to: '/history', labelKey: 'nav.history', icon: History, feature: 'history' },
  { to: '/firewall', labelKey: 'nav.firewall', icon: Shield, feature: 'firewall' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] satisfies { to: string; labelKey: TranslationKey; icon: typeof Gauge; feature?: keyof Features }[]

function itemClasses(isActive: boolean): string {
  return cn(
    'flex shrink-0 flex-col items-center justify-center gap-1 px-3 py-2 text-xs',
    'md:w-full md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-sm',
    isActive ? 'text-theme-600 dark:text-theme-400' : 'text-gray-700 dark:text-gray-300',
  )
}

/** Fade cues at the ends of the mobile bottom nav, shown only while there's
 * more to scroll to in that direction — the scrollbar itself is hidden. */
function useScrollCues() {
  const ref = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  return { ref, canScrollLeft, canScrollRight }
}

export function Nav() {
  const { t } = useI18n()
  const features = useFeatures()
  const { ref, canScrollLeft, canScrollRight } = useScrollCues()

  const visibleItems = items.filter((item) => !item.feature || features[item.feature])

  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <nav className="relative shrink-0 border-t border-gray-200 md:w-48 md:border-t-0 md:border-r dark:border-gray-800">
      <div
        ref={ref}
        className="scrollbar-hide flex overflow-x-auto md:h-full md:flex-col md:overflow-x-visible md:overflow-y-auto md:p-2"
      >
        {visibleItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => itemClasses(isActive)}>
            <Icon className="size-5 md:size-4" />
            <span>{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>

      {canScrollLeft && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-background to-transparent pr-3 md:hidden">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-120)}
            className="flex items-center justify-center text-gray-500"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
      )}
      {canScrollRight && (
        <div className="absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-background to-transparent pl-3 md:hidden">
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(120)}
            className="flex items-center justify-center text-gray-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
