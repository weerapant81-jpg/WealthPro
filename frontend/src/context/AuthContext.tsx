import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from '../lib/api'
import { logout, type User } from '../lib/auth'

interface AuthCtx { user: User | null; setUser: (u: User | null) => void; loading: boolean }
const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {}, loading: true })

const IDLE_MS = 15 * 60 * 1000   // ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 15 นาที

// ออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน — ใช้ timestamp ใน localStorage เพื่อแชร์ข้ามแท็บ
function useIdleLogout(active: boolean) {
  useEffect(() => {
    if (!active) return
    const bump = () => { try { localStorage.setItem('last_activity', String(Date.now())) } catch { /* ignore */ } }
    bump()
    let last = 0
    const onActivity = () => { const now = Date.now(); if (now - last > 5000) { last = now; bump() } }   // throttle 5 วิ
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    const check = () => {
      const la = Number(localStorage.getItem('last_activity') || Date.now())
      if (Date.now() - la >= IDLE_MS) logout()
    }
    const iv = window.setInterval(check, 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity))
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active])
}

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

  useIdleLogout(!!user)

  return <Ctx.Provider value={{ user, setUser, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
