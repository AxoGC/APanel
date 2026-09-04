import type { TranslationKey } from '@/lib/i18n'

export function statusClasses(subState: string): [dot: string, text: string] {
  if (subState === 'running') return ['bg-green-500', 'text-green-600 dark:text-green-400']
  if (subState === 'dead') return ['bg-red-500', 'text-red-600 dark:text-red-400']
  return ['bg-gray-400', 'text-gray-500']
}

export function enablementClasses(unitFileState: string): [dot: string, text: string] {
  if (unitFileState === 'enabled' || unitFileState === 'enabled-runtime') return ['bg-green-500', 'text-green-600 dark:text-green-400']
  if (unitFileState === 'masked' || unitFileState === 'bad') return ['bg-red-500', 'text-red-600 dark:text-red-400']
  return ['bg-gray-400', 'text-gray-500']
}

// The status column reuses the filter's own vocabulary (services.filter.*)
// so a card's displayed status always matches whichever filter option would
// select it — see statesForStatus on the backend for the running/exited/dead
// SubState mapping this mirrors.
export const SUBSTATE_LABELS: Record<string, TranslationKey> = {
  running: 'services.filter.running',
  exited: 'services.filter.stopped',
  dead: 'services.filter.failed',
}

export const UNIT_FILE_STATE_LABELS: Record<string, TranslationKey> = {
  enabled: 'services.unitFileState.enabled',
  static: 'services.unitFileState.static',
  alias: 'services.unitFileState.alias',
  disabled: 'services.unitFileState.disabled',
  masked: 'services.unitFileState.masked',
  'enabled-runtime': 'services.unitFileState.enabledRuntime',
  indirect: 'services.unitFileState.indirect',
  bad: 'services.unitFileState.bad',
}

// Display only — actions still key off the full unit name (u.name), since
// systemd needs the ".service" suffix for the actual API calls.
export function displayName(name: string): string {
  return name.endsWith('.service') ? name.slice(0, -'.service'.length) : name
}
