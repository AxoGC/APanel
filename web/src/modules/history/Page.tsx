import { ComingSoon } from '@/components/ComingSoon'
import { useI18n } from '@/lib/i18n'

export default function HistoryPage() {
  const { t } = useI18n()
  return <ComingSoon title={t('nav.history')} />
}
