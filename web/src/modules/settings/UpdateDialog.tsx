import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ToggleButton } from '@/components/ToggleButton'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { checkForUpdate, getUpdateStatus, putUpdateSettings, type UpdateStatus } from './api'

export function UpdateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useI18n()
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [source, setSource] = useState('')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    getUpdateStatus()
      .then((s) => {
        setStatus(s)
        setSource(s.settings.source)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [open])

  async function toggleEnabled() {
    if (!status) return
    setSaving(true)
    setError(null)
    try {
      const next = await putUpdateSettings({ enabled: !status.settings.enabled, source })
      setStatus(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function saveSource() {
    if (!status || source === status.settings.source) return
    setSaving(true)
    setError(null)
    try {
      const next = await putUpdateSettings({ enabled: status.settings.enabled, source })
      setStatus(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckNow() {
    setChecking(true)
    setError(null)
    try {
      setStatus(await checkForUpdate())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  const isDevBuild = status?.currentVersion === 'dev'
  const lastCheck = status?.lastCheck

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.update.title')} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">{t('settings.update.currentVersion')}</span>
          <span className="text-sm text-gray-900 dark:text-gray-100">{status?.currentVersion ?? '–'}</span>
        </div>

        <p className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {t('settings.update.warning')}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-normal text-gray-500">{t('settings.update.enabled')}</span>
          <ToggleButton active={status?.settings.enabled ?? false} onClick={() => void toggleEnabled()}>
            {status?.settings.enabled ? t('settings.update.on') : t('settings.update.off')}
          </ToggleButton>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="update-source" className="text-xs font-normal text-gray-500">
            {t('settings.update.source')}
          </Label>
          <Input
            id="update-source"
            placeholder={t('settings.update.sourcePlaceholder')}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onBlur={() => void saveSource()}
          />
          <span className="text-xs text-gray-400">{t('settings.update.sourceHint')}</span>
        </div>

        {isDevBuild && <p className="text-xs text-gray-500">{t('settings.update.devBuild')}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="min-w-0 text-xs text-gray-500">
            {lastCheck ? (
              lastCheck.error ? (
                <span className="text-red-600">{t('settings.update.status.error', { error: lastCheck.error })}</span>
              ) : lastCheck.updateAvailable ? (
                <span>{t('settings.update.status.available', { version: lastCheck.latestVersion ?? '' })}</span>
              ) : (
                <span>{t('settings.update.status.upToDate')}</span>
              )
            ) : (
              <span>{t('settings.update.neverChecked')}</span>
            )}
            {lastCheck && (
              <div>{t('settings.update.lastChecked', { time: new Date(lastCheck.at).toLocaleString(locale) })}</div>
            )}
          </div>
          <Button variant="outline" size="sm" disabled={checking || saving} onClick={() => void handleCheckNow()}>
            <RefreshCw className={checking ? 'animate-spin' : undefined} />
            {t('settings.update.checkNow')}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SectionedDialog>
  )
}
