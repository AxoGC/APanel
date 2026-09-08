import { Images, Info, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Combobox } from '@/components/Combobox'
import { SectionedDialog } from '@/components/SectionedDialog'
import { ToggleButton } from '@/components/ToggleButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SegmentedInput } from '@/components/ui/segmented-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { pathComplete } from '@/modules/files/api'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  createContainer,
  listContainerImageTags,
  listContainerNetworks,
  listImageVolumes,
  type ContainerNetwork,
} from './api'
import { ImageManagerDialog } from './ImageManagerDialog'

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

// Just suggestions offered via the combobox dropdown — both fields still
// accept any free-text value the admin types.
const CPU_LIMIT_OPTIONS = ['0.5', '1', '2', '4', '8']
const MEMORY_LIMIT_OPTIONS = ['512m', '1g', '2g', '4g', '8g']

// Left label / right value on desktop; stacked label-above-value on mobile.
// labelExtra renders alongside the label text (e.g. a button opening a
// related management dialog), pinned to the opposite end of the same row.
function FormRow({ label, labelExtra, children }: { label: string; labelExtra?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
      <div className="flex items-center justify-between gap-2 md:w-28 md:shrink-0">
        <span className="text-xs text-gray-500">{label}</span>
        {labelExtra}
      </div>
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

interface MountRow {
  key: number
  source: string
  target: string
  readOnly: boolean
}

// Docker's own Binds syntax, auto-detected the same way the daemon itself
// parses it: an empty source means an anonymous volume ("target[:ro]"), a
// non-empty one is a named volume or a bind mount depending on its shape
// ("source:target[:ro]") — there's no separate type field to keep in sync.
function mountsToVolumeStrings(rows: MountRow[]): string[] {
  return rows
    .filter((row) => row.target.trim() !== '')
    .map((row) => {
      const target = row.target.trim()
      const source = row.source.trim()
      const suffix = row.readOnly ? ':ro' : ''
      return source ? `${source}:${target}${suffix}` : `${target}${suffix}`
    })
}

type PortProtocol = 'tcp' | 'udp'

interface PortRow {
  key: number
  // Everything before the container port: just a host port ("8080") or an
  // IP-qualified one ("0.0.0.0:8080") — free text, since it's one <input>
  // and the daemon's own parser (see below) accepts either shape.
  hostPart: string
  containerPort: string
  protocol: PortProtocol
}

// Docker's own "[host-ip:]host-port:container-port[/proto]" syntax (either
// port may also be a range, e.g. "8000-8010") — passed straight through to
// the backend, which parses it with the same nat.ParsePortSpecs the `docker
// run -p` flag itself uses.
function portsToStrings(rows: PortRow[]): string[] {
  return rows
    .filter((row) => row.hostPart.trim() !== '' && row.containerPort.trim() !== '')
    .map((row) => `${row.hostPart.trim()}:${row.containerPort.trim()}/${row.protocol}`)
}

// A bare number left in the memory field has no unit to send to the
// backend. On blur we guess the intended one the way an admin would read
// it themselves: small numbers are almost always gigabytes, larger ones
// are megabytes. Anything already carrying a unit (or non-numeric) passes
// through unchanged.
function normalizeMemoryLimit(value: string): string {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed
  return trimmed + (parseFloat(trimmed) < 16 ? 'g' : 'm')
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
  const [imageAutoUpdate, setImageAutoUpdate] = useState(false)
  const [tty, setTty] = useState(false)
  const [stdinOpen, setStdinOpen] = useState(false)
  const [networkMode, setNetworkMode] = useState('bridge')
  const [restartPolicy, setRestartPolicy] = useState<RestartPolicy>('no')
  const [cpuLimit, setCpuLimit] = useState('')
  const [memoryLimit, setMemoryLimit] = useState('')
  const [env, setEnv] = useState('')
  // Both tables always keep at least one row in the UI — an empty row just
  // means "none of these", so there's no separate empty state to render,
  // and removing the last row clears it in place instead of vanishing.
  const [mounts, setMounts] = useState<MountRow[]>([{ key: 0, source: '', target: '', readOnly: false }])
  const [ports, setPorts] = useState<PortRow[]>([{ key: 0, hostPart: '', containerPort: '', protocol: 'tcp' }])

  const [imageTags, setImageTags] = useState<string[]>([])
  const [networks, setNetworks] = useState<ContainerNetwork[]>([])
  const [creating, setCreating] = useState(false)
  // Only meaningful while creating with auto-update on — the pull happens
  // before the container itself is created, so this is the only progress
  // there is to show.
  const [createPullPercent, setCreatePullPercent] = useState<number | null>(null)
  // Radix's Tooltip only opens on hover/focus by default, which touch
  // devices have neither of — toggling it on click keeps the info icon
  // reachable on mobile too.
  const [portsTooltipOpen, setPortsTooltipOpen] = useState(false)
  const [volumesTooltipOpen, setVolumesTooltipOpen] = useState(false)
  const [imagesOpen, setImagesOpen] = useState(false)
  // Which mount row (and which of its two segments) is showing suggestions —
  // at most one at a time, since it only ever follows the focused field.
  const [pathSuggestKey, setPathSuggestKey] = useState<number | null>(null)
  const [pathSuggestField, setPathSuggestField] = useState<'source' | 'target'>('source')
  const [pathSuggestOptions, setPathSuggestOptions] = useState<string[]>([])
  // The image's own declared VOLUME paths, offered as suggestions on the
  // container-path segment regardless of which row they were first used to
  // seed — the admin may add more mounts than the image declared.
  const [imageVolumePaths, setImageVolumePaths] = useState<string[]>([])
  const nextMountKey = useRef(1)
  const nextPortKey = useRef(1)

  function addMountRow(row?: Partial<Omit<MountRow, 'key'>>) {
    setMounts((current) => [...current, { key: nextMountKey.current++, source: '', target: '', readOnly: false, ...row }])
  }

  function updateMountRow(key: number, patch: Partial<Omit<MountRow, 'key'>>) {
    setMounts((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  // Deleting the last remaining row clears its fields instead of removing
  // it, so the table never collapses to zero rows.
  function removeMountRow(key: number) {
    setMounts((current) => {
      if (current.length <= 1) {
        return current.map((row) => (row.key === key ? { key: row.key, source: '', target: '', readOnly: false } : row))
      }
      return current.filter((row) => row.key !== key)
    })
  }

  function addPortRow() {
    setPorts((current) => [...current, { key: nextPortKey.current++, hostPart: '', containerPort: '', protocol: 'tcp' }])
  }

  function updatePortRow(key: number, patch: Partial<Omit<PortRow, 'key'>>) {
    setPorts((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  // Same "clear, don't remove" rule as removeMountRow for the last row.
  function removePortRow(key: number) {
    setPorts((current) => {
      if (current.length <= 1) {
        return current.map((row) =>
          row.key === key ? { key: row.key, hostPart: '', containerPort: '', protocol: 'tcp' } : row,
        )
      }
      return current.filter((row) => row.key !== key)
    })
  }

  useEffect(() => {
    if (!open) return
    setName('')
    setImage('')
    setImageAutoUpdate(false)
    setTty(false)
    setStdinOpen(false)
    setNetworkMode('bridge')
    setRestartPolicy('no')
    setCpuLimit('')
    setMemoryLimit('')
    setEnv('')
    setMounts([{ key: nextMountKey.current++, source: '', target: '', readOnly: false }])
    setPorts([{ key: nextPortKey.current++, hostPart: '', containerPort: '', protocol: 'tcp' }])
    Promise.all([listContainerImageTags(), listContainerNetworks()])
      .then(([tags, nets]) => {
        setImageTags(tags)
        setNetworks(nets)
      })
      .catch(() => {})
  }, [open])

  // Refresh the tag list after the image manager closes, in case the admin
  // pulled or removed images while it was open.
  function handleImagesOpenChange(next: boolean) {
    setImagesOpen(next)
    if (!next) listContainerImageTags().then(setImageTags).catch(() => {})
  }

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
    setMounts([{ key: nextMountKey.current++, source: '', target: '', readOnly: false }])
    setImageVolumePaths([])
    if (!ref) return
    let cancelled = false
    const timer = setTimeout(() => {
      listImageVolumes(ref)
        .then((paths) => {
          if (cancelled) return
          setImageVolumePaths(paths)
          if (paths.length === 0) return
          setMounts(
            paths.map((path) => ({ key: nextMountKey.current++, source: '', target: path, readOnly: false })),
          )
        })
        .catch(() => {})
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, image])

  // Only an absolute host path (source starting with "/") has anything on
  // disk to suggest — a volume name or a relative bind source doesn't.
  useEffect(() => {
    if (pathSuggestKey == null || pathSuggestField !== 'source') return
    const row = mounts.find((r) => r.key === pathSuggestKey)
    if (!row || !row.source.startsWith('/')) {
      setPathSuggestOptions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      pathComplete(row.source)
        .then((paths) => {
          if (!cancelled) setPathSuggestOptions(paths)
        })
        .catch(() => {})
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [pathSuggestKey, pathSuggestField, mounts])

  // The port table is hidden for network modes that can't publish ports —
  // drop any rows the admin entered before switching to one, so a stale
  // mapping can't silently ride along in the submit payload. Switching back
  // to a mode that can publish ports restores the usual single empty row.
  useEffect(() => {
    if (!networkModeHasPorts(networkMode)) {
      setPorts([])
      return
    }
    setPorts((current) =>
      current.length === 0 ? [{ key: nextPortKey.current++, hostPart: '', containerPort: '', protocol: 'tcp' }] : current,
    )
  }, [networkMode])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreatePullPercent(imageAutoUpdate ? 0 : null)
    try {
      const created = await createContainer(
        {
          name,
          image,
          imageAutoUpdate,
          tty,
          openStdin: stdinOpen,
          networkMode,
          restartPolicy,
          cpuLimit: cpuLimit.trim(),
          memoryLimit: memoryLimit.trim(),
          env: linesOf(env),
          volumes: mountsToVolumeStrings(mounts),
          ports: portsToStrings(ports),
        },
        imageAutoUpdate ? setCreatePullPercent : undefined,
      )
      onCreated(created.id)
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setCreating(false)
      setCreatePullPercent(null)
    }
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('containers.create.title')}
      className="sm:max-w-xl"
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
            {createPullPercent == null ? t('containers.create.submit') : `${t('containers.create.pulling')} ${createPullPercent}%`}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
        <FormRow label={t('containers.create.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('containers.create.name.placeholder')} />
        </FormRow>

        <FormRow
          label={t('containers.create.image')}
          labelExtra={
            <button
              type="button"
              onClick={() => setImagesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:text-gray-700 md:hidden dark:border-gray-800 dark:hover:text-gray-300"
            >
              <Images className="size-3" />
              {t('containers.images')}
            </button>
          }
        >
          <div className="flex w-full items-center gap-2">
            <div className="min-w-0 flex-1">
              <Combobox
                value={image}
                onChange={setImage}
                options={imageTags}
                placeholder={t('containers.create.image.placeholder')}
                clearable
              />
            </div>
            <ToggleButton active={imageAutoUpdate} onClick={() => setImageAutoUpdate((v) => !v)} className="h-8 shrink-0">
              {t('containers.create.image.autoUpdate')}
            </ToggleButton>
            <button
              type="button"
              onClick={() => setImagesOpen(true)}
              className="hidden shrink-0 items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:text-gray-700 md:inline-flex dark:border-gray-800 dark:hover:text-gray-300"
            >
              <Images className="size-3" />
              {t('containers.images')}
            </button>
          </div>
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
            className="text-sm"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            placeholder={t('containers.create.env.placeholder')}
            rows={3}
          />
        </FormRow>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Tooltip open={volumesTooltipOpen} onOpenChange={setVolumesTooltipOpen}>
              <TooltipTrigger asChild>
                <span
                  onClick={() => setVolumesTooltipOpen((v) => !v)}
                  className="flex cursor-help items-center gap-1 text-xs text-gray-500"
                >
                  {t('containers.create.volumes')}
                  <Info className="size-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('containers.create.volumes.tooltip')}</TooltipContent>
            </Tooltip>
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

          {mounts.map((row) => {
            const sourceSuggestOpen =
              pathSuggestKey === row.key &&
              pathSuggestField === 'source' &&
              row.source.startsWith('/') &&
              pathSuggestOptions.length > 0
            const targetOptions = imageVolumePaths.filter(
              (p) => !row.target.trim() || p.toLowerCase().includes(row.target.trim().toLowerCase()),
            )
            const targetSuggestOpen = pathSuggestKey === row.key && pathSuggestField === 'target' && targetOptions.length > 0
            const suggestOpen = sourceSuggestOpen || targetSuggestOpen
            const suggestOptions = pathSuggestField === 'source' ? pathSuggestOptions : targetOptions
            return (
              <div key={row.key} className="flex items-center gap-2">
                <Popover open={suggestOpen} onOpenChange={(open) => !open && setPathSuggestKey(null)}>
                  <PopoverAnchor data-path-suggest-anchor="" className="min-w-0 flex-1">
                    <SegmentedInput
                      separator=":"
                      segments={[
                        {
                          value: row.source,
                          onChange: (source) => updateMountRow(row.key, { source }),
                          onFocus: () => {
                            setPathSuggestKey(row.key)
                            setPathSuggestField('source')
                          },
                          placeholder: t('containers.create.volumes.source.placeholder'),
                        },
                        {
                          value: row.target,
                          onChange: (target) => updateMountRow(row.key, { target }),
                          onFocus: () => {
                            setPathSuggestKey(row.key)
                            setPathSuggestField('target')
                          },
                          placeholder: t('containers.create.volumes.target.placeholder'),
                        },
                      ]}
                      suffix={
                        <>
                          <span className="flex items-center text-muted-foreground select-none">:</span>
                          <button
                            type="button"
                            onClick={() => updateMountRow(row.key, { readOnly: !row.readOnly })}
                            title={
                              row.readOnly ? t('containers.create.volumes.readOnly') : t('containers.create.volumes.readWrite')
                            }
                            className={cn(
                              'shrink-0 cursor-pointer self-stretch px-3 text-xs transition-colors',
                              row.readOnly ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600',
                            )}
                          >
                            {row.readOnly ? 'ro' : 'rw'}
                          </button>
                        </>
                      }
                    />
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    // Radix only exempts an actual Trigger from counting as an
                    // outside interaction; Anchor isn't tracked the same way,
                    // so typing/clicking in either segment would otherwise
                    // read as focus-outside and close this immediately.
                    onInteractOutside={(e) => {
                      if (e.target instanceof HTMLElement && e.target.closest('[data-path-suggest-anchor]')) {
                        e.preventDefault()
                      }
                    }}
                    className="w-(--radix-popover-trigger-width) p-1"
                  >
                    <ScrollArea className="max-h-56" viewportClassName="max-h-56">
                      {suggestOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            updateMountRow(row.key, pathSuggestField === 'source' ? { source: opt } : { target: opt })
                            setPathSuggestKey(null)
                          }}
                          className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {opt}
                        </button>
                      ))}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
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
            )
          })}
        </div>

        {networkModeHasPorts(networkMode) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Tooltip open={portsTooltipOpen} onOpenChange={setPortsTooltipOpen}>
                <TooltipTrigger asChild>
                  <span
                    onClick={() => setPortsTooltipOpen((v) => !v)}
                    className="flex cursor-help items-center gap-1 text-xs text-gray-500"
                  >
                    {t('containers.create.ports')}
                    <Info className="size-3" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('containers.create.ports.tooltip')}</TooltipContent>
              </Tooltip>
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

            {ports.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <SegmentedInput
                  className="flex-1"
                  separator=":"
                  segments={[
                    {
                      value: row.hostPart,
                      onChange: (hostPart) => updatePortRow(row.key, { hostPart }),
                      placeholder: t('containers.create.ports.host.placeholder'),
                    },
                    {
                      value: row.containerPort,
                      onChange: (containerPort) => updatePortRow(row.key, { containerPort }),
                      placeholder: t('containers.create.ports.container.placeholder'),
                    },
                  ]}
                  suffix={
                    <>
                      <span className="flex items-center text-muted-foreground select-none">/</span>
                      <button
                        type="button"
                        onClick={() => updatePortRow(row.key, { protocol: row.protocol === 'tcp' ? 'udp' : 'tcp' })}
                        className="shrink-0 cursor-pointer self-stretch px-3 text-xs font-medium text-gray-700 transition-colors dark:text-gray-300"
                      >
                        {row.protocol === 'tcp' ? 'TCP' : 'UDP'}
                      </button>
                    </>
                  }
                />
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
            ))}
          </div>
        )}

        <FormRow label={t('containers.create.cpuLimit')}>
          <div className="relative w-32">
            <Combobox
              value={cpuLimit}
              onChange={setCpuLimit}
              options={CPU_LIMIT_OPTIONS}
              inputClassName="pr-10 text-sm"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
              {t('containers.create.cpuLimit.unit')}
            </span>
          </div>
        </FormRow>

        <FormRow label={t('containers.create.memoryLimit')}>
          <div className="w-32">
            <Combobox
              value={memoryLimit}
              onChange={setMemoryLimit}
              onBlur={() => setMemoryLimit((v) => normalizeMemoryLimit(v))}
              options={MEMORY_LIMIT_OPTIONS}
              placeholder={t('containers.create.memoryLimit.placeholder')}
              inputClassName="text-sm"
            />
          </div>
        </FormRow>
      </form>

      <ImageManagerDialog open={imagesOpen} onOpenChange={handleImagesOpenChange} />
    </SectionedDialog>
  )
}
