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
  week: 'containers.duration.week',
  weeks: 'containers.duration.weeks',
  month: 'containers.duration.month',
  months: 'containers.duration.months',
  year: 'containers.duration.year',
  years: 'containers.duration.years',
}

// Docker's go-units HumanDuration has three fixed phrases instead of a count
// + unit ("Less than a second", "About a minute", "About an hour") for the
// smallest value of their respective units — these must be translated as
// whole phrases before the word-level pass below, otherwise e.g. "About an
// hour" only gets its trailing "hour" swapped out, leaving "About an 小时".
const DURATION_PHRASE_KEYS: Record<string, TranslationKey> = {
  'Less than a second': 'containers.duration.lessThanASecond',
  'About a minute': 'containers.duration.aboutAMinute',
  'About an hour': 'containers.duration.aboutAnHour',
}

const HEALTH_KEYS: Record<string, TranslationKey> = {
  healthy: 'containers.health.healthy',
  unhealthy: 'containers.health.unhealthy',
  'health: starting': 'containers.health.starting',
}

// Docker returns its human-readable status in English (for example, "Up 3
// hours (unhealthy)"), so translate the state, elapsed-time, and health
// words before rendering it.
export function formatContainerStatus(status: string, t: (key: TranslationKey) => string): string {
  return status
    .replace(/^(Up|Exited|Created|Restarting|Paused|Removing|Dead)\b/, (word) => t(STATUS_KEYS[word]))
    .replace(/Less than a second|About a minute|About an hour/, (phrase) => t(DURATION_PHRASE_KEYS[phrase]))
    .replace(/\b(second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/g, (word) =>
      t(DURATION_KEYS[word]),
    )
    .replace(/\((healthy|unhealthy|health: starting)\)/, (_, word: string) => `(${t(HEALTH_KEYS[word])})`)
    .replace(/\bago\b/g, t('containers.status.ago'))
}

export function isUnhealthy(status: string): boolean {
  return /\(unhealthy\)/.test(status)
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
