import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiFetch, ApiError } from './api'
import { encryptLoginPassword } from './loginCrypto'

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
    // A challenge is single-use and short-lived, so a login can race one
    // into expiring (e.g. the user took a while typing the password). One
    // silent retry with a freshly fetched challenge covers that without
    // bothering the caller.
    for (let attempt = 0; ; attempt++) {
      try {
        const payload = await encryptLoginPassword(password)
        await apiFetch('/login', { method: 'POST', body: JSON.stringify(payload) })
        setState('authenticated')
        return
      } catch (err) {
        if (attempt === 0 && err instanceof ApiError && err.code === 'CHALLENGE_EXPIRED') continue
        throw err
      }
    }
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
