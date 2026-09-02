import { Box, Gauge, History, LogOut, Menu, Server, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', labelKey: 'nav.dashboard', icon: Gauge },
  { to: '/services', labelKey: 'nav.services', icon: Server },
  { to: '/containers', labelKey: 'nav.containers', icon: Box },
  { to: '/history', labelKey: 'nav.history', icon: History },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
] as const

export function Nav() {
  const { t } = useI18n()
  const { logout } = useAuth()

  return (
    <nav className="flex items-center justify-between px-4 py-3 sm:px-6">
      <div className="hidden items-center gap-6 md:flex">
        {items.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-1.5 text-sm',
                isActive ? 'text-theme-600 dark:text-theme-400' : 'text-gray-700 dark:text-gray-300',
              )
            }
          >
            <Icon className="size-4" />
            {t(labelKey)}
          </NavLink>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('nav.menu')}
            className="flex items-center gap-1.5 text-sm text-gray-700 md:hidden dark:text-gray-300"
          >
            <Menu className="size-4" />
            {t('nav.menu')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {items.map(({ to, labelKey, icon: Icon }) => (
            <DropdownMenuItem key={to} asChild>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn('flex items-center gap-2', isActive && 'text-theme-600 dark:text-theme-400')
                }
              >
                <Icon className="size-4" />
                {t(labelKey)}
              </NavLink>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => void logout()} className="flex items-center gap-2">
            <LogOut className="size-4" />
            {t('nav.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => void logout()}
        aria-label={t('nav.logout')}
        className="hidden items-center gap-1.5 text-sm text-gray-700 md:flex dark:text-gray-300"
      >
        <LogOut className="size-4" />
      </button>
    </nav>
  )
}
