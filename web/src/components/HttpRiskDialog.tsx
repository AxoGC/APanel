import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { isSecureContext } from '@/lib/https'
import { useI18n } from '@/lib/i18n'

// Gates the whole app behind an explicit risk acknowledgment whenever it's
// served over plain HTTP. apanel still works over HTTP (the login password
// itself is protected — see loginCrypto.ts), but everything else — the
// session cookie, and every subsequent request: file contents, terminal
// input/output, and so on — travels unencrypted, so this can't be silently
// skipped or dismissed by clicking away. It has no close button and
// reappears every time the app loads over HTTP; accepting it isn't
// remembered across page loads.
export function HttpRiskDialog() {
  const { t } = useI18n()
  const [accepted, setAccepted] = useState(false)

  if (isSecureContext() || accepted) return null

  return (
    <AlertDialog open onOpenChange={() => {}}>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('httpRisk.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('httpRisk.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <a href="https://apanel.axogc.net/secure.html" target="_blank" rel="noreferrer">
              {t('httpRisk.tutorial')}
            </a>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setAccepted(true)}>
            {t('httpRisk.accept')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
