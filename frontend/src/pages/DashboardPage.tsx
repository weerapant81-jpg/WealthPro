import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hasSpouseInfo } from '../lib/spouse'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import {
  User, Users, FileText, Landmark, TrendingUp, ShieldCheck, GraduationCap,
  Receipt, FileDown,
  Target, ScrollText, ArrowRight, Camera, Trash2, ClipboardCheck, Wallet, Scale, CalendarRange,
} from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useAuth } from '../context/AuthContext'
import InvestmentMonteCarloChart from '../components/InvestmentMonteCarloChart'
import InsuranceCoverageSummary from '../components/InsuranceCoverageSummary'
import { useClient } from '../context/ClientContext'
import AdvisorDashboard from './AdvisorDashboard'

type Person = 'client' | 'spouse'

const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n || 0))
const cM = (n: number) => (n || 0) >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : `฿${fmt(n)}`

/* ย่อรูปเป็น JPEG ≤ 400px แล้วคืน dataURL */
function resizePhoto(file: File, cb: (dataUrl: string) => void) {
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const max = 400
      let { width, height } = img
      if (width > height && width > max) { height = height * max / width; width = max }
      else if (height > max) { width = width * max / height; height = max }
      const cv = document.createElement('canvas')
      cv.width = width; cv.height = height
      cv.getContext('2d')!.drawImage(img, 0, 0, width, height)
      cb(cv.toDataURL('image/jpeg', 0.82))
    }
    img.src = reader.result as string
  }
  reader.readAsDataURL(file)
}

const RATIO_META: Record<string, { name: string; unit: 'times' | 'months' | 'pct' }> = {
  ratio1: { name: 'สภาพคล่อง', unit: 'times' },
  ratio2: { name: 'สภาพคล่องพื้นฐาน', unit: 'months' },
  ratio3: { name: 'สภาพคล่องต่อความมั่งคั่ง', unit: 'pct' },
  ratio4: { name: 'หนี้สินต่อสินทรัพย์', unit: 'pct' },
  ratio5: { name: 'ชำระหนี้จากรายได้', unit: 'pct' },
  ratio6: { name: 'หนี้ไม่จดจำนอง', unit: 'pct' },
  ratio7: { name: 'การออม', unit: 'pct' },
  ratio8: { name: 'การลงทุน', unit: 'pct' },
}

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }
const label: React.CSSProperties = { fontSize: 16.5, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }

/* ── circular gauge ── */
function Gauge({ value, size = 150, color = 'var(--cyan)', sub }: { value: number | null; size?: number; color?: string; sub?: string }) {
  const r = 45, C = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: size, height: size }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--navy-900)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={value == null ? 'var(--navy-900)' : color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.26, fontWeight: 800, color: value == null ? 'var(--text-muted)' : color, fontFamily: 'monospace' }}>{value == null ? '—' : value}</span>
        {sub && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{sub}</span>}
      </div>
    </div>
  )
}

/* ── สถานะความพร้อม (ไฟจราจร) ── */
function statusOf(pct: number | null): { color: string; text: string } {
  if (pct == null) return { color: 'var(--text-muted)', text: 'ยังไม่มีข้อมูล' }
  if (pct >= 100) return { color: '#10b981', text: 'เพียงพอ' }
  if (pct >= 60) return { color: '#ffb800', text: 'ควรเพิ่ม' }
  return { color: '#f4526b', text: 'เร่งด่วน' }
}

/* ── การ์ดความพร้อมต่อเป้าหมาย (คลิกดูรายละเอียด) ── */
function GoalCard({ icon: Icon, title, accent, statusText, pct, big, bigColor, line1, line2, onClick, dashed }: {
  icon: React.ElementType; title: string; accent: string; statusText: string
  pct?: number | null; big: string; bigColor: string; line1?: React.ReactNode; line2?: React.ReactNode
  onClick?: () => void; dashed?: boolean
}) {
  const clickable = !!onClick
  return (
    <button onClick={onClick} disabled={!clickable}
      style={{ textAlign: 'left', background: dashed ? 'var(--navy-950)' : 'var(--card-bg)', border: `1px ${dashed ? 'dashed' : 'solid'} var(--card-border)`, borderLeft: `3px solid ${accent}`, borderRadius: 16, padding: 16, cursor: clickable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 0, transition: 'transform 0.12s, border-color 0.15s' }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = accent } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderLeftColor = accent; e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.borderLeftColor = accent }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={accent} />
        </div>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: accent, background: `${accent}22`, padding: '2px 8px', borderRadius: 99 }}>{statusText}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: bigColor, lineHeight: 1.05, fontFamily: 'monospace' }}>{big}</div>
      {pct != null
        ? <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,.08)', margin: '8px 0 6px' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 4, background: accent }} />
          </div>
        : <div style={{ height: 6, margin: '8px 0 6px' }} />}
      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', minHeight: 15 }}>{line1}</div>
      <div style={{ fontSize: 11, color: accent, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4, minHeight: 16 }}>{line2}</div>
    </button>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { selectedClient } = useClient()
  // นักวางแผน (ADMIN/SUPER_ADMIN) ที่ยังไม่เลือกลูกค้า → ภาพรวมนักวางแผน · เลือกลูกค้าแล้ว → แดชบอร์ดลูกค้า
  if ((user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && !selectedClient) return <AdvisorDashboard />
  return <ClientDashboard />
}

function ClientDashboard() {
  const compact = useIsCompact()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [person, setPerson] = useState<Person>('client')
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const showSpouse = hasSpouseInfo(clientProfile)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('client') }, [showSpouse, person])
  const photoSrc: string | undefined = person === 'client' ? clientProfile?.photo : clientProfile?.spouseProfile?.photo
  const savePhoto = useMutation({
    mutationFn: (dataUrl: string | null) => person === 'client'
      ? api.put('/client-profile', { photo: dataUrl })
      : api.put('/client-profile', { spouseProfile: { ...(clientProfile?.spouseProfile ?? {}), photo: dataUrl } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-profile'] }),
  })
  const { data: profileData } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: ratioData } = useQuery({
    queryKey: ['financial-ratios', person],
    queryFn: () => api.get('/financial-ratios', { params: { person } }).then(r => r.data),
    retry: false,
  })
  const { data: actionData } = useQuery({
    queryKey: ['action-items', person],
    queryFn: () => api.get('/action-items', { params: { person } }).then(r => r.data),
    retry: false,
  })
  const s = ratioData?.summary

  const ret = useRetirementReadiness(person)
  const edu = useEducationReadiness()
  const ins = useInsuranceReadiness(person)

  const clientName = clientProfile?.firstName ? `คุณ${clientProfile.firstName}` : 'ลูกค้า'
  const spouseName = clientProfile?.spouseProfile?.firstName ? `คุณ${clientProfile.spouseProfile.firstName}` : 'คู่สมรส'
  const displayName = person === 'client'
    ? `${clientProfile?.firstName ?? ''} ${clientProfile?.lastName ?? ''}`.trim() || 'ลูกค้า'
    : `${clientProfile?.spouseProfile?.firstName ?? ''} ${clientProfile?.spouseProfile?.lastName ?? ''}`.trim() || 'คู่สมรส'
  const initial = (person === 'client' ? clientProfile?.firstName : clientProfile?.spouseProfile?.firstName)?.charAt(0)?.toUpperCase() ?? '?'
  const age = (() => {
    const b = person === 'client' ? clientProfile?.birthDate : null
    if (person === 'spouse') return clientProfile?.spouseAge ?? null
    if (!b) return null
    return new Date().getFullYear() - new Date(b).getFullYear()
  })()
  const consentSigned = !!(clientProfile?.consent as any)?.signedAt
  // ระดับความเสี่ยง — จากผลประเมิน (client = profile.riskScore, spouse = profile.spouseRisk.riskScore) → 3 ระดับ
  const riskScore: number | null = (person === 'client' ? profileData?.riskScore : profileData?.spouseRisk?.riskScore) ?? null
  const riskLabel = riskScore == null ? 'ยังไม่ประเมิน' : riskScore >= 30 ? 'เสี่ยงสูง' : riskScore >= 22 ? 'เสี่ยงกลาง' : 'เสี่ยงต่ำ'
  const riskColor = riskScore == null ? 'var(--text-muted)' : riskScore >= 30 ? '#f97316' : riskScore >= 22 ? '#f59e0b' : '#10b981'

  const ratios: { key: string; value: number | null; state: string }[] = ratioData?.ratios ?? []
  const advice: Record<string, string | null> = ratioData?.advice ?? {}
  const healthScore: number | null = ratioData?.healthScore ?? null
  const healthLabel: string = ratioData?.healthLabel ?? '—'
  const healthColor = healthScore == null ? 'var(--text-muted)' : healthScore >= 80 ? '#10b981' : healthScore >= 60 ? 'var(--cyan)' : healthScore >= 40 ? '#f59e0b' : '#f43f5e'
  const cat = ratioData?.categoryScores
  const subColor = (sc: number | null | undefined) => sc == null ? 'var(--text-muted)' : sc >= 80 ? '#10b981' : sc >= 60 ? 'var(--cyan)' : sc >= 40 ? '#ffb800' : '#f4526b'

  const debtRatio = ratios.find(r => r.key === 'ratio4')?.value ?? null

  // สรุปแผนดำเนินการ (subPlan) จากหน้าแผนปฏิบัติการ → แผนดำเนินการ · จำนวนเงิน · กำหนดการ
  const CAT_COLOR: Record<string, string> = { liquidity: '#06b6d4', insurance: '#3b82f6', retirement: '#00cfc1', education: '#ffb800', estate: '#a78bfa', tax: '#f59e0b', debt: '#ef4444', savings: '#10b981', other: '#8b9198' }
  const planRows: { desc: string; amount: number | null; schedule: string; owner: string; color: string }[] = []
  for (const it of (actionData?.items ?? [])) {
    const sub = Array.isArray(it.subPlan) ? it.subPlan : []
    for (const r of sub) {
      // แต่ละหมวดใช้ชื่อฟิลด์ต่างกัน: desc (ทั่วไป) / method (สภาพคล่อง) / who (มรดก)
      const desc = String(r?.desc || r?.method || r?.who || '').trim()
      const rawAmt = r?.amount ?? r?.premium ?? r?.sumInsured
      const amount = rawAmt != null && rawAmt !== '' ? Number(String(rawAmt).replace(/,/g, '')) : null
      const schedule = String(r?.schedule || '')
      const owner = String(r?.owner || '').trim()
      if (!desc && amount == null && !schedule) continue
      planRows.push({ desc: desc || it.title, amount, schedule, owner, color: CAT_COLOR[it.category] || CAT_COLOR.other })
    }
  }


  // Action Items — จากคำแนะนำอัตราส่วน + เงื่อนไข
  const actions: { text: string; level: 'danger' | 'warning' }[] = []
  if (!consentSigned) actions.push({ text: 'ยังไม่ได้ลงนามยินยอม PDPA / เงื่อนไขบริการ', level: 'danger' })
  for (const r of ratios) {
    if (r.state === 'danger' || r.state === 'warning') {
      const a = advice[r.key]
      if (a) actions.push({ text: `${RATIO_META[r.key]?.name}: ${a}`, level: r.state as 'danger' | 'warning' })
    }
  }
  if (ret && ret.gap > 0) actions.push({ text: `แผนเกษียณยังขาดอีก ${fmt(ret.gap)} บาท (ควรออมเพิ่ม ~${fmt(ret.annualSavings)}/ปี)`, level: 'warning' })
  if (ins && ins.gap > 0) actions.push({ text: `ทุนประกันชีวิตยังขาดอีก ${fmt(ins.gap)} บาท (ที่ควรมี ${fmt(ins.need)} · มีจริง ${fmt(ins.have)})`, level: ins.coveragePct < 50 ? 'danger' : 'warning' })

  // ทางลัดหน้ายูทิลิตี้ (หน้าเป้าหมายอยู่ในการ์ด Goal Readiness แล้ว)
  const QUICK = [
    { icon: Landmark, label: 'งบการเงิน', to: '/client?tab=finance' },
    { icon: TrendingUp, label: 'สินทรัพย์-ลงทุน', to: '/financial-plan?tab=investment' },
    { icon: Receipt, label: 'วางแผนภาษี', to: '/tax' },
    { icon: ClipboardCheck, label: 'แผนปฏิบัติการ', to: '/action-plan' },
    { icon: CalendarRange, label: 'งบการเงินล่วงหน้า', to: '/forward-cashflow' },
    { icon: FileText, label: 'รายงาน PDF', to: '/report' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>แดชบอร์ดลูกค้า</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>ภาพรวมสถานะการเงินและความพร้อมต่อเป้าหมาย</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 10, border: '1px solid var(--card-border)' }}>
            {([['client', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).filter(([k]) => showSpouse || k === 'client').map(([k, c, Icon, name]) => (
              <button key={k} onClick={() => setPerson(k)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: person === k ? `${c}20` : 'transparent', color: person === k ? c : 'var(--text-muted)', fontWeight: person === k ? 600 : 400, fontSize: 13 }}>
                <Icon size={14} />{name}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/report')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--cyan)', color: '#00201d', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <FileDown size={16} /> สร้างรายงาน PDF
          </button>
        </div>
      </div>

      {/* Row 1: Profile + Quick links — บนสุด */}
      <div style={{ order: 0, display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(260px, 1fr) 2fr', gap: 16, alignItems: 'stretch' }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) resizePhoto(f, d => savePhoto.mutate(d)); e.target.value = '' }} />
            <div onClick={() => fileRef.current?.click()} title="คลิกเพื่อเปลี่ยนรูป"
              style={{ position: 'relative', width: 92, height: 92, borderRadius: 20, background: 'var(--cyan-dim)', border: '2px solid var(--cyan)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              {photoSrc
                ? <img src={photoSrc} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--cyan)' }}>{initial}</span>}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '3px 0', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9.5 }}>
                <Camera size={11} /> {photoSrc ? 'เปลี่ยน' : 'เพิ่มรูป'}
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{displayName}</h3>
              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 5, padding: '2px 8px' }}>ลูกค้าวางแผนการเงิน</span>
              {photoSrc && (
                <button onClick={() => savePhoto.mutate(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '3px 8px', background: 'none', border: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>
                  <Trash2 size={12} /> ลบรูป
                </button>
              )}
            </div>
          </div>
          <Row k="อายุ" v={age != null ? `${age} ปี` : '—'} />
          <Row k="สถานภาพ" v={clientProfile?.maritalStatus || '—'} />
          <Row k="ระดับความเสี่ยง" v={riskLabel} color={riskColor} />
          <Row k="PDPA" v={consentSigned ? 'ลงนามแล้ว ✓' : 'ยังไม่ลงนาม'} color={consentSigned ? '#10b981' : '#f59e0b'} />
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '2px 0' }} />
          <Row k="สินทรัพย์รวม" v={`${fmt(s?.totalAssets ?? 0)} บาท`} />
          <Row k="ความมั่งคั่งสุทธิ" v={`${fmt(s?.netWorth ?? 0)} บาท`} color={(s?.netWorth ?? 0) >= 0 ? '#10b981' : '#f43f5e'} />
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '2px 0' }} />
          <Row k="นัดหมายครั้งถัดไป"
            v={profileData?.planReviewDate ? new Date(profileData.planReviewDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'ยังไม่กำหนด'}
            color={profileData?.planReviewDate ? '#06b6d4' : 'var(--text-muted)'} />
        </div>

        {/* ความพร้อมต่อเป้าหมาย (ย้ายขึ้นมาข้างโปรไฟล์) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ความพร้อมต่อเป้าหมาย</p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>คลิกการ์ดเพื่อดูรายละเอียด →</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, flex: 1 }}>
            {/* แถวแรก: สภาพคล่อง · หนี้สิน · ความเสี่ยง */}
            {(() => {
              const months = s && s.totalMonthlyExp > 0 ? s.liquidAssets / s.totalMonthlyExp : null
              const pct = months != null ? (months / 6) * 100 : null
              return (
                <GoalCard icon={Wallet} title="สภาพคล่อง (เงินสำรอง)"
                  accent={statusOf(pct).color} statusText={months != null ? statusOf(pct).text : 'ยังไม่มีข้อมูล'}
                  pct={pct} big={months != null ? `${months.toFixed(1)} เดือน` : '—'} bigColor={statusOf(pct).color}
                  line1={s ? <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>สำรอง {cM(s.liquidAssets)}</span><span>เป้า 6 เดือน</span></span> : 'ยังไม่มีข้อมูลงบการเงิน'}
                  line2={months != null ? (months >= 6 ? <>เพียงพอ (≥6 เดือน) ✓</> : <>ควรมีให้ถึง 6 เดือน</>) : undefined}
                  onClick={() => navigate('/income')} />
              )
            })()}
            {(() => {
              const dScore = cat?.debt?.score ?? null
              return (
                <GoalCard icon={Scale} title="ภาระหนี้สิน"
                  accent={statusOf(dScore).color} statusText={cat?.debt?.label ?? statusOf(dScore).text}
                  pct={dScore} big={debtRatio != null ? `${Math.round(debtRatio)}%` : '—'} bigColor={statusOf(dScore).color}
                  line1={s ? <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>หนี้ {cM(s.totalDebtBalance)}</span><span>สินทรัพย์ {cM(s.totalAssets)}</span></span> : 'ยังไม่มีข้อมูลงบการเงิน'}
                  line2={debtRatio != null ? (debtRatio <= 50 ? <>หนี้ต่อสินทรัพย์อยู่ในเกณฑ์ ✓</> : <>สูงกว่าเกณฑ์ 50%</>) : undefined}
                  onClick={() => navigate('/income')} />
              )
            })()}
            <GoalCard icon={ShieldCheck} title="จัดการความเสี่ยง (ประกัน)"
              accent={statusOf(ins?.coveragePct ?? null).color}
              statusText={ins ? statusOf(ins.coveragePct).text : 'ยังไม่มีข้อมูล'}
              pct={ins?.coveragePct ?? null}
              big={ins ? `${Math.round(ins.coveragePct)}%` : '—'}
              bigColor={statusOf(ins?.coveragePct ?? null).color}
              line1={ins ? <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>แนะนำ {cM(ins.need)}</span><span>มี {cM(ins.have)}</span></span> : 'กรอกข้อมูลที่แท็บวางแผนประกัน'}
              line2={ins ? (ins.gap > 0 ? <>ทุนประกันขาด {cM(ins.gap)}</> : <>คุ้มครองเพียงพอ ✓</>) : undefined}
              onClick={() => navigate('/financial-plan?tab=insurance')} />

            {/* แถวสอง: เกษียณ · การศึกษา · มรดก */}
            <GoalCard icon={Target} title="วางแผนเกษียณ"
              accent={statusOf(ret?.readinessPct ?? null).color}
              statusText={ret ? statusOf(ret.readinessPct).text : 'ยังไม่มีข้อมูล'}
              pct={ret?.readinessPct ?? null}
              big={ret ? `${Math.round(ret.readinessPct)}%` : '—'}
              bigColor={statusOf(ret?.readinessPct ?? null).color}
              line1={ret ? <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>ต้องการ {cM(ret.needed)}</span><span>มี {cM(ret.have)}</span></span> : 'กรอกข้อมูลที่แท็บวางแผนเกษียณ'}
              line2={ret ? (ret.gap > 0 ? <>ขาดอีก {cM(ret.gap)} · ออม {fmt(ret.annualSavings)}/ปี</> : <>เพียงพอแล้ว ✓</>) : undefined}
              onClick={() => navigate('/financial-plan?tab=retirement')} />
            <GoalCard icon={GraduationCap} title="ทุนการศึกษาบุตร" accent="#ffb800"
              statusText={edu && edu.childCount > 0 ? 'ต้องเตรียม' : 'ไม่มีบุตร'}
              big={edu && edu.childCount > 0 ? cM(edu.totalPV) : '—'} bigColor="#ffb800"
              line1={edu && edu.childCount > 0 ? `บุตร ${edu.childCount} คน · เตรียมวันนี้ (PV)` : 'ยังไม่มีข้อมูลบุตร/ค่าเล่าเรียน'}
              line2={edu && edu.childCount > 0 ? <>ออม ~{fmt(edu.monthlySaving)}/เดือน <ArrowRight size={12} /></> : undefined}
              onClick={() => navigate(edu && edu.childCount > 0 ? '/financial-plan?tab=education' : '/client?tab=family')} />
            <GoalCard icon={ScrollText} title="แผนมรดก" accent="#a78bfa"
              statusText="แบ่งตามกฎหมาย" big="ทายาท" bigColor="#a78bfa"
              line1="ผังทายาท · กองมรดกสุทธิ · การแบ่งตามกฎหมาย"
              line2={<>ดูแผนมรดก <ArrowRight size={12} /></>}
              onClick={() => navigate('/financial-plan?tab=estate')} />
          </div>
        </div>
      </div>

      {/* Row 2: Health Score + KPIs */}
      <div style={{ order: 1, display: 'grid', gridTemplateColumns: compact ? '1fr' : '260px 1fr', gap: 16, alignItems: 'stretch' }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <p style={{ ...label, alignSelf: 'flex-start' }}>คะแนนสุขภาพการเงิน</p>
          <Gauge value={healthScore} size={150} color={healthColor} sub={healthLabel} />
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
            {([['สภาพคล่อง', cat?.liquidity], ['หนี้สิน', cat?.debt], ['การออม', cat?.savings]] as const).map(([nm, c]) => {
              const sc = c?.score ?? null
              return (
                <div key={nm}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <span>{nm}</span><span style={{ color: subColor(sc), fontWeight: 700 }}>{sc ?? '—'}{c?.label ? ` · ${c.label}` : ''}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', marginTop: 3 }}>
                    <div style={{ width: `${sc ?? 0}%`, height: '100%', borderRadius: 3, background: subColor(sc) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* สรุปแผนดำเนินการ (จากหน้าแผนปฏิบัติการ) */}
          <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ ...label, margin: 0 }}>สรุปแผนดำเนินการ</p>
              <span onClick={() => navigate('/action-plan')} style={{ fontSize: 11, color: 'var(--cyan)', cursor: 'pointer' }}>ดูทั้งหมด →</span>
            </div>
            {planRows.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12.5 }}>
                ยังไม่มีแผนดำเนินการ — เพิ่มได้ที่หน้าแผนปฏิบัติการ
              </div>
            ) : (
              <div style={{ overflowY: 'auto', minHeight: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px', gap: 8, padding: '0 4px 6px', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>แผนดำเนินการ</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>จำนวนเงิน</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>ผู้รับผิดชอบ</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>กำหนดการ</span>
                </div>
                {planRows.map((r, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 110px', gap: 8, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--divider)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--text-secondary)', minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.desc}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontFamily: 'monospace', textAlign: 'right', color: r.amount ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.amount ? fmt(r.amount) : '—'}</span>
                    <span style={{ fontSize: 11.5, textAlign: 'center', color: r.owner ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{r.owner || '—'}</span>
                    <span style={{ fontSize: 11.5, textAlign: 'right', color: r.schedule ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{r.schedule ? new Date(r.schedule).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Monte Carlo + Ratios */}
      <div style={{ order: 5, display: 'grid', gridTemplateColumns: compact ? '1fr' : '2fr minmax(280px, 1fr)', gap: 16, alignItems: 'stretch' }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>มูลค่าสินทรัพย์ลงทุนในอนาคต</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>แบบจำลอง Monte Carlo · ช่วง 80% (P10–P90)</p>
            </div>
            <span onClick={() => navigate('/financial-plan?tab=investment')} style={{ fontSize: 11, color: 'var(--cyan)', cursor: 'pointer' }}>ดูรายละเอียด →</span>
          </div>
          <InvestmentMonteCarloChart person={person === 'spouse' ? 'spouse' : 'self'} height={300} />
        </div>

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ ...label, margin: 0 }}>สรุปความคุ้มครองประกัน</p>
            <span onClick={() => navigate('/financial-plan?tab=insurance')} style={{ fontSize: 11, color: 'var(--cyan)', cursor: 'pointer' }}>ดูรายละเอียด →</span>
          </div>
          <InsuranceCoverageSummary person={person === 'spouse' ? 'spouse' : 'self'} />
        </div>
      </div>

      {/* Row 4: ทางลัด (ย้ายลงมาแทนที่ความพร้อมต่อเป้าหมาย) */}
      <div style={{ order: 2, marginTop: 2 }}>
        <div style={{ order: 3, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
          {QUICK.map(({ icon: Icon, label: l, to }) => (
            <button key={l} onClick={() => navigate(to)}
              style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}>
              <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color="var(--cyan)" />
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{l}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5, borderBottom: '1px solid var(--divider)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>{v}</span>
    </div>
  )
}
