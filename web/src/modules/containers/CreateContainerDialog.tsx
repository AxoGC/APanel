import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Combobox } from '@/components/Combobox'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ToggleButton } from '@/components/ToggleButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import {
  createContainer,
  listContainerImageTags,
  listContainerNetworks,
  listImageVolumes,
  type ContainerNetwork,
} from './api'

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

type MountType = 'volume' | 'bind'

interface MountRow {
  key: number
  type: MountType
  source: string
  target: string
  readOnly: boolean
}

// Docker's Binds syntax is identical for a named volume and a bind mount —
// "source:target[:ro]" — so the type toggle is purely a UI affordance (guides
// the source placeholder / autocomplete); both encode the same way here.
function mountsToVolumeStrings(rows: MountRow[]): string[] {
  return rows
    .filter((row) => row.source.trim() !== '' && row.target.trim() !== '')
    .map((row) => `${row.source.trim()}:${row.target.trim()}${row.readOnly ? ':ro' : ''}`)
}

type PortProtocol = 'tcp' | 'udp'

interface PortRow {
  key: number
  hostPort: string
  containerPort: string
  protocol: PortProtocol
}

// Docker's own "hostPort:containerPort/proto" syntax — passed straight
// through to the backend, which parses it with the same nat.Port helpers
// the daemon itself uses.
function portsToStrings(rows: PortRow[]): string[] {
  return rows
    .filter((row) => row.hostPort.trim() !== '' && row.containerPort.trim() !== '')
    .map((row) => `${row.hostPort.trim()}:${row.containerPort.trim()}/${row.protocol}`)
}

// "none" has no network to publish ports on; "host" already shares the
// host's ports directly. Every other mode (bridge, custom networks, ...)
// benefits from explicit publish rules.
function networkModeHasPorts(mode: string): boolean {
  return mode !== 'none' && mode !== 'host'
}

export function CreateContainerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [tty, setTty] = useState(false)
  const [stdinOpen, setStdinOpen] = useState(false)
  const [networkMode, setNetworkMode] = useState('bridge')
  const [restartPolicy, setRestartPolicy] = useState<RestartPolicy>('no')
  const [env, setEnv] = useState('')
  const [mounts, setMounts] = useState<MountRow[]>([])
  const [ports, setPorts] = useState<PortRow[]>([])

  const [imageTags, setImageTags] = useState<string[]>([])
  const [networks, setNetworks] = useState<ContainerNetwork[]>([])
  const [creating, setCreating] = useState(false)
  const nextMountKey = useRef(0)
  const nextPortKey = useRef(0)

  function addMountRow(row?: Partial<Omit<MountRow, 'key'>>) {
    setMounts((current) => [
      ...current,
      { key: nextMountKey.current++, type: 'volume', source: '', target: '', readOnly: false, ...row },
    ])
  }

  function updateMountRow(key: number, patch: Partial<Omit<MountRow, 'key'>>) {
    setMounts((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeMountRow(key: number) {
    setMounts((current) => current.filter((row) => row.key !== key))
  }

  function addPortRow() {
    setPorts((current) => [...current, { key: nextPortKey.current++, hostPort: '', containerPort: '', protocol: 'tcp' }])
  }

  function updatePortRow(key: number, patch: Partial<Omit<PortRow, 'key'>>) {
    setPorts((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removePortRow(key: number) {
    setPorts((current) => current.filter((row) => row.key !== key))
  }

  useEffect(() => {
    if (!open) return
    setName('')
    setImage('')
    setTty(false)
    setStdinOpen(false)
    setNetworkMode('bridge')
    setRestartPolicy('no')
    setEnv('')
    setMounts([])
    setPorts([])
    Promise.all([listContainerImageTags(), listContainerNetworks()])
      .then(([tags, nets]) => {
        setImageTags(tags)
        setNetworks(nets)
      })
      .catch(() => {})
  }, [open])

  // Resets the mount list to the newly-selected image's own defaults rather
  // than merging into whatever the admin had set up for the previous image —
  // mounts tuned for one image (e.g. a database's data dir) rarely make
  // sense once the image underneath changes, so switching images clears the
  // form immediately and repopulates it with the new image's declared
  // VOLUME paths (as named volumes; switching to a bind mount is an
  // explicit opt-in click on the row's type control).
  useEffect(() => {
    if (!open) return
    const ref = image.trim()
    setMounts([])
    if (!ref) return
    let cancelled = false
    const timer = setTimeout(() => {
      listImageVolumes(ref)
        .then((paths) => {
          if (cancelled) return
          setMounts(
            paths.map((path) => ({ key: nextMountKey.current++, type: 'volume' as const, source: '', target: path, readOnly: false })),
          )
        })
        .catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, image])

  // The port table is hidden for network modes that can't publish ports —
  // drop any rows the admin entered before switching to one, so a stale
  // mapping can't silently ride along in the submit payload.
  useEffect(() => {
    if (!networkModeHasPorts(networkMode)) setPorts([])
  }, [networkMode])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await createContainer({
        name,
        image,
        tty,
        openStdin: stdinOpen,
        networkMode,
        restartPolicy,
        env: linesOf(env),
        volumes: mountsToVolumeStrings(mounts),
        ports: portsToStrings(ports),
      })
      onCreated(created.id)
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setCreating(false)
    }
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('containers.create.title')}
      className="max-w-lg"
      drawer
      onOpenAutoFocus={(event) => {
        if (!window.matchMedia('(min-width: 768px)').matches) event.preventDefault()
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('confirm.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={creating}
            className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
          >
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

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-500">{t('containers.create.volumes')}</span>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-1.5 dark:border-gray-800">
              <div className="shrink-0 text-xs whitespace-nowrap text-gray-500">{t('containers.create.volumes.type')}</div>
              <div className="min-w-32 flex-1 text-xs text-gray-500">{t('containers.create.volumes.source')}</div>
              <div className="min-w-32 flex-1 text-xs text-gray-500">{t('containers.create.volumes.target')}</div>
              <div className="flex w-8 shrink-0 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('containers.create.volumes.add')}
                  onClick={() => addMountRow()}
                >
                  <Plus />
                </Button>
              </div>
            </div>

            {mounts.length === 0 && <p className="py-3 text-xs text-gray-500">{t('containers.create.volumes.empty')}</p>}

            {mounts.map((row) => (
              <div
                key={row.key}
                className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-900"
              >
                <div className="shrink-0">
                  <SegmentedControl
                    options={[
                      { value: 'volume', label: t('containers.create.volumes.type.volume') },
                      { value: 'bind', label: t('containers.create.volumes.type.bind') },
                    ]}
                    value={row.type}
                    onChange={(type) => updateMountRow(row.key, { type })}
                  />
                </div>
                <Input
                  className="min-w-32 flex-1"
                  value={row.source}
                  onChange={(e) => updateMountRow(row.key, { source: e.target.value })}
                  placeholder={
                    row.type === 'volume'
                      ? t('containers.create.volumes.source.volumePlaceholder')
                      : t('containers.create.volumes.source.bindPlaceholder')
                  }
                />
                <Input
                  className="min-w-32 flex-1"
                  value={row.target}
                  onChange={(e) => updateMountRow(row.key, { target: e.target.value })}
                  placeholder={t('containers.create.volumes.target.placeholder')}
                />
                <ToggleButton
                  active={row.readOnly}
                  onClick={() => updateMountRow(row.key, { readOnly: !row.readOnly })}
                  className="shrink-0"
                >
                  {t('containers.create.volumes.readOnly')}
                </ToggleButton>
                <div className="flex w-8 shrink-0 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('containers.create.volumes.remove')}
                    onClick={() => removeMountRow(row.key)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {networkModeHasPorts(networkMode) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-500">{t('containers.create.ports')}</span>
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-1.5 dark:border-gray-800">
                <div className="min-w-24 flex-1 text-xs text-gray-500">{t('containers.create.ports.host')}</div>
                <div className="min-w-24 flex-1 text-xs text-gray-500">{t('containers.create.ports.container')}</div>
                <div className="shrink-0 text-xs whitespace-nowrap text-gray-500">{t('containers.create.ports.protocol')}</div>
                <div className="flex w-8 shrink-0 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('containers.create.ports.add')}
                    onClick={() => addPortRow()}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>

              {ports.length === 0 && <p className="py-3 text-xs text-gray-500">{t('containers.create.ports.empty')}</p>}

              {ports.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center gap-2 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-900"
                >
                  <Input
                    className="min-w-24 flex-1"
                    value={row.hostPort}
                    onChange={(e) => updatePortRow(row.key, { hostPort: e.target.value })}
                    placeholder={t('containers.create.ports.host.placeholder')}
                  />
                  <Input
                    className="min-w-24 flex-1"
                    value={row.containerPort}
                    onChange={(e) => updatePortRow(row.key, { containerPort: e.target.value })}
                    placeholder={t('containers.create.ports.container.placeholder')}
                  />
                  <div className="shrink-0">
                    <SegmentedControl
                      options={[
                        { value: 'tcp', label: 'TCP' },
                        { value: 'udp', label: 'UDP' },
                      ]}
                      value={row.protocol}
                      onChange={(protocol) => updatePortRow(row.key, { protocol })}
                    />
                  </div>
                  <div className="flex w-8 shrink-0 justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('containers.create.ports.remove')}
                      onClick={() => removePortRow(row.key)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </SectionedDialog>
  )
}
