import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { deleteFirewallRule, getFirewallStatus, type FirewallRule, type FirewallStatus } from './api'
import { FirewallGrid } from './FirewallGrid'
import { FirewallTable, FirewallTableHeader } from './FirewallTable'
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

      {status && status.rules.length > 0 && dataLayout === 'table' && (
        <div className="flex min-h-0 grow flex-col">
          <FirewallTableHeader />
          <ScrollArea className="min-h-0 grow">
            <FirewallTable rules={status.rules} deleting={deleting} onEdit={openEdit} onDelete={handleDelete} hideHeader />
          </ScrollArea>
        </div>
      )}
      {status && status.rules.length > 0 && dataLayout === 'grid' && (
        <ScrollArea className="min-h-0 grow">
          <FirewallGrid rules={status.rules} deleting={deleting} onEdit={openEdit} onDelete={handleDelete} />
        </ScrollArea>
      )}

      <RuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editingRule} onSuccess={setStatus} />
    </div>
  )
}
