import { KeyRound, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { createUser, deleteUser, listUsers, updateUser, type UserInfo } from './usersApi'

function errorMessage(err: unknown, t: (key: TranslationKey) => string): string {
  if (err instanceof ApiError) {
    if (err.code === 'PASSWORD_TOO_SHORT') return t('settings.users.error.tooShort')
    if (err.code === 'PASSWORD_DUPLICATE') return t('settings.users.error.duplicate')
    if (err.code === 'LAST_USER') return t('settings.users.error.lastUser')
    return err.message
  }
  return String(err)
}

function ResetPasswordRow({ user, onDone }: { user: UserInfo; onDone: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label={t('settings.users.resetPassword')} onClick={() => setOpen(true)}>
        <KeyRound />
      </Button>
    )
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await updateUser(user.id, { password, remark: user.remark })
      setOpen(false)
      setPassword('')
      onDone()
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 p-2 dark:border-gray-800">
      <Input
        type="password"
        autoFocus
        autoComplete="new-password"
        placeholder={t('settings.users.newPasswordPlaceholder')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => { setOpen(false); setError(null); setPassword('') }}>
          {t('confirm.cancel')}
        </Button>
        <Button size="sm" disabled={saving || password === ''} onClick={() => void submit()}>
          {t('settings.users.resetPassword')}
        </Button>
      </div>
    </div>
  )
}

export function UsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newRemark, setNewRemark] = useState('')
  const [creating, setCreating] = useState(false)

  function refresh() {
    return listUsers()
      .then(setUsers)
      .catch((err) => setError(errorMessage(err, t)))
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function saveRemark(user: UserInfo, remark: string) {
    if (remark === user.remark) return
    try {
      setUsers(await updateUser(user.id, { remark }))
    } catch (err) {
      setError(errorMessage(err, t))
      void refresh()
    }
  }

  async function handleDelete(id: number) {
    setError(null)
    try {
      setUsers(await deleteUser(id))
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      await createUser(newPassword, newRemark)
      setNewPassword('')
      setNewRemark('')
      await refresh()
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setCreating(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.users.title')} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {users?.map((user) => (
            <div key={user.id} className="flex flex-col gap-1.5 rounded-md border border-gray-200 p-2 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Input
                  defaultValue={user.remark}
                  placeholder={t('settings.users.remarkPlaceholder')}
                  onBlur={(e) => void saveRemark(user, e.target.value)}
                  className="min-w-0 flex-1"
                />
                <ConfirmIconButton
                  icon={<Trash2 />}
                  label={t('settings.users.delete')}
                  actionLabel={t('settings.users.delete')}
                  title={t('settings.users.confirmDelete.title')}
                  description={t('settings.users.confirmDelete.description')}
                  disabled={users.length <= 1}
                  onConfirm={() => void handleDelete(user.id)}
                />
              </div>
              <ResetPasswordRow user={user} onDone={() => void refresh()} />
            </div>
          ))}
          {users && users.length === 0 && <p className="text-sm text-gray-500">{t('settings.users.empty')}</p>}
        </div>

        <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Label className="text-xs font-normal text-gray-500">{t('settings.users.add')}</Label>
          <Input
            placeholder={t('settings.users.remarkPlaceholder')}
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t('settings.users.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button size="sm" className="self-end" disabled={creating || newPassword === ''} onClick={() => void handleCreate()}>
            <UserPlus />
            {t('settings.users.add')}
          </Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </SectionedDialog>
  )
}
