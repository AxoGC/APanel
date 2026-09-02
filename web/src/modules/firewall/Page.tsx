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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useDataLayout } from '@/lib/dataLayout'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { addFirewallRule, getFirewallStatus, type FirewallStatus, type NewFirewallRule } from './api'
import { FirewallGrid } from './FirewallGrid'
import { FirewallTable } from './FirewallTable'

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
  const [protocol, setProtocol] = useState<NewFirewallRule['protocol']>('any')
  const [family, setFamily] = useState<NewFirewallRule['family']>('any')
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
    setProtocol('any')
    setFamily('any')
    setAddError(null)
  }

  async function submitAddRule(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
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
              <Select value={action} onValueChange={(v) => setAction(v as NewFirewallRule['action'])}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">{t('firewall.action.allow')}</SelectItem>
                  <SelectItem value="deny">{t('firewall.action.deny')}</SelectItem>
                  <SelectItem value="reject">{t('firewall.action.reject')}</SelectItem>
                  <SelectItem value="limit">{t('firewall.action.limit')}</SelectItem>
                </SelectContent>
              </Select>
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
                <ToggleChip active={protocol === 'any'} onClick={() => setProtocol('any')}>
                  {t('firewall.protocol.any')}
                </ToggleChip>
                <ToggleChip active={protocol === 'tcp'} onClick={() => setProtocol('tcp')}>
                  {t('firewall.protocol.tcp')}
                </ToggleChip>
                <ToggleChip active={protocol === 'udp'} onClick={() => setProtocol('udp')}>
                  {t('firewall.protocol.udp')}
                </ToggleChip>
              </div>
            </FormRow>

            <FormRow label={t('firewall.addRule.family')}>
              <div className="flex justify-start gap-2">
                <ToggleChip active={family === 'any'} onClick={() => setFamily('any')}>
                  {t('firewall.family.any')}
                </ToggleChip>
                <ToggleChip active={family === 'ipv4'} onClick={() => setFamily('ipv4')}>
                  {t('firewall.family.ipv4')}
                </ToggleChip>
                <ToggleChip active={family === 'ipv6'} onClick={() => setFamily('ipv6')}>
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
              <Button type="submit" disabled={adding}>
                {t('firewall.addRule.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
