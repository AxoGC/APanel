import { useEffect, useState, type ReactNode } from 'react'
import colors from 'tailwindcss/colors'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useAuth } from '@/lib/auth'
import { getStoredDataLayout, setStoredDataLayout, type DataLayout } from '@/lib/dataLayout'
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
const DATA_LAYOUTS: DataLayout[] = ['table', 'grid']

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-6 py-4 first:pt-0">
      <p className="w-24 shrink-0 text-xs text-gray-500">{label}</p>
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
  const [scheme, setScheme] = useState<ColorScheme>(getStoredScheme)
  const [hue, setHue] = useState<ThemeHue>(getStoredThemeHue)
  const [dataLayout, setDataLayout] = useState<DataLayout>(getStoredDataLayout)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    getSystemInfo()
      .then(setSystemInfo)
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto flex max-w-md flex-col p-4 sm:p-6">
      <h1 className="mb-2 text-base text-gray-900 dark:text-gray-100">{t('nav.settings')}</h1>

      <div className="border-b border-gray-200 py-4 first:pt-0 dark:border-gray-800">
        <p className="mb-3 text-xs text-gray-500">{t('settings.systemInfo.title')}</p>
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

      {/* Only meaningful on wide screens — narrow screens always use grid,
          so the control is hidden there rather than shown but inert. */}
      <div className="hidden md:block">
        <Section label={t('settings.dataLayout')}>
          <SegmentedControl
            value={dataLayout}
            onChange={(value) => {
              setStoredDataLayout(value)
              setDataLayout(value)
            }}
            options={DATA_LAYOUTS.map((l) => ({
              value: l,
              label: t(l === 'table' ? 'settings.dataLayout.table' : 'settings.dataLayout.grid'),
            }))}
          />
        </Section>
      </div>

      <Section label={t('settings.account')}>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          <LogOut />
          {t('settings.signOut')}
        </Button>
      </Section>
    </div>
  )
}
