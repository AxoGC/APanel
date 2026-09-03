import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Combobox } from '@/components/Combobox'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ToggleButton } from '@/components/ToggleButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { createContainer, listContainerImageTags, listContainerNetworks, type ContainerNetwork } from './api'

// Lets the footer's submit button (rendered as a sibling of the form, not a
// descendant — see SectionedDialog) still submit this form via the HTML
// form="..." attribute.
const FORM_ID = 'create-container-form'

const RESTART_POLICIES = ['no', 'on-failure', 'always', 'unless-stopped'] as const
type RestartPolicy = (typeof RESTART_POLICIES)[number]

const RESTART_POLICY_LABELS: Record<RestartPolicy, TranslationKey> = {
  no: 'containers.create.restartPolicy.no',
  'on-failure': 'containers.create.restartPolicy.onFailure',
  always: 'containers.create.restartPolicy.always',
  'unless-stopped': 'containers.create.restartPolicy.unlessStopped',
}

// Left label / right value on desktop; stacked label-above-value on mobile.
function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
      <span className="text-xs text-gray-500 md:w-28 md:shrink-0">{label}</span>
      <div className="flex justify-start md:flex-1">{children}</div>
    </div>
  )
}

// Blank lines and surrounding whitespace are dropped so an empty textarea
// (or one with trailing newlines) doesn't send a list of empty strings.
function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function CreateContainerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
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
  const [creating, setCreating] = useState(false)

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

  async function submit(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await createContainer({
        name,
        image,
        tty,
        openStdin: stdinOpen,
        networkMode,
        restartPolicy,
        env: linesOf(env),
        volumes: linesOf(volumes),
      })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('containers.create.title')}
      className="h-[85vh] max-w-lg"
      onOpenAutoFocus={(event) => {
        if (!window.matchMedia('(min-width: 768px)').matches) event.preventDefault()
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('confirm.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={creating}>
            {t('containers.create.submit')}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
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
      </form>
    </SectionedDialog>
  )
}
