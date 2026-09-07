import { Eye, EyeOff } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { clearStoredServer, getStoredServer, isStandalone, normalizeServerAddress, setStoredServer } from '@/lib/apiBase'
import { useAuth } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

export default function LoginPage() {
  const { t } = useI18n()
  const { login } = useAuth()
  const [server, setServer] = useState(getStoredServer)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (isStandalone) {
      let normalized: string
      try {
        normalized = normalizeServerAddress(server)
      } catch {
        setError(t('login.invalidServer'))
        return
      }
      setStoredServer(normalized)
    }

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
        {isStandalone && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="server" className="text-xs font-normal text-gray-500">
              {t('login.server')}
            </Label>
            <Input
              id="server"
              type="text"
              autoFocus
              placeholder={t('login.serverPlaceholder')}
              value={server}
              onChange={(e) => setServer(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-xs font-normal text-gray-500">
            {t('login.password')}
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoFocus={!isStandalone}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" disabled={submitting || password === '' || (isStandalone && server === '')}>
          {t('login.submit')}
        </Button>
        {isStandalone && server !== '' && (
          <button
            type="button"
            className="text-xs text-gray-500 hover:underline"
            onClick={() => {
              clearStoredServer()
              setServer('')
            }}
          >
            {t('login.changeServer')}
          </button>
        )}
      </form>
    </div>
  )
}
