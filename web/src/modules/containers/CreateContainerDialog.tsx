import { useEffect, useState, type ReactNode } from 'react'
import { Combobox } from '@/components/Combobox'
import { ToggleButton } from '@/components/ToggleButton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { listContainerImageTags, listContainerNetworks, type ContainerNetwork } from './api'

const RESTART_POLICIES = ['no', 'on-failure', 'always', 'unless-stopped'] as const
type RestartPolicy = (typeof RESTART_POLICIES)[number]

const RESTART_POLICY_LABELS: Record<RestartPolicy, TranslationKey> = {
  no: 'containers.create.restartPolicy.no',
  'on-failure': 'containers.create.restartPolicy.onFailure',
  always: 'containers.create.restartPolicy.always',
  'unless-stopped': 'containers.create.restartPolicy.unlessStopped',
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="flex flex-1 justify-start">{children}</div>
    </div>
  )
}

// UI/form only — nothing here calls a create-container endpoint yet. Image
// tags and the network list are still fetched live so the form's Combobox
// and network-mode Select reflect what's actually on this host.
export function CreateContainerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [tty, setTty] = useState(false)
  const [stdinOpen, setStdinOpen] = useState(false)
  const [networkMode, setNetworkMode] = useState('bridge')
  const [restartPolicy, setRestartPolicy] = useState<RestartPolicy>('no')
  const [env, setEnv] = useState('')
  const [volumes, setVolumes] = useState('')

  const [imageTags, setImageTags] = useState<string[]>([])
  const [networks, setNetworks] = useState<ContainerNetwork[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setImage('')
    setTty(false)
    setStdinOpen(false)
    setNetworkMode('bridge')
    setRestartPolicy('no')
    setEnv('')
    setVolumes('')
    setError(null)
    Promise.all([listContainerImageTags(), listContainerNetworks()])
      .then(([tags, nets]) => {
        setImageTags(tags)
        setNetworks(nets)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{t('containers.create.title')}</DialogTitle>
        </DialogHeader>

        <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-4 pr-1">
          <FormRow label={t('containers.create.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('containers.create.name.placeholder')} />
          </FormRow>

          <FormRow label={t('containers.create.image')}>
            <Combobox value={image} onChange={setImage} options={imageTags} placeholder={t('containers.create.image.placeholder')} />
          </FormRow>

          <FormRow label={t('containers.create.ttyStdin')}>
            <div className="flex gap-2">
              <ToggleButton active={tty} onClick={() => setTty((v) => !v)}>
                {t('containers.create.tty')}
              </ToggleButton>
              <ToggleButton active={stdinOpen} onClick={() => setStdinOpen((v) => !v)}>
                {t('containers.create.stdinOpen')}
              </ToggleButton>
            </div>
          </FormRow>

          <FormRow label={t('containers.create.networkMode')}>
            <Select value={networkMode} onValueChange={setNetworkMode}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {networks.map((n) => (
                  <SelectItem key={n.id} value={n.name}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label={t('containers.create.restartPolicy')}>
            <Select value={restartPolicy} onValueChange={(v) => setRestartPolicy(v as RestartPolicy)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESTART_POLICIES.map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {t(RESTART_POLICY_LABELS[policy])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>

          <FormRow label={t('containers.create.env')}>
            <Textarea
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              placeholder={t('containers.create.env.placeholder')}
              rows={3}
            />
          </FormRow>

          <FormRow label={t('containers.create.volumes')}>
            <Textarea
              value={volumes}
              onChange={(e) => setVolumes(e.target.value)}
              placeholder={t('containers.create.volumes.placeholder')}
              rows={3}
            />
          </FormRow>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-gray-500">{t('containers.create.notWiredUp')}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button type="button" disabled>
              {t('containers.create.submit')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
