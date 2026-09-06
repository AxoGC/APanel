import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { ApiError, setApiErrorListener } from './api'
import { useI18n, type TranslationKey } from './i18n'

function translateCode(code: string, t: (key: TranslationKey) => string): string {
  const key = `api.error.${code}` as TranslationKey
  const translated = t(key)
  return translated === key ? code : translated
}

// Mounted once at the app root (see App.tsx's <Shell/>, next to
// <HttpRiskDialog/>). Every apiFetch failure funnels through here instead of
// each dialog rendering its own inline "raw error code in the document flow"
// paragraph — apiFetch calls setApiErrorListener's callback synchronously
// before rejecting, and { silent: true } opts a call out for best-effort
// background probes or forms with their own dedicated error UI.
export function ErrorFeedbackDialog() {
  const { t } = useI18n()
  const [current, setCurrent] = useState<ApiError | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setApiErrorListener((err) => {
      setCurrent(err)
      setDetailOpen(false)
    })
    return () => setApiErrorListener(null)
  }, [])

  return (
    <AlertDialog open={current !== null} onOpenChange={(open) => !open && setCurrent(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('error.title')}</AlertDialogTitle>
          <AlertDialogDescription>{current ? translateCode(current.code, t) : ''}</AlertDialogDescription>
        </AlertDialogHeader>

        {current?.detail && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              className="flex w-fit cursor-pointer items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setDetailOpen((v) => !v)}
            >
              {detailOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              {t('error.details')}
            </button>
            {detailOpen && (
              <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs whitespace-pre-wrap text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                {current.detail}
              </pre>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogAction className={buttonVariants({ variant: 'default' })} onClick={() => setCurrent(null)}>
            {t('confirm.ok')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
