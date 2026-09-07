import { useEffect, useState, type ReactNode } from 'react'
import colors from 'tailwindcss/colors'
import { BookOpen, Database, ListChecks, LogOut, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ToggleButton } from '@/components/ToggleButton'
import { useAuth } from '@/lib/auth'
import { useI18n, type Locale, type TranslationKey } from '@/lib/i18n'
import {
  getStoredReaderLineNumbers,
  getStoredReaderTextWrap,
  setStoredReaderLineNumbers,
  setStoredReaderTextWrap,
} from '@/lib/readerPrefs'
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
import bilibiliIcon from '@/assets/bilibili.svg'
import githubIcon from '@/assets/github.svg'
import logo from '@/assets/logo.svg'
import qqIcon from '@/assets/qq.svg'
import { getDiskUsage, getSystemInfo, type DiskPartition, type SystemInfo } from './api'
import { EnableModulesDialog } from './EnableModulesDialog'
import { SiteDataDialog } from './SiteDataDialog'
import { UpdateDialog } from './UpdateDialog'
import { UsersDialog } from './UsersDialog'

const SCHEMES: ColorScheme[] = ['light', 'dark', 'system']
const LOCALES: Locale[] = ['en', 'zh']

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <p className="w-18 shrink-0 text-xs text-gray-500">{label}</p>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// The form's final row: no left-side label, actions right-aligned.
function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2 py-2">{children}</div>
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

// Bytes -> whole GB, rounded (decimal, matching how drives are marketed —
// e.g. a ~500GB disk reads "465 GB", not "500 GB" or a binary-GiB figure).
function formatGB(bytes: number): string {
  return Math.round(bytes / 1e9).toString()
}

function PartitionField({ partition }: { partition: DiskPartition }) {
  const pct = partition.totalBytes > 0 ? (partition.usedBytes / partition.totalBytes) * 100 : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-theme-500'

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-gray-500" title={`${partition.fsType} ${partition.mountPoint}`}>
          {partition.fsType} {partition.mountPoint}
        </span>
        <span className="shrink-0 text-xs text-gray-500">
          {formatGB(partition.usedBytes)} / {formatGB(partition.totalBytes)} GB
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
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
  const [readerLineNumbers, setReaderLineNumbers] = useState(getStoredReaderLineNumbers)
  const [readerTextWrap, setReaderTextWrap] = useState(getStoredReaderTextWrap)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [diskPartitions, setDiskPartitions] = useState<DiskPartition[]>([])
  const [modulesDialogOpen, setModulesDialogOpen] = useState(false)
  const [siteDataDialogOpen, setSiteDataDialogOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [usersDialogOpen, setUsersDialogOpen] = useState(false)

  useEffect(() => {
    getSystemInfo()
      .then(setSystemInfo)
      .catch(() => {})
    getDiskUsage()
      .then(setDiskPartitions)
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto flex max-w-md flex-col p-4 sm:p-6 md:max-w-2xl">
      <div className="border-b border-gray-200 pt-2 pb-4 dark:border-gray-800">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
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
          {diskPartitions.map((partition) => (
            <PartitionField key={partition.device} partition={partition} />
          ))}
        </div>
      </div>

      <div className="py-2">
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

        <Section label={t('settings.reader')}>
          <div className="flex items-center gap-2">
            <ToggleButton
              active={readerLineNumbers}
              onClick={() => {
                const next = !readerLineNumbers
                setStoredReaderLineNumbers(next)
                setReaderLineNumbers(next)
              }}
            >
              {t('settings.reader.lineNumbers')}
            </ToggleButton>
            <ToggleButton
              active={readerTextWrap}
              onClick={() => {
                const next = !readerTextWrap
                setStoredReaderTextWrap(next)
                setReaderTextWrap(next)
              }}
            >
              {t('settings.reader.textWrap')}
            </ToggleButton>
          </div>
        </Section>

        <ButtonRow>
          <Button variant="outline" size="sm" onClick={() => setSiteDataDialogOpen(true)}>
            <Database />
            {t('settings.siteData')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModulesDialogOpen(true)}>
            <ListChecks />
            {t('settings.enableModules')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setUpdateDialogOpen(true)}>
            <RefreshCw />
            {t('settings.update')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setUsersDialogOpen(true)}>
            <Users />
            {t('settings.users')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            <LogOut />
            {t('settings.signOut')}
          </Button>
        </ButtonRow>
      </div>

      <EnableModulesDialog open={modulesDialogOpen} onOpenChange={setModulesDialogOpen} />
      <SiteDataDialog open={siteDataDialogOpen} onOpenChange={setSiteDataDialogOpen} />
      <UpdateDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />
      <UsersDialog open={usersDialogOpen} onOpenChange={setUsersDialogOpen} />

      <div className="flex flex-col gap-4 border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <img src={logo} alt="" className="size-16 shrink-0" />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">APanel</span>
            <span className="text-sm text-gray-500">{t('settings.about.tagline')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
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
            className="flex w-fit cursor-pointer items-center gap-1.5 text-theme-700 hover:underline dark:text-theme-300"
          >
            <img src={githubIcon} alt="" aria-hidden="true" className="size-4 dark:invert" />
            GitHub
          </a>
          <a
            href="https://qm.qq.com/q/rn3BmSyb06"
            target="_blank"
            rel="noreferrer"
            className="flex w-fit cursor-pointer items-center gap-1.5 text-theme-700 hover:underline dark:text-theme-300"
          >
            <img src={qqIcon} alt="" aria-hidden="true" className="size-4 dark:invert" />
            {t('settings.about.qqGroup')} 704280441
          </a>
          <a
            href="https://b23.tv/jfWeS6Z"
            target="_blank"
            rel="noreferrer"
            className="flex w-fit cursor-pointer items-center gap-1.5 text-theme-700 hover:underline dark:text-theme-300"
          >
            <img src={bilibiliIcon} alt="" aria-hidden="true" className="size-4 dark:invert" />
            Bilibili
          </a>
        </div>
      </div>
    </div>
  )
}
