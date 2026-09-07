import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { SectionedDialog } from '@/components/SectionedDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'

// Lets the footer's submit button (rendered as a sibling of the form, not a
// descendant — see SectionedDialog) still submit this form via the HTML
// form="..." attribute.
const FORM_ID = 'create-volume-form'

// Left label / right value on desktop; stacked label-above-value on mobile.
function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
      <span className="text-xs text-gray-500 md:w-28 md:shrink-0">{label}</span>
      <div className="flex justify-start md:flex-1">{children}</div>
    </div>
  )
}

export function CreateVolumeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()

  const [name, setName] = useState('')
  const [driver, setDriver] = useState('')

  useEffect(() => {
    if (!open) return
    setName('')
    setDriver('')
  }, [open])

  function submit(e: FormEvent) {
    e.preventDefault()
    onOpenChange(false)
  }

  return (
    <SectionedDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('containers.volumes.create.title')}
      className="h-[85vh] max-w-lg"
      onOpenAutoFocus={(event) => {
        if (!window.matchMedia('(min-width: 768px)').matches) event.preventDefault()
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('confirm.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            className="border-theme-200 bg-theme-50 text-theme-700 hover:bg-theme-100 dark:border-theme-800 dark:bg-theme-950 dark:text-theme-300 dark:hover:bg-theme-900"
          >
            {t('containers.volumes.create.submit')}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="flex flex-col gap-4">
        <FormRow label={t('containers.volumes.create.name')}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('containers.volumes.create.name.placeholder')}
          />
        </FormRow>

        <FormRow label={t('containers.volumes.create.driver')}>
          <Input
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            placeholder={t('containers.volumes.create.driver.placeholder')}
          />
        </FormRow>
      </form>
    </SectionedDialog>
  )
}
