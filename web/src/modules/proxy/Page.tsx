import { Gauge, Loader2, Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ApiError } from '@/lib/api'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  getProxyGroup,
  getProxyOverview,
  selectProxyOption,
  setProxyMode,
  testProxyGroupDelay,
  type ProxyGroup,
  type ProxyMode,
  type ProxyOverview,
} from './api'
import { ProxyTable, ProxyTableHeader } from './ProxyTable'

export default function ProxyPage() {
  const { t } = useI18n()
  const { dialogOpen, setDialogOpen } = useDependencyGate('proxy')

  const [overview, setOverview] = useState<ProxyOverview | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [group, setGroup] = useState<ProxyGroup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [switchingMode, setSwitchingMode] = useState(false)
  const [pendingSelect, setPendingSelect] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  function loadGroup(name: string) {
    setGroup(null)
    getProxyGroup(name)
      .then(setGroup)
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
  }

  useEffect(() => {
    getProxyOverview()
      .then((res) => {
        setOverview(res)
        const target = res.mode === 'global' ? 'GLOBAL' : res.mode === 'rule' ? res.groups[0] : undefined
        if (target) {
          setSelectedGroup(res.mode === 'rule' ? target : null)
          loadGroup(target)
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : String(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleModeChange(mode: ProxyMode) {
    setSwitchingMode(true)
    setError(null)
    try {
      const res = await setProxyMode(mode)
      setOverview(res)
      if (mode === 'global') {
        setSelectedGroup(null)
        loadGroup('GLOBAL')
      } else if (mode === 'rule') {
        const next = selectedGroup && res.groups.includes(selectedGroup) ? selectedGroup : res.groups[0]
        setSelectedGroup(next ?? null)
        if (next) loadGroup(next)
        else setGroup(null)
      } else {
        setSelectedGroup(null)
        setGroup(null)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setSwitchingMode(false)
    }
  }

  function handleGroupChip(name: string) {
    setSelectedGroup(name)
    setError(null)
    loadGroup(name)
  }

  async function handleSelect(name: string) {
    const activeGroup = overview?.mode === 'global' ? 'GLOBAL' : selectedGroup
    if (!activeGroup) return
    setPendingSelect(name)
    setError(null)
    try {
      setGroup(await selectProxyOption(activeGroup, name))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setPendingSelect(null)
    }
  }

  async function handleTestDelay() {
    const activeGroup = overview?.mode === 'global' ? 'GLOBAL' : selectedGroup
    if (!activeGroup) return
    setTesting(true)
    setError(null)
    try {
      setGroup(await testProxyGroupDelay(activeGroup))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const mode = overview?.mode ?? 'rule'
  const showTable = mode !== 'direct'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.proxy')}</h1>
        <div className="flex items-center gap-1">
          {showTable && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('proxy.testDelay')}
              title={t('proxy.testDelay')}
              disabled={testing || !group}
              onClick={() => void handleTestDelay()}
            >
              {testing ? <Loader2 className="animate-spin" /> : <Gauge />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('dependency.configure')}
            title={t('dependency.configure')}
            onClick={() => setDialogOpen(true)}
          >
            <Plug />
          </Button>
        </div>
      </div>

      <div className="mt-3 px-4 sm:px-6">
        <SegmentedControl
          options={[
            { value: 'global' as ProxyMode, label: t('proxy.mode.global') },
            { value: 'rule' as ProxyMode, label: t('proxy.mode.rule') },
            { value: 'direct' as ProxyMode, label: t('proxy.mode.direct') },
          ]}
          value={mode}
          onChange={(v) => void handleModeChange(v)}
        />
      </div>

      {mode === 'rule' && overview && overview.groups.length > 0 && (
        <div className="mt-3 flex flex-row flex-wrap gap-1.5 px-4 sm:px-6">
          {overview.groups.map((name) => (
            <button
              key={name}
              type="button"
              disabled={switchingMode}
              onClick={() => handleGroupChip(name)}
              className={cn(
                'cursor-pointer rounded-md px-2 py-1 text-xs transition-colors',
                name === selectedGroup
                  ? 'bg-theme-100 text-theme-700 dark:bg-theme-900 dark:text-theme-300'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-gray-800 dark:hover:text-gray-300',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 px-4 text-xs text-red-600 sm:px-6">{error}</p>}

      {showTable && (
        <>
          <div className="mt-3 px-4 sm:px-6">
            <ProxyTableHeader />
          </div>
          <ScrollArea className="min-h-0 grow px-4 sm:px-6">
            {group && group.options.length === 0 && <p className="p-2 text-sm text-gray-500">{t('proxy.empty')}</p>}
            {group && group.options.length > 0 && (
              <ProxyTable options={group.options} now={group.now} pending={pendingSelect} onSelect={(name) => void handleSelect(name)} />
            )}
          </ScrollArea>
        </>
      )}

      <DependencyDialog moduleKey="proxy" open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
