import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
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

function EditRemarkDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: UserInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (users: UserInfo[]) => void
}) {
  const { t } = useI18n()
  const [remark, setRemark] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setRemark(user?.remark ?? '')
    setError(null)
  }, [open, user])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateUser(user.id, { remark }))
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.users.editRemark')} className="max-w-sm">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="user-remark" className="text-xs font-normal text-gray-500">
            {t('settings.users.remark')}
          </Label>
          <Input
            id="user-remark"
            autoFocus
            placeholder={t('settings.users.remarkPlaceholder')}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" size="sm" className="self-end" disabled={saving}>
          {t('settings.users.editRemark.save')}
        </Button>
      </form>
    </SectionedDialog>
  )
}

function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: UserInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (users: UserInfo[]) => void
}) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
    }
    setError(null)
  }, [open])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setError(null)

    if (password !== confirmPassword) {
      setError(t('settings.users.resetPassword.mismatch'))
      return
    }

    setSaving(true)
    try {
      onSaved(await updateUser(user.id, { password, remark: user.remark }))
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.users.resetPassword')} className="max-w-sm">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password-new" className="text-xs font-normal text-gray-500">
            {t('settings.users.newPasswordPlaceholder')}
          </Label>
          <Input
            id="reset-password-new"
            type="password"
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-password-confirm" className="text-xs font-normal text-gray-500">
            {t('settings.users.resetPassword.confirmPlaceholder')}
          </Label>
          <Input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" size="sm" className="self-end" disabled={saving || password === '' || confirmPassword === ''}>
          {t('settings.users.resetPassword')}
        </Button>
      </form>
    </SectionedDialog>
  )
}

export function UsersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<UserInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [newRemark, setNewRemark] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingRemarkFor, setEditingRemarkFor] = useState<UserInfo | null>(null)
  const [resettingPasswordFor, setResettingPasswordFor] = useState<UserInfo | null>(null)

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
        <div className="flex flex-col">
          {users && users.length > 0 && (
            <div className="flex items-center gap-2 border-b border-gray-200 pb-1.5 text-xs text-gray-500 dark:border-gray-800">
              <div className="min-w-0 flex-1">{t('settings.users.remark')}</div>
              <div className="shrink-0">{t('settings.users.actions')}</div>
            </div>
          )}
          {users?.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 border-b border-gray-100 py-1.5 last:border-b-0 dark:border-gray-800"
            >
              <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                {user.remark || t('settings.users.noRemark')}
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('settings.users.editRemark')}
                  onClick={() => setEditingRemarkFor(user)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('settings.users.resetPassword')}
                  onClick={() => setResettingPasswordFor(user)}
                >
                  <KeyRound />
                </Button>
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

      <EditRemarkDialog
        user={editingRemarkFor}
        open={editingRemarkFor !== null}
        onOpenChange={(next) => !next && setEditingRemarkFor(null)}
        onSaved={setUsers}
      />
      <ResetPasswordDialog
        user={resettingPasswordFor}
        open={resettingPasswordFor !== null}
        onOpenChange={(next) => !next && setResettingPasswordFor(null)}
        onSaved={setUsers}
      />
    </SectionedDialog>
  )
}
