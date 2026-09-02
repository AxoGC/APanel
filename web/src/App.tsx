import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import { AuthProvider, useAuth } from '@/lib/auth'
import { FeaturesProvider } from '@/lib/features'
import { I18nProvider } from '@/lib/i18n'
import ContainersPage from '@/modules/containers/Page'
import DashboardPage from '@/modules/dashboard/Page'
import FilesPage from '@/modules/files/Page'
import FirewallPage from '@/modules/firewall/Page'
import HistoryPage from '@/modules/history/Page'
import LoginPage from '@/modules/login/Page'
import ServicesPage from '@/modules/services/Page'
import SettingsPage from '@/modules/settings/Page'

const TerminalPage = lazy(() => import('@/modules/terminal/Page'))

function Shell() {
  const { state } = useAuth()

  if (state === 'loading') return null
  if (state === 'unauthenticated') return <LoginPage />

  return (
    <div className="flex h-dvh flex-col md:flex-row-reverse">
      <div className="min-h-0 grow overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/terminal"
            element={
              <Suspense fallback={null}>
                <TerminalPage />
              </Suspense>
            }
          />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/firewall" element={<FirewallPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
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
