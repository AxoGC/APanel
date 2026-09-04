import { Plug } from 'lucide-react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'

export default function DatabasePage() {
  const { t } = useI18n()
  const { dialogOpen, setDialogOpen } = useDependencyGate('database')

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.database')}</h1>
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
      <p className="text-sm text-gray-700 dark:text-gray-300">{t('placeholder.comingSoon')}</p>
      <DependencyDialog moduleKey="database" open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
