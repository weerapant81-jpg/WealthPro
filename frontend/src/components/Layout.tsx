import type { ReactNode, CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useClient } from '../context/ClientContext'
import { logout } from '../lib/auth'
import CopilotWidget from './CopilotWidget'
import { LayoutDashboard, Target, Settings, LogOut, ClipboardList, ClipboardCheck, ShieldCheck, Calculator, Users, RefreshCw, Sun, Moon, UserCog, Menu, ChevronLeft, ChevronRight, ChevronDown, User, Shield, TrendingUp, Wallet, Activity, Briefcase, Scale, HeartPulse, GraduationCap, CalendarRange, ScrollText, Search, ArrowRight, FileText, BookOpen } from 'lucide-react'

// เมนูย่อยของ "ข้อมูลลูกค้า" (ขับแท็บด้วย ?tab=)
const CLIENT_TABS = [
  { tab: 'personal', icon: User, label: 'ข้อมูลส่วนบุคคล' },
  { tab: 'family', icon: Users, label: 'ข้อมูลครอบครัว' },
  { tab: 'insurance', icon: Shield, label: 'ข้อมูลการประกัน' },
  { tab: 'investment', icon: TrendingUp, label: 'ข้อมูลสินทรัพย์-หนี้สิน' },
  { tab: 'finance', icon: Wallet, label: 'งบการเงินส่วนบุคคล' },
  { tab: 'goals', icon: Target, label: 'เป้าหมายทางการเงิน' },
  { tab: 'risk', icon: Activity, label: 'ประเมินความเสี่ยง' },
]
// เมนูย่อยของ "วางแผนการเงิน"
const FINANCIAL_TABS = [
  { tab: 'investment', icon: TrendingUp, label: 'มูลค่าสินทรัพย์ลงทุน' },
  { tab: 'social', icon: Shield, label: 'กองทุนประกันสังคม' },
  { tab: 'pvd', icon: Briefcase, label: 'กองทุนสำรองเลี้ยงชีพ' },
  { tab: 'severance', icon: Scale, label: 'เงินชดเชยเกษียณอายุ' },
  { tab: 'education', icon: GraduationCap, label: 'ทุนการศึกษาบุตร' },
  { tab: 'insurance', icon: HeartPulse, label: 'วางแผนประกัน' },
  { tab: 'retirement', icon: Target, label: 'วางแผนเกษียณ' },
  { tab: 'estate', icon: ScrollText, label: 'วางแผนมรดก' },
]
// พาธที่มีเมนูย่อย
const EXPANDABLE: Record<string, { tabs: typeof CLIENT_TABS; first: string }> = {
  '/client': { tabs: CLIENT_TABS, first: 'personal' },
  '/financial-plan': { tabs: FINANCIAL_TABS, first: 'investment' },
}

const menuItem: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '8px 6px', background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text-secondary)', fontSize: 12.5, textAlign: 'left', borderRadius: 6,
}

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/client', icon: ClipboardList, label: 'ข้อมูลลูกค้า' },
  { to: '/financial-plan', icon: Target, label: 'วางแผนการเงิน' },
  { to: '/action-plan', icon: ClipboardCheck, label: 'แผนปฏิบัติการ' },
  { to: '/tax', icon: Calculator, label: 'วางแผนภาษี' },
  { to: '/forward-cashflow', icon: CalendarRange, label: 'งบการเงินล่วงหน้า' },
  { to: '/calculator', icon: Calculator, label: 'เครื่องคิดเลข' },
  { to: '/settings', icon: Settings, label: 'สมมติฐาน' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { selectedClient, setSelectedClient } = useClient()
  const navigate = useNavigate()
  const location = useLocation()
  const currentPath = location.pathname
  const currentTab = new URLSearchParams(location.search).get('tab') || ''
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => ({ [currentPath]: true }))
  const setMenuOpen = (path: string, v: boolean | ((o: boolean) => boolean)) =>
    setOpenMenus(m => ({ ...m, [path]: typeof v === 'function' ? v(!!m[path]) : v }))
  useEffect(() => { if (EXPANDABLE[currentPath]) setOpenMenus(m => ({ ...m, [currentPath]: true })) }, [currentPath])
  const initial = user?.name?.charAt(0).toUpperCase() ?? '?'
  // รูปโปรไฟล์ FA (base64) จาก advisor-profile — ถ้ามีใช้รูป ไม่มีใช้ตัวอักษร
  const { data: advProfile } = useQuery<any>({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const photo: string | undefined = advProfile?.photo || undefined
  const avatarInner = photo
    ? <img src={photo} alt="โปรไฟล์" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : initial
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [railMenu, setRailMenu] = useState<{ to: string; top: number } | null>(null)  // flyout เมนูย่อยตอนหดเมนู
  const [q, setQ] = useState('')  // ค้นหาลูกค้าบน topbar (โหมดภาพรวม)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sb_collapsed') === '1')
  const [vw, setVw] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1280)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => { localStorage.setItem('sb_collapsed', collapsed ? '1' : '0') }, [collapsed])

  // ── โหมดตามความกว้างจอ ──
  const isMobile = vw < 600            // มือถือ → hamburger + drawer
  const autoRail = vw >= 600 && vw < 1024   // tablet แนวตั้ง → ไอคอนล้วน
  const rail = !isMobile && (collapsed || autoRail)  // sidebar ไอคอนล้วน
  const canToggle = !isMobile && !autoRail           // ปุ่มพับใช้ได้เฉพาะจอกว้าง
  const sidebarW = rail ? 68 : 236

  function clearClient() {
    setSelectedClient(null)
    sessionStorage.removeItem('selected_client_id')
    sessionStorage.removeItem('selected_client_name')
    sessionStorage.removeItem('selected_client_email')
  }
  function switchClient() { clearClient(); navigate('/clients') }
  // ค้นหาลูกค้า (แสดงบน topbar เมื่อยังไม่เลือกลูกค้า)
  const showSearch = isAdmin && !selectedClient
  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ['client-search', q],
    queryFn: () => api.get('/clients', { params: { q } }).then(r => r.data),
    enabled: showSearch && q.trim().length > 0,
  })
  function pickClient(c: any) {
    setSelectedClient(c)
    sessionStorage.setItem('selected_client_id', c.id)
    sessionStorage.setItem('selected_client_name', c.name)
    sessionStorage.setItem('selected_client_email', c.email)
    setQ(''); navigate('/')
  }
  function goOverview() { if (isAdmin) clearClient(); navigate('/'); setDrawerOpen(false) }

  const navLinks = nav

  const linkStyle = (isActive: boolean, asRail: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: asRail ? 0 : 12,
    justifyContent: asRail ? 'center' : 'flex-start',
    padding: asRail ? '12px 0' : '11px 14px', borderRadius: 10,
    fontSize: 13.5, fontWeight: isActive ? 600 : 400,
    color: isActive ? 'var(--cyan-light)' : 'var(--text-secondary)',
    background: isActive ? 'var(--cyan-dim)' : 'transparent',
    textDecoration: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
  })

  // เมนูแบบมีเมนูย่อย (ข้อมูลลูกค้า / วางแผนการเงิน) — คลี่ลงมาแบบ stagger
  const renderExpandable = (asRail: boolean, to: string, Icon: any, label: string) => {
    const cfg = EXPANDABLE[to]
    const open = !!openMenus[to]
    const onPage = currentPath === to
    const effTab = currentTab || cfg.first
    return (
      <div key={to}>
        <button
          onClick={(e) => {
            if (asRail) {
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setRailMenu(m => m?.to === to ? null : { to, top: r.top })   // rail: เด้ง flyout เมนูย่อย
            } else setMenuOpen(to, o => !o)                                 // เต็ม: คลิกที่ไหนก็ได้ = คลี่/หด
          }}
          title={asRail ? label : undefined}
          style={{ ...linkStyle(onPage, asRail), width: '100%', border: 'none', cursor: 'pointer' }}>
          <Icon size={18} />
          {!asRail && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
          {!asRail && <ChevronDown size={15} style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }} />}
        </button>
        {!asRail && (
          <div style={{ overflow: 'hidden', maxHeight: open ? 600 : 0, transition: 'max-height 0.4s ease' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 2, paddingLeft: 10 }}>
              {cfg.tabs.map(({ tab, icon: TIcon, label: tl }, i) => {
                const activeSub = onPage && effTab === tab
                const delay = open ? i * 0.045 : 0
                return (
                  <button key={tab} onClick={() => { navigate(`${to}?tab=${tab}`); setDrawerOpen(false) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, textAlign: 'left', whiteSpace: 'nowrap',
                      color: activeSub ? 'var(--cyan-light)' : 'var(--text-muted)', background: activeSub ? 'var(--cyan-dim)' : 'transparent',
                      opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-8px)',
                      transition: `opacity 0.28s ease ${delay}s, transform 0.28s ease ${delay}s` }}>
                    <TIcon size={15} />{tl}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Sidebar (ใช้ทั้งแบบตายตัวและ drawer) ──
  const Sidebar = ({ asRail }: { asRail: boolean }) => (
    <>
      {/* Logo */}
      <button onClick={goOverview} title="ภาพรวมนักวางแผน"
        style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: asRail ? 'center' : 'flex-start', height: 56, padding: asRail ? 0 : '0 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', flexShrink: 0 }}>
        <img src="/icon-192.png" alt="WealthPro" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
        {!asRail && <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></span>}
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: asRail ? '10px 8px' : '12px 12px', overflowY: 'auto' }}>
        {navLinks.map(({ to, icon: Icon, label }) => {
          // เมนูที่มีเมนูย่อย (ข้อมูลลูกค้า / วางแผนการเงิน)
          if (EXPANDABLE[to]) return renderExpandable(asRail, to, Icon, label)
          return (
            <NavLink key={to} to={to} end={to === '/'} title={asRail ? label : undefined}
              onClick={() => setDrawerOpen(false)}
              style={({ isActive }) => linkStyle(isActive, asRail)}>
              <Icon size={18} />{!asRail && label}
            </NavLink>
          )
        })}
      </nav>

      {/* ปรับแต่งข้อมูลผู้ใช้ — ล่างสุด */}
      <div style={{ borderTop: '1px solid var(--card-border)', padding: asRail ? '8px 8px 4px' : '8px 12px 4px' }}>
        <NavLink to="/user-profile" title={asRail ? 'ปรับแต่งข้อมูลผู้ใช้' : undefined}
          onClick={() => setDrawerOpen(false)}
          style={({ isActive }) => linkStyle(isActive, asRail)}>
          <UserCog size={18} />{!asRail && 'ปรับแต่งข้อมูลผู้ใช้'}
        </NavLink>
      </div>

      {/* Collapse toggle (จอกว้างเท่านั้น) */}
      {canToggle && (
        <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'ขยายเมนู' : 'พับเมนู'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: asRail ? 'center' : 'flex-start', gap: 8, padding: asRail ? '12px 0' : '11px 16px', margin: 8, borderRadius: 10, background: 'none', border: '1px solid var(--card-border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5 }}>
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> พับเมนู</>}
        </button>
      )}

      {/* เอกสารกฎหมาย (เหนือ copyright) */}
      <button onClick={() => { navigate('/privacy'); setDrawerOpen(false) }} title="นโยบายความเป็นส่วนตัว"
        style={{ display: 'flex', alignItems: 'center', justifyContent: asRail ? 'center' : 'flex-start', gap: 7, padding: asRail ? '6px 4px 2px' : '6px 16px 2px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11.5, width: '100%', flexShrink: 0 }}>
        <ScrollText size={13} />{!asRail && 'นโยบายความเป็นส่วนตัว'}
      </button>
      <button onClick={() => { navigate('/terms'); setDrawerOpen(false) }} title="ข้อกำหนดการใช้บริการ"
        style={{ display: 'flex', alignItems: 'center', justifyContent: asRail ? 'center' : 'flex-start', gap: 7, padding: asRail ? '2px 4px' : '2px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11.5, width: '100%', flexShrink: 0 }}>
        <FileText size={13} />{!asRail && 'ข้อกำหนดการใช้บริการ'}
      </button>

      {/* Copyright — ล่างสุด เห็นทุกหน้า */}
      <div style={{ padding: asRail ? '4px 4px 12px' : '2px 16px 12px', fontSize: 10, lineHeight: 1.5, color: 'var(--text-muted)', textAlign: asRail ? 'center' : 'left', flexShrink: 0 }}>
        {asRail
          ? `© ${new Date().getFullYear()}`
          : <>© {new Date().getFullYear()} Ultimate Life<br />Advisor Co., Ltd.</>}
      </div>
    </>
  )

  const iconBtn: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 7, borderRadius: 8, transition: 'color 0.15s' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-900)', display: 'flex' }}>

      {/* ── Fixed sidebar (จอ ≥ 600px) ── */}
      {!isMobile && (
        <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: sidebarW, background: 'var(--navy-950)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', zIndex: 50, transition: 'width 0.2s', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          {Sidebar({ asRail: rail })}
        </aside>
      )}

      {/* ── Flyout เมนูย่อย (เฉพาะตอนหดเมนู/rail) ── */}
      {rail && railMenu && EXPANDABLE[railMenu.to] && (
        <>
          <div onClick={() => setRailMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'fixed', left: sidebarW + 6, top: Math.max(8, Math.min(railMenu.top, window.innerHeight - 380)), zIndex: 61, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 6, minWidth: 210, maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-muted)', padding: '6px 10px 8px' }}>
              {nav.find(n => n.to === railMenu.to)?.label}
            </div>
            {EXPANDABLE[railMenu.to].tabs.map(({ tab, icon: TIcon, label: tl }) => {
              const activeSub = currentPath === railMenu.to && (currentTab || EXPANDABLE[railMenu.to].first) === tab
              return (
                <button key={tab} onClick={() => { navigate(`${railMenu.to}?tab=${tab}`); setRailMenu(null); setDrawerOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left', whiteSpace: 'nowrap',
                    color: activeSub ? 'var(--cyan-light)' : 'var(--text-secondary)', background: activeSub ? 'var(--cyan-dim)' : 'transparent' }}>
                  <TIcon size={15} />{tl}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* ── Mobile drawer ── */}
      {isMobile && drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 236, background: 'var(--navy-950)', borderRight: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', zIndex: 100, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            {Sidebar({ asRail: false })}
          </aside>
        </>
      )}

      {/* ── Main column ── */}
      <div style={{ minWidth: 0, marginLeft: isMobile ? 0 : sidebarW, width: isMobile ? '100%' : `calc(100% - ${sidebarW}px)`, transition: 'margin-left 0.2s, width 0.2s' }}>

        {/* Topbar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--navy-950)', borderBottom: '1px solid var(--card-border)', height: 'calc(56px + env(safe-area-inset-top, 0px))', paddingTop: 'env(safe-area-inset-top, 0px)', display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 16, boxSizing: 'border-box' }}>
          {isMobile && (
            <button onClick={() => setDrawerOpen(true)} title="เมนู" aria-label="เมนู" style={iconBtn}>
              <Menu size={20} />
            </button>
          )}
          {isMobile && (
            <button onClick={goOverview} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <img src="/icon-192.png" alt="WealthPro" style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></span>
            </button>
          )}

          {/* Selected client indicator */}
          {isAdmin && selectedClient ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>กำลังดู:</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClient.name}</span>
              <button onClick={switchClient} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', borderRadius: 8, color: 'var(--cyan)', fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
                <RefreshCw size={12} />เปลี่ยนลูกค้า
              </button>
            </div>
          ) : isAdmin ? (
            <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', borderRadius: 8, color: 'var(--cyan)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
              <Users size={13} /> เลือกลูกค้า
            </button>
          ) : null}

          {/* Client search — บน topbar เมื่อยังไม่เลือกลูกค้า */}
          {showSearch && !isMobile && (
            <div style={{ position: 'relative', flex: '0 1 340px', minWidth: 0 }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาลูกค้า (ชื่อ / อีเมล)..."
                style={{ width: '100%', height: 34, padding: '0 12px 0 33px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }} />
              {q.trim().length > 0 && (
                <>
                  <div onClick={() => setQ('')} style={{ position: 'fixed', inset: 0, zIndex: 45 }} />
                  <div style={{ position: 'absolute', top: 40, left: 0, right: 0, zIndex: 46, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: 'var(--shadow)', maxHeight: 340, overflowY: 'auto', padding: 6 }}>
                    {searchResults.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text-muted)' }}>ไม่พบลูกค้า "{q}"</div>
                    ) : searchResults.map((c: any) => (
                      <button key={c.id} onClick={() => pickClient(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--cyan)', flexShrink: 0 }}>{(c.name || '?').charAt(0).toUpperCase()}</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                        </div>
                        <ArrowRight size={14} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Right controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* slot สำหรับปุ่ม action เฉพาะหน้า (เช่น สลับลูกค้า/คู่สมรส, ชิป PDPA) */}
            <div id="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }} />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setProfileOpen(o => !o)} title="โปรไฟล์"
                style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: 'var(--cyan-dim)', border: '1.5px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--cyan)', cursor: 'pointer', padding: 0 }}>
                {avatarInner}
              </button>
              {profileOpen && (
                <>
                  <div onClick={() => setProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
                  <div style={{ position: 'absolute', top: 40, right: 0, zIndex: 70, minWidth: 220, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: 'var(--shadow)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--cyan-dim)', border: '1.5px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--cyan)' }}>{avatarInner}</div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                      </div>
                    </div>
                    {user?.role && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>สิทธิ์: {user.role}</div>}
                    <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0 4px' }} />
                    <button onClick={() => { setProfileOpen(false); navigate('/guide') }} style={menuItem}>
                      <BookOpen size={15} /> คู่มือการใช้งาน
                    </button>
                    {isAdmin && (
                      <button onClick={() => { setProfileOpen(false); navigate('/audit-log') }} style={menuItem}>
                        <ScrollText size={15} /> บันทึกการเข้าถึงข้อมูล
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button onClick={() => { setProfileOpen(false); navigate('/admin') }} style={{ ...menuItem, color: '#f59e0b' }}>
                        <ShieldCheck size={15} /> อนุมัตินักวางแผน
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title={theme === 'light' ? 'โหมดมืด' : 'โหมดสว่าง'}
              style={iconBtn}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={logout} title="ออกจากระบบ" style={iconBtn}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page content — เต็มความกว้าง ชิดขอบเมนู (ไม่จัดกึ่งกลาง) */}
        <main style={{ padding: isMobile ? '20px 14px' : '24px 28px' }}>
          {children}
        </main>
      </div>
      <CopilotWidget />
    </div>
  )
}
