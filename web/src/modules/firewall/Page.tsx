import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { deleteFirewallRule, getFirewallStatus, type FirewallRule, type FirewallStatus } from './api'
import { FirewallTable, FirewallTableHeader } from './FirewallTable'
import { RuleDialog } from './RuleDialog'

export default function FirewallPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<FirewallStatus | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    getFirewallStatus()
      .then(setStatus)
      .catch(() => {})
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
    try {
      const next = await deleteFirewallRule(rule.numbers)
      setStatus(next)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setDeleting((current) => {
        const { [key]: _removed, ...rest } = current
        return rest
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={openAdd}>
            <Plus />
            {t('firewall.addRule')}
          </Button>
        </div>
      </div>

      {status && status.rules.length === 0 && (
        <p className="mt-4 px-4 text-sm text-gray-500 sm:px-6">{t('firewall.empty')}</p>
      )}

      {status && status.rules.length > 0 && (
        <>
          <div className="mt-4 px-4 sm:px-6">
            <FirewallTableHeader />
          </div>
          <ScrollArea className="min-h-0 grow px-4 sm:px-6">
            <FirewallTable rules={status.rules} deleting={deleting} onEdit={openEdit} onDelete={handleDelete} hideHeader />
          </ScrollArea>
        </>
      )}

      <RuleDialog open={dialogOpen} onOpenChange={setDialogOpen} rule={editingRule} onSuccess={setStatus} />
    </div>
  )
}
