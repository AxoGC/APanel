import { Plug, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ApiError } from '@/lib/api'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { deleteFirewallRule, getFirewallStatus, type FirewallRule, type FirewallStatus } from './api'
import { FirewallTable, FirewallTableHeader } from './FirewallTable'
import { RuleDialog } from './RuleDialog'

export default function FirewallPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const { dialogOpen: dependencyOpen, setDialogOpen: setDependencyOpen } = useDependencyGate('firewall')

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
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.firewall')}</h1>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 px-4 sm:px-6">
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('dependency.configure')}
            title={t('dependency.configure')}
            onClick={() => setDependencyOpen(true)}
          >
            <Plug />
          </Button>
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus />
            {t('firewall.addRule')}
          </Button>
        </div>
      </div>

      {error && <p className="mt-4 px-4 text-xs text-red-600 sm:px-6">{error}</p>}

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
      <DependencyDialog moduleKey="firewall" open={dependencyOpen} onOpenChange={setDependencyOpen} />
    </div>
  )
}
