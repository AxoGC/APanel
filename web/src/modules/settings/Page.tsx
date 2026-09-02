import { useState, type ReactNode } from 'react'
import colors from 'tailwindcss/colors'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <div className="flex flex-col gap-2 border-b border-gray-200 py-4 first:pt-0 last:border-b-0 dark:border-gray-800">
      <p className="text-xs text-gray-500">{label}</p>
      {children}
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

      <Section label="Language">
        <div className="flex gap-4">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              className={cn(
                'cursor-pointer text-sm',
                locale === l ? 'text-theme-600 dark:text-theme-400' : 'text-gray-700 dark:text-gray-300',
              )}
            >
              {l === 'en' ? 'English' : '中文'}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Appearance">
        <div className="flex gap-4">
          {SCHEMES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStoredScheme(s)
                setScheme(s)
              }}
              className={cn(
                'cursor-pointer text-sm capitalize',
                scheme === s ? 'text-theme-600 dark:text-theme-400' : 'text-gray-700 dark:text-gray-300',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Section>

      <Section label="Theme color">
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
          <div className="flex gap-4">
            {DATA_LAYOUTS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setStoredDataLayout(l)
                  setDataLayout(l)
                }}
                className={cn(
                  'cursor-pointer text-sm',
                  dataLayout === l ? 'text-theme-600 dark:text-theme-400' : 'text-gray-700 dark:text-gray-300',
                )}
              >
                {t(l === 'table' ? 'settings.dataLayout.table' : 'settings.dataLayout.grid')}
              </button>
            ))}
          </div>
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
