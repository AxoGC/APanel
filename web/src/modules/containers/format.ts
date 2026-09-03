import type { TranslationKey } from '@/lib/i18n'

const STATUS_KEYS: Record<string, TranslationKey> = {
  Up: 'containers.status.up',
  Exited: 'containers.status.exited',
  Created: 'containers.status.created',
  Restarting: 'containers.status.restarting',
  Paused: 'containers.status.paused',
  Removing: 'containers.status.removing',
  Dead: 'containers.status.dead',
}

const DURATION_KEYS: Record<string, TranslationKey> = {
  second: 'containers.duration.second',
  seconds: 'containers.duration.seconds',
  minute: 'containers.duration.minute',
  minutes: 'containers.duration.minutes',
  hour: 'containers.duration.hour',
  hours: 'containers.duration.hours',
  day: 'containers.duration.day',
  days: 'containers.duration.days',
}

// Docker returns its human-readable status in English (for example, "Up 3
// hours"), so translate the state and elapsed-time words before rendering it.
export function formatContainerStatus(status: string, t: (key: TranslationKey) => string): string {
  return status
    .replace(/^(Up|Exited|Created|Restarting|Paused|Removing|Dead)\b/, (word) => t(STATUS_KEYS[word]))
    .replace(/\b(second|seconds|minute|minutes|hour|hours|day|days)\b/g, (word) => t(DURATION_KEYS[word]))
    .replace(/\bago\b/g, t('containers.status.ago'))
}

export function statusClasses(state: string): [dot: string, text: string] {
  if (state === 'running') return ['bg-green-500', 'text-green-600 dark:text-green-400']
  if (state === 'dead') return ['bg-red-500', 'text-red-600 dark:text-red-400']
  return ['bg-gray-400', 'text-gray-500']
}

export const STATE_LABELS: Record<string, TranslationKey> = {
  created: 'containers.state.created',
  running: 'containers.state.running',
  paused: 'containers.state.paused',
  restarting: 'containers.state.restarting',
  removing: 'containers.state.removing',
  exited: 'containers.state.exited',
  dead: 'containers.state.dead',
}

export const RESTART_POLICY_LABELS: Record<string, TranslationKey> = {
  no: 'containers.create.restartPolicy.no',
  'on-failure': 'containers.create.restartPolicy.onFailure',
  always: 'containers.create.restartPolicy.always',
  'unless-stopped': 'containers.create.restartPolicy.unlessStopped',
}
