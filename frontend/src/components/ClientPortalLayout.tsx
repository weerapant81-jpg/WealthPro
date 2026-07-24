import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, LineChart, Bell, User, LogOut, Sun, Moon } from 'lucide-react'
import { logout } from '../lib/auth'

/* เปลือกสำหรับ client portal — เน้นมือถือ: แถบบน (โลโก้+ธีม+ออกจากระบบ) + เนื้อหา + แถบแท็บล่าง
   ไม่ใช้ sidebar/เมนู FA · จำกัดความกว้างให้อ่านสบายบนเดสก์ท็อปด้วย */
const TABS = [
  { to: '/portal', label: 'หน้าหลัก', icon: Home, end: true },
  { to: '/portal/plan', label: 'แผนของฉัน', icon: LineChart, end: false },
  { to: '/portal/notify', label: 'แจ้ง FA', icon: Bell, end: false },
  { to: '/portal/profile', label: 'โปรไฟล์', icon: User, end: false },
]

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark')
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme) }, [theme])
  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')
  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-900)', color: 'var(--text-primary)', fontFamily: "'Sarabun', sans-serif" }}>
      {/* แถบบน */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--navy-950)', borderBottom: '1px solid var(--card-border)',
        paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={toggle} aria-label="สลับธีม" style={iconBtn}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button onClick={logout} aria-label="ออกจากระบบ" style={iconBtn}><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      {/* เนื้อหา — เว้นล่างให้พ้นแถบแท็บ */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px calc(84px + env(safe-area-inset-bottom))' }}>
        {children}
      </main>

      {/* แถบแท็บล่าง (มือถือ) */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'var(--navy-950)', borderTop: '1px solid var(--card-border)',
        paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end}
              style={({ isActive }) => ({
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 4px 10px',
                textDecoration: 'none', fontSize: 11, fontWeight: 700,
                color: isActive ? 'var(--cyan)' : 'var(--text-muted)',
              })}>
              {({ isActive }) => (<><t.icon size={21} color={isActive ? 'var(--cyan)' : 'var(--text-muted)'} />{t.label}</>)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent',
  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
}
