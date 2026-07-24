import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { Wallet, TrendingUp, ClipboardCheck, CalendarClock, ChevronRight } from 'lucide-react'

const fmt = (n: number) => Math.round(n).toLocaleString('th-TH')
const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 18 }

function scoreColor(s: number | null) {
  if (s == null) return 'var(--text-muted)'
  return s >= 80 ? '#10b981' : s >= 60 ? 'var(--cyan)' : s >= 40 ? '#f59e0b' : '#f43f5e'
}

// วงแหวนคะแนนสุขภาพการเงิน (SVG เบา ๆ)
function Ring({ value }: { value: number | null }) {
  const size = 132, sw = 12, r = (size - sw) / 2, c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const col = scoreColor(value)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--card-border)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize="30" fontWeight="800" fill={col}>{value ?? '—'}</text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="var(--text-muted)">/ 100</text>
    </svg>
  )
}

export default function PortalHome() {
  const navigate = useNavigate()
  const { data: ratio } = useQuery({ queryKey: ['financial-ratios'], queryFn: () => api.get('/financial-ratios').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: assumptions } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: actions } = useQuery({ queryKey: ['action-items'], queryFn: () => api.get('/action-items').then(r => r.data), retry: false })

  const s = ratio?.summary
  const healthScore: number | null = ratio?.healthScore ?? null
  const healthLabel: string = ratio?.healthLabel ?? '—'
  const firstName = profile?.firstName ? `คุณ${profile.firstName}` : 'สวัสดี'

  // ความคืบหน้าแผนปฏิบัติการ — นับจากแถวย่อย (subPlan) ที่ทำเสร็จ
  let done = 0, total = 0
  for (const it of (actions ?? [])) {
    const rows = Array.isArray(it.subPlan) ? it.subPlan : []
    if (rows.length) { total += rows.length; done += rows.filter((r: any) => r?.done).length }
    else { total += 1; if (it.status === 'done') done += 1 }
  }
  const pct = total ? Math.round((done / total) * 100) : 0

  const reviewDate = assumptions?.planReviewDate
    ? new Date(assumptions.planReviewDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>{firstName}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>ภาพรวมแผนการเงินของคุณ</div>
      </div>

      {/* สุขภาพการเงิน */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring value={healthScore} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>คะแนนสุขภาพการเงิน</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(healthScore), margin: '2px 0 8px' }}>{healthLabel}</div>
          {ratio?.categoryScores && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span>สภาพคล่อง · {ratio.categoryScores.liquidity?.label ?? '—'}</span>
              <span>ภาระหนี้ · {ratio.categoryScores.debt?.label ?? '—'}</span>
              <span>การออม · {ratio.categoryScores.savings?.label ?? '—'}</span>
            </div>
          )}
        </div>
      </div>

      {/* สินทรัพย์ / ความมั่งคั่ง */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <Wallet size={18} color="var(--cyan)" />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>สินทรัพย์รวม</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(s?.totalAssets ?? 0)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
        </div>
        <div style={card}>
          <TrendingUp size={18} color={(s?.netWorth ?? 0) >= 0 ? '#10b981' : '#f43f5e'} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>ความมั่งคั่งสุทธิ</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: (s?.netWorth ?? 0) >= 0 ? '#10b981' : '#f43f5e' }}>{fmt(s?.netWorth ?? 0)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
        </div>
      </div>

      {/* ความคืบหน้าแผนปฏิบัติการ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ClipboardCheck size={18} color="var(--cyan)" />
          <span style={{ fontSize: 14, fontWeight: 800 }}>ความคืบหน้าแผนดำเนินการ</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: 'var(--cyan)' }}>{pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 6, background: 'var(--navy-900)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cyan)', borderRadius: 6, transition: 'width .4s' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>ทำแล้ว {done} จาก {total} รายการ</div>
      </div>

      {/* นัดทบทวนถัดไป */}
      {reviewDate && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CalendarClock size={20} color="var(--cyan)" />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>นัดทบทวนแผนถัดไป</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{reviewDate}</div>
          </div>
        </div>
      )}

      <button onClick={() => navigate('/portal/plan')}
        style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', width: '100%', color: 'var(--text-primary)' }}>
        <TrendingUp size={18} color="var(--cyan)" />
        <span style={{ fontSize: 14, fontWeight: 700 }}>ดูกราฟแผนการเงินของคุณ</span>
        <ChevronRight size={18} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
      </button>
    </div>
  )
}
