import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useClient, type ClientInfo } from '../context/ClientContext'
import { Landmark, Wallet, Users, CheckCircle2, ChevronRight, Search, Circle, X, Rocket, ArrowRight, ShieldAlert, UserPlus, Gamepad2, ExternalLink
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsCompact } from '../hooks/useViewport'
import { AppointmentsWidget, TasksWidget, NewsWidget } from '../components/AdvisorWidgets'

const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }

export default function AdvisorDashboard() {
  const compact = useIsCompact()
  const navigate = useNavigate()
  const { setSelectedClient } = useClient()
  const { data } = useQuery<any>({ queryKey: ['advisor-summary'], queryFn: () => api.get('/advisor/summary').then(r => r.data), retry: false })

  // ── ค้นหา + เลือกลูกค้าในตัวแดชบอร์ด ──
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const { data: results = [] } = useQuery<ClientInfo[]>({
    queryKey: ['clients', q],
    queryFn: () => api.get('/clients', { params: { q } }).then(r => r.data),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
  })
  const pickClient = (c: ClientInfo) => {
    setSelectedClient(c)
    sessionStorage.setItem('selected_client_id', c.id)
    sessionStorage.setItem('selected_client_name', c.name)
    sessionStorage.setItem('selected_client_email', c.email)
    navigate('/')
  }

  const s = data ?? { clientCount: 0, activePlans: 0, totalAUM: 0, totalNetWorth: 0, totalDebt: 0, topClients: [] }

  const KPI =({ icon: Icon, t, v, unit, color, onClick }: { icon: any; t: string; v: string; unit?: string; color?: string; onClick?: () => void }) => (
    <div onClick={onClick} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8, cursor: onClick ? 'pointer' : 'default', transition: 'transform .12s, border-color .15s' }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--cyan)' } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--card-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={label}>{t}</span>
        <Icon size={18} color="var(--cyan)" />
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--text-primary)', fontFamily: 'monospace', margin: 0 }}>{v} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{unit}</span></p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>ภาพรวมนักวางแผน</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>สรุปพอร์ตลูกค้าทั้งหมดในความดูแล · เลือกลูกค้าเพื่อดูรายละเอียด</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 280, maxWidth: '70vw' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={q} onChange={e => setQ(e.target.value)}
              onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
              placeholder="ค้นหาลูกค้า (ชื่อ/อีเมล)..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px 9px 36px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            {focus && q.trim() && (
              <div style={{ position: 'absolute', top: 44, left: 0, right: 0, zIndex: 30, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, boxShadow: 'var(--shadow)', maxHeight: 320, overflowY: 'auto' }}>
                {results.length === 0 ? (
                  <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--text-muted)' }}>ไม่พบลูกค้า “{q}”</div>
                ) : results.map(c => (
                  <button key={c.id} onMouseDown={() => pickClient(c)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--divider)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>{(c.name || c.email).charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || c.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</div>
                    </div>
                    <ChevronRight size={14} color="var(--cyan)" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => navigate('/clients')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--cyan)', color: '#00201d', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Users size={16} /> ลูกค้าทั้งหมด
          </button>
          <button onClick={() => navigate('/clients?new=1')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'transparent', color: 'var(--cyan)', border: '1px solid var(--cyan)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <UserPlus size={16} /> สร้างลูกค้าใหม่
          </button>
        </div>
      </div>

      <SecurityBanner />
      <WelcomeChecklist />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <KPI icon={Landmark} t="สินทรัพย์รวม (AUM)" v={fmt(s.totalAUM)} unit="บาท" color="var(--cyan-light)" onClick={() => navigate('/clients')} />
        <KPI icon={Wallet} t="ความมั่งคั่งสุทธิรวม" v={fmt(s.totalNetWorth)} unit="บาท" color={s.totalNetWorth >= 0 ? '#10b981' : '#f43f5e'} onClick={() => navigate('/clients')} />
        <KPI icon={Users} t="จำนวนลูกค้า" v={fmt(s.clientCount)} unit="ราย" onClick={() => navigate('/clients')} />
        <KPI icon={CheckCircle2} t="แผนที่ใช้งาน" v={fmt(s.activePlans)} unit="แผน" color="#10b981" onClick={() => navigate('/clients')} />
      </div>

      {/* Row: ปฏิทิน | นัดหมายที่จะถึง | รายการงาน (สามคอลัมน์เท่ากันโดยธรรมชาติ) */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '2fr minmax(280px, 1fr)', gap: 16, alignItems: 'stretch' }}>
        <AppointmentsWidget />
        <TasksWidget />
      </div>

      {/* Lead จากเกมเศรษฐี */}
      <GameLeadsWidget />

      {/* ข่าวสารจากผู้ให้บริการ */}
      <NewsWidget />
    </div>
  )
}

/* ── ผู้เล่น "เกมเศรษฐี" ที่ฝากช่องทางติดต่อไว้ (lead จาก /game) ── */
function GameLeadsWidget() {
  const { data: leads = [], refetch } = useQuery<any[]>({
    queryKey: ['game-leads'],
    queryFn: () => api.get('/game/leads').then(r => r.data),
    retry: false,
  })
  const markContacted = async (id: string, contacted: boolean) => {
    await api.put(`/game/leads/${id}`, { contacted })
    refetch()
  }
  const pending = leads.filter(l => !l.contacted).length
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Gamepad2 size={18} color="var(--gold)" />
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>ผู้เล่นเกมเศรษฐีที่สนใจรับคำปรึกษา</span>
        {pending > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#1a1200', background: 'var(--gold)', borderRadius: 20, padding: '2px 9px' }}>{pending} รอติดต่อ</span>
        )}
        <a href="/game" target="_blank" rel="noreferrer"
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--cyan)', fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
          เปิดเกม / แชร์ให้ลูกค้า <ExternalLink size={13} />
        </a>
      </div>
      {leads.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
          ยังไม่มี lead — แชร์ลิงก์ <b>/game</b> ให้ลูกค้าหรือกลุ่มไลน์ ผู้เล่นที่กรอกฟอร์มท้ายเกมจะมาปรากฏที่นี่
        </div>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {leads.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: l.contacted ? 'transparent' : 'var(--navy-900)', opacity: l.contacted ? 0.6 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {l.name} <span style={{ fontWeight: 600, color: 'var(--cyan)' }}>· {l.contact}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                  {l.career ?? '—'} · เกรด {l.grade ?? '—'} ({l.score ?? '—'}/100)
                  {l.result?.fundedAge != null && ` · เงินพอถึงอายุ ${l.result.fundedAge >= 100 ? '100+' : l.result.fundedAge}`}
                  {' · '}{new Date(l.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button onClick={() => markContacted(l.id, !l.contacted)}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${l.contacted ? 'var(--card-border)' : 'var(--cyan)'}`,
                  background: l.contacted ? 'transparent' : 'var(--cyan-dim)',
                  color: l.contacted ? 'var(--text-muted)' : 'var(--cyan)' }}>
                {l.contacted ? 'ติดต่อแล้ว ✓' : 'ติดต่อกลับ'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── แบนเนอร์เตือนเปิด 2FA — เตือนทุกครั้งที่ 2FA ยังปิด (ปิดได้แค่ราย session → เตือนซ้ำรอบหน้า) ── */
function SecurityBanner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('wp_2fa_dismissed') === '1')
  const { data: tfa } = useQuery<any>({ queryKey: ['2fa-status'], queryFn: () => api.get('/auth/2fa/status').then(r => r.data), retry: false })
  if (dismissed || tfa == null || tfa.enabled) return null
  const isSuper = user?.role === 'SUPER_ADMIN'
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      background: 'linear-gradient(150deg, rgba(245,158,11,0.14), var(--card-bg) 60%)', border: '1px solid #f59e0b' }}>
      <ShieldAlert size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>
          บัญชีนี้ยังไม่ได้เปิดการยืนยันตัวตน 2 ชั้น (2FA)
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
          {isSuper
            ? 'บัญชีผู้ดูแลระบบมีสิทธิ์สูง — แนะนำอย่างยิ่งให้เปิด 2FA เพื่อกันการเข้าถึงโดยไม่ได้รับอนุญาต'
            : 'เพิ่มความปลอดภัยให้บัญชีและข้อมูลลูกค้า — ใช้เวลาตั้งค่าไม่ถึง 1 นาที'}
        </div>
      </div>
      <button onClick={() => navigate('/user-profile')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#f59e0b', color: '#1a1200', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
        เปิด 2FA <ArrowRight size={15} />
      </button>
      <button onClick={() => { sessionStorage.setItem('wp_2fa_dismissed', '1'); setDismissed(true) }} title="ปิดชั่วคราว"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}

/* ── Welcome checklist — แสดงจนกว่าจะทำครบหรือกดปิด ── */
function WelcomeChecklist() {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('wp_onboard_dismissed') === '1')
  const { data: adv } = useQuery<any>({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const { data: clients } = useQuery<any[]>({ queryKey: ['clients', ''], queryFn: () => api.get('/clients').then(r => r.data), retry: false })
  const { data: tfa } = useQuery<any>({ queryKey: ['2fa-status'], queryFn: () => api.get('/auth/2fa/status').then(r => r.data), retry: false })

  const steps = [
    { done: !!adv?.fullName?.trim(), label: 'ตั้งค่าโปรไฟล์ผู้ใช้', sub: 'ชื่อ รูป และใบอนุญาต สำหรับแสดงในรายงาน', to: '/user-profile' },
    { done: (clients?.length ?? 0) > 0, label: 'สร้างลูกค้าคนแรก', sub: 'เริ่มบันทึกข้อมูลและวางแผนให้ลูกค้า', to: '/clients' },
    { done: !!tfa?.enabled, label: 'เปิดยืนยันตัวตน 2 ชั้น (2FA)', sub: 'เพิ่มความปลอดภัยให้บัญชี', to: '/user-profile' },
  ]
  const doneCount = steps.filter(s => s.done).length
  if (dismissed || doneCount === steps.length) return null

  return (
    <div style={{ ...card, background: 'linear-gradient(150deg, var(--cyan-dim), var(--card-bg) 55%)', border: '1px solid var(--cyan)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Rocket size={18} color="var(--cyan)" />
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>เริ่มต้นใช้งาน WealthPro</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>({doneCount}/{steps.length})</span>
        <button onClick={() => { localStorage.setItem('wp_onboard_dismissed', '1'); setDismissed(true) }} title="ปิด"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => navigate(s.to)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: s.done ? 'transparent' : 'var(--navy-900)', cursor: 'pointer', textAlign: 'left', opacity: s.done ? 0.7 : 1 }}>
            {s.done ? <CheckCircle2 size={20} color="#10b981" style={{ flexShrink: 0 }} /> : <Circle size={20} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
            {!s.done && <ArrowRight size={16} color="var(--cyan)" style={{ flexShrink: 0 }} />}
          </button>
        ))}
      </div>
      <button onClick={() => navigate('/guide')}
        style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--cyan)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
        อ่านคู่มือการใช้งานฉบับเต็ม <ArrowRight size={13} />
      </button>
    </div>
  )
}
