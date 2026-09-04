import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AuthProvider, useAuth } from '@/lib/auth'
import { FeaturesProvider } from '@/lib/features'
import { I18nProvider } from '@/lib/i18n'
import ContainersPage from '@/modules/containers/Page'
import DashboardPage from '@/modules/dashboard/Page'
import DatabasePage from '@/modules/database/Page'
import FilesPage from '@/modules/files/Page'
import FirewallPage from '@/modules/firewall/Page'
import HistoryPage from '@/modules/history/Page'
import LoginPage from '@/modules/login/Page'
import ProxyPage from '@/modules/proxy/Page'
import ServicesPage from '@/modules/services/Page'
import SettingsPage from '@/modules/settings/Page'

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

  if (state === 'loading') return null
  if (state === 'unauthenticated') return <LoginPage />

  return (
    <div className="mx-auto flex h-dvh max-w-5xl flex-col md:flex-row-reverse">
      <ScrollArea className="min-h-0 grow" viewportClassName="[&>div]:h-full [&>div]:block!">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/firewall" element={<FirewallPage />} />
          <Route path="/proxy" element={<ProxyPage />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
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
