import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from './api'
import { useAuth } from './auth'

export type ModuleKey =
  | 'terminal'
  | 'services'
  | 'files'
  | 'containers'
  | 'history'
  | 'firewall'
  | 'proxy'
  | 'database'
  | 'auditlog'

export interface ModuleStatus {
  key: ModuleKey
  enabled: boolean
}

interface StatusResponse {
  modules: ModuleStatus[]
}

interface FeaturesContextValue {
  modules: ModuleStatus[]
  setEnabledFeatures: (keys: ModuleKey[]) => Promise<void>
}

const EMPTY: ModuleStatus[] = []

const FeaturesContext = createContext<FeaturesContextValue>({
  modules: EMPTY,
  setEnabledFeatures: async () => {},
})

// Which optional extension modules (containers, history, firewall, proxy,
// database) the admin has explicitly enabled, and in what order — fetched
// once after login so Nav can render exactly the enabled modules, in the
// chosen order. Never auto-detected: see Settings' "enable modules" dialog.
export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const [modules, setModules] = useState<ModuleStatus[]>(EMPTY)

  useEffect(() => {
    if (state !== 'authenticated') return
    apiFetch<StatusResponse>('/status', undefined, { silent: true })
      .then((res) => setModules(res.modules))
      .catch(() => setModules(EMPTY))
  }, [state])

  const setEnabledFeatures = async (keys: ModuleKey[]) => {
    const res = await apiFetch<StatusResponse>('/status/features', {
      method: 'PUT',
      body: JSON.stringify({ enabledFeatures: keys }),
    })
    setModules(res.modules)
  }

  return (
    <FeaturesContext.Provider value={{ modules, setEnabledFeatures }}>{children}</FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
