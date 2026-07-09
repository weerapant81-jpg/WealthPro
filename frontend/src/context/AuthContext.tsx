import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../lib/auth'

interface AuthCtx { user: User | null; setUser: (u: User | null) => void; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {}, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      api.get('/auth/me').then(r => setUser(r.data)).catch(() => {}).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  return <Ctx.Provider value={{ user, setUser, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
