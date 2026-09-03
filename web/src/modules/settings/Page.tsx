import { useEffect, useState, type ReactNode } from 'react'
import colors from 'tailwindcss/colors'
import { BookOpen, ChevronDown, GitFork, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useAuth } from '@/lib/auth'
import { BASE_FEATURES, useFeatures, type FeatureKey } from '@/lib/features'
import { useI18n, type Locale, type TranslationKey } from '@/lib/i18n'
import {
  getStoredScheme,
  getStoredThemeHue,
  setStoredScheme,
  setStoredThemeHue,
  THEME_HUES,
  type ColorScheme,
  type ThemeHue,
} from '@/lib/theme'
import { cn } from '@/lib/utils'
import { getSystemInfo, type SystemInfo } from './api'

const SCHEMES: ColorScheme[] = ['light', 'dark', 'system']
const LOCALES: Locale[] = ['en', 'zh']

const FEATURE_LABEL_KEYS: Record<FeatureKey, TranslationKey> = {
  dashboard: 'nav.dashboard',
  terminal: 'nav.terminal',
  services: 'nav.services',
  files: 'nav.files',
  containers: 'nav.containers',
  history: 'nav.history',
  firewall: 'nav.firewall',
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2 first:pt-0">
      <p className="w-18 shrink-0 text-xs text-gray-500">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="truncate text-sm text-gray-700 dark:text-gray-300" title={value}>
        {value}
      </span>
    </div>
  )
}

// Drops leading zero-valued units (e.g. "5m 12s" once a host has been up
// less than an hour) but always keeps seconds, so a freshly booted host
// doesn't render as an empty string.
function formatUptime(totalSeconds: number, t: (key: TranslationKey) => string): string {
  const total = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days}${t('settings.systemInfo.unit.day')}`)
  if (days > 0 || hours > 0) parts.push(`${hours}${t('settings.systemInfo.unit.hour')}`)
  if (days > 0 || hours > 0 || minutes > 0) parts.push(`${minutes}${t('settings.systemInfo.unit.minute')}`)
  parts.push(`${seconds}${t('settings.systemInfo.unit.second')}`)
  return parts.join(' ')
}

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const { logout } = useAuth()
  const { containers, history, firewall, disabledFeatures, setDisabledFeatures } = useFeatures()
  const [scheme, setScheme] = useState<ColorScheme>(getStoredScheme)
  const [hue, setHue] = useState<ThemeHue>(getStoredThemeHue)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [pendingDisabledFeatures, setPendingDisabledFeatures] = useState<FeatureKey[] | null>(null)

  useEffect(() => {
    getSystemInfo()
      .then(setSystemInfo)
      .catch(() => {})
  }, [])

  const availableFeatures: FeatureKey[] = [
    ...BASE_FEATURES,
    ...(containers ? ['containers' as const] : []),
    ...(history ? ['history' as const] : []),
    ...(firewall ? ['firewall' as const] : []),
  ]
  const effectiveDisabledFeatures = pendingDisabledFeatures ?? disabledFeatures
  const enabledFeatureCount = availableFeatures.filter((feature) => !effectiveDisabledFeatures.includes(feature)).length

  const toggleFeature = async (feature: FeatureKey, enabled: boolean) => {
    const nextDisabledFeatures = enabled
      ? effectiveDisabledFeatures.filter((value) => value !== feature)
      : [...effectiveDisabledFeatures, feature]
    setPendingDisabledFeatures(nextDisabledFeatures)
    try {
      await setDisabledFeatures(nextDisabledFeatures)
    } catch {
      // Keep the server-provided value when saving fails.
    } finally {
      setPendingDisabledFeatures(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col p-4 sm:p-6">
      <h1 className="mb-2 text-base text-gray-900 dark:text-gray-100">{t('nav.settings')}</h1>

      <div className="border-b border-gray-200 py-2 first:pt-0 dark:border-gray-800">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label={t('settings.systemInfo.hostname')} value={systemInfo?.hostname ?? '–'} />
          <Field label={t('settings.systemInfo.distro')} value={systemInfo?.distro || '–'} />
          <Field label={t('settings.systemInfo.kernel')} value={systemInfo?.kernel ?? '–'} />
          <Field label={t('settings.systemInfo.arch')} value={systemInfo?.arch ?? '–'} />
          <Field
            label={t('settings.systemInfo.bootTime')}
            value={systemInfo ? new Date(systemInfo.bootTime).toLocaleString() : '–'}
          />
          <Field
            label={t('settings.systemInfo.uptime')}
            value={systemInfo ? formatUptime(systemInfo.uptimeSeconds, t) : '–'}
          />
        </div>
      </div>

      <Section label={t('settings.language')}>
        <SegmentedControl
          value={locale}
          onChange={setLocale}
          options={LOCALES.map((l) => ({ value: l, label: l === 'en' ? 'English' : '中文' }))}
        />
      </Section>

      <Section label={t('settings.appearance')}>
        <SegmentedControl
          value={scheme}
          onChange={(value) => {
            setStoredScheme(value)
            setScheme(value)
          }}
          options={SCHEMES.map((s) => ({ value: s, label: t(`settings.appearance.${s}` as const) }))}
        />
      </Section>

      <Section label={t('settings.themeColor')}>
        <div className="flex flex-wrap gap-3">
          {THEME_HUES.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={h}
              onClick={() => {
                setStoredThemeHue(h)
                setHue(h)
              }}
              className={cn(
                'size-6 cursor-pointer rounded-full',
                hue === h && 'ring-2 ring-gray-400 ring-offset-2 dark:ring-gray-500',
              )}
              style={{ backgroundColor: colors[h][500] }}
            />
          ))}
        </div>
      </Section>

      <Section label={t('settings.enabledFeatures')}>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('settings.enabledFeatures')}
              title={t('settings.enabledFeatures')}
              className="flex h-8 w-20 cursor-pointer items-center justify-between rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
            >
              <span>{enabledFeatureCount}</span>
              <ChevronDown className="size-4 text-gray-500" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1">
            <div role="listbox" aria-multiselectable="true">
              {availableFeatures.map((feature) => {
                const enabled = !effectiveDisabledFeatures.includes(feature)
                return (
                  <label
                    key={feature}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      checked={enabled}
                      disabled={pendingDisabledFeatures !== null}
                      onCheckedChange={(checked) => void toggleFeature(feature, checked === true)}
                    />
                    <span>{t(FEATURE_LABEL_KEYS[feature])}</span>
                  </label>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </Section>

      <Section label={t('settings.account')}>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut />
          {t('settings.signOut')}
        </Button>
      </Section>

      <div className="grid grid-cols-2 border-t border-gray-200 pt-2 text-sm dark:border-gray-800">
          <a
            href="https://apanel.axogc.net"
            target="_blank"
            rel="noreferrer"
            className="flex w-fit cursor-pointer items-center gap-1.5 text-theme-700 hover:underline dark:text-theme-300"
          >
            <BookOpen className="size-4" />
            {t('settings.about.documentation')}
          </a>
          <a
            href="https://github.com/axogc/apanel"
            target="_blank"
            rel="noreferrer"
            className="flex w-fit cursor-pointer items-center gap-1.5 justify-self-end text-theme-700 hover:underline dark:text-theme-300"
          >
            <GitFork className="size-4" />
            GitHub
          </a>
      </div>
    </div>
  )
}
