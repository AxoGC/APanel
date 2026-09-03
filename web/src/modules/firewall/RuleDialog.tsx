import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  addFirewallRule,
  updateFirewallRule,
  type FirewallRule,
  type FirewallStatus,
  type NewFirewallRule,
} from './api'

type Protocol = Exclude<NewFirewallRule['protocol'], 'any'>
type Family = 'ipv4' | 'ipv6'
type FormMode = 'simple' | 'advanced'

const PROTOCOLS: Protocol[] = ['tcp', 'udp']
const ACTIONS: NewFirewallRule['action'][] = ['allow', 'deny', 'reject', 'limit']
const SIMPLE_ACTIONS: NewFirewallRule['action'][] = ['allow', 'deny']

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

interface FormState {
  action: NewFirewallRule['action']
  port: string
  protocols: ReadonlySet<Protocol>
  families: ReadonlySet<Family>
  fromIPv4: string
  fromIPv6: string
}

function blankForm(): FormState {
  return {
    action: 'allow',
    port: '',
    protocols: new Set(PROTOCOLS),
    families: new Set<Family>(['ipv4', 'ipv6']),
    fromIPv4: '',
    fromIPv6: '',
  }
}

// A merged Rule only ever carries one `from` string for both families (it's
// only merged into one row when the IPv4 and IPv6 halves are otherwise
// identical — in practice that's always the "Anywhere"/"Anywhere (v6)"
// default), so that single value seeds whichever per-family inputs are
// active; "Anywhere" itself means "left blank", matching the add form.
function formFromRule(rule: FirewallRule): FormState {
  const from = rule.from === 'Anywhere' ? '' : rule.from
  const families = new Set<Family>()
  if (rule.ipv4) families.add('ipv4')
  if (rule.ipv6) families.add('ipv6')
  return {
    action: rule.action.split(' ')[0].toLowerCase() as NewFirewallRule['action'],
    port: rule.to,
    protocols: new Set<Protocol>(rule.protocol ? [rule.protocol] : PROTOCOLS),
    families,
    fromIPv4: rule.ipv4 ? from : '',
    fromIPv6: rule.ipv6 ? from : '',
  }
}

function modeFromRule(rule: FirewallRule | null): FormMode {
  if (!rule) return 'simple'
  const action = rule.action.split(' ')[0].toLowerCase()
  const hasSource = rule.from !== '' && rule.from !== 'Anywhere'
  return action === 'reject' || action === 'limit' || !rule.ipv4 || !rule.ipv6 || hasSource ? 'advanced' : 'simple'
}

// Shared by both "add rule" and "edit rule" — passing `rule` switches the
// dialog into edit mode (prefilled from it, PUT on submit); omitting it
// (or passing null) is add mode (blank form, POST on submit).
export function RuleDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: FirewallRule | null
  onSuccess: (status: FirewallStatus) => void
}) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>(blankForm)
  const [mode, setMode] = useState<FormMode>('simple')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(rule ? formFromRule(rule) : blankForm())
    setMode(modeFromRule(rule))
    setError(null)
  }, [open, rule])

  function changeMode(nextMode: FormMode) {
    setMode(nextMode)
    if (nextMode === 'simple') {
      setForm((current) => ({
        ...current,
        action: SIMPLE_ACTIONS.includes(current.action) ? current.action : 'allow',
        families: new Set<Family>(['ipv4', 'ipv6']),
        fromIPv4: '',
        fromIPv6: '',
      }))
    }
  }

  function toggleFamily(f: Family) {
    setForm((current) => {
      if (current.families.size === 1 && current.families.has(f)) return current
      const next = new Set(current.families)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return { ...current, families: next }
    })
  }

  function toggleProtocol(p: Protocol) {
    setForm((current) => {
      if (current.protocols.size === 1 && current.protocols.has(p)) return current
      const next = new Set(current.protocols)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return { ...current, protocols: next }
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const protocol: NewFirewallRule['protocol'] =
        form.protocols.size === PROTOCOLS.length ? 'any' : form.protocols.has('tcp') ? 'tcp' : 'udp'
      const payload: NewFirewallRule = {
        action: form.action,
        fromIPv4: mode === 'simple' ? '' : form.families.has('ipv4') ? form.fromIPv4 : '',
        fromIPv6: mode === 'simple' ? '' : form.families.has('ipv6') ? form.fromIPv6 : '',
        port: form.port,
        protocol,
        ipv4: mode === 'simple' || form.families.has('ipv4'),
        ipv6: mode === 'simple' || form.families.has('ipv6'),
      }
      const status = rule ? await updateFirewallRule(rule.numbers, payload) : await addFirewallRule(payload)
      onSuccess(status)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] flex-col"
        onOpenAutoFocus={(event) => {
          if (!window.matchMedia('(min-width: 768px)').matches) event.preventDefault()
        }}
      >
        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{rule ? t('firewall.editRule.title') : t('firewall.addRule.title')}</DialogTitle>
            <SegmentedControl
              value={mode}
              onChange={changeMode}
              options={[
                { value: 'simple', label: t('firewall.mode.simple') },
                { value: 'advanced', label: t('firewall.mode.advanced') },
              ]}
            />
          </DialogHeader>

          <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
            <div className="flex flex-col gap-4 pr-1">
              <FormRow label={t('firewall.addRule.action')}>
                <div className="flex flex-wrap justify-start gap-2">
                  {(mode === 'simple' ? SIMPLE_ACTIONS : ACTIONS).map((a) => (
                    <ToggleChip key={a} active={form.action === a} onClick={() => setForm((c) => ({ ...c, action: a }))}>
                      {t(`firewall.action.${a}`)}
                    </ToggleChip>
                  ))}
                </div>
              </FormRow>

              <FormRow label={t('firewall.addRule.port')}>
                <Input
                  value={form.port}
                  onChange={(e) => setForm((c) => ({ ...c, port: e.target.value }))}
                  placeholder={t('firewall.addRule.port.placeholder')}
                />
              </FormRow>

              <FormRow label={t('firewall.addRule.protocol')}>
                <div className="flex justify-start gap-2">
                  <ToggleChip active={form.protocols.has('tcp')} onClick={() => toggleProtocol('tcp')}>
                    {t('firewall.protocol.tcp')}
                  </ToggleChip>
                  <ToggleChip active={form.protocols.has('udp')} onClick={() => toggleProtocol('udp')}>
                    {t('firewall.protocol.udp')}
                  </ToggleChip>
                </div>
              </FormRow>

              {mode === 'advanced' && (
                <>
                  <FormRow label={t('firewall.addRule.family')}>
                    <div className="flex justify-start gap-2">
                      <ToggleChip active={form.families.has('ipv4')} onClick={() => toggleFamily('ipv4')}>
                        {t('firewall.family.ipv4')}
                      </ToggleChip>
                      <ToggleChip active={form.families.has('ipv6')} onClick={() => toggleFamily('ipv6')}>
                        {t('firewall.family.ipv6')}
                      </ToggleChip>
                    </div>
                  </FormRow>

                  {form.families.has('ipv4') && (
                    <FormRow label={t('firewall.addRule.from.ipv4')}>
                      <Input
                        value={form.fromIPv4}
                        onChange={(e) => setForm((c) => ({ ...c, fromIPv4: e.target.value }))}
                        placeholder={t('firewall.addRule.from.placeholder')}
                      />
                    </FormRow>
                  )}

                  {form.families.has('ipv6') && (
                    <FormRow label={t('firewall.addRule.from.ipv6')}>
                      <Input
                        value={form.fromIPv6}
                        onChange={(e) => setForm((c) => ({ ...c, fromIPv6: e.target.value }))}
                        placeholder={t('firewall.addRule.from.placeholder')}
                      />
                    </FormRow>
                  )}
                </>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
            >
              {rule ? t('firewall.editRule.submit') : t('firewall.addRule.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
