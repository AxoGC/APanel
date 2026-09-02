import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from './api'
import { useAuth } from './auth'

export interface Features {
  containers: boolean
  history: boolean
  firewall: boolean
}

const EMPTY: Features = { containers: false, history: false, firewall: false }

const FeaturesContext = createContext<Features>(EMPTY)

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

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
