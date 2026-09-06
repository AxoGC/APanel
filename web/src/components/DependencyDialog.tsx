import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  url: 'dependency.field.url',
  username: 'dependency.field.username',
  password: 'dependency.field.password',
}

const FIELD_PLACEHOLDERS: Partial<Record<DependencyField, string>> = {
  url: 'http://127.0.0.1:9090',
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
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    getModuleDependency(moduleKey)
      .then((res) => {
        setStatus(res)
        setForm(res.config)
      })
      .catch(() => {})
  }, [open, moduleKey])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await putModuleDependency(moduleKey, form)
      setStatus(res)
      setForm(res.config)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setSaving(false)
    }
  }

  const handleEnableService = async () => {
    setEnabling(true)
    try {
      setStatus(await enableModuleDependencyService(moduleKey))
    } catch {
      // surfaced by the global error dialog
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
              {status.fields.map((field) => {
                const required = status.requiredFields.includes(field)
                return (
                  <div key={field} className="flex flex-col gap-1">
                    <Label htmlFor={`dependency-${field}`}>
                      {t(FIELD_LABEL_KEYS[field])}
                      {required && <span className="text-red-600"> *</span>}
                    </Label>
                    {field === 'password' ? (
                      <div className="relative">
                        <Input
                          id={`dependency-${field}`}
                          type={showPassword ? 'text' : 'password'}
                          placeholder={FIELD_PLACEHOLDERS[field]}
                          value={form[field] ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                          className="pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={t(showPassword ? 'dependency.hidePassword' : 'dependency.showPassword')}
                          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    ) : (
                      <Input
                        id={`dependency-${field}`}
                        type="text"
                        placeholder={FIELD_PLACEHOLDERS[field]}
                        value={form[field] ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      />
                    )}
                  </div>
                )
              })}
              <Button
                size="sm"
                disabled={saving || status.requiredFields.some((field) => !form[field])}
                onClick={() => void handleSave()}
                className="w-fit border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
              >
                {t('dependency.save')}
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionedDialog>
  )
}
