import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { addFirewallRule, getFirewallStatus, type FirewallStatus, type NewFirewallRule } from './api'
import { FirewallGrid } from './FirewallGrid'
import { FirewallTable } from './FirewallTable'

type Protocol = Exclude<NewFirewallRule['protocol'], 'any'>
type Family = Exclude<NewFirewallRule['family'], 'any'>

const PROTOCOLS: Protocol[] = ['tcp', 'udp']
const FAMILIES: Family[] = ['ipv4', 'ipv6']

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-theme-300 bg-theme-50 text-theme-600 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-400'
          : 'border-gray-200 text-gray-500 hover:text-gray-700 dark:border-gray-700 dark:hover:text-gray-300',
      )}
    >
      {children}
    </button>
  )
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="flex flex-1 justify-start">{children}</div>
    </div>
  )
}

export default function FirewallPage() {
  const { t } = useI18n()
  const dataLayout = useDataLayout()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [action, setAction] = useState<NewFirewallRule['action']>('allow')
  const [from, setFrom] = useState('')
  const [port, setPort] = useState('')
  const [protocols, setProtocols] = useState<ReadonlySet<Protocol>>(() => new Set(PROTOCOLS))
  const [families, setFamilies] = useState<ReadonlySet<Family>>(() => new Set(FAMILIES))
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getFirewallStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [])

  function resetAddForm() {
    setAction('allow')
    setFrom('')
    setPort('')
    setProtocols(new Set(PROTOCOLS))
    setFamilies(new Set(FAMILIES))
    setAddError(null)
  }

  async function submitAddRule(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const protocol: NewFirewallRule['protocol'] = protocols.size === PROTOCOLS.length ? 'any' : protocols.has('tcp') ? 'tcp' : 'udp'
      const family: NewFirewallRule['family'] = families.size === FAMILIES.length ? 'any' : families.has('ipv4') ? 'ipv4' : 'ipv6'
      const next = await addFirewallRule({ action, from, port, protocol, family })
      setStatus(next)
      setAddOpen(false)
      resetAddForm()
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setAdding(false)
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetAddForm()
            setAddOpen(true)
          }}
        >
          <Plus />
          {t('firewall.addRule')}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {status && status.rules.length === 0 && <p className="text-sm text-gray-500">{t('firewall.empty')}</p>}

      {status && status.rules.length > 0 && (
        <div className="min-h-0 grow overflow-y-auto">
          {dataLayout === 'table' ? <FirewallTable rules={status.rules} /> : <FirewallGrid rules={status.rules} />}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) resetAddForm()
        }}
      >
        <DialogContent>
          <form onSubmit={submitAddRule} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('firewall.addRule.title')}</DialogTitle>
            </DialogHeader>

            <FormRow label={t('firewall.addRule.action')}>
              <div className="flex flex-wrap justify-start gap-2">
                <ToggleChip active={action === 'allow'} onClick={() => setAction('allow')}>
                  {t('firewall.action.allow')}
                </ToggleChip>
                <ToggleChip active={action === 'deny'} onClick={() => setAction('deny')}>
                  {t('firewall.action.deny')}
                </ToggleChip>
                <ToggleChip active={action === 'reject'} onClick={() => setAction('reject')}>
                  {t('firewall.action.reject')}
                </ToggleChip>
                <ToggleChip active={action === 'limit'} onClick={() => setAction('limit')}>
                  {t('firewall.action.limit')}
                </ToggleChip>
              </div>
            </FormRow>

            <FormRow label={t('firewall.addRule.port')}>
              <Input
                autoFocus
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={t('firewall.addRule.port.placeholder')}
              />
            </FormRow>

            <FormRow label={t('firewall.addRule.protocol')}>
              <div className="flex justify-start gap-2">
                <ToggleChip
                  active={protocols.has('tcp')}
                  onClick={() =>
                    setProtocols((current) => {
                      if (current.size === 1 && current.has('tcp')) return current
                      const next = new Set(current)
                      next.has('tcp') ? next.delete('tcp') : next.add('tcp')
                      return next
                    })
                  }
                >
                  {t('firewall.protocol.tcp')}
                </ToggleChip>
                <ToggleChip
                  active={protocols.has('udp')}
                  onClick={() =>
                    setProtocols((current) => {
                      if (current.size === 1 && current.has('udp')) return current
                      const next = new Set(current)
                      next.has('udp') ? next.delete('udp') : next.add('udp')
                      return next
                    })
                  }
                >
                  {t('firewall.protocol.udp')}
                </ToggleChip>
              </div>
            </FormRow>

            <FormRow label={t('firewall.addRule.family')}>
              <div className="flex justify-start gap-2">
                <ToggleChip
                  active={families.has('ipv4')}
                  onClick={() =>
                    setFamilies((current) => {
                      if (current.size === 1 && current.has('ipv4')) return current
                      const next = new Set(current)
                      next.has('ipv4') ? next.delete('ipv4') : next.add('ipv4')
                      return next
                    })
                  }
                >
                  {t('firewall.family.ipv4')}
                </ToggleChip>
                <ToggleChip
                  active={families.has('ipv6')}
                  onClick={() =>
                    setFamilies((current) => {
                      if (current.size === 1 && current.has('ipv6')) return current
                      const next = new Set(current)
                      next.has('ipv6') ? next.delete('ipv6') : next.add('ipv6')
                      return next
                    })
                  }
                >
                  {t('firewall.family.ipv6')}
                </ToggleChip>
              </div>
            </FormRow>

            <FormRow label={t('firewall.addRule.from')}>
              <Input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder={t('firewall.addRule.from.placeholder')}
              />
            </FormRow>

            {addError && <p className="text-xs text-red-600">{addError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                {t('confirm.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={adding}
                className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
              >
                {t('firewall.addRule.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
