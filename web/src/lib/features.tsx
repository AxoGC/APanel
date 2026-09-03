import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from './api'
import { useAuth } from './auth'

export type FeatureKey = 'dashboard' | 'terminal' | 'services' | 'files' | 'containers' | 'history' | 'firewall'
export type OptionalFeatureKey = 'containers' | 'history' | 'firewall'

export const BASE_FEATURES: FeatureKey[] = ['dashboard', 'terminal', 'services', 'files']

export interface Features {
  containers: boolean
  history: boolean
  firewall: boolean
  disabledFeatures: FeatureKey[]
}

interface FeaturesContextValue extends Features {
  setDisabledFeatures: (disabledFeatures: FeatureKey[]) => Promise<void>
}

const EMPTY: Features = { containers: false, history: false, firewall: false, disabledFeatures: [] }

const FeaturesContext = createContext<FeaturesContextValue>({
  ...EMPTY,
  setDisabledFeatures: async () => {},
})

// Which dependency-gated modules (Docker, sysstat, ufw) are actually usable
// on this host — fetched once after login so Nav can hide their items
// entirely instead of the page showing an "unavailable" message.
export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const [features, setFeatures] = useState<Features>(EMPTY)

  useEffect(() => {
    if (state !== 'authenticated') return
    apiFetch<Features>('/status')
      .then(setFeatures)
      .catch(() => setFeatures(EMPTY))
  }, [state])

  const updateDisabledFeatures = async (disabledFeatures: FeatureKey[]) => {
    const updated = await apiFetch<Features>('/status/features', {
      method: 'PUT',
      body: JSON.stringify({ disabledFeatures }),
    })
    setFeatures(updated)
  }

  return (
    <FeaturesContext.Provider value={{ ...features, setDisabledFeatures: updateDisabledFeatures }}>
      {children}
    </FeaturesContext.Provider>
  )
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
