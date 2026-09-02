import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
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
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { addFirewallRule, getFirewallStatus, type FirewallStatus, type NewFirewallRule } from './api'
import { FirewallGrid } from './FirewallGrid'

export default function FirewallPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<FirewallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [action, setAction] = useState<NewFirewallRule['action']>('allow')
  const [from, setFrom] = useState('')
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState<NewFirewallRule['protocol']>('any')
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
    setAddError(null)
  }

  async function submitAddRule(e: FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const next = await addFirewallRule({ action, from, port, protocol })
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
          <FirewallGrid rules={status.rules} />
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

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">{t('firewall.addRule.action')}</span>
              <Select value={action} onValueChange={(v) => setAction(v as NewFirewallRule['action'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">{t('firewall.action.allow')}</SelectItem>
                  <SelectItem value="deny">{t('firewall.action.deny')}</SelectItem>
                  <SelectItem value="reject">{t('firewall.action.reject')}</SelectItem>
                  <SelectItem value="limit">{t('firewall.action.limit')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">{t('firewall.addRule.port')}</span>
              <Input
                autoFocus
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={t('firewall.addRule.port.placeholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">{t('firewall.addRule.protocol')}</span>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as NewFirewallRule['protocol'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('firewall.protocol.any')}</SelectItem>
                  <SelectItem value="tcp">{t('firewall.protocol.tcp')}</SelectItem>
                  <SelectItem value="udp">{t('firewall.protocol.udp')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-500">{t('firewall.addRule.from')}</span>
              <Input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder={t('firewall.addRule.from.placeholder')}
              />
            </div>

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
