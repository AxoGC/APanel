import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { changePassword } from './api'

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError(t('settings.changePassword.tooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.changePassword.mismatch'))
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'WRONG_PASSWORD' ? t('settings.changePassword.wrongPassword') : t('settings.changePassword.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title={t('settings.changePassword.title')}
      className="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password" className="text-xs font-normal text-gray-500">
            {t('settings.changePassword.current')}
          </Label>
          <Input
            id="current-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password" className="text-xs font-normal text-gray-500">
            {t('settings.changePassword.new')}
          </Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password" className="text-xs font-normal text-gray-500">
            {t('settings.changePassword.confirm')}
          </Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button
          type="submit"
          size="sm"
          className="self-end"
          disabled={submitting || currentPassword === '' || newPassword === '' || confirmPassword === ''}
        >
          {t('settings.changePassword.submit')}
        </Button>
      </form>
    </SectionedDialog>
  )
}
