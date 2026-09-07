import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionedDialog } from '@/components/SectionedDialog'
import { useI18n } from '@/lib/i18n'
import { getAuditLogSettings, putAuditLogSettings } from './api'

export function AuditLogSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [retentionDays, setRetentionDays] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    getAuditLogSettings()
      .then((s) => setRetentionDays(String(s.retentionDays)))
      .catch(() => {})
  }, [open])

  const days = Number(retentionDays)
  const valid = Number.isInteger(days) && days > 0

  async function handleSave() {
    if (!valid) return
    setSaving(true)
    try {
      const next = await putAuditLogSettings({ retentionDays: days })
      setRetentionDays(String(next.retentionDays))
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('auditlog.settings.title')} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auditlog-retention-days" className="text-xs font-normal text-gray-500">
            {t('auditlog.settings.retentionDays')}
          </Label>
          <Input
            id="auditlog-retention-days"
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
          />
          <span className="text-xs text-gray-400">{t('auditlog.settings.retentionDaysHint')}</span>
        </div>

        <div className="flex justify-end">
          <Button size="sm" disabled={!valid || saving} onClick={() => void handleSave()}>
            {t('auditlog.settings.save')}
          </Button>
        </div>
      </div>
    </SectionedDialog>
  )
}
