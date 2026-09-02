import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch } from './api'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  state: AuthState
  login: (password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')

  useEffect(() => {
    apiFetch('/session')
      .then(() => setState('authenticated'))
      .catch(() => setState('unauthenticated'))
  }, [])

  async function login(password: string) {
    await apiFetch('/login', { method: 'POST', body: JSON.stringify({ password }) })
    setState('authenticated')
  }

  async function logout() {
    await apiFetch('/logout', { method: 'POST' })
    setState('unauthenticated')
  }

  return <AuthContext.Provider value={{ state, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
