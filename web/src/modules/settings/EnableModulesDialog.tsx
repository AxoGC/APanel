import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Switch } from '@/components/ui/switch'
import { useFeatures, type ModuleKey, type ModuleStatus } from '@/lib/features'
import { useI18n } from '@/lib/i18n'
import { MODULE_META, MODULE_ORDER } from '@/lib/modules'
import { cn } from '@/lib/utils'

// Enabled modules always sort first, in the order given, followed by every
// remaining module in the canonical MODULE_ORDER — so the disabled section
// stays stable regardless of which one was toggled off last.
function buildRows(enabledKeys: ModuleKey[]): ModuleStatus[] {
  const enabledSet = new Set(enabledKeys)
  const disabled = MODULE_ORDER.filter((key) => !enabledSet.has(key))
  return [
    ...enabledKeys.map((key) => ({ key, enabled: true })),
    ...disabled.map((key) => ({ key, enabled: false })),
  ]
}

export function EnableModulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const { modules, setEnabledFeatures } = useFeatures()
  const [pendingRows, setPendingRows] = useState<ModuleStatus[] | null>(null)

  const rows = pendingRows ?? modules
  const enabledCount = rows.filter((m) => m.enabled).length

  const apply = async (next: ModuleStatus[]) => {
    setPendingRows(next)
    try {
      await setEnabledFeatures(next.filter((m) => m.enabled).map((m) => m.key))
    } catch {
      // Keep the server-provided value when saving fails.
    } finally {
      setPendingRows(null)
    }
  }

  const toggle = (key: ModuleKey, enabled: boolean) => {
    const enabledKeys = rows.filter((m) => m.enabled && m.key !== key).map((m) => m.key)
    if (enabled) enabledKeys.push(key)
    void apply(buildRows(enabledKeys))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= enabledCount) return
    const enabledKeys = rows.filter((m) => m.enabled).map((m) => m.key)
    ;[enabledKeys[index], enabledKeys[target]] = [enabledKeys[target], enabledKeys[index]]
    void apply(buildRows(enabledKeys))
  }

  return (
    <SectionedDialog open={open} onOpenChange={onOpenChange} title={t('settings.enabledFeatures')} className="max-w-sm" drawer>
      <div role="list" className="flex flex-col gap-0.5">
        {rows.map((row, index) => {
          const meta = MODULE_META[row.key]
          const Icon = meta.icon
          return (
            <div
              key={row.key}
              role="listitem"
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5',
                !row.enabled && 'text-gray-400 dark:text-gray-500',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm">{t(meta.labelKey)}</span>
              {row.enabled && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={pendingRows !== null || index === 0}
                    onClick={() => move(index, -1)}
                    className="cursor-pointer rounded p-1 text-gray-500 hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={pendingRows !== null || index === enabledCount - 1}
                    onClick={() => move(index, 1)}
                    className="cursor-pointer rounded p-1 text-gray-500 hover:bg-accent disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              )}
              <Switch
                checked={row.enabled}
                disabled={pendingRows !== null}
                onCheckedChange={(checked) => toggle(row.key, checked === true)}
              />
            </div>
          )
        })}
      </div>
    </SectionedDialog>
  )
}
