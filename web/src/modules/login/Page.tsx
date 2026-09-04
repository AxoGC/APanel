import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { isSecureContext } from '@/lib/https'
import { useI18n } from '@/lib/i18n'

export default function LoginPage() {
  const { t } = useI18n()
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isSecureContext()) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <p className="max-w-sm text-sm text-gray-700 dark:text-gray-300">{t('login.httpsRequired')}</p>
      </div>
    )
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(password)
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'INVALID_TOKEN' ? t('login.invalid') : t('login.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('login.title')}</h1>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-normal text-gray-500">
            {t('login.password')}
          </Label>
          <Input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting || password === ''}>
          {t('login.submit')}
        </Button>
      </form>
    </div>
  )
}
