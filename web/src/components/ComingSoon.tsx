import { useI18n } from '@/lib/i18n'

export function ComingSoon({ title }: { title: string }) {
  const { t } = useI18n()
  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 text-base text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="text-sm text-gray-700 dark:text-gray-300">{t('placeholder.comingSoon')}</p>
    </div>
  )
}
