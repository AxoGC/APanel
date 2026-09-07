import { SiDocker } from '@icons-pack/react-simple-icons'
import { Database, FolderOpen, History, ScrollText, Server, Shield, SquareTerminal, Waypoints } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ModuleKey } from './features'
import type { TranslationKey } from './i18n'

// Covers both lucide-react icons and @icons-pack/react-simple-icons brand
// icons — MODULE_META mixes the two (Docker uses its real product mark).
export type ModuleIcon = ComponentType<{ className?: string }>

// Shared metadata for the 9 togglable/reorderable modules — Nav and the
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
  'auditlog',
]

export const MODULE_META: Record<ModuleKey, { to: string; labelKey: TranslationKey; icon: ModuleIcon }> = {
  terminal: { to: '/terminal', labelKey: 'nav.terminal', icon: SquareTerminal },
  services: { to: '/services', labelKey: 'nav.services', icon: Server },
  files: { to: '/files', labelKey: 'nav.files', icon: FolderOpen },
  containers: { to: '/containers', labelKey: 'nav.containers', icon: SiDocker },
  history: { to: '/history', labelKey: 'nav.history', icon: History },
  firewall: { to: '/firewall', labelKey: 'nav.firewall', icon: Shield },
  proxy: { to: '/proxy', labelKey: 'nav.proxy', icon: Waypoints },
  database: { to: '/database', labelKey: 'nav.database', icon: Database },
  auditlog: { to: '/auditlog', labelKey: 'nav.auditlog', icon: ScrollText },
}

// The 3 optional extensions that can have a checkable local dependency
// (see DependencyDialog) — dashboard/terminal/services/files are core,
// always-local features with nothing to configure or detect. containers
// isn't here either: it only ever talks to the local Docker runtime, so
// there's no connection to configure. firewall isn't here either: it only
// ever talks to the local ufw binary, so it has no connection dialog to
// offer — its local-only health is still probed for initial-feature
// detection, just not exposed through this dialog.
export type DependencyModuleKey = 'history' | 'proxy' | 'database'

export const DEPENDENCY_MODULES: DependencyModuleKey[] = ['history', 'proxy', 'database']
