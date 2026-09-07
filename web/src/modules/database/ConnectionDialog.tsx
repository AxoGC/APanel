import { Eye, EyeOff, Info } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import {
  enableModuleDependencyService,
  getModuleDependency,
  putModuleDependency,
  type DependencyField,
  type DependencyStatus,
} from '@/lib/dependency'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { MODULE_META } from '@/lib/modules'

const FIELD_LABEL_KEYS: Record<DependencyField, TranslationKey> = {
  host: 'dependency.field.host',
  port: 'dependency.field.port',
  url: 'dependency.field.url',
  username: 'dependency.field.username',
  password: 'dependency.field.password',
}

// Left label, right form item — same row shape throughout this dialog.
function FormRow({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

type DatabaseType = 'mysql' | 'postgresql'

// Database's own connection dialog: unlike the generic DependencyDialog
// (still used by history/proxy), this drops the status blurb and install-
// guide link in favor of a header icon linking to the same docs, and adds
// a database-type selector ahead of the connection fields. The type
// selector is frontend-only for now — PostgreSQL is the only backend the
// API actually supports (see internal/database), MySQL doesn't submit
// anywhere yet.
export function DatabaseConnectionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<DependencyStatus | null>(null)
  const [dbType, setDbType] = useState<DatabaseType>('postgresql')
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    setStatus(null)
    getModuleDependency('database')
      .then((res) => {
        setStatus(res)
        setForm(res.config)
      })
      .catch(() => {})
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await putModuleDependency('database', form)
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
      setStatus(await enableModuleDependencyService('database'))
    } catch {
      // surfaced by the global error dialog
    } finally {
      setEnabling(false)
    }
  }

  const meta = MODULE_META.database

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(meta.labelKey)}
      className="max-w-sm"
      headerButton={
        status && (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={status.docsUrl} target="_blank" rel="noreferrer" title={t('dependency.installGuide')}>
              <Info />
              <span className="sr-only">{t('dependency.installGuide')}</span>
            </a>
          </Button>
        )
      }
    >
      {!status ? (
        <p className="text-sm text-gray-500">…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {status.reason === 'serviceInactive' && status.serviceName && (
            <Button variant="outline" size="sm" disabled={enabling} onClick={() => void handleEnableService()} className="w-fit">
              {t('dependency.enableService')}
            </Button>
          )}

          <div className="flex flex-col gap-3">
            <FormRow label={t('database.connection.type')}>
              <SegmentedControl
                value={dbType}
                onChange={setDbType}
                options={[
                  { value: 'mysql', label: t('database.connection.type.mysql') },
                  { value: 'postgresql', label: t('database.connection.type.postgresql') },
                ]}
              />
            </FormRow>

            {status.fields.map((field) => {
              const required = status.requiredFields.includes(field)
              return (
                <FormRow key={field} label={t(FIELD_LABEL_KEYS[field])} required={required}>
                  {field === 'password' ? (
                    <div className="relative">
                      <Input
                        id={`dependency-${field}`}
                        type={showPassword ? 'text' : 'password'}
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
                      value={form[field] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    />
                  )}
                </FormRow>
              )
            })}

            <Button
              size="sm"
              disabled={saving || status.requiredFields.some((field) => !form[field])}
              onClick={() => void handleSave()}
              className="w-fit self-end border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
            >
              {t('dependency.save')}
            </Button>
          </div>
        </div>
      )}
    </SectionedDialog>
  )
}
