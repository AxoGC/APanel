import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import { AuthProvider, useAuth } from '@/lib/auth'
import { I18nProvider } from '@/lib/i18n'
import ContainersPage from '@/modules/containers/Page'
import DashboardPage from '@/modules/dashboard/Page'
import HistoryPage from '@/modules/history/Page'
import LoginPage from '@/modules/login/Page'
import ServicesPage from '@/modules/services/Page'
import SettingsPage from '@/modules/settings/Page'

function Shell() {
  const { state } = useAuth()

  if (state === 'loading') return null
  if (state === 'unauthenticated') return <LoginPage />

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
