import { useState, type ReactNode } from 'react'
import colors from 'tailwindcss/colors'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useAuth } from '@/lib/auth'
import { getStoredDataLayout, setStoredDataLayout, type DataLayout } from '@/lib/dataLayout'
import { useI18n, type Locale } from '@/lib/i18n'
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

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n()
  const { logout } = useAuth()
  const [scheme, setScheme] = useState<ColorScheme>(getStoredScheme)
  const [hue, setHue] = useState<ThemeHue>(getStoredThemeHue)
  const [dataLayout, setDataLayout] = useState<DataLayout>(getStoredDataLayout)

  return (
    <div className="mx-auto flex max-w-md flex-col p-4 sm:p-6">
      <h1 className="mb-2 text-base text-gray-900 dark:text-gray-100">{t('nav.settings')}</h1>

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
