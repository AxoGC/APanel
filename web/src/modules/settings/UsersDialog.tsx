import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'
import { createUser, deleteUser, listUsers, updateUser, type UserInfo } from './usersApi'

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { t } = useI18n()
  const [remark, setRemark] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      setRemark('')
      setPassword('')
    }
  }, [open])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    try {
      await createUser(password, remark)
      onCreated()
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setCreating(false)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.users.add')} className="max-w-sm">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-user-remark" className="text-xs font-normal text-gray-500">
            {t('settings.users.remark')}
          </Label>
          <Input
            id="new-user-remark"
            autoFocus
            placeholder={t('settings.users.remarkPlaceholder')}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-user-password" className="text-xs font-normal text-gray-500">
            {t('settings.users.newPasswordPlaceholder')}
          </Label>
          <Input
            id="new-user-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm" className="self-end" disabled={creating || password === ''}>
          <UserPlus />
          {t('settings.users.add')}
        </Button>
      </form>
    </SectionedDialog>
  )
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setRemark(user?.remark ?? '')
  }, [open, user])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      onSaved(await updateUser(user.id, { remark }))
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
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
  const [mismatch, setMismatch] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword('')
      setConfirmPassword('')
    }
    setMismatch(false)
  }, [open])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return

    if (password !== confirmPassword) {
      setMismatch(true)
      return
    }
    setMismatch(false)

    setSaving(true)
    try {
      onSaved(await updateUser(user.id, { password, remark: user.remark }))
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
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
        {mismatch && <p className="text-xs text-red-600">{t('settings.users.resetPassword.mismatch')}</p>}
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
  const [addOpen, setAddOpen] = useState(false)
  const [editingRemarkFor, setEditingRemarkFor] = useState<UserInfo | null>(null)
  const [resettingPasswordFor, setResettingPasswordFor] = useState<UserInfo | null>(null)

  function refresh() {
    return listUsers()
      .then(setUsers)
      .catch(() => {})
  }

  useEffect(() => {
    if (!open) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleDelete(id: number) {
    try {
      setUsers(await deleteUser(id))
    } catch {
      // surfaced by the global error dialog
    }
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.users.title')}
      className="max-w-sm"
      drawer
      footer={
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus />
            {t('settings.users.add')}
          </Button>
        </div>
      }
    >
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

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => void refresh()} />
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
