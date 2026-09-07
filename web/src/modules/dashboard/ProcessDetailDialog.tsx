import { Loader2, Square, SquareStack } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { SectionedDialog } from '@/components/SectionedDialog'
import { formatBytes, formatPercent } from '@/lib/format'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { getProcessDetail, terminateProcess, terminateProcessTree, type ProcessDetail } from './useDashboardStream'

const STATE_LABELS: Record<string, TranslationKey> = {
  R: 'dashboard.state.R',
  S: 'dashboard.state.S',
  D: 'dashboard.state.D',
  Z: 'dashboard.state.Z',
  T: 'dashboard.state.T',
  t: 'dashboard.state.t',
  X: 'dashboard.state.X',
  I: 'dashboard.state.I',
}

function Field({ label, value, wrap }: { label: string; value: ReactNode; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-sm text-gray-700 dark:text-gray-300', wrap ? 'break-all' : 'truncate')}>{value}</span>
    </div>
  )
}

// Opens on any pid (a click on the flat list or the tree's row); closing
// resets pid back to null so re-opening the same process always refetches
// rather than showing stale detail.
export function ProcessDetailDialog({ pid, onOpenChange }: { pid: number | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<ProcessDetail | null>(null)
  const [terminating, setTerminating] = useState(false)
  const [terminatingTree, setTerminatingTree] = useState(false)

  useEffect(() => {
    if (pid === null) return
    setDetail(null)
    getProcessDetail(pid)
      .then(setDetail)
      .catch(() => {})
  }, [pid])

  async function handleTerminate() {
    if (pid === null) return
    setTerminating(true)
    try {
      await terminateProcess(pid)
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setTerminating(false)
    }
  }

  async function handleTerminateTree() {
    if (pid === null) return
    setTerminatingTree(true)
    try {
      await terminateProcessTree(pid)
      onOpenChange(false)
    } catch {
      // surfaced by the global error dialog
    } finally {
      setTerminatingTree(false)
    }
  }

  return (
    <SectionedDialog
      open={pid !== null}
      onOpenChange={onOpenChange}
      title={detail ? detail.name : t('dashboard.detail.title')}
      className="max-w-lg"
      drawer
      footer={
        <div className="flex items-center justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!detail || terminating || terminatingTree}>
                {terminatingTree ? <Loader2 className="animate-spin" /> : <SquareStack />}
                {t('dashboard.detail.terminateTree')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('dashboard.confirmTerminateTree.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {detail && (
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{detail.name}</span>
                      {' — '}
                    </>
                  )}
                  {t('dashboard.confirmTerminateTree.description')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleTerminateTree}>{t('dashboard.detail.terminateTree')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!detail || terminating || terminatingTree}>
                {terminating ? <Loader2 className="animate-spin" /> : <Square />}
                {t('dashboard.detail.terminate')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('dashboard.confirmTerminate.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {detail && (
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{detail.name}</span>
                      {' — '}
                    </>
                  )}
                  {t('dashboard.confirmTerminate.description')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('confirm.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleTerminate}>{t('dashboard.detail.terminate')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      {detail && (
        <div className="grid grid-cols-2 gap-4">
              <Field label={t('dashboard.detail.pid')} value={detail.pid} />
              <Field label={t('dashboard.detail.ppid')} value={detail.ppid} />
              <Field
                label={t('dashboard.detail.state')}
                value={STATE_LABELS[detail.state] ? t(STATE_LABELS[detail.state]) : detail.state}
              />
              <Field label={t('dashboard.user')} value={detail.user} />
              <Field label={t('dashboard.cpu')} value={formatPercent(detail.cpuPercent)} />
              <Field label={t('dashboard.memory')} value={formatBytes(detail.memRSS)} />
              <Field label={t('dashboard.detail.vmSize')} value={formatBytes(detail.vmSize)} />
              <Field label={t('dashboard.detail.vmSwap')} value={formatBytes(detail.vmSwap)} />
              <Field label={t('dashboard.detail.priority')} value={detail.priority} />
              <Field label={t('dashboard.detail.nice')} value={detail.nice} />
              <Field label={t('dashboard.detail.threads')} value={detail.threads} />
              <Field
                label={t('dashboard.detail.openFiles')}
                value={detail.openFiles >= 0 ? detail.openFiles : '—'}
              />
              <div className="col-span-2">
                <Field
                  label={t('dashboard.detail.startTime')}
                  value={new Date(detail.startTime).toLocaleString()}
                />
              </div>
              <div className="col-span-2">
                <Field label={t('dashboard.detail.cmdline')} value={detail.cmdline} wrap />
              </div>
              {detail.exe && (
                <div className="col-span-2">
                  <Field label={t('dashboard.detail.exe')} value={detail.exe} wrap />
                </div>
              )}
              {detail.cwd && (
                <div className="col-span-2">
                  <Field label={t('dashboard.detail.cwd')} value={detail.cwd} wrap />
                </div>
              )}
        </div>
      )}
    </SectionedDialog>
  )
}
