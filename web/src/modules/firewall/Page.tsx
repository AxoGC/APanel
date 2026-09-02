import { useEffect, useState } from 'react'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getFirewallStatus, type FirewallStatus } from './api'
import { FirewallGrid } from './FirewallGrid'

export default function FirewallPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFirewallStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [])

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {status && (
        <div className="flex items-center gap-1.5">
          <span className={cn('size-1.5 rounded-full', status.active ? 'bg-green-500' : 'bg-gray-400')} />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {status.active ? t('firewall.active') : t('firewall.inactive')}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {status && status.rules.length === 0 && <p className="text-sm text-gray-500">{t('firewall.empty')}</p>}

      {status && status.rules.length > 0 && (
        <div className="min-h-0 grow overflow-y-auto">
          <FirewallGrid rules={status.rules} />
        </div>
      )}
    </div>
  )
}
