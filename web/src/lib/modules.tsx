import { Box, Database, FolderOpen, History, Server, Shield, SquareTerminal, Waypoints, type LucideIcon } from 'lucide-react'
import type { ModuleKey } from './features'
import type { TranslationKey } from './i18n'

// Shared metadata for the 8 togglable/reorderable modules — Nav and the
// "enable modules" dialog both render off this, so a module's route,
// label, and icon live in exactly one place. Order here doubles as the
// default order (matches the backend's moduleOrder) before the admin
// customizes it. Dashboard and Settings aren't here — they're mandatory,
// pinned first and last in Nav directly.
export const MODULE_ORDER: ModuleKey[] = [
  'terminal',
  'services',
  'files',
  'containers',
  'history',
  'firewall',
  'proxy',
  'database',
]

export const MODULE_META: Record<ModuleKey, { to: string; labelKey: TranslationKey; icon: LucideIcon }> = {
  terminal: { to: '/terminal', labelKey: 'nav.terminal', icon: SquareTerminal },
  services: { to: '/services', labelKey: 'nav.services', icon: Server },
  files: { to: '/files', labelKey: 'nav.files', icon: FolderOpen },
  containers: { to: '/containers', labelKey: 'nav.containers', icon: Box },
  history: { to: '/history', labelKey: 'nav.history', icon: History },
  firewall: { to: '/firewall', labelKey: 'nav.firewall', icon: Shield },
  proxy: { to: '/proxy', labelKey: 'nav.proxy', icon: Waypoints },
  database: { to: '/database', labelKey: 'nav.database', icon: Database },
}

// The 5 optional extensions that can have a checkable local dependency
// (see DependencyDialog) — dashboard/terminal/services/files are core,
// always-local features with nothing to configure or detect.
export type DependencyModuleKey = 'containers' | 'history' | 'firewall' | 'proxy' | 'database'

export const DEPENDENCY_MODULES: DependencyModuleKey[] = ['containers', 'history', 'firewall', 'proxy', 'database']
