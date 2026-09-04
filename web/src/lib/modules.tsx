import { Box, Database, History, Shield, Waypoints, type LucideIcon } from 'lucide-react'
import type { ModuleKey } from './features'
import type { TranslationKey } from './i18n'

// Shared metadata for the 5 optional extension modules — Nav and the
// "enable modules" dialog both render off this, so a module's route, label,
// and icon live in exactly one place.
export const MODULE_ORDER: ModuleKey[] = ['containers', 'history', 'firewall', 'proxy', 'database']

export const MODULE_META: Record<ModuleKey, { to: string; labelKey: TranslationKey; icon: LucideIcon }> = {
  containers: { to: '/containers', labelKey: 'nav.containers', icon: Box },
  history: { to: '/history', labelKey: 'nav.history', icon: History },
  firewall: { to: '/firewall', labelKey: 'nav.firewall', icon: Shield },
  proxy: { to: '/proxy', labelKey: 'nav.proxy', icon: Waypoints },
  database: { to: '/database', labelKey: 'nav.database', icon: Database },
}
