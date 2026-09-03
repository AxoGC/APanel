import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { deleteFirewallRule, getFirewallStatus, type FirewallRule, type FirewallStatus } from './api'
import { FirewallGrid } from './FirewallGrid'
import { FirewallTable } from './FirewallTable'
import { RuleDialog } from './RuleDialog'

export default function FirewallPage() {
  const { t } = useI18n()
  const dataLayout = useDataLayout()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getFirewallStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [])

  function openAdd() {
    setEditingRule(null)
    setDialogOpen(true)
  }

  function openEdit(rule: FirewallRule) {
    setEditingRule(rule)
    setDialogOpen(true)
  }

  async function handleDelete(rule: FirewallRule) {
    const key = rule.numbers.join('-')
    setDeleting((current) => ({ ...current, [key]: true }))
    setError(null)
    try {
      const next = await deleteFirewallRule(rule.numbers)
      setStatus(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setDeleting((current) => {
        const { [key]: _removed, ...rest } = current
        return rest
      })
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        {status ? (
          <div className="flex items-center gap-1.5">
            <span className={cn('size-1.5 rounded-full', status.active ? 'bg-green-500' : 'bg-gray-400')} />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {status.active ? t('firewall.active') : t('firewall.inactive')}
            </span>
          </div>
        ) : (
          <div />
        )}
        <Button variant="outline" size="sm" onClick={openAdd}>
          <Plus />
          {t('firewall.addRule')}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {status && status.rules.length === 0 && <p className="text-sm text-gray-500">{t('firewall.empty')}</p>}

      {status && status.rules.length > 0 && (
        <div className="min-h-0 grow overflow-y-auto">
          {dataLayout === 'table' ? (
            <FirewallTable rules={status.rules} deleting={deleting} onEdit={openEdit} onDelete={handleDelete} />
          ) : (
            <FirewallGrid rules={status.rules} deleting={deleting} onEdit={openEdit} onDelete={handleDelete} />
          )}
        </div>
      )}

      <RuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editingRule} onSuccess={setStatus} />
    </div>
  )
}
