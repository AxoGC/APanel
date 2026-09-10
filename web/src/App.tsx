import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HttpRiskDialog } from '@/components/HttpRiskDialog'
import { Nav } from '@/components/Nav'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ErrorFeedbackDialog } from '@/lib/errorFeedback'
import { FeaturesProvider } from '@/lib/features'
import { I18nProvider } from '@/lib/i18n'

const LoginPage = lazy(() => import('@/modules/login/Page'))
const DashboardPage = lazy(() => import('@/modules/dashboard/Page'))
const ServicesPage = lazy(() => import('@/modules/services/Page'))
const FilesPage = lazy(() => import('@/modules/files/Page'))
const ContainersPage = lazy(() => import('@/modules/containers/Page'))
const HistoryPage = lazy(() => import('@/modules/history/Page'))
const FirewallPage = lazy(() => import('@/modules/firewall/Page'))
const ProxyPage = lazy(() => import('@/modules/proxy/Page'))
const DatabasePage = lazy(() => import('@/modules/database/Page'))
const AuditLogPage = lazy(() => import('@/modules/auditlog/Page'))
const SettingsPage = lazy(() => import('@/modules/settings/Page'))
const TerminalPage = lazy(() => import('@/modules/terminal/Page'))

function Shell() {
  const { state } = useAuth()
  const location = useLocation()
  // The terminal's WebSocket + xterm instance must survive navigating away
  // from /terminal (so the session and its scrollback keep running in the
  // background), so TerminalPage can't be mounted/unmounted by <Route> the
  // way every other page is. Instead it's mounted once — lazily, the first
  // time /terminal is visited — and then kept alive for the rest of the
  // session as a sibling of <Routes>, toggling only its CSS visibility.
  const [terminalStarted, setTerminalStarted] = useState(false)
  useEffect(() => {
    if (location.pathname === '/terminal') setTerminalStarted(true)
  }, [location.pathname])

  return (
    <>
      <HttpRiskDialog />
      <ErrorFeedbackDialog />
      {state === 'loading' ? null : state === 'unauthenticated' ? (
        <Suspense fallback={null}>
          <LoginPage />
        </Suspense>
      ) : (
        <div className="mx-auto flex h-dvh max-w-5xl flex-col md:flex-row-reverse">
          <ScrollArea className="min-h-0 grow" viewportClassName="[&>div]:h-full [&>div]:block!">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/files" element={<FilesPage />} />
                <Route path="/containers" element={<ContainersPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/firewall" element={<FirewallPage />} />
                <Route path="/proxy" element={<ProxyPage />} />
                <Route path="/database" element={<DatabasePage />} />
                <Route path="/auditlog" element={<AuditLogPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
            {terminalStarted && (
              <div hidden={location.pathname !== '/terminal'} className="h-full">
                <Suspense fallback={null}>
                  <TerminalPage />
                </Suspense>
              </div>
            )}
          </ScrollArea>
          <Nav />
        </div>
      )}
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <FeaturesProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </FeaturesProvider>
      </AuthProvider>
    </I18nProvider>
  )
}
