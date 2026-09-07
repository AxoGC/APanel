import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useI18n } from '@/lib/i18n'
import type { ContainerRef } from './api'

// Shared by the image, network, and volume managers: "unused" in gray, the
// container's own name when exactly one is using it, or a theme-colored
// "<n> in use" that reveals which containers on hover once there's more
// than one.
export function UsageCell({ usedBy }: { usedBy: ContainerRef[] }) {
  const { t } = useI18n()

  if (usedBy.length === 0) {
    return <span className="text-xs text-gray-500">{t('containers.usage.unused')}</span>
  }

  if (usedBy.length === 1) {
    return (
      <span className="block truncate text-xs text-theme-700 dark:text-theme-300" title={usedBy[0].name}>
        {usedBy[0].name}
      </span>
    )
  }

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <span className="cursor-default text-xs text-theme-700 dark:text-theme-300">
          {usedBy.length} {t('containers.usage.inUse')}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-auto min-w-40">
        <ul className="flex flex-col gap-1">
          {usedBy.map((c) => (
            <li key={c.id} className="truncate text-sm text-gray-700 dark:text-gray-300">
              {c.name}
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  )
}
