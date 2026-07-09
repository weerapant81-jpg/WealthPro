import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useClient, type ClientInfo } from '../context/ClientContext'
import { Landmark, Wallet, Users, CheckCircle2, ChevronRight, Search } from 'lucide-react'
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
        </div>
      </div>

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

      {/* ข่าวสารจากผู้ให้บริการ */}
      <NewsWidget />
    </div>
  )
}
