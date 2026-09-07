import { Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ConfirmIconButton } from '@/components/ConfirmIconButton'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { deleteContainerNetwork, listContainerNetworks, type ContainerNetwork } from './api'
import { UsageCell } from './UsageCell'

type NetworkFilter = 'all' | 'unused' | 'used'

// Docker's own built-in networks — always present, never removable, and
// never useful to show here since there's nothing a user can do with them
// in a delete-oriented list. In-use custom networks are still listed (just
// with delete disabled) since they're real candidates once freed up.
const PREDEFINED_NETWORKS = new Set(['bridge', 'host', 'none'])

export function NetworkManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [networks, setNetworks] = useState<ContainerNetwork[] | null>(null)
  const [filter, setFilter] = useState<NetworkFilter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadNetworks = async () => {
    try {
      setNetworks(await listContainerNetworks())
    } catch {
      // surfaced by the global error dialog
    }
  }

  useEffect(() => {
    if (!open) return
    void loadNetworks()
  }, [open])

  const removableNetworks = useMemo(
    () => (networks ?? []).filter((n) => !PREDEFINED_NETWORKS.has(n.name)),
    [networks],
  )

  const filteredNetworks = useMemo(() => {
    if (filter === 'used') return removableNetworks.filter((n) => n.usedBy.length > 0)
    if (filter === 'unused') return removableNetworks.filter((n) => n.usedBy.length === 0)
    return removableNetworks
  }, [filter, removableNetworks])

  const deleteNetwork = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteContainerNetwork(id)
      await loadNetworks()
    } catch {
      // surfaced by the global error dialog
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('containers.networks.title')} className="max-w-3xl" height="85vh">
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{t('containers.networks.filter')}</span>
          <Select value={filter} onValueChange={(value) => setFilter(value as NetworkFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('containers.networks.filter.all')}</SelectItem>
              <SelectItem value="unused">{t('containers.networks.filter.unused')}</SelectItem>
              <SelectItem value="used">{t('containers.networks.filter.used')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-h-0 grow flex-col">
          <div className="flex items-center gap-1 border-b border-gray-200 px-2 pb-1.5 md:gap-3 dark:border-gray-800">
            <div className="min-w-0 flex-1 text-xs text-gray-500">{t('containers.networks.name')}</div>
            <div className="w-14 shrink-0 text-xs text-gray-500 md:w-24">{t('containers.networks.driver')}</div>
            <div className="hidden w-20 shrink-0 text-xs text-gray-500 md:block">{t('containers.networks.scope')}</div>
            <div className="w-14 shrink-0 text-right text-xs text-gray-500 md:w-24">{t('containers.usage')}</div>
            <div className="w-8 shrink-0" />
          </div>

          <div className="scrollbar-shadcn min-h-0 grow overflow-y-auto overscroll-contain">
            {networks && filteredNetworks.length === 0 && (
              <p className="px-2 py-4 text-sm text-gray-500">{t('containers.networks.empty')}</p>
            )}
            {filteredNetworks.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-1 border-b border-gray-100 px-2 py-2 last:border-b-0 hover:bg-gray-100 md:gap-3 dark:border-gray-900 dark:hover:bg-gray-800"
              >
                <div className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{n.name}</div>
                <div className="w-14 shrink-0 truncate text-xs text-gray-500 md:w-24">{n.driver}</div>
                <div className="hidden w-20 shrink-0 truncate text-xs text-gray-500 md:block">{n.scope}</div>
                <div className="w-14 shrink-0 text-right md:w-24">
                  <UsageCell usedBy={n.usedBy} />
                </div>
                <div className="flex w-8 shrink-0 justify-end">
                  <ConfirmIconButton
                    icon={<Trash2 />}
                    label={t('containers.networks.delete')}
                    actionLabel={t('containers.networks.delete')}
                    title={t('containers.networks.confirmDelete.title')}
                    description={
                      <>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{n.name}</span>
                        {' — '}
                        {t('containers.networks.confirmDelete.description')}
                      </>
                    }
                    disabled={n.usedBy.length > 0 || deletingId === n.id}
                    onConfirm={() => void deleteNetwork(n.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionedDialog>
  )
}
