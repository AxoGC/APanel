import { ChevronLeft, ChevronRight, Gauge, PanelRightClose, PanelRightOpen, Settings, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import logo from '@/assets/logo.png'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFeatures } from '@/lib/features'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { MODULE_META } from '@/lib/modules'
import { cn } from '@/lib/utils'

type NavItem = { to: string; labelKey: TranslationKey; icon: LucideIcon }

// Dashboard and Settings aren't part of the enable/reorder system — they're
// mandatory, pinned first and last respectively.
const DASHBOARD_ITEM = { to: '/', labelKey: 'nav.dashboard', icon: Gauge } satisfies NavItem
const SETTINGS_ITEM = { to: '/settings', labelKey: 'nav.settings', icon: Settings } satisfies NavItem

const COLLAPSED_STORAGE_KEY = 'apanel:nav-collapsed'

function itemClasses(isActive: boolean, collapsed: boolean): string {
  return cn(
    'flex h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 text-xs',
    collapsed
      ? 'md:size-10 md:min-w-0 md:flex-row md:justify-center md:px-0 md:py-0'
      : 'md:h-auto md:w-full md:min-w-0 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-sm',
    isActive ? 'text-theme-700 dark:text-theme-300' : 'text-gray-700 dark:text-gray-300',
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
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true')

  function setCollapsed(value: boolean) {
    setCollapsedState(value)
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(value))
  }

  const visibleItems = [
    DASHBOARD_ITEM,
    ...features.modules.filter((m) => m.enabled).map((m) => MODULE_META[m.key]),
    SETTINGS_ITEM,
  ]

  const scrollBy = (delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <nav className="relative shrink-0 border-t border-gray-200 md:flex md:w-auto md:flex-col md:border-t-0 md:border-r dark:border-gray-800">
      <div className="hidden h-14 items-center justify-center gap-2 md:flex">
        <img src={logo} alt="APanel" className="size-6 shrink-0" />
        {!collapsed && <span className="text-sm font-semibold text-theme-700 dark:text-theme-300">Apanel</span>}
      </div>

      <div
        ref={ref}
        className="scrollbar-hide flex overflow-x-auto md:hidden"
      >
        {visibleItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(labelKey)}
            className={({ isActive }) => itemClasses(isActive, collapsed)}
          >
            <Icon className="size-5 md:size-4" />
            <span className={cn(collapsed && 'md:hidden')}>{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>

      <ScrollArea className="hidden min-h-0 flex-1 md:block">
        <div className="flex flex-col p-2">
          {visibleItems.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={t(labelKey)}
              className={({ isActive }) => itemClasses(isActive, collapsed)}
            >
              <Icon className="size-5 md:size-4" />
              <span className={cn(collapsed && 'md:hidden')}>{t(labelKey)}</span>
            </NavLink>
          ))}
        </div>
      </ScrollArea>

      <button
        type="button"
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        onClick={() => setCollapsed(!collapsed)}
        className="mt-auto mx-2 mb-2 hidden size-10 cursor-pointer items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300 md:flex"
      >
        {collapsed ? <PanelRightOpen className="size-4" /> : <PanelRightClose className="size-4" />}
      </button>

      {canScrollLeft && (
        <div className="absolute inset-y-0 left-0 flex items-center bg-gradient-to-r from-background to-transparent pr-3 md:hidden">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-120)}
            className="flex cursor-pointer items-center justify-center text-gray-500"
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
            className="flex cursor-pointer items-center justify-center text-gray-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}
