import { Plug } from 'lucide-react'
import { DependencyDialog } from '@/components/DependencyDialog'
import { Button } from '@/components/ui/button'
import { useDependencyGate } from '@/lib/useDependencyGate'
import { useI18n } from '@/lib/i18n'

export default function ProxyPage() {
  const { t } = useI18n()
  const { dialogOpen, setDialogOpen } = useDependencyGate('proxy')

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('nav.proxy')}</h1>
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
      <DependencyDialog moduleKey="proxy" open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
