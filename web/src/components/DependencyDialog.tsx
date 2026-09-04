import { useEffect, useState } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import {
  enableModuleDependencyService,
  getModuleDependency,
  putModuleDependency,
  type DependencyField,
  type DependencyReason,
  type DependencyStatus,
} from '@/lib/dependency'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { MODULE_META, type DependencyModuleKey } from '@/lib/modules'

const FIELD_LABEL_KEYS: Record<DependencyField, TranslationKey> = {
  host: 'dependency.field.host',
  port: 'dependency.field.port',
  username: 'dependency.field.username',
  password: 'dependency.field.password',
}

const REASON_TEXT_KEYS: Record<DependencyReason, TranslationKey> = {
  unavailable: 'dependency.reason.unavailable',
  serviceInactive: 'dependency.reason.serviceInactive',
  unconfigured: 'dependency.reason.unconfigured',
}

// Reused across every extension module's page: on open, fetches that
// module's dependency status and shows the docs link, an "enable service"
// button when the dependency is installed but stopped, and a connection
// form for whichever fields that dependency actually needs (empty for the
// purely-local ones, which have nothing to configure).
export function DependencyDialog({
  moduleKey,
  open,
  onOpenChange,
}: {
  moduleKey: DependencyModuleKey
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const [status, setStatus] = useState<DependencyStatus | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    setError(null)
    getModuleDependency(moduleKey)
      .then((res) => {
        setStatus(res)
        setForm(res.config)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [open, moduleKey])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await putModuleDependency(moduleKey, form)
      setStatus(res)
      setForm(res.config)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleEnableService = async () => {
    setEnabling(true)
    setError(null)
    try {
      setStatus(await enableModuleDependencyService(moduleKey))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setEnabling(false)
    }
  }

  const meta = MODULE_META[moduleKey]

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t(meta.labelKey)} className="max-w-sm">
      {!status ? (
        <p className="text-sm text-gray-500">…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t(status.reason ? REASON_TEXT_KEYS[status.reason] : 'dependency.reason.healthy')}
          </p>

          <a
            href={status.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-sm text-theme-700 hover:underline dark:text-theme-300"
          >
            {t('dependency.installGuide')}
          </a>

          {status.reason === 'serviceInactive' && status.serviceName && (
            <Button variant="outline" size="sm" disabled={enabling} onClick={() => void handleEnableService()} className="w-fit">
              {t('dependency.enableService')}
            </Button>
          )}

          {status.fields.length > 0 && (
            <div className="flex flex-col gap-3">
              {status.fields.map((field) => (
                <div key={field} className="flex flex-col gap-1">
                  <Label htmlFor={`dependency-${field}`}>{t(FIELD_LABEL_KEYS[field])}</Label>
                  <Input
                    id={`dependency-${field}`}
                    type={field === 'password' ? 'password' : 'text'}
                    value={form[field] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <Button
                size="sm"
                disabled={saving}
                onClick={() => void handleSave()}
                className="w-fit border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
              >
                {t('dependency.save')}
              </Button>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </SectionedDialog>
  )
}
