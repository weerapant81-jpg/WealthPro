import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FileText, Printer, Check, Loader2, FileStack, Presentation, Pencil, Download, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { useClient } from '../context/ClientContext'
import { PageHeader } from '../components/ui'
import PresentationDeck, { SlideEditor, OverlayLayer, DECK_SLIDES, type SlideEl, type CustomSlide } from './report/PresentationDeck'
import { PieChart, Pie, Cell, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, ComposedChart, Line, Area, ReferenceLine, ScatterChart, Scatter, CartesianGrid } from 'recharts'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { calc as calcTaxCalc, defaultState as defaultTaxState, expenseFor, BRACKETS, type TaxState } from '../lib/tax'
import { hasSpouseInfo } from '../lib/spouse'
import { useInsuranceCoverage } from '../components/InsuranceCoverageSummary'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../lib/portfolioReturns'

const fmt = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

/* ── financial math (mirror of feature pages) ── */

const EDU_LEVELS = [
  { key: 'kindergarten', ages: [3, 4, 5] }, { key: 'primary', ages: [6, 7, 8, 9, 10, 11] },
  { key: 'secondary', ages: [12, 13, 14, 15, 16, 17] }, { key: 'bachelor', ages: [18, 19, 20, 21] }, { key: 'master', ages: [22, 23] },
]
function eduForChild(age: number, setting: any, eduCosts: any, inf: number, fundR: number) {
  const inflation = inf / 100, r = fundR / 100
  const type = setting?.type ?? 'private', includeMaster = setting?.includeMaster ?? false
  let totalNominal = 0, totalPV = 0
  for (let a = Math.max(age, 3); a <= 23; a++) {
    const lvl = EDU_LEVELS.find(l => l.ages.includes(a)); if (!lvl) continue
    if (lvl.key === 'master' && !includeMaster) continue
    const base = toNum(eduCosts?.[lvl.key]?.[type]); if (base <= 0) continue
    const yfn = a - age
    totalNominal += base * Math.pow(1 + inflation, yfn)
    totalPV += base * Math.pow(1 + inflation, yfn) / Math.pow(1 + r, yfn)
  }
  const m = Math.max(1, setting?.savingYears ?? 10)
  const af = r === 0 ? m : (1 - Math.pow(1 + r, -m)) / r
  const annual = totalPV / af
  return { totalNominal, totalPV, annual, monthly: annual / 12 }
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Sec { k: string; t: string; lvl: 1 | 2; auto?: string }
const SECTIONS: Sec[] = [
  { k: 'service', t: 'ข้อตกลงในการให้บริการ', lvl: 1, auto: 'service' },
  { k: 'execsum', t: 'บทสรุปผู้บริหาร', lvl: 1, auto: 'execsum' },
  { k: 'basicinfo', t: 'วิเคราะห์ข้อมูลพื้นฐาน', lvl: 1, auto: 'basicinfo' },
  { k: 'exec', t: 'สถานะทางการเงินปัจจุบัน', lvl: 1, auto: 'exec' },
  { k: 'exec_spouse', t: 'สถานะทางการเงินปัจจุบัน (คู่สมรส)', lvl: 1, auto: 'exec_spouse' },
  { k: 'domains', t: 'บทวิเคราะห์และการดำเนินการ', lvl: 1, auto: 'domains' },
  { k: 'domains_spouse', t: 'บทวิเคราะห์และการดำเนินการ (คู่สมรส)', lvl: 1, auto: 'domains_spouse' },
  { k: 'finance', t: 'สรุปผลการวิเคราะห์ข้อมูลทางการเงินส่วนบุคคล', lvl: 1, auto: 'finance' },
  { k: 'fin_cf2', t: 'งบกระแสเงินสด (Cash Flow Statement)', lvl: 2, auto: 'fin_cf2' },
  { k: 'fin_ratio2', t: 'อัตราส่วนทางการเงิน (Financial Ratio)', lvl: 2, auto: 'fin_ratio2' },
  { k: 'fin_invest', t: 'การวิเคราะห์สินทรัพย์ลงทุนที่มี', lvl: 2, auto: 'fin_invest' },
  { k: 'finance_sp', t: 'สรุปผลการวิเคราะห์ข้อมูลทางการเงินส่วนบุคคล (คู่สมรส)', lvl: 1, auto: 'finance_sp' },
  { k: 'fin_cf2_sp', t: 'งบกระแสเงินสด — คู่สมรส', lvl: 2, auto: 'fin_cf2_sp' },
  { k: 'fin_ratio2_sp', t: 'อัตราส่วนทางการเงิน — คู่สมรส', lvl: 2, auto: 'fin_ratio2_sp' },
  { k: 'fin_invest_sp', t: 'การวิเคราะห์สินทรัพย์ลงทุนที่มี — คู่สมรส', lvl: 2, auto: 'fin_invest_sp' },
  { k: 'g_insurance', t: 'การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย', lvl: 2, auto: 'insurance' },
  { k: 'g_education', t: 'เป้าหมายทางการเงินเพื่อการศึกษาบุตร', lvl: 2, auto: 'education' },
  { k: 'g_retire', t: 'ความต้องการทางการเงินเพื่อการเกษียณ', lvl: 2, auto: 'retirement' },
  { k: 'g_tax', t: 'การวิเคราะห์ภาษีเงินได้', lvl: 2, auto: 'taxfull' },
  { k: 'g_estate', t: 'แนวทางการจัดการทรัพย์สินและมรดก', lvl: 2, auto: 'estatefull' },
  { k: 'g_port_reco', t: 'พอร์ตการลงทุนที่แนะนำ', lvl: 2, auto: 'portfolio_reco' },
  { k: 'assumptions', t: 'สมมติฐานที่ใช้ในการวางแผน', lvl: 1, auto: 'assumptions' },
  { k: 'acknowledge2', t: 'ข้อควรทราบ', lvl: 1, auto: 'ack2' },
  { k: 'advprofile', t: 'ประวัตินักวางแผนการเงิน', lvl: 1, auto: 'advprofile' },
]

// หัวข้อที่ autoNode จัดการข้อความเองทั้งหมด (ช่องพิมพ์ = แก้ข้อความ default ไม่ใช่ต่อท้าย)
const TEXT_HANDLED = new Set(['exec', 'exec_spouse', 'advprofile'])




type SecData = { include: boolean; text: string }

export default function ReportPage() {
  const compact = useIsCompact()
  const { data: client } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: advisor } = useQuery({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const { data: ratios } = useQuery({ queryKey: ['financial-ratios'], queryFn: () => api.get('/financial-ratios').then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: eduPlan } = useQuery({ queryKey: ['education-plan'], queryFn: () => api.get('/education-plan').then(r => r.data), retry: false })
  const { selectedClient } = useClient()
  const clientKey = selectedClient?.id ?? 'none'
  const { data: saved, isFetched } = useQuery({ queryKey: ['report-plan', clientKey], queryFn: () => api.get('/report-plan').then(r => r.data), retry: false })
  const { data: taxPlanQ } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  const { data: actionData } = useQuery({ queryKey: ['action-items'], queryFn: () => api.get('/action-items').then(r => r.data), retry: false })
  const { data: expensesQ = [] } = useQuery<any[]>({ queryKey: ['expenses'], queryFn: () => api.get('/expenses').then(r => r.data), retry: false })
  const actionItems: any[] = Array.isArray(actionData) ? actionData : (actionData?.items ?? [])
  // คำแนะนำรายหมวดที่ที่ปรึกษาพิมพ์ไว้ในหน้าแผนปฏิบัติการ (แหล่งเดียวกัน — ไม่ต้องพิมพ์ซ้ำ)
  const domainAdvice: Record<string, string> = (!Array.isArray(actionData) && actionData?.advice) || {}
  // readiness กลาง (สูตรเดียวกับหน้าแผน/แผนปฏิบัติการ — กัน drift)
  const retR = useRetirementReadiness('client')
  const insR = useInsuranceReadiness('client')
  const eduR = useEducationReadiness()
  // ฝั่งคู่สมรส (ใช้เมื่อมีข้อมูลคู่สมรส)
  const retRSp = useRetirementReadiness('spouse')
  const insRSp = useInsuranceReadiness('spouse')
  const { data: ratiosSp } = useQuery({ queryKey: ['financial-ratios', 'spouse'], queryFn: () => api.get('/financial-ratios', { params: { person: 'spouse' } }).then(r => r.data), retry: false })
  const covSelf = useInsuranceCoverage('self')
  const covSp = useInsuranceCoverage('spouse')
  const { data: marketData } = useQuery({ queryKey: ['market-data'], queryFn: () => api.get('/market-data').then(r => r.data), staleTime: 5 * 60 * 1000, retry: 1 })
  const { data: estatePlanQ } = useQuery({ queryKey: ['estate-plan'], queryFn: () => api.get('/estate-plan').then(r => r.data), retry: false })
  const { data: rebalQ } = useQuery({ queryKey: ['rebalance-plan'], queryFn: () => api.get('/rebalance-plan').then(r => r.data), retry: false })

  const [title, setTitle] = useState('แผนการเงินส่วนบุคคล')
  const [mode, setMode] = useState<'full' | 'pres'>('full')
  const [pres, setPres] = useState<Record<string, { comment?: string; hidden?: boolean; off?: boolean }>>({})
  const [editMode, setEditMode] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)   // หุบเมนูเลือกหน้า เพื่อเพิ่มพื้นที่เอกสาร
  const [overlays, setOverlays] = useState<Record<string, SlideEl[]>>({})
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([])
  const [thankYouPhoto, setThankYouPhoto] = useState('')
  const [signatures, setSignatures] = useState<Record<string, string>>({})   // ลายเซ็นหน้าข้อตกลง (advisor/client/witness)
  const [signing, setSigning] = useState<string | null>(null)
  const [secs, setSecs] = useState<Record<string, SecData>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.k, { include: true, text: '' }])))
  const loadedRef = useRef(false)
  // เปลี่ยนลูกค้า → ล้างสถานะรายงานทั้งหมด (รวมลายเซ็น/ติ๊ก PDPA) แล้วโหลดแผนของลูกค้าคนใหม่
  const clientRef = useRef(clientKey)
  useEffect(() => {
    if (clientRef.current === clientKey) return
    clientRef.current = clientKey
    loadedRef.current = false
    setTitle('แผนการเงินส่วนบุคคล')
    setPres({}); setOverlays({}); setCustomSlides([]); setThankYouPhoto('')
    setSignatures({}); setSigning(null); setEditMode(false)
    setSecs(Object.fromEntries(SECTIONS.map(sc => [sc.k, { include: true, text: '' }])))
  }, [clientKey])
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved && typeof saved === 'object') {
      if (saved.title) setTitle(saved.title)
      if (saved.mode === 'pres' || saved.mode === 'full') setMode(saved.mode)
      if (saved.pres && typeof saved.pres === 'object') {
        const next: Record<string, { comment?: string; hidden?: boolean; off?: boolean }> = {}
        for (const k of Object.keys(saved.pres)) {
          const v = saved.pres[k]
          next[k] = typeof v === 'string' ? { comment: v } : (v || {})   // backward-compat: string → {comment}
        }
        setPres(next)
      }
      if (saved.overlays && typeof saved.overlays === 'object') setOverlays(saved.overlays)
      if (Array.isArray(saved.customSlides)) setCustomSlides(saved.customSlides)
      if (typeof saved.thankYouPhoto === 'string') setThankYouPhoto(saved.thankYouPhoto)
      if (saved.signatures && typeof saved.signatures === 'object') setSignatures(saved.signatures)
      if (saved.secs) setSecs(prev => {
        const next = { ...prev }
        for (const k of Object.keys(saved.secs)) next[k] = { ...next[k], ...saved.secs[k] }
        return next
      })
    }
    loadedRef.current = true
  }, [isFetched, saved])

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = useMutation({
    mutationFn: (payload: any) => api.put('/report-plan', payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ title, secs, mode, pres, overlays, customSlides, thankYouPhoto, signatures }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [title, secs, mode, pres, overlays, customSlides, thankYouPhoto, signatures])

  const setText = (k: string, v: string) => setSecs(p => ({ ...p, [k]: { ...p[k], text: v } }))
  const setInc = (k: string, v: boolean) => setSecs(p => ({ ...p, [k]: { ...p[k], include: v } }))

  const clientName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
  const age = client?.birthDate ? new Date().getFullYear() - new Date(client.birthDate).getFullYear() : null
  const sm = ratios?.summary ?? {}
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

  // investment allocation by asset class
  const allocation = (() => {
    const assets: any[] = invProfile?.investmentAssets ?? []
    const groups: Record<string, number> = {}
    assets.forEach(a => { const v = toNum(a.currentValue); if (v > 0) groups[a.assetClass || 'อื่นๆ'] = (groups[a.assetClass || 'อื่นๆ'] || 0) + v })
    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    return { rows: Object.entries(groups).map(([name, value]) => ({ name, value })), total }
  })()
  const PIE_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#a78bfa', '#f87171', '#22d3ee', '#fb923c', '#34d399']

  // recompute inputs for plan-based sections
  const invAssets: any[] = invProfile?.investmentAssets ?? []
  const totalInv = invAssets.reduce((s, a) => s + toNum(a.currentValue), 0)
  let _wr = 0, _cv = 0
  invAssets.forEach(a => { const v = toNum(a.currentValue), rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { _cv += v; _wr += rr * v } })
  const portRet = _cv > 0 ? _wr / _cv : 0
  // สินทรัพย์ลงทุนฝั่งคู่สมรส
  const hasSpouse = hasSpouseInfo(client)
  const invAssetsSp: any[] = invProfile?.spouseData?.investmentAssets ?? []
  const totalInvSp = invAssetsSp.reduce((s, a) => s + toNum(a.currentValue), 0)
  let _wrS = 0, _cvS = 0
  invAssetsSp.forEach(a => { const v = toNum(a.currentValue), rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { _cvS += v; _wrS += rr * v } })
  const portRetSp = _cvS > 0 ? _wrS / _cvS : 0
  const eduCosts = profile?.educationCosts ?? {}
  const eduInf = profile?.educationInflation ?? 5, eduRet = profile?.educationFundReturn ?? 4
  const children: any[] = client?.children ?? []



  /* ── ชิ้นส่วนดีไซน์รายงาน (สไตล์มืออาชีพ) ── */
  const TEAL = '#00cfc1', AMBERR = '#d97706', REDR = '#dc2626', GREENR = '#059669'
  const Chip = ({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' }) => {
    const c = tone === 'good' ? GREENR : tone === 'warn' ? AMBERR : REDR
    return <span style={{ padding: '3px 10px', borderRadius: 6, background: `${c}14`, color: c, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
  }
  const PBar = ({ pct, tone }: { pct: number; tone: 'good' | 'warn' | 'bad' }) => (
    <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#f1f5f9', margin: '10px 0 12px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(3, Math.min(100, pct))}%`, borderRadius: 999, background: tone === 'good' ? TEAL : tone === 'warn' ? '#f59e0b' : '#ef4444' }} />
    </div>
  )
  const MiniRow = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px', borderBottom: '1px solid #f8fafc', fontSize: 12.5 }}>
      <span style={{ color: '#64748b' }}>{l}</span>
      <span style={{ fontWeight: strong ? 800 : 700, color: '#0f172a', fontFamily: 'monospace' }}>{v}</span>
    </div>
  )
  const DomainCard = ({ no, title, status, pct, rows, advice }: { no: number; title: string; status: { label: string; tone: 'good' | 'warn' | 'bad' }; pct: number; rows: [string, string][]; advice?: string }) => (
    <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '16px 18px', breakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
          <span style={{ color: TEAL, marginRight: 6 }}>{no}.</span>{title}
        </div>
        <Chip label={status.label} tone={status.tone} />
      </div>
      <PBar pct={pct} tone={status.tone} />
      {rows.map(([l, v], i) => <MiniRow key={i} l={l} v={v} strong={i === rows.length - 1} />)}
      {advice && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.6, fontStyle: 'italic' }}>“{advice}”</div>}
    </div>
  )

  function autoNode(kind: string) {
    if (kind === 'service') {
      // หนังสือข้อตกลงการให้บริการ (Letter of Engagement) — บีบให้จบ 1 หน้า A4 พอดี
      const now = new Date()
      const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const dueTh = dueDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      const Blank = ({ w = 120, v }: { w?: number; v?: string }) => v
        ? <span style={{ fontWeight: 700, color: '#0f172a', borderBottom: '1px dotted #94a3b8', padding: '0 6px' }}>{v}</span>
        : <span style={{ display: 'inline-block', minWidth: w, borderBottom: '1px dotted #94a3b8', verticalAlign: 'bottom' }}>&nbsp;</span>
      const clause = (no: number, title: string, body: string) => (
        <div key={no} style={{ marginBottom: 7 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{no}. {title} — </span>
          <span style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.6 }}>{body}</span>
        </div>
      )
      const box = '☐'
      return (
        <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>หนังสือข้อตกลงการให้บริการวางแผนการเงิน</div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.5 }}>Letter of Engagement for Financial Planning Services</div>
          </div>
          {/* คู่สัญญา 2 คอลัมน์ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, marginBottom: 6 }}>ผู้ให้บริการ (นักวางแผนการเงิน)</div>
              <div style={{ fontSize: 11.5, color: '#334155', display: 'grid', gap: 4 }}>
                <div>ชื่อ: <Blank w={150} v={advisor?.fullName} /></div>
                <div>ใบอนุญาต/ใบรับรอง: <Blank w={100} v={advisor?.licenseCFP || advisor?.licenseInsurance} /></div>
                <div>บริษัท/สังกัด: <Blank w={120} v={advisor?.company} /></div>
                <div>โทรศัพท์: <Blank w={70} v={advisor?.phone} /> อีเมล: <Blank w={80} v={advisor?.email} /></div>
              </div>
            </div>
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, marginBottom: 6 }}>ผู้รับบริการ (ลูกค้า)</div>
              <div style={{ fontSize: 11.5, color: '#334155', display: 'grid', gap: 4 }}>
                <div>ชื่อ: <Blank w={150} v={clientName !== 'ลูกค้า' ? `คุณ${clientName}` : undefined} /></div>
                <div>เลขบัตรประชาชน: <Blank w={110} v={client?.nationalId} /></div>
                <div>ที่อยู่: <Blank w={160} v={client?.address} /></div>
                <div>โทรศัพท์: <Blank w={70} v={client?.phone} /> อีเมล: <Blank w={80} v={client?.contactEmail} /></div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: '#334155', marginBottom: 9 }}>
            คู่สัญญาทั้งสองฝ่ายตกลงทำหนังสือข้อตกลงการให้บริการวางแผนการเงินฉบับนี้ขึ้น ณ วันที่ <Blank w={30} v={String(now.getDate())} /> เดือน <Blank w={80} v={now.toLocaleDateString('th-TH', { month: 'long' })} /> พ.ศ. <Blank w={45} v={String(now.getFullYear() + 543)} /> โดยมีรายละเอียดดังต่อไปนี้
          </p>
          {clause(1, 'ขอบเขตการให้บริการ', 'ผู้ให้บริการตกลงจัดทำแผนการเงินส่วนบุคคลให้แก่ผู้รับบริการ ครอบคลุมการวิเคราะห์ฐานะทางการเงิน การวางแผนเกษียณอายุ การวางแผนภาษี การวางแผนประกันชีวิตและสุขภาพ รวมถึงการวางแผนการลงทุน ทั้งนี้ตามข้อมูลที่ผู้รับบริการให้ไว้เท่านั้น')}
          <div style={{ marginBottom: 7 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>2. ระยะเวลาและการส่งมอบ — </span>
            <span style={{ fontSize: 11.5, color: '#334155' }}>ผู้ให้บริการจะส่งมอบแผนการเงินฉบับสมบูรณ์ภายใน <Blank w={35} v="7" /> วัน นับจากวันทำสัญญา (ภายในวันที่ <Blank w={90} v={dueTh} />) พร้อมนัดหมายนำเสนอแผนและตอบข้อซักถาม จำนวน 1 ครั้ง</span>
          </div>
          {clause(3, 'ความรับผิดชอบและข้อจำกัด', 'แผนการเงินที่จัดทำขึ้นเป็นเพียงคำแนะนำบนพื้นฐานข้อมูลที่ผู้รับบริการให้ไว้ ณ วันที่จัดทำ มิใช่การรับประกันผลตอบแทนหรือการรับประกันความสำเร็จทางการเงิน ผู้ให้บริการไม่รับผิดชอบต่อความเสียหายอันเกิดจากการตัดสินใจของผู้รับบริการ หรือจากการเปลี่ยนแปลงของสภาวะตลาดและกฎหมายที่เกิดขึ้นภายหลัง')}
          {clause(4, 'การรักษาความลับและคุ้มครองข้อมูลส่วนบุคคล', 'ผู้ให้บริการตกลงเก็บรักษาข้อมูลของผู้รับบริการไว้เป็นความลับ และจะใช้ข้อมูลดังกล่าวเพื่อวัตถุประสงค์ในการจัดทำแผนการเงินเท่านั้น สอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ผู้รับบริการมีสิทธิขอตรวจสอบ แก้ไข หรือลบข้อมูลของตนได้ตลอดเวลา')}
          {clause(5, 'การยกเลิกสัญญา', 'คู่สัญญาฝ่ายใดฝ่ายหนึ่งมีสิทธิบอกเลิกสัญญาได้โดยแจ้งเป็นลายลักษณ์อักษรล่วงหน้าไม่น้อยกว่า 7 วัน')}
          {clause(6, 'การรับทราบและข้อจำกัดของรายงาน', 'ข้อเสนอแนะในรายงานจัดทำขึ้นจากข้อมูลที่ผู้รับบริการให้ไว้และสมมติฐานที่ระบุในหัวข้อ "สมมติฐานที่ใช้ในการวางแผน" หากข้อมูลส่วนบุคคล สถานการณ์ทางการเงิน หรือภาวะตลาดเปลี่ยนแปลงไป ข้อเสนอแนะอาจเปลี่ยนแปลงตาม จึงควรทบทวนแผนอย่างน้อยปีละ 1 ครั้ง ประมาณการต่าง ๆ (รวมถึงผลการจำลอง Monte Carlo) เป็นเพียงการคาดการณ์ตามสมมติฐาน ไม่ใช่การรับประกันผลตอบแทน ผลการดำเนินงานในอดีตไม่ได้ยืนยันถึงผลการดำเนินงานในอนาคต และรายงานนี้ไม่ถือเป็นคำแนะนำด้านกฎหมาย บัญชี หรือภาษีเฉพาะกรณี คู่สัญญาได้อ่านและรับทราบสมมติฐานและข้อจำกัดข้างต้นแล้ว')}
          <div style={{ border: `1px solid ${TEAL}55`, background: '#f0fdfa', borderRadius: 10, padding: '8px 12px', margin: '10px 0' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>การยินยอมใช้ข้อมูลส่วนบุคคล (PDPA Consent)</div>
            <div onClick={() => setSignatures(s => s.pdpa_consent ? (() => { const n = { ...s }; delete n.pdpa_consent; return n })() : { ...s, pdpa_consent: '1' })}
              title="คลิกเพื่อติ๊ก/ยกเลิกความยินยอม" style={{ fontSize: 11.5, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontWeight: 800, color: signatures.pdpa_consent ? GREENR : '#334155' }}>{signatures.pdpa_consent ? '☑' : box}</span> ข้าพเจ้าให้ความยินยอมในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้าเพื่อวัตถุประสงค์ในการจัดทำแผนการเงินเท่านั้น และรับทราบสิทธิของข้าพเจ้าตาม PDPA แล้ว
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: '#334155', marginBottom: 12 }}>คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในหนังสือข้อตกลงฉบับนี้โดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 6 }}>
            {([['sig_advisor', 'ผู้ให้บริการ / นักวางแผนการเงิน', advisor?.fullName || ''], ['sig_client', 'ผู้รับบริการ / ลูกค้า', clientName !== 'ลูกค้า' ? `คุณ${clientName}` : '']] as const).map(([k, role, name]) => (
              <div key={k} style={{ textAlign: 'center', fontSize: 11.5, color: '#334155' }}>
                <div onClick={() => setSigning(k)} title="คลิกเพื่อลงนามบนหน้าจอ"
                  style={{ height: 54, margin: '0 auto 4px', maxWidth: 230, borderBottom: '1px dotted #94a3b8', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'pointer' }}>
                  {signatures[k]
                    ? <img src={signatures[k]} alt="" style={{ maxHeight: 52, maxWidth: '100%' }} />
                    : <span className="no-print" style={{ fontSize: 10, color: '#cbd5e1', paddingBottom: 4 }}>คลิกเพื่อลงนาม</span>}
                </div>
                <div>ลงชื่อ {name ? <span style={{ fontWeight: 700, color: '#0f172a' }}>({name})</span> : '(.................................................)'}</div>
                <div style={{ marginTop: 3 }}>({role})</div>
                <div style={{ marginTop: 3 }}>วันที่ {today}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
            <span>พยาน: ลงชื่อ</span>
            <span onClick={() => setSigning('sig_witness')} title="คลิกเพื่อลงนามบนหน้าจอ"
              style={{ display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', width: 150, height: 38, borderBottom: '1px dotted #94a3b8', cursor: 'pointer' }}>
              {signatures.sig_witness
                ? <img src={signatures.sig_witness} alt="" style={{ maxHeight: 36, maxWidth: '100%' }} />
                : <span className="no-print" style={{ fontSize: 10, color: '#cbd5e1', paddingBottom: 3 }}>คลิกเพื่อลงนาม</span>}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
              (<input value={signatures.witness_name || ''} onChange={e => setSignatures(s => ({ ...s, witness_name: e.target.value }))}
                placeholder="พิมพ์ชื่อพยาน" title="พิมพ์ชื่อ-นามสกุลพยาน"
                style={{ width: 170, border: 'none', borderBottom: '1px dotted #94a3b8', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontFamily: 'inherit', color: '#0f172a', fontWeight: 700, padding: '0 2px' }} />)
            </span>
            <span>วันที่ {today}</span>
          </div>
        </div>
      )
    }
    if (kind === 'ack2') {
      // ── ข้อควรทราบ (หน้าสุดท้ายเสมอ · 1 หน้า) ──
      const PARAS = [
        'เราเข้าใจดีว่าท่านอาจมีคำถามและข้อกังวลต่าง ๆ ในระหว่างการสร้างและรักษาความมั่นคงทางการเงิน สภาพแวดล้อมทางการเงินในปัจจุบันมีความซับซ้อนและเต็มไปด้วยความไม่แน่นอนในหลายด้าน การตัดสินใจของท่านเกี่ยวกับการทำงาน การใช้จ่าย การลงทุน และการเกษียณ ทั้งในปัจจุบันและอนาคต ล้วนส่งผลอย่างมีนัยสำคัญต่อฐานะทางการเงินของท่านในระยะยาว',
        'เพื่อช่วยให้ท่านเรียนรู้ ทำความเข้าใจ และสร้างหลักคิดส่วนบุคคลสำหรับการตัดสินใจ จึงจัดทำ "แผนการเงินส่วนบุคคล" ขึ้น เพื่อเพิ่มพูนความรู้เกี่ยวกับหัวข้อต่าง ๆ และอธิบายรายละเอียดที่ซับซ้อนของโลกการเงิน แผนนี้เป็นกรอบแนวทางที่ช่วยให้เรื่องทางการเงินของท่านมีความชัดเจนและเป็นระบบมากขึ้น',
        'แผนนี้จัดทำขึ้นจากข้อมูลที่เป็นความลับเกี่ยวกับทรัพยากรและเป้าหมายในปัจจุบันที่ท่านได้ให้ไว้ แม้ภาพประกอบต่าง ๆ ในแผนจะเป็นเครื่องมือที่มีประโยชน์สำหรับการพิจารณาด้านการเงินของท่าน แต่แผนนี้ไม่ได้ถือเป็นจุดสิ้นสุดของการวางแผนทั้งหมด เนื่องจากการวางแผนทางการเงินเป็นกระบวนการที่ต้องดำเนินอย่างต่อเนื่อง',
        'ตัวอย่างสมมติเกี่ยวกับหลักการทางคณิตศาสตร์นี้จัดทำขึ้นเป็นพิเศษ เพื่อจำลองสถานการณ์และการเปลี่ยนแปลงที่อาจเกิดขึ้นในอนาคตทางการเงินของท่าน สมมติฐานที่ใช้ในตัวอย่างนี้ได้รับการคัดเลือกโดยเฉพาะเพื่อแสดงให้เห็นถึงแนวทางที่สมเหตุสมผลสำหรับสถานการณ์ทางการเงินของท่าน และเน้นให้ที่ปรึกษาทางการเงินพิจารณาถึงผลกระทบในอนาคตอันซับซ้อนที่เกิดจากปัจจัยต่าง ๆ ร่วมกัน ได้แก่ รายได้ ค่าใช้จ่าย เงินออม การเติบโตของสินทรัพย์ ภาษี ผลประโยชน์หลังเกษียณ และประกันภัย',
        'เอกสารนี้ไม่ใช่การโฆษณาหรือการชักชวนให้ลงทุนในผลิตภัณฑ์ กลยุทธ์การลงทุน หรือบริการใดโดยเฉพาะ อีกทั้งไม่มีการให้หรือสื่อเป็นนัยถึงคำแนะนำหรือการคาดการณ์เกี่ยวกับการลงทุนหรือกลยุทธ์การลงทุนใดโดยเฉพาะ ตัวอย่างการเติบโตของสินทรัพย์ในเอกสารนี้ใช้เพื่อสาธิตแนวคิดและความสัมพันธ์ทางคณิตศาสตร์อย่างเคร่งครัด โดยนำเสนอภาพรวมที่สมดุลและครบถ้วนของหลักการทางการเงินบางประการ สมมติฐานเกี่ยวกับการเติบโตใช้กับบัญชีโดยทั่วไปตามแนวทางด้านภาษีที่แตกต่างกัน ตัวอย่าง แผนภูมิ และตารางต่าง ๆ ไม่ได้คาดการณ์หรือแสดงถึงผลการดำเนินงาน ผลตอบแทน หรือค่าใช้จ่ายของการลงทุนใดโดยเฉพาะ ทั้งในอดีตและอนาคต',
        'แผนนี้ไม่ได้ให้คำแนะนำด้านภาษีหรือกฎหมาย แต่อาจแสดงตัวอย่างกฎหรือผลกระทบทางภาษีบางประการ รวมทั้งกล่าวถึงทางเลือกทางกฎหมายที่อาจเป็นไปได้เพื่อวัตถุประสงค์ทางการศึกษา ข้อมูลในเอกสารนี้ไม่สามารถใช้แทนการปรึกษาผู้เชี่ยวชาญด้านกฎหมายหรือที่ปรึกษาด้านภาษีที่มีความสามารถ และควรนำไปใช้ร่วมกับคำแนะนำของผู้เชี่ยวชาญดังกล่าว',
        'ผลลัพธ์ที่แสดงในตัวอย่างนี้ไม่ใช่การรับประกันหรือการคาดการณ์ผลการดำเนินงานในอนาคต ผลลัพธ์ดังกล่าวมีไว้เพื่อประกอบการอธิบายเท่านั้น เอกสารนี้มีข้อความที่เกี่ยวกับการคาดการณ์ในอนาคต ซึ่งไม่สามารถรับประกันได้ว่าความเห็นและความคิดเห็นที่แสดงไว้จะเกิดขึ้นจริง ข้อมูลในอดีตแสดงถึงผลการดำเนินงานที่ผ่านมาเท่านั้น และไม่ได้บ่งชี้หรือรับประกันผลลัพธ์ในอนาคต ข้อมูล สารสนเทศ และแบบจำลองทางสถิติที่แสดงในเอกสารนี้ได้มาจากแหล่งข้อมูลที่เชื่อว่าน่าเชื่อถือ แต่ไม่สามารถรับประกันความถูกต้องหรือความครบถ้วนสมบูรณ์ได้',
        'หน้าสมมติฐานประกอบด้วยข้อมูลที่ท่านให้ไว้และนำไปใช้ตลอดการนำเสนอ รายการสินทรัพย์ในเอกสารนี้ไม่ใช่ใบแจ้งยอดบัญชี และอาจไม่รวมยอดคงเหลือ การถือครองสินทรัพย์ และผลตอบแทนที่เป็นปัจจุบันหรือครบถ้วน โปรดตรวจสอบความถูกต้องของข้อมูล และแจ้งที่ปรึกษาทางการเงินของท่านโดยเร็ว หากพบความคลาดเคลื่อนในสมมติฐาน เนื่องจากความคลาดเคลื่อนดังกล่าวอาจส่งผลอย่างมีนัยสำคัญต่อการนำเสนอ',
        'ผลตอบแทนจากการลงทุน อัตราภาษี และอัตราเงินเฟ้อที่แท้จริงในอนาคตของท่านยังไม่สามารถทราบได้ ตัวอย่างนี้ใช้สมมติฐานที่เป็นตัวแทนในแบบจำลองการวางแผนทางการเงิน เพื่อจัดทำรายงานสำหรับการศึกษาและการอภิปราย การคำนวณและสมมติฐานในรายงานนี้อาจไม่ครอบคลุมค่าธรรมเนียม ค่าใช้จ่าย และต้นทุนทั้งหมดที่อาจเกิดขึ้นในช่วงเวลาที่ตัวอย่างนี้ครอบคลุม ซึ่งหากนำมารวมคำนวณ อาจส่งผลให้ผลตอบแทนจากการลงทุนลดลงและทำให้ผลลัพธ์ของตัวอย่างไม่น่าพึงพอใจเท่าที่แสดงไว้ โปรดอย่าใช้ผลลัพธ์ในรายงานนี้เพื่อคาดการณ์ผลการดำเนินงานจริงของการลงทุนในอนาคต สภาวะตลาด ผลกระทบทางภาษี หรืออัตราเงินเฟ้อ',
      ]
      return (
        <div style={{ marginBottom: 8 }}>
          {PARAS.map((t, i2) => (
            <p key={i2} style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.9, marginBottom: 12, textAlign: 'justify', textIndent: 30 }}>{t}</p>
          ))}
        </div>
      )
    }
    if (kind === 'taxfull') {
      // ── การวิเคราะห์ภาษีเงินได้ — จำลองหน้าวางแผนภาษีต่อคน ──
      const persons = [
        { name: `คุณ${client?.firstName || 'ลูกค้า'}`, st: taxPlanQ?.self, tint: TEAL },
        ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', st: taxPlanQ?.spouse, tint: '#8b5cf6' }] : []),
      ].filter(p2 => p2.st)
      if (!persons.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลแผนภาษี — กรอกที่หน้า "วางแผนภาษี" ก่อน</div>
      const INC_ROWS: { l: string; sec: string; k: string; expKey?: string }[] = [
        { l: 'เงินเดือน/ค่าจ้าง', sec: '40(1)', k: 'income40_1', expKey: 'income40_1' },
        { l: 'ค่าจ้าง/คอมมิชชั่น', sec: '40(2)', k: 'income40_2', expKey: 'income40_2' },
        { l: 'ค่าลิขสิทธิ์/Goodwill', sec: '40(3)', k: 'income40_3', expKey: 'income40_3' },
        { l: 'ดอกเบี้ย', sec: '40(4)', k: 'interest' },
        { l: 'เงินปันผล', sec: '40(4)', k: 'dividend' },
        { l: 'วิชาชีพอิสระ', sec: '40(6)', k: 'prof40_6', expKey: 'prof40_6' },
        { l: 'รับเหมา (มีค่าของ)', sec: '40(7)', k: 'income40_7', expKey: 'income40_7' },
        { l: 'ค่าเช่าทรัพย์สิน', sec: '40(5)', k: 'rental', expKey: 'rental' },
        { l: 'เงินได้อื่นๆ', sec: '40(8)', k: 'other40', expKey: 'other40' },
      ]
      const tdT: React.CSSProperties = { padding: '5px 8px', fontSize: 11.5, color: '#334155' }
      return (
        <div style={{ marginBottom: 16 }}>
          {persons.map(p2 => {
            const st = { ...defaultTaxState(), ...(p2.st as TaxState) }
            const c = calcTaxCalc(st)
            const incRows = INC_ROWS
              .map(r => ({ ...r, inc: toNum((st as any)[r.k]), exp: r.expKey ? expenseFor(st, r.expKey as any) : 0 }))
              .filter(r => r.inc > 0)
            // ภาษีแต่ละขั้นจากเงินได้สุทธิ
            const brRows = BRACKETS.map(b => ({
              label: b.rate === 0 ? `ยกเว้น · 0–${fmt(b.max)}` : `${b.rate * 100}% · ${fmt(b.min)}–${b.max > 9e9 ? 'ขึ้นไป' : fmt(b.max)}`,
              amt: c.ni > b.min ? (Math.min(c.ni, b.max) - b.min) * b.rate : null,
            })).filter(b => b.amt !== null)
            return (
              <div key={p2.name} style={{ marginBottom: 22, breakInside: 'avoid' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: p2.tint, borderLeft: `5px solid ${p2.tint}`, paddingLeft: 10, marginBottom: 10 }}>{p2.name} · ปีภาษี {new Date().getFullYear() + 543}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14 }}>
                  {/* ซ้าย: เงินได้พึงประเมิน + ภาษีแต่ละขั้น */}
                  <div>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                      <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>เงินได้พึงประเมิน</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                            {['ประเภทเงินได้', 'เงินได้', 'ค่าใช้จ่าย', 'หลังหักค่าใช้จ่าย'].map((h, i2) => (
                              <th key={h} style={{ padding: '4px 8px', fontSize: 9.5, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {incRows.map(r => (
                            <tr key={r.k} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={tdT}>{r.l} <span style={{ fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>{r.sec}</span></td>
                              <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.inc)}</td>
                              <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', color: AMBERR }}>{r.exp > 0 ? `−${fmt(r.exp)}` : '—'}</td>
                              <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>{fmt(r.inc - r.exp)}</td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                            <td style={{ ...tdT, fontWeight: 800, color: '#0f172a' }}>รวม</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>{fmt(c.ti)}</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: AMBERR }}>−{fmt(c.expD)}</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>{fmt(c.ti - c.expD)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>ภาษีแต่ละขั้น (เงินได้สุทธิ {fmt(c.ni)} บาท)</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>{brRows.map(b => (
                          <tr key={b.label} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={tdT}>{b.label}</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(b.amt as number)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                  {/* ขวา: ภาษีสุทธิ + สรุป + รายการลดหย่อน */}
                  <div>
                    <div style={{ border: `1px solid ${p2.tint}55`, background: '#f0fdfa', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                      <div style={{ fontSize: 10.5, color: '#64748b' }}>ภาษีที่ต้องชำระ (สุทธิ)</div>
                      <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: p2.tint }}>{fmt(c.netTax)} <span style={{ fontSize: 12 }}>บาท</span></div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>≈ {fmt(c.mth)} บาท/เดือน{st.prepaid > 0 ? ` · ภาษีก่อนหัก ณ ที่จ่าย ${fmt(c.tax)}` : ''}</div>
                    </div>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>สรุป</div>
                      {([
                        ['เงินได้พึงประเมินรวม', fmt(c.ti), '#0f172a'],
                        ['หักค่าใช้จ่าย', `−${fmt(c.expD)}`, AMBERR],
                        ['หักค่าลดหย่อนรวม', `−${fmt(c.allD - c.expD)}`, AMBERR],
                        ['เงินได้สุทธิ (ฐานภาษี)', fmt(c.ni), TEAL],
                        ['อัตราภาษีขั้นสูงสุด', `${c.mr.toFixed(0)}%`, AMBERR],
                        ['อัตราภาษีเฉลี่ย', `${c.eff.toFixed(2)}%`, AMBERR],
                      ] as const).map(([l, v, col]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc', fontSize: 11 }}>
                          <span style={{ color: '#64748b' }}>{l}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: col }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '8px 12px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>รายการลดหย่อน</div>
                      {c.deducts.map(d => (
                        <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 10.5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 999, background: d.c, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: '#475569' }}>{d.l}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(d.v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )
    }
    if (kind === 'estatefull') {
      // ── วางแผนมรดก: จำลองการแบ่งมรดก + ภาษีมรดก + สภาพคล่อง (สูตรเดียวกับหน้าวางแผนมรดก/deck) ──
      const selfName2 = `คุณ${client?.firstName || 'ลูกค้า'}`
      const spouseName2 = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
      const build = (who: 'self' | 'spouse') => {
        const inputs: any = estatePlanQ?.[who] ?? {}
        const R4 = who === 'self' ? ratios : ratiosSp
        const netWorth = toNum(R4?.summary?.netWorth)
        const liquid = toNum(R4?.summary?.liquidAssets)
        const debt = toNum(R4?.summary?.totalDebtBalance)
        const married = /สมรส/.test(String(client?.maritalStatus ?? '')) || hasSpouse
        const survivorName = who === 'self' ? spouseName2 : selfName2
        const spouseIsHeir = !!inputs.spouseAlive && married
        const spouseHalf = spouseIsHeir ? netWorth * (toNum(inputs.maritalAssetPct ?? 100) / 100) / 2 : 0
        const estateVal = Math.max(0, netWorth - spouseHalf)
        const kids: any[] = client?.children ?? []
        const parentsAlive = (inputs.fatherAlive ? 1 : 0) + (inputs.motherAlive ? 1 : 0)
        const wishes: any[] = inputs.wishes ?? []
        const wishTotal = wishes.reduce((x, w) => x + (Number(w.pct) || 0), 0)
        const useWill = !!inputs.hasWill && wishes.length > 0 && wishTotal > 0
        const THRESH = 100_000_000
        const heirTax = (share: number, rel: string) => rel === 'spouse' ? 0 : Math.max(0, share - THRESH) * (rel === 'lineal' ? 0.05 : 0.10)
        let heirs: { name: string; share: number; rel: string; note: string }[]
        if (useWill) {
          heirs = wishes.filter(w => (Number(w.pct) || 0) > 0).map(w => ({ name: w.name || 'ผู้รับ', share: estateVal * (Number(w.pct) || 0) / 100, rel: w.rel || 'lineal', note: `ตามพินัยกรรม ${Number(w.pct) || 0}%` }))
        } else {
          const shares = kids.length + (spouseIsHeir ? 1 : 0) + parentsAlive
          const each = shares > 0 ? estateVal / shares : estateVal
          heirs = []
          if (spouseIsHeir) heirs.push({ name: survivorName, share: each, rel: 'spouse', note: 'คู่สมรส (รับส่วนเท่าบุตร)' })
          kids.forEach((c2, i2) => heirs.push({ name: c2.name || `บุตรคนที่ ${i2 + 1}`, share: each, rel: 'lineal', note: 'บุตร (ผู้สืบสันดาน)' }))
          if (inputs.fatherAlive) heirs.push({ name: 'บิดา', share: each, rel: 'lineal', note: 'บิดา (ม.1630 ว.2)' })
          if (inputs.motherAlive) heirs.push({ name: 'มารดา', share: each, rel: 'lineal', note: 'มารดา (ม.1630 ว.2)' })
        }
        const totalTax = heirs.reduce((x, h) => x + heirTax(h.share, h.rel), 0)
        const needLiquid = totalTax + debt
        return { netWorth, liquid, debt, spouseIsHeir, spouseHalf, estateVal, useWill, heirs, totalTax, needLiquid, hasWill: !!inputs.hasWill, willType: inputs.willType, survivorName, heirTax }
      }
      const cases = [
        { title: `กรณี ${selfName2} เสียชีวิต`, e: build('self'), tint: TEAL },
        ...(hasSpouse ? [{ title: `กรณี ${spouseName2} เสียชีวิต`, e: build('spouse'), tint: '#8b5cf6' }] : []),
      ]
      const relLabel = (rel: string) => rel === 'spouse' ? 'คู่สมรส (ยกเว้นภาษี)' : rel === 'lineal' ? 'บุพการี/ผู้สืบสันดาน (5%)' : 'อื่น ๆ (10%)'
      const Card = ({ l, v, c, note }: { l: string; v: string; c: string; note?: string }) => (
        <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
          {note && <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>{note}</div>}
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
            ประมาณการการแบ่งมรดกตามประมวลกฎหมายแพ่งและพาณิชย์ บรรพ 6 · ภาษีมรดกตาม พ.ร.บ.ภาษีการรับมรดก 2558 (ผู้รับสุทธิเกิน 100 ล้าน: ผู้สืบสันดาน/บุพการี 5% · อื่น 10% · คู่สมรสยกเว้น) — เป็นเครื่องมือประกอบการวางแผนเท่านั้น การจัดทำพินัยกรรมจริงควรปรึกษาทนายความ
          </p>
          {cases.map(({ title, e, tint }) => (
            <div key={title} style={{ marginBottom: 22, breakInside: 'avoid' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: tint, borderLeft: `5px solid ${tint}`, paddingLeft: 10, marginBottom: 10 }}>{title}</div>
              {/* กองมรดกสุทธิ */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                <Card l="ความมั่งคั่งสุทธิ (สินทรัพย์ − หนี้สิน)" v={fmt(e.netWorth)} c="#0f172a" note="ดึงจากงบดุล" />
                <Card l="คู่สมรสรับก่อน (½ สินสมรส)" v={e.spouseIsHeir ? fmt(e.spouseHalf) : '—'} c="#0284c7" note={e.spouseIsHeir ? 'ไม่ถือเป็นมรดก' : 'ไม่มีคู่สมรสที่มีชีวิตอยู่'} />
                <Card l="กองมรดกสุทธิ (นำมาแบ่ง)" v={fmt(e.estateVal)} c={tint} />
              </div>
              {/* การแบ่งมรดก */}
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                  การแบ่งมรดก{e.useWill ? 'ตามพินัยกรรม' : 'ตามกฎหมาย (กรณีไม่มีพินัยกรรม · ทายาทโดยธรรม ม.1629, 1635)'}
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: e.hasWill ? GREENR : AMBERR, background: e.hasWill ? `${GREENR}14` : `${AMBERR}14`, borderRadius: 999, padding: '2px 9px' }}>
                    {e.hasWill ? `มีพินัยกรรมแล้ว${e.willType ? ` · ${e.willType}` : ''}` : 'ยังไม่มีพินัยกรรม — ควรจัดทำ'}
                  </span>
                </div>
                {e.heirs.length === 0
                  ? <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>— ยังไม่มีข้อมูลทายาท (กรอกที่หน้า "วางแผนมรดก") —</div>
                  : e.heirs.map((h, i2) => {
                      const pctSh = e.estateVal > 0 ? h.share / e.estateVal * 100 : 0
                      return (
                        <div key={i2} style={{ padding: '7px 12px', borderBottom: '1px solid #f8fafc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{h.name} <span style={{ fontSize: 10.5, fontWeight: 400, color: '#94a3b8' }}>· {h.note}</span></span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: tint }}>{fmt(h.share)} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>({pctSh.toFixed(1)}%)</span></span>
                          </div>
                          <div style={{ height: 5, borderRadius: 999, background: '#f1f5f9', marginTop: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.max(2, pctSh)}%`, borderRadius: 999, background: tint }} />
                          </div>
                          {h.rel === 'spouse' && e.spouseHalf > 0 && (
                            <div style={{ fontSize: 10, color: '#0284c7', marginTop: 3 }}>+ ½ สินสมรส {fmt(e.spouseHalf)} → รับรวม {fmt(h.share + e.spouseHalf)} บาท</div>
                          )}
                        </div>
                      )
                    })}
              </div>
              {/* ภาษีมรดก & สภาพคล่อง */}
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>ภาษีมรดก & สภาพคล่อง</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <tbody>
                    {e.heirs.map((h, i2) => {
                      const tx = e.heirTax(h.share, h.rel)
                      return (
                        <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '5px 12px', color: '#334155' }}>{h.name}</td>
                          <td style={{ padding: '5px 12px', color: '#94a3b8', fontSize: 10.5 }}>{relLabel(h.rel)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(h.share)}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: tx > 0 ? REDR : GREENR, width: 90 }}>{tx > 0 ? fmt(tx) : 'ยกเว้น'}</td>
                        </tr>
                      )
                    })}
                    <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                      <td colSpan={3} style={{ padding: '6px 12px', fontWeight: 800, color: '#0f172a' }}>ภาษีมรดกรวม{e.totalTax === 0 ? ' — ผู้รับแต่ละรายได้รับไม่เกิน 100 ล้านบาท จึงไม่มีภาษีมรดก' : ''}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: e.totalTax > 0 ? REDR : GREENR }}>{fmt(e.totalTax)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '10px 12px', background: '#fffbf5' }}>
                  <Card l="ต้องใช้ (ภาษี + หนี้สินตกทอด)" v={fmt(e.needLiquid)} c={AMBERR} note={`ภาษี ${fmt(e.totalTax)} + หนี้ ${fmt(e.debt)}`} />
                  <Card l="สินทรัพย์สภาพคล่อง" v={fmt(e.liquid)} c="#0284c7" />
                  <Card l={e.liquid >= e.needLiquid ? 'สภาพคล่องเพียงพอ (คงเหลือ)' : 'ขาดสภาพคล่อง'} v={fmt(Math.abs(e.liquid - e.needLiquid))} c={e.liquid >= e.needLiquid ? GREENR : REDR} note={e.liquid >= e.needLiquid ? undefined : 'แนะนำทำประกันชีวิต (ระบุผู้รับผลประโยชน์) เพื่อเติมสภาพคล่อง'} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (kind === 'fin_invest' || kind === 'fin_invest_sp') {
      // ── การวิเคราะห์สินทรัพย์ลงทุนที่มี: พอร์ตเดิม + Monte Carlo + พอร์ตแนะนำ/เปรียบเทียบ (ตรรกะเดียวกับแท็บปรับสัดส่วน · มีเวอร์ชันคู่สมรส) ──
      const isSp = kind === 'fin_invest_sp'
      if (isSp && !hasSpouse) return null
      const invAssetsList: any[] = (isSp ? invProfile?.spouseData?.investmentAssets : invProfile?.investmentAssets) ?? []
      const totalInv2 = isSp ? totalInvSp : totalInv
      const portRet2 = isSp ? portRetSp : portRet
      if (totalInv2 <= 0) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน{isSp ? 'ของคู่สมรส' : ''}</div>
      const annRet = (a: any): number | null => {
        const cost = toNum(a.investAmount), val = toNum(a.currentValue)
        if (cost > 0 && val > 0 && a.investDate) {
          const st = new Date(a.investDate)
          if (!isNaN(st.getTime())) {
            const yrs = (Date.now() - st.getTime()) / (365.25 * 24 * 3600 * 1000)
            if (yrs >= 1 / 365.25) return (Math.pow(val / cost, 1 / yrs) - 1) * 100
          }
        }
        const m = parseFloat(a.annualReturn)
        return isNaN(m) ? null : m
      }
      const rpKey = isSp ? 'spouse' : 'self'
      const curAge = (isSp ? retPlan?.spouse?.currentAge ?? client?.spouseAge : retPlan?.self?.currentAge ?? age) ?? 45
      const lifeExp = (isSp ? profile?.lifeExpectancySpouse : profile?.lifeExpectancySelf) ?? retPlan?.[rpKey]?.lifeExpectancy ?? 85
      const retAge = (isSp ? profile?.retirementAgeSpouse : profile?.retirementAgeSelf) ?? retPlan?.[rpKey]?.retirementAge ?? 60
      const years = Math.max(1, lifeExp - curAge)
      const riskSrc2 = isSp ? profile?.spouseRisk : profile
      const riskLabel = String(riskSrc2?.riskLabel ?? riskSrc2?.riskLevel ?? '')
      const curSd = /สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (portRet2 >= 8 ? 16 : portRet2 >= 4 ? 11 : 6)
      const pctile = (arr: number[], q: number) => { const idx = (arr.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo) }
      const simulate = (mu0: number, sd0: number, seed: number) => {
        const mu = mu0 / 100, sd = sd0 / 100
        const rng = mulberry32(seed >>> 0 || 1)
        const byYear: number[][] = Array.from({ length: years + 1 }, () => [])
        for (let k2 = 0; k2 < 600; k2++) {
          let v = totalInv2
          byYear[0].push(v)
          for (let y = 1; y <= years; y++) {
            let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
            v *= Math.exp((mu - sd * sd / 2) + sd * z)
            byYear[y].push(v)
          }
        }
        return byYear.map(arr => { const so = arr.slice().sort((x, y2) => x - y2); return { p10: pctile(so, 0.1), p50: pctile(so, 0.5), p90: pctile(so, 0.9) } })
      }
      const seedB = (Math.round(totalInv2) ^ (years << 4)) >>> 0
      const curSim = simulate(portRet2, curSd, seedB ^ 0x1111)
      const curRows = curSim.map((c2, i2) => ({ age: curAge + i2, ค่ากลาง: Math.round(c2.p50), band: [Math.round(c2.p10), Math.round(c2.p90)] as [number, number] }))
      const rIdx = Math.min(Math.max(0, retAge - curAge), years)
      // พอร์ตแนะนำ + พอร์ตที่เลือกไว้ (จากแท็บการปรับสัดส่วนลงทุน)
      const assetsMk = applyMarketData(DEFAULT_ASSETS, marketData)
      const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
      const ports = PORTFOLIO_SETS.map(set => {
        const results = set.options.map(o => computePortfolio(o.weights, assetsMk, matrix))
        const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
        return { id: set.id, label: set.label, sub: set.sub, color: set.color, weights: set.options[bi].weights, ...results[bi] }
      })
      const selTier = rebalQ?.[rpKey]?.tier ?? null
      const selP = ports.find(p2 => p2.id === selTier) ?? null
      const newSim = selP ? simulate(selP.ret, selP.sigma, seedB ^ 0x2222) : null
      const cmpRows = newSim ? curSim.map((c2, i2) => ({ age: curAge + i2, พอร์ตเดิม: Math.round(c2.p50), พอร์ตใหม่: Math.round(newSim[i2].p50), band: [Math.round(newSim[i2].p10), Math.round(newSim[i2].p90)] as [number, number] })) : null
      const W_LBL2 = ['ตราสารหนี้', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ']
      const W_CLR2 = ['#0284c7', GREENR, AMBERR, '#f43f5e']
      const subH2: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '18px 0 10px' }
      const tdI: React.CSSProperties = { padding: '5px 10px', fontSize: 11.5, color: '#334155' }
      const StatC = ({ l, v, c }: { l: string; v: string; c: string }) => (
        <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          {/* ── 1. การจัดสัดส่วนการลงทุนเดิม ── */}
          <div style={{ ...subH2, marginTop: 0 }}>การจัดสัดส่วนการลงทุนเดิม</div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10, breakInside: 'avoid' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['สินทรัพย์', 'ประเภท', 'ผลตอบแทน/ปี', 'มูลค่าปัจจุบัน'].map((h, i2) => (
                    <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invAssetsList.filter((a: any) => toNum(a.currentValue) > 0).map((a: any, i2: number) => {
                  const r = annRet(a)
                  return (
                    <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={tdI}>{a.assetName || `สินทรัพย์ที่ ${i2 + 1}`}</td>
                      <td style={{ ...tdI, color: '#94a3b8' }}>{a.assetClass || '—'}</td>
                      <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r == null ? '#94a3b8' : r >= 0 ? GREENR : REDR }}>{r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`}</td>
                      <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(toNum(a.currentValue))}</td>
                    </tr>
                  )
                })}
                <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                  <td colSpan={3} style={{ ...tdI, fontWeight: 800, color: '#0f172a' }}>รวม</td>
                  <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: TEAL }}>{fmt(totalInv2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
            <StatC l="มูลค่าสินทรัพย์ลงทุน" v={`฿${fmt(totalInv2)}`} c={TEAL} />
            <StatC l="ผลตอบแทนพอร์ต (ต่อปี)" v={`${portRet2.toFixed(2)}%`} c={AMBERR} />
            <StatC l="อายุปัจจุบัน" v={`${curAge} ปี`} c="#0f172a" />
            <StatC l="อายุขัยที่คาดไว้" v={`${lifeExp} ปี`} c="#0f172a" />
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px', breakInside: 'avoid' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>มูลค่าสินทรัพย์ลงทุนในอนาคต — Monte Carlo (เส้น = ค่ากลาง · แถบ = ช่วง P10–P90)</div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curRows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                  <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={38} />
                  <Tooltip formatter={(v: any) => Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                  <ReferenceLine x={retAge} stroke={AMBERR} strokeDasharray="4 3" label={{ value: `เกษียณ ${retAge}`, position: 'insideTopLeft', fontSize: 9.5, fill: AMBERR }} />
                  <Area dataKey="band" stroke="none" fill={TEAL} fillOpacity={0.15} />
                  <Line dataKey="ค่ากลาง" stroke={TEAL} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '10px 0 4px' }}>
            <StatC l={`ดี (P90) ณ เกษียณ อายุ ${retAge}`} v={fmt(curSim[rIdx].p90)} c={GREENR} />
            <StatC l="ค่ากลาง (P50) ณ เกษียณ" v={fmt(curSim[rIdx].p50)} c="#0f172a" />
            <StatC l="แย่ (P10) ณ เกษียณ" v={fmt(curSim[rIdx].p10)} c={REDR} />
          </div>

          {/* ── 2. สัดส่วนการลงทุนแนะนำ ── */}
          <div style={subH2}>สัดส่วนการลงทุนแนะนำ</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {ports.map(p2 => {
              const active = p2.id === selTier
              return (
                <div key={p2.id} style={{ border: active ? `2px solid ${p2.color}` : '1px solid #f1f5f9', background: active ? `${p2.color}0a` : 'transparent', borderRadius: 12, padding: '10px 12px', position: 'relative', breakInside: 'avoid' }}>
                  {active && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: '#fff', background: p2.color, borderRadius: 999, padding: '2px 8px' }}>พอร์ตที่เลือก ✓</span>}
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: p2.color }}>{p2.label}</div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', marginBottom: 6 }}>{p2.sub}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 8 }}>
                    {p2.weights.map((w, i2) => (
                      <div key={i2} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 7.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{W_LBL2[i2]}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{w}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                    {([['E(Rp)', `+${p2.ret.toFixed(2)}%`, GREENR], ['σ', `${p2.sigma.toFixed(2)}%`, AMBERR], ['Sharpe', p2.sharpe.toFixed(2), '#0f172a']] as const).map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: '#94a3b8' }}>{l}</div>
                        <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {selP && cmpRows && newSim ? (
            <>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 12px', marginBottom: 10, breakInside: 'avoid' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>จัดสัดส่วนเงินลงทุนปัจจุบัน ฿{fmt(totalInv2)} ตาม{selP.label}</div>
                <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                  {selP.weights.map((w, i2) => w > 0 && <div key={i2} style={{ width: `${w}%`, background: W_CLR2[i2] }} />)}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <tbody>
                    {selP.weights.map((w, i2) => (
                      <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '4px 8px', color: '#334155' }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: W_CLR2[i2], marginRight: 7 }} />{W_LBL2[i2]}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{w}%</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(totalInv2 * w / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <StatC l={`พอร์ตเดิม — ค่ากลาง ณ เกษียณ (อายุ ${retAge})`} v={`฿${fmt(curSim[rIdx].p50)}`} c={AMBERR} />
                <StatC l={`พอร์ตใหม่ (${selP.label}) — ค่ากลาง ณ เกษียณ`} v={`฿${fmt(newSim[rIdx].p50)}`} c={selP.color} />
                <StatC l="ส่วนต่างค่ากลาง ณ เกษียณ" v={`${newSim[rIdx].p50 >= curSim[rIdx].p50 ? '+' : '−'}฿${fmt(Math.abs(newSim[rIdx].p50 - curSim[rIdx].p50))}`} c={newSim[rIdx].p50 >= curSim[rIdx].p50 ? GREENR : REDR} />
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px', breakInside: 'avoid' }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>เปรียบเทียบมูลค่าอนาคต — พอร์ตเดิม vs พอร์ตใหม่ (แถบ = ช่วง P10–P90 พอร์ตใหม่)</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={cmpRows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                      <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={38} />
                      <Tooltip formatter={(v: any) => Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                      <Legend wrapperStyle={{ fontSize: 10.5 }} />
                      <ReferenceLine x={retAge} stroke={AMBERR} strokeDasharray="4 3" />
                      <Area dataKey="band" name="ช่วง 80% (พอร์ตใหม่)" stroke="none" fill={selP.color} fillOpacity={0.13} />
                      <Line dataKey="พอร์ตเดิม" stroke={AMBERR} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                      <Line dataKey="พอร์ตใหม่" stroke={selP.color} strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.7, marginTop: 8 }}>
                * พอร์ตเดิมใช้ผลตอบแทนถัวเฉลี่ยจากสินทรัพย์จริง {portRet2.toFixed(2)}%/ปี ความผันผวน {curSd}% · พอร์ตใหม่ใช้ E(Rp) {selP.ret.toFixed(2)}%/ปี σ {selP.sigma.toFixed(2)}% · การจำลองเพื่อเปรียบเทียบ ไม่ใช่การรับประกันผลตอบแทน
              </p>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '10px 14px' }}>
              ยังไม่ได้เลือกพอร์ตเป้าหมาย — เลือกได้ที่เมนู "มูลค่าสินทรัพย์ลงทุน → การปรับสัดส่วนลงทุน" แล้วหน้านี้จะแสดงการจัดสัดส่วนใหม่และกราฟเปรียบเทียบอัตโนมัติ
            </div>
          )}
        </div>
      )
    }
    if (kind === 'advprofile') {
      // ── หน้า Profile นักวางแผน (หน้าสุดท้าย) — ข้อมูลจากตั้งค่าผู้ใช้ · ข้อความ/รูปแก้ไขได้ในหน้า ──
      const bio = (secs['advprofile']?.text ?? '') !== '' ? secs['advprofile']!.text : (advisor?.bio || '')
      const photo = signatures.advpage_photo || advisor?.photo || ''
      const onPickPhoto = (file?: File | null) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            let { width, height } = img
            const max = 900
            if (width > height && width > max) { height = height * max / width; width = max }
            else if (height > max) { width = width * max / height; height = max }
            const cv = document.createElement('canvas')
            cv.width = width; cv.height = height
            cv.getContext('2d')!.drawImage(img, 0, 0, width, height)
            setSignatures(sg => ({ ...sg, advpage_photo: cv.toDataURL('image/jpeg', 0.85) }))
          }
          img.src = reader.result as string
        }
        reader.readAsDataURL(file)
      }
      const addr = advisor?.address || [advisor?.addrHouseNo, advisor?.addrSubdistrict && `ต.${advisor.addrSubdistrict}`, advisor?.addrDistrict && `อ.${advisor.addrDistrict}`, advisor?.addrProvince && `จ.${advisor.addrProvince}`, advisor?.addrZipcode].filter(Boolean).join(' ')
      const creds = [
        advisor?.licenseCFP && `คุณวุฒินักวางแผนการเงิน CFP เลขที่ ${advisor.licenseCFP}`,
        advisor?.licenseFChFP && `คุณวุฒิที่ปรึกษาการเงินมืออาชีพ (FChFP) เลขที่ ${advisor.licenseFChFP}`,
        advisor?.licenseAFPT && `คุณวุฒิที่ปรึกษาการเงิน AFPT เลขที่ ${advisor.licenseAFPT}`,
        advisor?.licenseInsurance && `ใบอนุญาตตัวแทน/นายหน้าประกันชีวิต เลขที่ ${advisor.licenseInsurance}`,
      ].filter(Boolean) as string[]
      const Contact = ({ icon, text }: { icon: string; text: string }) => (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</div>
          <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, paddingTop: 6 }}>{text}</div>
        </div>
      )
      return (
        <div style={{ margin: '-8px 0 0', display: 'flex', flexDirection: 'column', minHeight: 900 }}>
          {/* แถบ hero ด้านบน (print-safe gradient ธีม WealthPro) */}
          <div style={{ position: 'relative', height: 170, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)', marginBottom: 24 }}>
            <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
            <div style={{ position: 'absolute', left: -40, bottom: -70, width: 200, height: 200, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)' }} />
            <div style={{ position: 'absolute', left: 30, bottom: 26 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>YOUR FINANCIAL PLANNER</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>นักวางแผนการเงินของคุณ</div>
            </div>
            <div style={{ position: 'absolute', right: 26, bottom: 22, fontSize: 15, fontWeight: 800 }}>
              <span style={{ color: '#fff' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
            </div>
          </div>

          {/* คำแนะนำตัว (พิมพ์แก้ได้) */}
          <textarea value={bio} onChange={e => setText('advprofile', e.target.value)}
            placeholder={'พิมพ์ข้อความแนะนำตัว/ประสบการณ์ของนักวางแผนการเงิน...'}
            rows={Math.max(5, bio.split('\n').length + 1)}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: '#1e293b', lineHeight: 2, fontStyle: 'italic', marginBottom: 8 }} />
          {creds.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {creds.map(c2 => (
                <div key={c2} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#334155', lineHeight: 1.9 }}>
                  <span style={{ color: TEAL, fontWeight: 800 }}>✓</span>{c2}
                </div>
              ))}
            </div>
          )}

          {/* ชื่อ + ติดต่อ | รูป */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 36, marginTop: 'auto', paddingTop: 20 }}>
            <div>
              <div style={{ width: 190, height: 4, background: '#0f172a', marginBottom: 16 }} />
              <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{advisor?.fullName || 'นักวางแผนการเงิน'}{advisor?.licenseCFP ? ', CFP' : ''}</div>
              {advisor?.position && <div style={{ fontSize: 15, color: '#475569', marginTop: 4 }}>{advisor.position}</div>}
              {advisor?.company && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 2 }}>{advisor.company}</div>}
              <div style={{ marginTop: 24 }}>
                {advisor?.phone && <Contact icon="✆" text={advisor.phone} />}
                {advisor?.email && <Contact icon="✉" text={advisor.email} />}
                {addr && <Contact icon="⌂" text={addr} />}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <label style={{ cursor: 'pointer', width: '100%' }} title="คลิกเพื่อเปลี่ยนรูป">
                {photo
                  ? <img src={photo} alt="" style={{ width: '100%', maxHeight: 330, objectFit: 'cover', borderRadius: 14, border: `1.5px solid ${TEAL}55` }} />
                  : <div style={{ width: '100%', height: 300, borderRadius: 14, border: '1.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#94a3b8' }}>คลิกเพื่อใส่รูปนักวางแผน</div>}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { onPickPhoto(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {photo && <span className="no-print" style={{ fontSize: 10.5, color: '#94a3b8' }}>คลิกที่รูปเพื่อเปลี่ยน</span>}
            </div>
          </div>

          {/* แถบปิดท้าย */}
          <div style={{ height: 60, borderRadius: 14, marginTop: 28, background: 'linear-gradient(90deg, #0f172a 0%, #134e4a 60%, #00cfc1 140%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.85)' }}>WEALTHPRO · FINANCIAL PLANNING</span>
          </div>
        </div>
      )
    }
    if (kind === 'assumptions') {
      const pc = (v: any, suffix = '%') => v == null || v === '' ? '—' : `${v}${suffix}`
      const rows: [string, string][] = [
        ['อัตราเงินเฟ้อทั่วไป', pc(profile?.inflationRate ?? 3)],
        ['อัตราเงินเฟ้อค่าการศึกษา', pc(eduInf)],
        ['ผลตอบแทนกองทุนเพื่อการศึกษา', pc(eduRet)],
        ['อายุเกษียณ (ลูกค้า)', pc(profile?.retirementAgeSelf ?? 60, ' ปี')],
        ['อายุขัยที่ใช้วางแผน (ลูกค้า)', pc(profile?.lifeExpectancySelf ?? 85, ' ปี')],
        ...(client?.spouseProfile?.firstName ? [
          ['อายุเกษียณ (คู่สมรส)', pc(profile?.retirementAgeSpouse ?? 60, ' ปี')] as [string, string],
          ['อายุขัยที่ใช้วางแผน (คู่สมรส)', pc(profile?.lifeExpectancySpouse ?? 85, ' ปี')] as [string, string],
        ] : []),
        ['ผลตอบแทนคาดหวังก่อนเกษียณ', pc(retPlan?.self?.preRetirementReturn ?? 8)],
        ['ผลตอบแทนคาดหวังหลังเกษียณ', pc(retPlan?.self?.postRetirementReturn ?? 5)],
        ['อัตราการเติบโตของรายได้', pc(retPlan?.self?.savingsGrowthRate ?? 0)],
        ['ผลตอบแทนพอร์ตลงทุนปัจจุบัน (ถัวเฉลี่ย)', `${portRet.toFixed(1)}%`],
      ]
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 12 }}>การคำนวณทั้งหมดในรายงานฉบับนี้ตั้งอยู่บนสมมติฐานต่อไปนี้ การเปลี่ยนแปลงของสมมติฐานแม้เพียงเล็กน้อยอาจส่งผลต่อผลลัพธ์อย่างมีนัยสำคัญ</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>{rows.map(([l, v], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fbfdfe' : 'transparent' }}>
                <td style={{ padding: '8px 10px', color: '#475569' }}>{l}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{v}</td>
              </tr>
            ))}</tbody>
          </table>
          <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.7 }}>* สมมติฐานปรับแก้ได้ที่หน้า "สมมติฐาน" ของโปรแกรม และควรทบทวนร่วมกันอย่างน้อยปีละ 1 ครั้ง</p>
          {/* ค่าใช้จ่ายด้านการศึกษา (มูลค่าปัจจุบัน) */}
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '22px 0 10px' }}>ค่าใช้จ่ายด้านการศึกษา (มูลค่าปัจจุบัน ณ ปี พ.ศ. {new Date().getFullYear() + 543})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                {['ระดับการศึกษา', 'สถาบันรัฐ (บาท/ปี)', 'สถาบันเอกชน (บาท/ปี)', 'สถาบันนานาชาติ (บาท/ปี)'].map((h, i2) => (
                  <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{([['kindergarten', 'อนุบาล 1–3'], ['primary', 'ประถม 1–6'], ['secondary', 'มัธยม 1–6'], ['bachelor', 'ปริญญาตรี (ปีแรก)'], ['master', 'ปริญญาโท (ปีแรก)']] as const).map(([k2, lbl], i2) => (
              <tr key={k2} style={{ borderBottom: '1px solid #f1f5f9', background: i2 % 2 ? '#fbfdfe' : 'transparent' }}>
                <td style={{ padding: '7px 10px', color: '#475569' }}>{lbl}</td>
                {(['public', 'private', 'international'] as const).map(t2 => (
                  <td key={t2} style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: toNum(eduCosts?.[k2]?.[t2]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                    {toNum(eduCosts?.[k2]?.[t2]) > 0 ? fmt(toNum(eduCosts[k2][t2])) : '—'}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )
    }
    if (kind === 'execsum') {
      // ── บทสรุปผู้บริหาร: 3 กล่อง bullet พิมพ์ได้+เพิ่มแถวได้ (ค่าเริ่มต้นเติมตัวเลขจริง) + สรุปแผนดำเนินการจากข้อมูล ──
      const EMPTY4 = ['', '', '', '']
      const RowsBox = ({ k, title, defaults }: { k: string; title: string; defaults: string[] }) => {
        const rows = (secs[k]?.text ?? '') !== '' ? (secs[k]!.text).split('\n') : defaults
        const save = (r: string[]) => setText(k, r.length ? r.join('\n') : ' ')
        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>{title}</div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
              {rows.map((r, i2) => (
                <div key={i2} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: i2 < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <span style={{ color: '#64748b', flexShrink: 0 }}>–</span>
                  <input value={r} onChange={e => save(rows.map((x, j) => j === i2 ? e.target.value : x))}
                    placeholder="พิมพ์ข้อความ"
                    style={{ flex: 1, border: 'none', borderBottom: '1px dashed #cbd5e1', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: '#1e293b', padding: '2px 0' }} />
                  <button className="no-print" onClick={() => save(rows.filter((_, j) => j !== i2))} title="ลบแถว"
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 13, padding: 0, flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
            <button className="no-print" onClick={() => save([...rows, ''])}
              style={{ marginTop: 5, padding: '3px 12px', borderRadius: 7, border: '1px dashed #cbd5e1', background: 'transparent', color: '#64748b', fontSize: 11.5, cursor: 'pointer' }}>+ เพิ่มแถว</button>
          </div>
        )
      }
      // สรุปแผนดำเนินการ — ดึงจากแผนปฏิบัติการ (แหล่งเดียวกับหน้า action)
      const ownerTh = (o: string) => o === 'client' ? 'ลูกค้า' : o === 'advisor' ? 'ที่ปรึกษา' : o === 'spouse' ? 'คู่สมรส' : (o || '')
      const PR_LBL: Record<string, string> = { high: 'สูง', medium: 'กลาง', low: 'ต่ำ' }
      type Ln2 = { plan: string; amount: number; schedule: string; owner: string; priority: string; done: boolean }
      const lines: Ln2[] = []
      for (const it of actionItems) {
        const rows: any[] = Array.isArray(it.subPlan) ? it.subPlan : []
        const done = it.status === 'done' || !!it.completedAt
        if (!rows.length) { lines.push({ plan: it.title, amount: toNum(it.target), schedule: it.dueDate || '', owner: ownerTh(it.owner), priority: PR_LBL[it.priority] ?? '', done }); continue }
        for (const r of rows) {
          const plan = String(r?.desc || r?.method || r?.who || '').trim()
          const amount = toNum(r?.amount ?? r?.premium)
          if (!plan && amount <= 0 && !r?.schedule) continue
          lines.push({ plan: plan || it.title, amount, schedule: r?.schedule || '', owner: String(r?.owner || '').trim() || ownerTh(it.owner), priority: String(r?.priority || '') || (PR_LBL[it.priority] ?? ''), done: !!r?.done || done })
        }
      }
      const PR_ORD: Record<string, number> = { 'สูง': 0, 'กลาง': 1, 'ต่ำ': 2 }
      const PR_CLR: Record<string, string> = { 'สูง': REDR, 'กลาง': AMBERR, 'ต่ำ': '#64748b' }
      lines.sort((a, b) => (PR_ORD[a.priority] ?? 3) - (PR_ORD[b.priority] ?? 3))
      const fmtDate = (x: string) => { const d = new Date(x); return isNaN(d.getTime()) ? x : d.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) }
      const thS: React.CSSProperties = { padding: '5px 8px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textAlign: 'left' }
      const tdS: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: '#1e293b' }
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.85, marginBottom: 16, textAlign: 'justify', textIndent: 28 }}>
            รายงานนี้ใช้แบบจำลองทางการเงินเพื่อแสดงภาพสถานะทางการเงินในปัจจุบันของท่าน รวมถึงแนวทางที่เป็นไปได้สำหรับอนาคต อย่างไรก็ตาม ภาวะเศรษฐกิจและตลาดในอนาคตไม่สามารถคาดการณ์ได้อย่างแน่นอนและอาจเปลี่ยนแปลงได้ สมมติฐานที่ใช้เป็นเพียงตัวแทนของสภาวะเศรษฐกิจและตลาดที่อาจเกิดขึ้น โดยมีวัตถุประสงค์เพื่อสนับสนุนการพิจารณาแนวทางที่เหมาะสมทั้งในปัจจุบันและอนาคต เพื่อให้ท่านสามารถบริหารและรักษาสถานะทางการเงินได้ภายใต้สภาวการณ์ที่เปลี่ยนแปลง
          </p>
          <RowsBox k="exs2_status" title="สถานะทางการเงินในปัจจุบัน" defaults={EMPTY4} />
          <RowsBox k="exs2_goals" title="เป้าหมายของท่าน" defaults={EMPTY4} />
          <RowsBox k="exs2_analysis" title="สรุปผลการวิเคราะห์" defaults={EMPTY4} />
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>สรุปแผนดำเนินการ</div>
          {lines.length === 0
            ? <div style={{ fontSize: 12, color: '#94a3b8' }}>ยังไม่มีรายการในแผนปฏิบัติการ</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ ...thS, width: 24 }} />
                    <th style={thS}>แผนดำเนินการ</th>
                    <th style={{ ...thS, textAlign: 'right' }}>จำนวนเงิน</th>
                    <th style={thS}>กำหนดการ</th>
                    <th style={thS}>ผู้รับผิดชอบ</th>
                    <th style={thS}>ความสำคัญ</th>
                  </tr>
                </thead>
                <tbody>{lines.map((l, i2) => (
                  <tr key={i2} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdS, fontSize: 13, color: l.done ? GREENR : '#94a3b8' }}>{l.done ? '☑' : '☐'}</td>
                    <td style={{ ...tdS, color: l.done ? '#94a3b8' : '#1e293b', textDecoration: l.done ? 'line-through' : 'none' }}>{l.plan}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: l.amount > 0 ? '#0f172a' : '#94a3b8' }}>{l.amount > 0 ? fmt(l.amount) : '—'}</td>
                    <td style={{ ...tdS, color: '#475569' }}>{l.schedule ? fmtDate(l.schedule) : '—'}</td>
                    <td style={{ ...tdS, color: '#475569' }}>{l.owner || '—'}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: PR_CLR[l.priority] || '#94a3b8' }}>{l.priority || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>}
        </div>
      )
    }
    if (kind === 'basicinfo') {
      // ── วิเคราะห์ข้อมูลพื้นฐาน: ครอบครัว + งาน/สวัสดิการ (ข้อมูลชุดเดียวกับสไลด์ family/work ของเด็ค) ──
      const spouseName2 = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
      const selfName2 = `คุณ${client?.firstName || 'ลูกค้า'}`
      const healthSummary = (hi: any): string => {
        if (!hi) return ''
        const cond: string[] = []
        if (hi.chronic?.has) cond.push(`โรคประจำตัว${hi.chronic.detail ? ': ' + hi.chronic.detail : ''}`)
        if (hi.severeIllness?.has) cond.push(`โรคร้ายแรง${hi.severeIllness.detail ? ': ' + hi.severeIllness.detail : ''}`)
        const base = cond.length ? cond.join(' · ') : 'สุขภาพแข็งแรง ไม่มีโรคประจำตัว'
        return [base, [hi.smoke, hi.alcohol].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')
      }
      const incomeList = (sources: any, fallbackSalary = 0) => {
        const arr = (Array.isArray(sources) ? sources : []).map((r: any) => {
          const amt = toNum(r?.amount)
          const isBonus = (r?.label || '').includes('โบนัส')
          return { label: r?.source ? `${r.label} · ${r.source}` : (r?.label || 'รายได้'), amount: amt, yearly: isBonus ? amt : amt * 12, isBonus }
        }).filter((r: any) => r.amount > 0)
        if (arr.length === 0 && fallbackSalary > 0) arr.push({ label: 'เงินเดือน', amount: fallbackSalary, yearly: fallbackSalary * 12, isBonus: false })
        return arr
      }
      const hobbyOf = (hi: any): string => hi?.hobby?.has ? (hi.hobby.detail?.trim() || 'มี') : ''
      const familyCards = [
        { name: selfName2, age2: age, occ: client?.occupation || client?.jobTitle, incomes: incomeList(client?.incomeSources, toNum(client?.salary)), health: healthSummary(client?.healthInfo), hobby: hobbyOf(client?.healthInfo), tint: TEAL },
        ...(hasSpouse ? [{ name: spouseName2, age2: client?.spouseAge, occ: client?.spouseProfile?.occupation || client?.spouseOccupation || client?.spouseProfile?.jobTitle, incomes: incomeList(client?.spouseIncomeSources, toNum(client?.spouseJobs?.[0]?.salary) || toNum(client?.spouseIncome)), health: healthSummary(client?.spouseProfile?.healthInfo), hobby: hobbyOf(client?.spouseProfile?.healthInfo), tint: '#8b5cf6' }] : []),
      ].map(p2 => ({ ...p2, totalYear: p2.incomes.reduce((x: number, r: any) => x + r.yearly, 0) }))
      const parentHealth = (h: string | undefined, ch: any) => [h, ch?.has ? `โรคประจำตัว${ch.detail ? ': ' + ch.detail : ''}` : ''].filter(Boolean).join(' · ')
      const mkParents = (src: any, owner: string) => {
        const pi = src?.parentsInfo || {}
        return [
          { rel: 'บิดา', name: pi.fatherName, age2: src?.fatherAge, health: parentHealth(pi.fatherHealth, pi.fatherChronic), owner },
          { rel: 'มารดา', name: pi.motherName, age2: src?.motherAge, health: parentHealth(pi.motherHealth, pi.motherChronic), owner },
        ].filter(p2 => toNum(p2.age2) > 0 || (p2.name && p2.name.trim()))
      }
      const dependents = [...mkParents(client, selfName2), ...(hasSpouse ? mkParents(client?.spouseProfile, spouseName2) : [])]
      const careExpense = toNum(client?.parentCareExpense) + (hasSpouse ? toNum(client?.spouseProfile?.parentCareExpense) : 0)
      const workCards = [
        { name: selfName2, tint: TEAL, job: { occupation: client?.occupation, jobTitle: client?.jobTitle, company: client?.company, workYears: client?.workYears, salary: client?.salary, rate: client?.salaryIncreaseRate }, wf: client },
        ...(hasSpouse ? [{ name: spouseName2, tint: '#8b5cf6', job: (() => { const j = Array.isArray(client?.spouseJobs) ? client.spouseJobs[0] : null; return { occupation: j?.occupation || client?.spouseProfile?.occupation, jobTitle: j?.jobTitle, company: j?.company, workYears: j?.workYears, salary: j?.salary ?? client?.spouseIncome, rate: j?.salaryIncreaseRate } })(), wf: client?.spouseProfile }] : []),
      ] as any[]
      const subH3: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '18px 0 10px' }
      const cardSt: React.CSSProperties = { border: '1px solid #f1f5f9', background: '#fbfdfe', borderRadius: 14, padding: 14, breakInside: 'avoid' }
      const FRow = ({ l, v }: { l: string; v: string }) => (
        <div style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.6 }}>
          <span style={{ color: '#94a3b8', flexShrink: 0, width: 66 }}>{l}:</span>
          <span style={{ color: '#334155', fontWeight: 600 }}>{v}</span>
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          {/* ครอบครัว */}
          <div style={{ ...subH3, marginTop: 0 }}>ข้อมูลพื้นฐานครอบครัว</div>
          <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
            {familyCards.map((p2, i2) => (
              <div key={i2} style={cardSt}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 999, background: `${p2.tint}18`, color: p2.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{p2.name.replace('คุณ', '').charAt(0)}</span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>{p2.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>อายุ {p2.age2 ?? '—'} ปี{client?.maritalStatus ? ` · ${client.maritalStatus}` : ''}</div>
                  </div>
                </div>
                {p2.occ && <FRow l="อาชีพ" v={String(p2.occ)} />}
                {p2.incomes.map((inc: any, j2: number) => (
                  <div key={j2} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, lineHeight: 1.7 }}>
                    <span style={{ color: '#64748b' }}>{inc.label}</span>
                    <span style={{ color: GREENR, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{fmt(inc.amount)} /{inc.isBonus ? 'ปี' : 'เดือน'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 4, fontSize: 12.5 }}>
                  <span style={{ color: '#0f172a', fontWeight: 800 }}>รายได้รวม/ปี</span>
                  <span style={{ color: '#0f172a', fontWeight: 800, fontFamily: 'monospace' }}>{fmt(p2.totalYear)} บาท</span>
                </div>
                {p2.health && <FRow l="สุขภาพ" v={p2.health} />}
                {p2.hobby && <FRow l="งานอดิเรก" v={p2.hobby} />}
              </div>
            ))}
          </div>
          {((client?.children ?? []).length > 0 || dependents.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: ((client?.children ?? []).length > 0 && dependents.length > 0) ? '1fr 1fr' : '1fr', gap: 12 }}>
              {(client?.children ?? []).length > 0 && (
                <div style={cardSt}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: AMBERR, marginBottom: 8 }}>บุตร</div>
                  {(client?.children ?? []).map((c2: any, i2: number) => (
                    <div key={i2} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: '7px 12px', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', display: 'block' }}>{c2.name || `บุตรคนที่ ${i2 + 1}`}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>อายุ {toNum(c2.age)} ปี{c2.school ? ` · ${c2.school}` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              {dependents.length > 0 && (
                <div style={cardSt}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: REDR }}>บิดา / มารดา (ในอุปการะ)</span>
                    {careExpense > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>ค่าดูแล <b style={{ color: AMBERR }}>{fmt(careExpense)}</b>/เดือน</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {dependents.map((d, i2) => (
                      <div key={i2} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: '7px 12px', minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.rel}{d.name ? ` · ${d.name}` : ''}{hasSpouse ? <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> (ของ{d.owner})</span> : ''}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>อายุ {toNum(d.age2) || '—'} ปี{d.health ? ` · ${d.health}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* งาน & สวัสดิการ */}
          <div style={subH3}>ข้อมูลการทำงานและสวัสดิการ</div>
          <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 12 }}>
            {workCards.map(p2 => {
              const WRow = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid #f8fafc', fontSize: 11.5 }}>
                  <span style={{ color: '#64748b' }}>{l}</span>
                  <span style={{ fontWeight: strong ? 800 : 700, color: '#0f172a', textAlign: 'right' }}>{v}</span>
                </div>
              )
              const Benefit = ({ label, on, detail }: { label: string; on: boolean; detail?: string }) => (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? `${GREENR}1f` : '#f1f5f9', color: on ? GREENR : '#94a3b8', fontSize: 10, fontWeight: 800 }}>{on ? '✓' : '–'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: on ? '#0f172a' : '#94a3b8' }}>{label}</div>
                    {on && detail && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{detail}</div>}
                  </div>
                </div>
              )
              const salaryM = toNum(p2.job.salary)
              return (
                <div key={p2.name} style={cardSt}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: p2.tint, marginBottom: 6 }}>{p2.name}</div>
                  <WRow l="อาชีพ / ตำแหน่ง" v={[p2.job.occupation, p2.job.jobTitle].filter(Boolean).join(' · ') || '—'} />
                  {p2.job.company && <WRow l="สถานที่ทำงาน" v={String(p2.job.company)} />}
                  {toNum(p2.job.workYears) > 0 && <WRow l="อายุงาน" v={`${toNum(p2.job.workYears)} ปี`} />}
                  <WRow l="เงินเดือน" v={salaryM > 0 ? `${fmt(salaryM)} บาท/เดือน` : '—'} strong />
                  <WRow l="อัตราการเพิ่มขึ้นของรายได้" v={p2.job.rate != null && p2.job.rate !== '' ? `${toNum(p2.job.rate)}% ต่อปี` : '—'} />
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', margin: '9px 0 1px' }}>สวัสดิการที่มี</div>
                  <Benefit label="ประกันสังคม" on={!!p2.wf?.hasSocialSecurity}
                    detail={[toNum(p2.wf?.socialSecurityYears) > 0 ? `สมทบมาแล้ว ${toNum(p2.wf?.socialSecurityYears)} ปี` : '', toNum(p2.wf?.socialSecurityValue) > 0 ? `มูลค่ากองทุน ${fmt(toNum(p2.wf?.socialSecurityValue))} บาท` : ''].filter(Boolean).join(' · ')} />
                  <Benefit label="ประกันกลุ่ม" on={!!p2.wf?.hasGroupInsurance}
                    detail={[toNum(p2.wf?.giRoomLimit) > 0 ? `ค่าห้อง ${fmt(toNum(p2.wf?.giRoomLimit))}` : '', toNum(p2.wf?.giMedicalLimit) > 0 ? `ค่ารักษา ${fmt(toNum(p2.wf?.giMedicalLimit))}` : '', toNum(p2.wf?.giOpdLimit) > 0 ? `OPD ${fmt(toNum(p2.wf?.giOpdLimit))}` : ''].filter(Boolean).join(' · ')} />
                  <Benefit label="กองทุนสำรองเลี้ยงชีพ (PVD)" on={!!p2.wf?.hasPVD}
                    detail={[toNum(p2.wf?.pvdEmployeeRate) > 0 ? `สะสม ${toNum(p2.wf?.pvdEmployeeRate)}%` : '', toNum(p2.wf?.pvdEmployerRate) > 0 ? `นายจ้างสมทบ ${toNum(p2.wf?.pvdEmployerRate)}%` : '', toNum(p2.wf?.pvdCurrentValue) > 0 ? `มูลค่าปัจจุบัน ${fmt(toNum(p2.wf?.pvdCurrentValue))} บาท` : ''].filter(Boolean).join(' · ')} />
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    if (kind === 'exec' || kind === 'exec_spouse') {
      // ── บทสรุปผู้บริหารตามเอกสารตัวอย่าง: 4 ส่วน ซ้าย=ภาพข้อมูล (จากงานนำเสนอ) ขวา=กล่องข้อเสนอแนะ · มีเวอร์ชันคู่สมรส ──
      const isSp = kind === 'exec_spouse'
      if (isSp && !hasSpouse) return null
      const R = isSp ? ratiosSp : ratios
      const sm2 = R?.summary ?? {}
      const kSuf = isSp ? '_sp' : ''
      const pKey = isSp ? 'spouse' : 'client'
      const tInv = isSp ? totalInvSp : totalInv
      const pRet = isSp ? portRetSp : portRet
      const alloc = isSp ? (() => {
        const groups: Record<string, number> = {}
        invAssetsSp.forEach(a => { const v = toNum(a.currentValue); if (v > 0) groups[a.assetClass || 'อื่นๆ'] = (groups[a.assetClass || 'อื่นๆ'] || 0) + v })
        return { rows: Object.entries(groups).map(([name, value]) => ({ name, value })), total: Object.values(groups).reduce((x, v) => x + v, 0) }
      })() : allocation
      const toMonthly = (a: number, f: string) => f === 'QUARTERLY' ? a / 3 : f === 'ANNUALLY' ? a / 12 : a
      const expAnnualR = (prefix: string, exclude?: string) => (expensesQ ?? [])
        .filter((e: any) => String(e.category).startsWith(prefix) && e.category !== exclude && (e.person === pKey || e.person === 'shared'))
        .reduce((sum: number, e: any) => { const m = toMonthly(toNum(e.amount), e.frequency) * 12; return sum + (e.person === 'shared' ? m / 2 : m) }, 0)
      const liquid = toNum(sm2.liquidAssets), invest = toNum(sm2.investAssets), personal = toNum(sm2.personalTotal)
      const totalA = toNum(sm2.totalAssets), debt = toNum(sm2.totalDebtBalance), netW = toNum(sm2.netWorth)
      const income = toNum(sm2.totalAnnualIncome)
      const fixedE = expAnnualR('fixed_'), varE = expAnnualR('var_'), saveE = expAnnualR('saving_') || toNum(sm2.annualSavings)
      const totalE = fixedE + varE + saveE, netCF = income - totalE
      const pctOf = (v: number, t: number) => t > 0 ? `${Math.round(v / t * 100)}%` : ''
      // Monte Carlo มูลค่าพอร์ต ณ เกษียณ (ตรรกะเดียวกับสไลด์ลงทุน)
      const mcInv = (() => {
        const curAge = (isSp ? retPlan?.spouse?.currentAge ?? client?.spouseAge : retPlan?.self?.currentAge ?? age)
        const retAge = (isSp ? profile?.retirementAgeSpouse ?? retPlan?.spouse?.retirementAge : profile?.retirementAgeSelf ?? retPlan?.self?.retirementAge) ?? 60
        const years = curAge != null ? Math.max(0, retAge - curAge) : 0
        if (tInv <= 0 || years <= 0 || pRet <= 0) return null
        const riskSrc = isSp ? profile?.spouseRisk : profile
        const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
        const sigma = (/สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (pRet >= 8 ? 16 : pRet >= 4 ? 11 : 6)) / 100
        const mu = pRet / 100
        const rng = mulberry32((Math.round(tInv) ^ (years << 5) ^ 0x51ed) >>> 0)
        const finals: number[] = []
        for (let i = 0; i < 500; i++) {
          let v = tInv
          for (let y = 0; y < years; y++) {
            let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
            v *= Math.exp((mu - sigma * sigma / 2) + sigma * z)
          }
          finals.push(v)
        }
        finals.sort((a, b) => a - b)
        const pc = (q: number) => { const idx = (finals.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? finals[lo] : finals[lo] + (finals[hi] - finals[lo]) * (idx - lo) }
        return { p10: pc(0.1), p50: pc(0.5), p90: pc(0.9), retAge }
      })()
      const RATIO_META: Record<string, { name: string; unit: string }> = {
        ratio1: { name: 'สภาพคล่อง', unit: 'times' }, ratio2: { name: 'เงินสำรองฉุกเฉิน', unit: 'months' },
        ratio3: { name: 'สภาพคล่อง/ความมั่งคั่ง', unit: 'pct' }, ratio4: { name: 'หนี้สินต่อสินทรัพย์', unit: 'pct' },
        ratio5: { name: 'ชำระหนี้ต่อรายได้', unit: 'pct' }, ratio6: { name: 'หนี้ไม่จดจำนอง', unit: 'pct' },
        ratio7: { name: 'การออม', unit: 'pct' }, ratio8: { name: 'การลงทุน', unit: 'pct' },
      }
      const stateCol: Record<string, string> = { good: GREENR, warning: AMBERR, danger: REDR, nodata: '#94a3b8' }
      const fmtRatio = (v: number | null, unit: string) => v == null ? '—' : unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(0)}%`
      const score: number | null = R?.healthScore ?? null
      const circ = 2 * Math.PI * 42
      const MiniTable = ({ rows, total }: { rows: [string, number, string, boolean?][]; total?: number }) => (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>{rows.map(([l, v, c, strong], i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', fontWeight: strong ? 800 : 400 }}>
              <td style={{ padding: '6px 4px', color: strong ? '#0f172a' : '#64748b' }}>{l}</td>
              <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: c }}>{fmt(v)}</td>
              <td style={{ padding: '6px 4px', textAlign: 'right', color: '#94a3b8', width: 40, fontSize: 11 }}>{total != null ? pctOf(v, total) : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      )
      const AdviceB = ({ k }: { k: string }) => (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>ข้อเสนอแนะ</div>
          <textarea value={secs[k]?.text ?? ''} onChange={e => setText(k, e.target.value)}
            placeholder="พิมพ์ข้อเสนอแนะของนักวางแผนการเงิน..."
            style={{ flex: 1, minHeight: 110, border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: '#334155', lineHeight: 1.8 }} />
        </div>
      )
      const Row = ({ title, adviceKey, children }: { title: string; adviceKey: string; children: React.ReactNode }) => (
        <div style={{ marginBottom: 24, breakInside: 'avoid' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 18, alignItems: 'stretch' }}>
            <div>{children}</div>
            <AdviceB k={adviceKey} />
          </div>
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>ข้อสังเกตสำคัญ (Key Observations){isSp ? ` — ${client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'}` : ''}</div>
          <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 18px' }}>จากการทบทวนข้อมูลเบื้องต้น เรามีข้อสังเกตและข้อเสนอแนะสำคัญดังต่อไปนี้</p>
          <Row title="ความมั่งคั่งสุทธิ (Net Worth)" adviceKey={`exec_nw${kSuf}`}>
            <MiniTable total={totalA} rows={[
              ['สินทรัพย์สภาพคล่อง', liquid, '#0284c7'], ['สินทรัพย์ลงทุน', invest, TEAL], ['สินทรัพย์ส่วนตัว', personal, AMBERR],
              ['รวมสินทรัพย์', totalA, '#0f172a', true], ['หนี้สินรวม', debt, REDR], ['ความมั่งคั่งสุทธิ', netW, netW >= 0 ? GREENR : REDR, true],
            ]} />
          </Row>
          <Row title="กระแสเงินสด (Cash Flow)" adviceKey={`exec_cf${kSuf}`}>
            <MiniTable total={income} rows={[
              ['กระแสเงินสดรับ', income, GREENR], ['ค่าใช้จ่ายคงที่', fixedE, AMBERR], ['ค่าใช้จ่ายผันแปร', varE, REDR],
              ['ค่าใช้จ่ายเพื่อการออม/ลงทุน', saveE, '#8b5cf6'], ['ค่าใช้จ่ายรวม', totalE, REDR, true], ['กระแสเงินสดสุทธิ', netCF, netCF >= 0 ? TEAL : REDR, true],
            ]} />
          </Row>
          <Row title="สถานะสุขภาพทางการเงิน (Financial Health)" adviceKey={`exec_health${kSuf}`}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={50} cy={50} r={42} fill="none" stroke="#e2e8f0" strokeWidth={8} />
                  <circle cx={50} cy={50} r={42} fill="none" stroke={TEAL} strokeWidth={8} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100)} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{score ?? '—'}</span>
                  <span style={{ fontSize: 9, color: '#94a3b8' }}>/ 100</span>
                  {R?.healthLabel && <span style={{ fontSize: 9.5, fontWeight: 700, color: TEAL }}>{R.healthLabel}</span>}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(R?.ratios ?? []).map((e: any) => {
                  const m = RATIO_META[e.key]; if (!m) return null
                  const col = stateCol[e.state] ?? '#94a3b8'
                  return (
                    <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: col, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 11, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: col }}>{fmtRatio(e.value, m.unit)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </Row>
          <Row title="การออม/ลงทุน (Investment Portfolio)" adviceKey={`exec_inv${kSuf}`}>
            {alloc.total > 0 ? (
              <div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '6px 8px 2px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>สัดส่วนสินทรัพย์ลงทุน</div>
                  <div style={{ height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={alloc.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={50} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`} labelLine={false}>
                          {alloc.rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b', textAlign: 'center', paddingBottom: 6 }}>
                    รวม {fmt(alloc.total)} บาท · ผลตอบแทน ~{pRet.toFixed(1)}%/ปี
                  </div>
                </div>
                {mcInv && (
                  <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>มูลค่า ณ เกษียณ (อายุ {mcInv.retAge} ปี) · Monte Carlo</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {([['ดี (P90)', mcInv.p90, GREENR], ['ค่ากลาง (P50)', mcInv.p50, '#0f172a'], ['แย่ (P10)', mcInv.p10, REDR]] as const).map(([l, v, c]) => (
                        <div key={l} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{l}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: c }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน</div>}
          </Row>
        </div>
      )
    }
    if (kind === 'domains' || kind === 'domains_spouse') {
      const isSp = kind === 'domains_spouse'
      if (isSp && !hasSpouse) return null
      const s2 = isSp ? (ratiosSp?.summary ?? {}) : sm
      const iR = isSp ? insRSp : insR
      const rR = isSp ? retRSp : retR
      const tInv = isSp ? totalInvSp : totalInv
      const pRet = isSp ? portRetSp : portRet
      const adv: Record<string, string> = isSp ? {} : domainAdvice
      const tp = isSp ? taxPlanQ?.spouse : taxPlanQ?.self
      const tc = tp ? calcTaxCalc({ ...defaultTaxState(), ...tp }) : null
      const emMonths = s2.totalMonthlyExp > 0 ? s2.liquidAssets / s2.totalMonthlyExp : 0
      const savingsRate = s2.monthlyIncome > 0 ? (s2.annualSavings / (s2.monthlyIncome * 12)) * 100 : 0
      const debtToAsset = s2.totalAssets > 0 ? (s2.totalDebtBalance / s2.totalAssets) * 100 : 0
      const liqOk = emMonths >= 6 && debtToAsset <= 50 && savingsRate >= 10
      return (
        <div style={{ marginBottom: 16 }}>
          {isSp && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>สรุปสถานะการวางแผนการเงินของ{client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'} (คู่สมรส)</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <DomainCard no={1} advice={adv.liquidity} title="การบริหารสภาพคล่อง/หนี้สิน"
            status={liqOk ? { label: 'เพียงพอ', tone: 'good' } : { label: 'ควรปรับปรุง', tone: 'warn' }}
            pct={Math.min(100, emMonths / 6 * 100)}
            rows={[['เงินสำรองฉุกเฉิน (เดือน)', `${emMonths.toFixed(1)} / 6.0`], ['อัตราการออม', `${savingsRate.toFixed(0)}%`], ['หนี้สินต่อสินทรัพย์', `${debtToAsset.toFixed(0)}%`]]} />
          <DomainCard no={2} advice={adv.investment} title="การวางแผนการลงทุน/เป้าหมาย"
            status={tInv > 0 ? { label: 'ดำเนินการอยู่', tone: 'good' } : { label: 'เริ่มวางแผน', tone: 'warn' }}
            pct={tInv > 0 ? 80 : 15}
            rows={[['สินทรัพย์ลงทุนรวม', `${fmt(tInv)} ฿`], ['ผลตอบแทนพอร์ต (เฉลี่ย)', `${pRet.toFixed(1)}%`]]} />
          {eduR && eduR.childCount > 0 && (
            <DomainCard no={3} advice={adv.education} title="ทุนการศึกษาบุตร"
              status={{ label: `บุตร ${eduR.childCount} คน`, tone: 'good' }}
              pct={eduR.totalNominal > 0 ? Math.min(100, (eduR.totalPV / eduR.totalNominal) * 100) : 0}
              rows={[['ค่าเล่าเรียนรวมที่ต้องเตรียม', `${fmt(eduR.totalNominal)} ฿`], ['มูลค่าปัจจุบัน (เงินก้อนวันนี้)', `${fmt(eduR.totalPV)} ฿`], ['ต้องออม/เดือน', `${fmt(eduR.monthlySaving)} ฿`]]} />
          )}
          <DomainCard no={eduR && eduR.childCount > 0 ? 4 : 3} advice={adv.insurance} title="การวางแผนประกัน & ความเสี่ยง"
            status={iR ? (iR.gap > 0 ? { label: `ขาด ${fmt(iR.gap)} ฿`, tone: 'warn' } : { label: 'เพียงพอ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
            pct={iR && iR.need > 0 ? iR.have / iR.need * 100 : 0}
            rows={[['ทุนประกันที่แนะนำ', iR ? `${fmt(iR.need)} ฿` : '—'], ['ความคุ้มครองที่มี', iR ? `${fmt(iR.have)} ฿` : '—'], ['ส่วนที่ยังขาด', iR && iR.gap > 0 ? `${fmt(iR.gap)} ฿` : 'เพียงพอ']]} />
          <DomainCard no={eduR && eduR.childCount > 0 ? 5 : 4} advice={adv.retirement} title="การวางแผนเกษียณอายุ"
            status={rR ? (rR.gap > 0 ? { label: `ขาด ${fmt(rR.gap)} ฿`, tone: 'warn' } : { label: 'พร้อมเกษียณ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
            pct={rR?.readinessPct ?? 0}
            rows={[['ทุนเกษียณที่ต้องการ', rR ? `${fmt(rR.needed)} ฿` : '—'], ['ทรัพย์สินที่เตรียมแล้ว', rR ? `${fmt(rR.have)} ฿` : '—'], ['ต้องออมเพิ่ม/ปี', rR && rR.gap > 0 ? `${fmt(rR.annualSavings)} ฿` : '—']]} />
          <DomainCard no={eduR && eduR.childCount > 0 ? 6 : 5} advice={adv.tax} title="การวางแผนภาษี"
            status={tc ? { label: 'วางแผนแล้ว', tone: 'good' } : { label: 'ยังไม่วางแผน', tone: 'warn' }}
            pct={tc ? 75 : 10}
            rows={[['เงินได้สุทธิ', tc ? `${fmt(tc.ni)} ฿` : '—'], ['ภาษีที่ต้องชำระ', tc ? `${fmt(tc.netTax)} ฿` : '—'], ['อัตราภาษีที่แท้จริง', tc ? `${tc.eff.toFixed(1)}%` : '—']]} />
          <DomainCard no={eduR && eduR.childCount > 0 ? 7 : 6} advice={adv.estate} title="การวางแผนส่งมอบมรดก"
            status={profile?.estatePlan ? { label: 'มีแผนแล้ว', tone: 'good' } : { label: 'ควรจัดทำ', tone: 'warn' }}
            pct={profile?.estatePlan ? 70 : 15}
            rows={[['ความมั่งคั่งสุทธิ (กองมรดก)', `${fmt(toNum(s2.netWorth))} ฿`], ['สถานะแผนมรดก/พินัยกรรม', profile?.estatePlan ? 'จัดทำแล้ว' : 'ยังไม่จัดทำ']]} />
          </div>
        </div>
      )
    }
    if (['finance', 'fin_cf2', 'fin_ratio2', 'finance_sp', 'fin_cf2_sp', 'fin_ratio2_sp'].includes(kind)) {
      // ── งบการเงินเต็มรูปแบบ 3 งบ: งบดุล · งบกระแสเงินสด · อัตราส่วนทางการเงิน (มีเวอร์ชันคู่สมรส) ──
      const isSp = kind.endsWith('_sp')
      if (isSp && !hasSpouse) return null
      const baseKind = isSp ? kind.slice(0, -3) : kind
      const R2 = isSp ? ratiosSp : ratios
      const toMonthly2 = (a: number, f: string) => f === 'QUARTERLY' ? a / 3 : f === 'ANNUALLY' ? a / 12 : a
      const inv: any = (isSp ? invProfile?.spouseData : invProfile) ?? {}
      const savRows = (inv.savingsAccounts ?? []).map((a: any, i2: number) => ({ name: a.depositType || `เงินฝากที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
      const invRows = (inv.investmentAssets ?? []).map((a: any, i2: number) => ({ name: a.assetName || `สินทรัพย์ลงทุนที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
      const perRows = (inv.personalAssets ?? []).map((a: any, i2: number) => ({ name: a.customLabel || a.assetType || `สินทรัพย์ที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
      const liabs: any[] = inv.liabilities ?? []
      const shortDebt = liabs.filter(l => !((parseFloat(l.termYears) || 0) > 1) && toNum(l.currentBalance) > 0).map(l => ({ name: l.debtType || 'หนี้สินระยะสั้น', note: l.creditor, v: toNum(l.currentBalance) }))
      const longDebt = liabs.filter(l => (parseFloat(l.termYears) || 0) > 1 && toNum(l.currentBalance) > 0).map(l => ({ name: l.debtType || 'หนี้สินระยะยาว', note: l.creditor, v: toNum(l.currentBalance) }))
      const sumV = (rows: { v: number }[]) => rows.reduce((x, r) => x + r.v, 0)
      const savT = sumV(savRows), invT = sumV(invRows), perT = sumV(perRows)
      const assetT = savT + invT + perT
      const shortT = sumV(shortDebt), longT = sumV(longDebt), debtT = shortT + longT
      const netWT = assetT - debtT
      // งบกระแสเงินสด — รายรับจาก incomeSources + รายจ่ายรายรายการจาก /expenses (ลูกค้า + แชร์ครึ่ง)
      const incRows = (((isSp ? client?.spouseIncomeSources : client?.incomeSources) ?? []) as any[])
        .filter(sc => toNum(sc.amount) > 0)
        .map(sc => { const m = sc.label === 'โบนัส' ? toNum(sc.amount) / 12 : toNum(sc.amount); return { name: sc.label || 'รายรับ', note: sc.source, m, v: m * 12 } })
      const expRows = (prefix: string) => (expensesQ ?? [])
        .filter((e: any) => String(e.category).startsWith(prefix) && (e.person === (isSp ? 'spouse' : 'client') || e.person === 'shared'))
        .map((e: any) => { const m0 = toMonthly2(toNum(e.amount), e.frequency); const m = e.person === 'shared' ? m0 / 2 : m0; return { name: e.name, note: e.person === 'shared' ? 'แชร์ร่วมกัน (ครึ่งหนึ่ง)' : undefined, m, v: m * 12 } })
        .filter((r: any) => r.v > 0)
      const fixRows = expRows('fixed_'), varRows = expRows('var_'), savERows = expRows('saving_')
      const incT = sumV(incRows), fixT = sumV(fixRows), varT = sumV(varRows), savET = sumV(savERows)
      const expT = fixT + varT + savET, netCF2 = incT - expT
      // อัตราส่วน 8 ตัว
      const RM: Record<string, { name: string; std: string; unit: string }> = {
        ratio1: { name: 'อัตราส่วนสภาพคล่อง', std: '> 1 เท่า', unit: 'times' },
        ratio2: { name: 'เงินสำรองฉุกเฉิน (สภาพคล่องพื้นฐาน)', std: '3–6 เดือน', unit: 'months' },
        ratio3: { name: 'สินทรัพย์สภาพคล่องต่อความมั่งคั่งสุทธิ', std: '> 15%', unit: 'pct' },
        ratio4: { name: 'หนี้สินต่อสินทรัพย์', std: '< 50%', unit: 'pct' },
        ratio5: { name: 'การชำระคืนหนี้สินจากรายได้', std: '< 35–45%', unit: 'pct' },
        ratio6: { name: 'การชำระคืนหนี้ที่ไม่จดจำนอง', std: '< 15–20%', unit: 'pct' },
        ratio7: { name: 'อัตราการออม', std: '≥ 10%', unit: 'pct' },
        ratio8: { name: 'อัตราการลงทุน (สินทรัพย์ลงทุน/ความมั่งคั่งสุทธิ)', std: '≥ 50%', unit: 'pct' },
      }
      const stChip: Record<string, { label: string; c: string }> = {
        good: { label: 'ผ่านเกณฑ์', c: GREENR }, warning: { label: 'ควรปรับปรุง', c: AMBERR },
        danger: { label: 'ต่ำกว่าเกณฑ์', c: REDR }, nodata: { label: 'รอข้อมูล', c: '#94a3b8' },
      }
      const fmtRat = (v: number | null, unit: string) => v == null ? '—' : unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(1)}%`
      // ── ชิ้นส่วน UI ──
      const Sect = ({ title, accent, total, rows, base, monthly }: { title: string; accent: string; total: number; rows: { name: string; note?: string; m?: number; v: number }[]; base: number; monthly?: boolean }) => (
        <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, marginBottom: 10, overflow: 'hidden', breakInside: 'avoid' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{title}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace', color: accent }}>{fmt(total)} ฿</span>
          </div>
          {rows.length === 0
            ? <div style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>— ไม่มีรายการ —</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>{rows.map((r, i2) => (
                  <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '5px 14px', color: '#334155' }}>{r.name}{r.note && <span style={{ color: '#94a3b8', fontSize: 10.5 }}> · {r.note}</span>}</td>
                    {monthly && <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b', width: 100 }}>{fmt(r.m ?? 0)}</td>}
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', width: 110 }}>{fmt(r.v)}</td>
                    <td style={{ padding: '5px 14px 5px 8px', textAlign: 'right', color: '#94a3b8', width: 56, fontSize: 11 }}>{base > 0 ? `${(r.v / base * 100).toFixed(1)}%` : ''}</td>
                  </tr>
                ))}</tbody>
              </table>}
        </div>
      )
      const SumRow = ({ l, v, c, strong, sign }: { l: string; v: number; c: string; strong?: boolean; sign?: boolean }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 800 : 600 }}>
          <span style={{ color: strong ? '#0f172a' : '#64748b' }}>{l}</span>
          <span style={{ fontFamily: 'monospace', color: c, fontWeight: 800 }}>{sign && v > 0 ? '+' : ''}{fmt(v)} ฿</span>
        </div>
      )
      if (baseKind === 'finance') return (
        <div style={{ marginBottom: 16 }}>
          {/* ── 1. งบดุลส่วนบุคคล ── */}
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, marginBottom: 12 }}>งบดุลส่วนบุคคล (Balance Sheet)</div>
          <Sect title="สินทรัพย์สภาพคล่อง (Liquid Assets)" accent="#0284c7" total={savT} rows={savRows} base={assetT} />
          <Sect title="สินทรัพย์เพื่อการลงทุน (Investment Assets)" accent={TEAL} total={invT} rows={invRows} base={assetT} />
          <Sect title="สินทรัพย์ส่วนตัว (Personal Assets)" accent={AMBERR} total={perT} rows={perRows} base={assetT} />
          <Sect title="หนี้สินระยะสั้น (ครบกำหนด ≤ 1 ปี)" accent={REDR} total={shortT} rows={shortDebt} base={debtT} />
          <Sect title="หนี้สินระยะยาว (ครบกำหนด > 1 ปี)" accent="#f97316" total={longT} rows={longDebt} base={debtT} />
          <div style={{ border: `1px solid ${TEAL}55`, borderRadius: 10, overflow: 'hidden', breakInside: 'avoid' }}>
            <div style={{ padding: '8px 14px', background: '#f0fdfa', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>สรุปงบดุลส่วนบุคคล</div>
            <SumRow l="สินทรัพย์รวม (1)" v={assetT} c="#0284c7" />
            <SumRow l="หนี้สินระยะสั้นรวม" v={-shortT} c={REDR} />
            <SumRow l="หนี้สินระยะยาวรวม" v={-longT} c={REDR} />
            <SumRow l="หนี้สินรวม (2)" v={-debtT} c={REDR} />
            <SumRow l="ความมั่งคั่งสุทธิ (Net Worth = 1 − 2)" v={netWT} c={netWT >= 0 ? GREENR : REDR} strong sign />
          </div>

        </div>
      )
      if (baseKind === 'fin_cf2') return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 22, fontSize: 10.5, color: '#94a3b8', margin: '0 14px 4px' }}><span>บาท/เดือน</span><span>บาท/ปี</span><span>% รายรับ</span></div>
          <Sect title="รายรับ (Income)" accent={GREENR} total={incT} rows={incRows} base={incT} monthly />
          <Sect title="รายจ่ายคงที่ (Fixed Expenses)" accent={AMBERR} total={fixT} rows={fixRows} base={incT} monthly />
          <Sect title="รายจ่ายผันแปร (Variable Expenses)" accent={REDR} total={varT} rows={varRows} base={incT} monthly />
          <Sect title="รายจ่ายเพื่อการออม/ลงทุน (Saving / Investment)" accent="#8b5cf6" total={savET} rows={savERows} base={incT} monthly />
          <div style={{ border: `1px solid ${TEAL}55`, borderRadius: 10, overflow: 'hidden', breakInside: 'avoid' }}>
            <div style={{ padding: '8px 14px', background: '#f0fdfa', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>สรุปงบกระแสเงินสด (ต่อปี)</div>
            <SumRow l="รายรับรวม" v={incT} c={GREENR} sign />
            <SumRow l="รายจ่ายคงที่รวม" v={-fixT} c={AMBERR} />
            <SumRow l="รายจ่ายผันแปรรวม" v={-varT} c={REDR} />
            <SumRow l="รายจ่ายเพื่อการออม/ลงทุนรวม" v={-savET} c="#8b5cf6" />
            <SumRow l="รายจ่ายรวม" v={-expT} c={REDR} />
            <SumRow l="กระแสเงินสดสุทธิ (Net Cash Flow)" v={netCF2} c={netCF2 >= 0 ? GREENR : REDR} strong sign />
          </div>

        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                {['อัตราส่วน', 'ค่าที่คำนวณได้', 'เกณฑ์มาตรฐาน', 'สถานะ'].map((h, i2) => (
                  <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : i2 === 3 ? 'center' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{(R2?.ratios ?? []).map((e: any) => {
              const m = RM[e.key]; if (!m) return null
              const st = stChip[e.state] ?? stChip.nodata
              return (
                <tr key={e.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', color: '#334155' }}>{m.name}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: st.c }}>{fmtRat(e.value, m.unit)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{m.std}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 999, background: `${st.c}14`, color: st.c, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
          {R2?.healthScore != null && (
            <div style={{ marginTop: 10, padding: '9px 14px', background: '#f0fdfa', border: `1px solid ${TEAL}55`, borderRadius: 10, fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>
              คะแนนสุขภาพทางการเงินรวม: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: TEAL }}>{R2.healthScore} / 100</span>{R2.healthLabel ? ` · ${R2.healthLabel}` : ''}
            </div>
          )}
        </div>
      )
    }
    if (kind === 'insurance') {
      // ── การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย (ตามเอกสารตัวอย่าง) ──
      const persons = [
        { name: `คุณ${client?.firstName || 'ลูกค้า'}`, cov: covSelf, ins: insR, tint: TEAL },
        ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', cov: covSp, ins: insRSp, tint: '#8b5cf6' }] : []),
      ]
      const subH: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '20px 0 10px' }
      // ตารางแนะนำแบบประกัน (พิมพ์ได้ · เก็บใน secs.ins_reco เป็นบรรทัด "แบบ|คุ้มครอง|เบี้ย")
      const recoLines = (secs['ins_reco']?.text || '').split('\n')
      const recoRow = (i2: number): string[] => (recoLines[i2] || '').split('|')
      const setReco = (i2: number, c: number, v: string) => {
        const rows = Array.from({ length: 5 }, (_, k) => recoRow(k))
        rows[i2][c] = v
        setText('ins_reco', rows.map(r => [r[0] || '', r[1] || '', r[2] || ''].join('|')).join('\n'))
      }
      const recoInp: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: '#1e293b', padding: '2px 0' }
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...subH, marginTop: 0 }}>ความคุ้มครองที่มี</div>
          <div style={{ display: 'grid', gridTemplateColumns: persons.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
            {persons.map(p => (
              <div key={p.name} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', breakInside: 'avoid' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: p.tint, marginBottom: 6 }}>{p.name}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 170 }}>
                    {p.cov.hasPolicies ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={p.cov.radarData} outerRadius="68%">
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: '#64748b' }} />
                          <Radar name="ความคุ้มครองที่มี" dataKey="actual" stroke={p.tint} strokeWidth={2} fill={p.tint} fillOpacity={0.25} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: '#94a3b8' }}>ยังไม่มีกรมธรรม์</div>}
                  </div>
                  <div style={{ width: 118, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '6px 4px' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>คะแนนคุ้มครอง</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: p.cov.avg >= 70 ? GREENR : p.cov.avg >= 40 ? AMBERR : REDR }}>{p.cov.avg}</div>
                    </div>
                    {p.ins && ([['ทุนที่ควรมี', p.ins.need, AMBERR], ['มีอยู่', p.ins.have, GREENR], ['ยังขาด', p.ins.gap, p.ins.gap > 0 ? REDR : GREENR]] as const).map(([l, v, c]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: c }}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {p.cov.radarData.some((d: any) => toNum(d.amount) > 0) && (
                  <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', marginBottom: 3 }}>ความคุ้มครองที่มี (แยกประเภท)</div>
                    {p.cov.radarData.filter((d: any) => toNum(d.amount) > 0).map((d: any) => (
                      <div key={d.subject} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#475569', padding: '2px 0' }}>
                        <span>{d.subject}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(toNum(d.amount))} บาท</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={subH}>ทุนประกันที่ควรทำเพิ่ม</div>
          <div style={{ display: 'grid', gridTemplateColumns: persons.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
            {persons.map(p => p.ins && (
              <div key={p.name} style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', breakInside: 'avoid' }}>
                <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12.5, fontWeight: 800, color: p.tint }}>{p.name}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {['วิธีคำนวณ', 'ทุนที่ควรมี', 'มีอยู่', 'ยังขาด'].map((h, i2) => (
                        <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['Human Life Value', p.ins.hlvNeed, p.ins.hlvGap, p.ins.method === 'hlv'],
                      ['Need Base Analysis', p.ins.needsNeed, p.ins.needsGap, p.ins.method !== 'hlv'],
                      ['ทุนทุพพลภาพ', p.ins.disNeed, p.ins.disGap, false],
                    ] as const).map(([l, need, gap, sel]) => (
                      <tr key={String(l)} style={{ borderBottom: '1px solid #f8fafc', background: sel ? '#f0fdfa' : 'transparent' }}>
                        <td style={{ padding: '6px 8px', color: sel ? '#0f172a' : '#64748b', fontWeight: sel ? 800 : 400 }}>{sel ? '☑ ' : ''}{l}{sel ? ' (วิธีที่เลือก)' : ''}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: AMBERR, fontWeight: 700 }}>{fmt(need as number)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: GREENR, fontWeight: 700 }}>{fmt(l === 'ทุนทุพพลภาพ' ? p.ins!.disHave : p.ins!.have)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: (gap as number) > 0 ? REDR : GREENR, fontWeight: 800 }}>{fmt(gap as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div style={subH}>แบบประกันและเบี้ยประกันที่แนะนำ</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left' }}>แบบประกัน</th>
                <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'right', width: 150 }}>ความคุ้มครอง</th>
                <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'right', width: 160 }}>เบี้ยประกันโดยประมาณ</th>
              </tr>
            </thead>
            <tbody>{Array.from({ length: 5 }, (_, i2) => (
              <tr key={i2} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[0] || ''} onChange={e => setReco(i2, 0, e.target.value)} placeholder="พิมพ์ชื่อแบบประกัน..." style={recoInp} /></td>
                <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[1] || ''} onChange={e => setReco(i2, 1, e.target.value)} style={{ ...recoInp, textAlign: 'right', fontFamily: 'monospace' }} /></td>
                <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[2] || ''} onChange={e => setReco(i2, 2, e.target.value)} style={{ ...recoInp, textAlign: 'right', fontFamily: 'monospace' }} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )
    }
    if (kind === 'education') {
      if (!children.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลบุตร</div>
      const LV_TH: Record<string, string> = { kindergarten: 'อนุบาล', primary: 'ประถม', secondary: 'มัธยม', bachelor: 'ปริญญาตรี', master: 'ปริญญาโท' }
      const nowYearBE = new Date().getFullYear() + 543
      const totalAll = children.reduce((acc, c, i2) => {
        const e = eduForChild(toNum(c.age), eduPlan?.[i2], eduCosts, eduInf, eduRet)
        return { nominal: acc.nominal + e.totalNominal, pv: acc.pv + e.totalPV, monthly: acc.monthly + e.monthly }
      }, { nominal: 0, pv: 0, monthly: 0 })
      const Stat = ({ l, v, c, unit = 'บาท' }: { l: string; v: string; c: string; unit?: string }) => (
        <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{l}</div>
          <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
          <div style={{ fontSize: 10, color: '#cbd5e1' }}>{unit}</div>
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, marginBottom: 12 }}>ทุนการศึกษาบุตรที่ต้องการ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            <Stat l="จำนวนบุตร" v={String(children.length)} c="#0f172a" unit="คน" />
            <Stat l="ค่าเล่าเรียนรวม (อนาคต)" v={fmt(totalAll.nominal)} c={AMBERR} />
            <Stat l="เงินก้อนวันนี้ (PV)" v={fmt(totalAll.pv)} c={TEAL} />
            <Stat l="ต้องออม/เดือน" v={fmt(totalAll.monthly)} c={GREENR} />
          </div>
          {children.map((c, ci) => {
            const setting = eduPlan?.[ci] ?? {}
            const type = setting?.type ?? 'private'
            const includeMaster = setting?.includeMaster ?? false
            const ageNow = toNum(c.age)
            const rows: { age: number; year: number; lvl: string; cur: number; fut: number }[] = []
            for (let a = Math.max(ageNow, 3); a <= 23; a++) {
              const lvl = EDU_LEVELS.find(l => l.ages.includes(a)); if (!lvl) continue
              if (lvl.key === 'master' && !includeMaster) continue
              const base = toNum(eduCosts?.[lvl.key]?.[type]); if (base <= 0) continue
              rows.push({ age: a, year: nowYearBE + (a - ageNow), lvl: LV_TH[lvl.key], cur: base, fut: base * Math.pow(1 + eduInf / 100, a - ageNow) })
            }
            if (!rows.length) return null
            const tdE: React.CSSProperties = { padding: '4px 10px', fontSize: 11.5, color: '#334155' }
            return (
              <div key={ci} style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', marginBottom: 12, breakInside: 'avoid' }}>
                <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                  {c.name || `บุตรคนที่ ${ci + 1}`} · อายุปัจจุบัน {ageNow} ปี <span style={{ color: '#94a3b8', fontWeight: 600 }}>({type === 'private' ? 'เอกชน' : type === 'inter' ? 'นานาชาติ' : 'รัฐบาล'}{includeMaster ? ' · รวมปริญญาโท' : ''})</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      {['อายุ', 'ปี พ.ศ.', 'ระดับ', 'ค่าเล่าเรียน (ปัจจุบัน)', 'ปรับเงินเฟ้อแล้ว'].map((h, i2) => (
                        <th key={h} style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 >= 3 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.age} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={tdE}>{r.age}</td>
                        <td style={tdE}>{r.year}</td>
                        <td style={tdE}>{r.lvl}</td>
                        <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cur)}</td>
                        <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(r.fut)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                      <td colSpan={4} style={{ ...tdE, fontWeight: 800, color: '#0f172a' }}>รวม (ตามราคาอนาคต)</td>
                      <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: AMBERR }}>{fmt(rows.reduce((x, r) => x + r.fut, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
          <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>* เงินเฟ้อค่าการศึกษา {eduInf}% ต่อปี · ผลตอบแทนกองทุนเพื่อการศึกษา {eduRet}% ต่อปี (จากหน้าสมมติฐาน)</p>
        </div>
      )
    }
    if (kind === 'retirement') {
      const persons = [
        { name: `คุณ${client?.firstName || 'ลูกค้า'}`, r: retR, tint: TEAL },
        ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', r: retRSp, tint: '#8b5cf6' }] : []),
      ].filter(p => p.r)
      if (!persons.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลแผนเกษียณ</div>
      const Stat = ({ l, v, c }: { l: string; v: number; c: string }) => (
        <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{fmt(v)}</div>
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          {persons.map(p => {
            const R3 = p.r!
            const noSaveByAge = new Map<number, number>((R3.projectionRowsNoSave ?? []).map((row: any) => [row.age, Math.round(row.phase === 'accumulation' ? (row.totalAccum ?? 0) : (row.closeBalance ?? 0))]))
            const chart = (R3.projectionRows ?? []).map((row: any) => ({
              age: row.age,
              มูลค่ารวม: Math.round(row.phase === 'accumulation' ? (row.totalAccum ?? 0) : (row.closeBalance ?? 0)),
              ไม่ออมเพิ่ม: Math.max(0, noSaveByAge.get(row.age) ?? 0),
              ค่าใช้จ่าย: row.phase === 'retirement' ? Math.round((row.withdrawalLiving ?? 0) + (row.withdrawalGoals ?? 0)) : 0,
            }))
            return (
              <div key={p.name} style={{ marginBottom: 20, breakInside: 'avoid' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: p.tint, borderLeft: `5px solid ${p.tint}`, paddingLeft: 10, marginBottom: 10 }}>เงินเกษียณที่ต้องการ · {p.name} (เกษียณอายุ {R3.retireAge} ปี)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
                  <Stat l="เงินเกษียณที่ต้องการ" v={R3.needed} c="#0f172a" />
                  <Stat l="มูลค่าสินทรัพย์ที่มี" v={R3.have} c={GREENR} />
                  <Stat l="ส่วนที่ยังขาด" v={R3.gap} c={R3.gap > 0 ? REDR : GREENR} />
                  <Stat l="ต้องออมเพิ่ม (เท่ากันทุกปี)" v={R3.annualSavings} c="#0284c7" />
                  <Stat l="ออมเพิ่มขึ้นทุกปี (ปีแรก)" v={R3.gradFirst} c="#8b5cf6" />
                </div>
                {chart.length > 0 && (
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>การคาดการณ์มูลค่าเงินในอนาคต (สะสม → ใช้เงินหลังเกษียณ)</div>
                    <div style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                          <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                          <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={34} />
                          <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                          <Legend wrapperStyle={{ fontSize: 10.5 }} />
                          <ReferenceLine x={R3.retireAge} stroke={p.tint} strokeDasharray="4 3" />
                          <Bar dataKey="ค่าใช้จ่าย" barSize={4} fill="#f59e0bb0" />
                          <Line dataKey="ไม่ออมเพิ่ม" name="มูลค่ารวม (กรณีไม่ออมเพิ่ม)" stroke={REDR} strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
                          <Line dataKey="มูลค่ารวม" name="มูลค่ารวม (ออมตามแผน)" stroke={p.tint} strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    if (kind === 'portfolio_reco') {
      // พอร์ตแนะนำ 3 ระดับความเสี่ยง — ทางเลือกที่ Sharpe สูงสุดของแต่ละชุด (ข้อมูลตลาดล่าสุดถ้ามี)
      const assets = applyMarketData(DEFAULT_ASSETS, marketData)
      const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
      const W_LBL = ['ตราสารหนี้', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ']
      // จุดทุกทางเลือก (9 จุด) สำหรับ Efficient Frontier + ไฮไลต์พอร์ตแนะนำ (Sharpe สูงสุดของแต่ละชุด)
      const frontier = PORTFOLIO_SETS.flatMap(set => {
        const results = set.options.map(o => computePortfolio(o.weights, assets, matrix))
        const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
        return results.map((r, i2) => ({ x: +r.sigma.toFixed(2), y: +r.ret.toFixed(2), color: set.color, best: i2 === bi, name: `${set.label} · ${set.options[i2].label}` }))
      })
      return (
        <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          {PORTFOLIO_SETS.map(set => {
            const results = set.options.map(o => computePortfolio(o.weights, assets, matrix))
            const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
            const best = results[bi], w = set.options[bi].weights
            return (
              <div key={set.id} style={{ border: `1px solid ${set.color}44`, borderRadius: 12, padding: '12px 14px', breakInside: 'avoid' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: set.color }}>{set.label}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>{set.sub} · {set.options[bi].label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                  {w.map((wt, i2) => (
                    <div key={i2} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{W_LBL[i2]}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{wt}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                  {([['ผลตอบแทน', `+${best.ret.toFixed(2)}%`, GREENR], ['ความผันผวน σ', `${best.sigma.toFixed(2)}%`, AMBERR], ['Sharpe', best.sharpe.toFixed(2), '#0f172a']] as const).map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{l}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* สมมติฐานผลตอบแทนและความเสี่ยง */}
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '6px 0 8px' }}>สมมติฐานผลตอบแทนและความเสี่ยง (ย้อนหลัง 10 ปี)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                {['ประเภทสินทรัพย์', 'CAGR (%)', 'SD (%)'].map((h, i2) => (
                  <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>{assets.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 8px', color: '#334155' }}>{a.name}{a.live && <span style={{ marginLeft: 5, fontSize: 8.5, fontWeight: 800, color: GREENR, background: `${GREENR}14`, borderRadius: 4, padding: '1px 5px' }}>LIVE</span>}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: GREENR }}>{a.cagr.toFixed(2)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: AMBERR }}>{a.sd > 0 ? a.sd.toFixed(2) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', marginBottom: 4 }}>ค่าสัมประสิทธิ์สหสัมพันธ์ (Correlation)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
              <thead>
                <tr>{[''].concat(W_LBL).map((h, i2) => <th key={i2} style={{ padding: '3px 5px', fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>)}</tr>
              </thead>
              <tbody>{W_LBL.map((rl, ri) => (
                <tr key={rl} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '3px 5px', fontWeight: 700, color: '#475569' }}>{rl}</td>
                  {W_LBL.map((_, ci) => (
                    <td key={ci} style={{ padding: '3px 5px', textAlign: 'right', fontFamily: 'monospace', color: ci > ri ? '#e2e8f0' : Math.abs(matrix[ri][ci]) >= 0.5 && ri !== ci ? AMBERR : '#334155', fontWeight: ri === ci ? 800 : 600 }}>
                      {ci > ri ? '—' : matrix[ri][ci].toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* Efficient Frontier */}
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>Efficient Frontier</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>ผลตอบแทนคาดหวัง vs ความเสี่ยง — จุดใหญ่คือพอร์ตแนะนำของแต่ละระดับ (Sharpe สูงสุด)</div>
        <div style={{ height: 230, background: '#f8fafc', borderRadius: 12, padding: '8px 8px 0' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" name="ความเสี่ยง σ" unit="%" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis type="number" dataKey="y" name="ผลตอบแทน" unit="%" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
              <Tooltip content={({ payload }: any) => payload?.length ? (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{payload[0].payload.name}</div>
                  <div style={{ color: '#475569' }}>ผลตอบแทน {payload[0].payload.y}% · σ {payload[0].payload.x}%</div>
                </div>
              ) : null} />
              <Scatter data={frontier}>
                {frontier.map((pt, i2) => <Cell key={i2} fill={pt.color} stroke={pt.best ? '#0f172a' : 'none'} strokeWidth={pt.best ? 2 : 0} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, fontSize: 10.5, color: '#64748b' }}>
          {PORTFOLIO_SETS.map(set => <span key={set.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: set.color }} />{set.label}</span>)}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid #0f172a' }} />พอร์ตแนะนำ</span>
        </div>
        </div>
      )
    }
    return null
  }

  // ซ่อนหน้า (คู่สมรส) เมื่อลูกค้าไม่มีข้อมูลคู่สมรส
  const visibleSections = SECTIONS.filter(s => !(['domains_spouse', 'exec_spouse', 'finance_sp', 'fin_cf2_sp', 'fin_ratio2_sp', 'fin_invest_sp'].includes(s.k) && !hasSpouse))
  const included = visibleSections.filter(s => secs[s.k]?.include)

  // ── Export PDF เอง (jsPDF + html2canvas) — ชัวร์ทุกอุปกรณ์ โดยเฉพาะ iPad ที่ print เบราว์เซอร์เพี้ยน ──
  const [exporting, setExporting] = useState(false)
  // ตรวจความครบถ้วนของหน้าข้อตกลง (ติ๊ก PDPA + ลายเซ็น 3 จุด) ก่อนพิมพ์/export ฉบับเต็ม
  function checkSigned(): boolean {
    if (mode !== 'full' || !secs.service?.include) return true
    const missing: string[] = []
    if (!signatures.pdpa_consent) missing.push('ติ๊กช่องความยินยอม PDPA')
    if (!signatures.sig_advisor) missing.push('ลายเซ็นผู้ให้บริการ (นักวางแผนการเงิน)')
    if (!signatures.sig_client) missing.push('ลายเซ็นผู้รับบริการ (ลูกค้า)')
    if (!signatures.sig_witness) missing.push('ลายเซ็นพยาน')
    if (missing.length) {
      alert('ยังไม่สามารถ export ได้ — กรุณาดำเนินการในหน้า "ข้อตกลงในการให้บริการ" ให้ครบก่อน:\n\n• ' + missing.join('\n• '))
      return false
    }
    return true
  }
  async function exportPdf() {
    if (!checkSigned()) return
    const paper = document.getElementById('report-paper')
    if (!paper) return
    // pres → จับ .pd-slide (16:9) · full → จับ .rp-page (A4 portrait)
    const isPres = mode === 'pres'
    const els = (Array.from(paper.querySelectorAll(isPres ? '.pd-slide' : '.rp-page')) as HTMLElement[])
      .filter(el => getComputedStyle(el).display !== 'none')   // ข้ามสไลด์ที่ถูกซ่อนจากเมนูเลือกหน้า
    if (!els.length) return
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
      const fmtPage: [number, number] = isPres ? [297, 210] : [210, 297]   // mm (pres = A4 แนวนอน)
      const pdf = new jsPDF({ orientation: isPres ? 'landscape' : 'portrait', unit: 'mm', format: fmtPage })
      // จับที่ "ความกว้างออกแบบ" เสมอ ไม่ผูกกับความกว้างจอ (บน iPad จอแคบ layout จะยุบ/ตัดขอบ)
      // 1123px ≈ A4 แนวนอน · 794px ≈ A4 แนวตั้ง (ที่ ~96dpi)
      const designW = isPres ? 1123 : 794
      const presH = Math.round(designW * 210 / 297)   // ความสูงสไลด์ (อัตราส่วนคงที่)
      const nextFrame = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        const prev = { width: el.style.width, height: el.style.height, maxWidth: el.style.maxWidth, aspectRatio: el.style.aspectRatio, overflow: el.style.overflow }
        // บังคับขนาดออกแบบ → เนื้อหา (2 คอลัมน์/กราฟ/ตาราง) จัดเต็มความกว้างเหมือนบนจอใหญ่
        el.style.maxWidth = 'none'
        el.style.width = designW + 'px'
        if (isPres) { el.style.height = presH + 'px'; el.style.aspectRatio = 'auto' }
        el.style.overflow = 'visible'
        await nextFrame()          // ให้ layout + AutoFit ปรับตามความกว้างใหม่ก่อนจับภาพ
        await new Promise<void>(r => setTimeout(r, 30))
        const capH = isPres ? presH : el.scrollHeight
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          width: designW, height: capH, windowWidth: designW, windowHeight: capH,
          ignoreElements: e => e.classList?.contains('no-print') })
        Object.assign(el.style, prev)
        const img = canvas.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage(fmtPage, isPres ? 'landscape' : 'portrait')
        // contain-fit: ย่อภาพให้พอดีหน้าโดยคงสัดส่วน + จัดกึ่งกลาง (ไม่ตัด ไม่ยืด)
        const [pw, ph] = fmtPage
        const sc = Math.min(pw / canvas.width, ph / canvas.height)
        const w = canvas.width * sc, h = canvas.height * sc
        pdf.addImage(img, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h)
      }
      pdf.save(`${(title || 'WealthPro').replace(/[\\/:*?"<>|]/g, '')}.pdf`)
    } catch (e) {
      alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่')
      console.error(e)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes rp-spin{to{transform:rotate(360deg)}}.rp-spin{animation:rp-spin .9s linear infinite}
        @media print {
          body * { visibility: hidden !important; }
          #report-paper, #report-paper * { visibility: visible !important; }
          #report-paper { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          /* คงสีพื้นหลัง/การ์ด/กราฟตอนพิมพ์ (เบราว์เซอร์ตัด background โดยดีฟอลต์) */
          #report-paper, #report-paper * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          ${mode === 'pres' ? `
            /* A4 แนวนอนเต็มหน้า (297×210mm) · สไลด์เต็มหน้าไม่มีแถบขาว */
            @page { size: A4 landscape; margin: 0; }
            html, body { height: auto !important; }
            #report-paper { gap: 0 !important; }
            .pd-slide {
              width: 297mm !important; height: 210mm !important; max-width: none !important; aspect-ratio: auto !important;
              box-shadow: none !important; border-radius: 0 !important; margin: 0 auto !important;
              page-break-after: always; break-after: page; break-inside: avoid; overflow: hidden !important;
            }
            .pd-slide:last-of-type { page-break-after: auto; break-after: auto; }
            /* กันกฎ touch (pointer:coarse) ที่ iPad ยังใช้ตอนพิมพ์ ไปขยาย input/ปุ่มจนเลย์เอาต์เพี้ยน */
            input, select, textarea { font-size: inherit !important; }
            button, a[role="button"], [role="tab"] { min-height: 0 !important; }
          ` : `
            @page { size: A4 portrait; margin: 16mm; }
            .rp-page { page-break-after: always; box-shadow: none !important; margin: 0 !important; }
          `}
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print">
        <PageHeader icon={FileText} title="รายงานแผนการเงิน (PDF)" subtitle="เลือกรูปแบบ แล้วพิมพ์/บันทึกเป็น PDF"
          right={
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* หุบ/เปิดเมนูเลือกหน้า เพื่อเพิ่มพื้นที่เอกสาร */}
              <button onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'ซ่อนเมนู เพิ่มพื้นที่เอกสาร' : 'เปิดเมนูเลือกหน้า'}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {panelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />} {panelOpen ? 'ซ่อนเมนู' : 'เมนู'}
              </button>
              {/* สลับโหมด ฉบับเต็ม / นำเสนอ */}
              <div style={{ display: 'flex', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 3, gap: 3 }}>
                {([['full', 'ฉบับเต็ม', FileStack], ['pres', 'นำเสนอ', Presentation]] as const).map(([m, lbl, Ic]) => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: mode === m ? 'var(--cyan)' : 'transparent', color: mode === m ? '#00201d' : 'var(--text-secondary)' }}>
                    <Ic size={15} /> {lbl}
                  </button>
                ))}
              </div>
              <button onClick={() => setEditMode(e => !e)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: editMode ? 'var(--cyan)' : 'transparent', color: editMode ? '#00201d' : 'var(--text-secondary)', border: `1px solid ${editMode ? 'var(--cyan)' : 'var(--card-border)'}` }}>
                <Pencil size={15} /> {editMode ? 'เสร็จสิ้นการแก้ไข' : (mode === 'pres' ? 'แก้ไขสไลด์' : 'แก้ไขรายงาน')}
              </button>
              {status === 'saving' && <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="rp-spin" /> กำลังบันทึก...</span>}
              {status === 'saved' && <span style={{ fontSize: 12.5, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> บันทึกแล้ว</span>}
              <button onClick={() => { if (checkSigned()) window.print() }} title="ใช้ระบบพิมพ์ของเบราว์เซอร์ (เหมาะกับเดสก์ท็อป)"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={16} /> พิมพ์
              </button>
              <button onClick={exportPdf} disabled={exporting} title="ดาวน์โหลดเป็นไฟล์ PDF (แนะนำ · ชัวร์ทุกอุปกรณ์ รวมถึง iPad)"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'var(--cyan)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? 0.7 : 1 }}>
                {exporting ? <Loader2 size={16} className="rp-spin" /> : <Download size={16} />} {exporting ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
              </button>
            </div>
          } />
      </div>

      {mode === 'pres' ? (
      <div style={{ display: 'grid', gridTemplateColumns: (compact || !panelOpen) ? '1fr' : '250px 1fr', gap: 20, alignItems: 'start' }}>
        {/* เมนูเลือกหน้าสไลด์ (เหมือนฉบับเต็ม) */}
        {panelOpen && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          {DECK_SLIDES.map(sl => (
            <label key={sl.id} style={{ ...ecard, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', opacity: pres[sl.id]?.off ? 0.55 : 1 }}>
              <input type="checkbox" checked={!pres[sl.id]?.off}
                onChange={e => setPres(p => ({ ...p, [sl.id]: { ...p[sl.id], off: !e.target.checked } }))} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: pres[sl.id]?.off ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{sl.label}</span>
            </label>
          ))}
        </div>
        )}
        <div style={{ minWidth: 0 }}>
        <PresentationDeck title={title} pres={pres} advisorBio={(secs['advprofile']?.text ?? '') !== '' ? secs['advprofile'].text : undefined}
          onComment={(k, t) => setPres(p => ({ ...p, [k]: { ...p[k], comment: t } }))}
          onToggleHide={k => setPres(p => ({ ...p, [k]: { ...p[k], hidden: !p[k]?.hidden } }))}
          editMode={editMode}
          overlays={overlays}
          onOverlayChange={(id, els) => setOverlays(o => ({ ...o, [id]: els }))}
          customSlides={customSlides}
          thankYouPhoto={thankYouPhoto}
          onThankYouPhoto={setThankYouPhoto}
          onAddSlide={() => setCustomSlides(s => [...s, { id: `cs${Date.now().toString(36)}` }])}
          onDelSlide={id => { setCustomSlides(s => s.filter(x => x.id !== id)); setOverlays(o => { const n = { ...o }; delete n[id]; return n }) }}
          onMoveSlide={(id, dir) => setCustomSlides(s => {
            const i = s.findIndex(x => x.id === id); if (i < 0) return s
            const j = i + dir; if (j < 0 || j >= s.length) return s
            const a = [...s];[a[i], a[j]] = [a[j], a[i]]; return a
          })} />
        </div>
      </div>
      ) : (
      <SlideEditor.Provider value={{ editMode, snap: false, overlays, setEls: (id, els) => setOverlays(o => ({ ...o, [id]: els })), advisorName: advisor?.fullName, advisorPhone: advisor?.phone }}>
      <div style={{ display: 'grid', gridTemplateColumns: (compact || !panelOpen) ? '1fr' : '250px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Editor */}
        {panelOpen && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          <div style={ecard}>
            <label style={elbl}>ชื่อรายงาน</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={einp} />
          </div>
          {visibleSections.map(s => (
            <div key={s.k} style={ecard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="checkbox" checked={secs[s.k]?.include ?? true} onChange={e => setInc(s.k, e.target.checked)} />
                <span style={{ fontSize: 12.5, fontWeight: s.lvl === 1 ? 700 : 500, color: s.lvl === 1 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                  {s.lvl === 2 ? '— ' : ''}{s.t}
                </span>
              </div>
              {/* ช่องพิมพ์เฉพาะหัวข้อที่ไม่มีเนื้อหาอัตโนมัติ (หัวข้อ auto ใช้กล่องแก้ไขบนหน้ากระดาษ/ปุ่มแก้ไขรายงานแทน) */}
              {!s.auto && s.k !== 'goals' && (
                <textarea value={secs[s.k]?.text ?? ''} onChange={e => setText(s.k, e.target.value)}
                  placeholder="พิมพ์เนื้อหา/ข้อเสนอแนะสำหรับหัวข้อนี้..." rows={3}
                  style={{ ...einp, resize: 'vertical', minHeight: 56 }} />
              )}
            </div>
          ))}
        </div>
        )}

        {/* Paper preview */}
        <div id="report-paper" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
          {/* Cover — สไตล์มืออาชีพ (โลโก้ · แถบชื่อเรื่อง · แบนเนอร์ · ข้อมูลลูกค้า/ที่ปรึกษา) */}
          <Page pageId="page:cover">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 950, justifyContent: 'space-between' }}>
              {/* brand row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>
                  <span style={{ color: '#0f172a' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 3, color: '#94a3b8', marginTop: 2 }}>FINANCIAL PLANNING</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase' }}>Confidential Financial Document</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>Ref: WP-{new Date().getFullYear()}-{(client?.firstName || 'CL').slice(0, 2).toUpperCase()}</div>
                </div>
              </div>
              {/* title */}
              <div style={{ margin: '36px 0 24px' }}>
                <h1 style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', borderLeft: '8px solid #00cfc1', paddingLeft: 22, lineHeight: 1.35, margin: 0 }}>{title}</h1>
                <div style={{ height: 4, width: 120, background: '#00cfc1', opacity: .45, marginTop: 14, marginLeft: 30 }} />
              </div>
              {/* hero band (gradient — print-safe ไม่พึ่งรูปภายนอก) */}
              <div style={{ position: 'relative', width: '100%', height: 300, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)' }}>
                <div style={{ position: 'absolute', right: -70, top: -70, width: 260, height: 260, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
                <div style={{ position: 'absolute', right: 60, bottom: -90, width: 210, height: 210, borderRadius: '50%', background: 'rgba(254,183,0,0.10)' }} />
                <div style={{ position: 'absolute', left: -40, bottom: -60, width: 190, height: 190, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.10)' }} />
                <div style={{ position: 'absolute', left: 34, bottom: 30 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>HOLISTIC FINANCIAL PLANNING</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 6 }}>แผนการเงินแบบองค์รวม 6 ด้าน ตามมาตรฐานวิชาชีพ CFP®</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>สภาพคล่อง · การลงทุน · ประกัน & ความเสี่ยง · เกษียณอายุ · ภาษี · มรดก</div>
                </div>
              </div>
              {/* prepared for / advisor */}
              {/* ข้อมูลลูกค้า — เหนือเส้นคั่น */}
              <div style={{ padding: '24px 0 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>จัดทำเพื่อ</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>คุณ{clientName}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>เอกสารเฉพาะบุคคล · ห้ามเผยแพร่</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', margin: '18px 0 4px' }}>วันที่จัดทำรายงาน</div>
                <div style={{ fontSize: 14, color: '#334155' }}>{today}</div>
              </div>
              {/* ข้อมูลนักวางแผน — ใต้เส้นคั่น ขยับลงล่าง */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: '34px 0 26px', borderTop: '1px solid #f1f5f9' }}>
                <div />
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>นักวางแผนการเงิน</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{advisor?.fullName || 'ที่ปรึกษาการเงิน'}</div>
                    {advisor?.position && <div style={{ fontSize: 12, color: '#475569' }}>{advisor.position}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{[advisor?.phone, advisor?.email].filter(Boolean).join(' · ')}</div>
                    {advisor?.address && <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{advisor.address}</div>}
                  </div>
                  {advisor?.photo
                    ? <img src={advisor.photo} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00cfc1', flexShrink: 0 }} />
                    : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} />}
                </div>
              </div>
              <div style={{ textAlign: 'center', paddingTop: 16, borderTop: '1px solid #f1f5f9', fontSize: 10.5, color: '#94a3b8' }}>
                © {new Date().getFullYear()} WealthPro Financial Planning · Proprietary and Confidential
              </div>
            </div>
          </Page>

          {/* TOC */}
          <Page pageId="page:toc">
            <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: '#0f2a43', marginBottom: 24 }}>สารบัญ</h2>
            {included.map((s, i) => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', paddingLeft: s.lvl === 2 ? 28 : 0 }}>
                <span style={{ fontSize: s.lvl === 1 ? 14 : 13, fontWeight: s.lvl === 1 ? 600 : 400, color: s.lvl === 1 ? '#0f2a43' : '#475569' }}>{s.lvl === 1 ? `${i + 1}. ` : ''}{s.t}</span>
                <span style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', margin: '0 4px', transform: 'translateY(-3px)' }} />
              </div>
            ))}
          </Page>

          {/* Content sections */}
          {included.map((s, idx) => (
            <Page key={s.k} pageId={`page:${s.k}`}>
              {/* running header — แบรนด์ + เลขหน้า */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid #f1f5f9', paddingBottom: 10, marginBottom: 22 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}><span style={{ color: '#0f172a' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span></span>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1, color: '#94a3b8' }}>{title} • หน้า {idx + 3}</span>
              </div>
              <h2 style={{ fontSize: s.lvl === 1 ? 20 : 16, fontWeight: 800, color: '#0f172a', borderLeft: '5px solid #00cfc1', paddingLeft: 12, marginBottom: 16 }}>{s.t}</h2>
              {s.auto && autoNode(s.auto)}
              {!TEXT_HANDLED.has(s.k) && (secs[s.k]?.text || '').split('\n').map((p, i) => (
                <p key={i} style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.8, marginBottom: 8 }}>{p || ' '}</p>
              ))}
            </Page>
          ))}
        </div>
      </div>
      </SlideEditor.Provider>
      )}

      {/* modal ลงนามบนหน้าจอ (ขยายใหญ่ เซ็นด้วยนิ้ว/เมาส์) */}
      {signing && (
        <SignModal
          title={signing === 'sig_advisor' ? 'ลงนาม — ผู้ให้บริการ (นักวางแผนการเงิน)' : signing === 'sig_client' ? 'ลงนาม — ผู้รับบริการ (ลูกค้า)' : 'ลงนาม — พยาน'}
          value={signatures[signing] || ''}
          onSave={v => { setSignatures(s => ({ ...s, [signing]: v })); setSigning(null) }}
          onClear={() => { setSignatures(s => { const n = { ...s }; delete n[signing]; return n }); setSigning(null) }}
          onClose={() => setSigning(null)} />
      )}
    </div>
  )
}

/* ── modal ลายเซ็น: canvas ใหญ่ เซ็นบนหน้าจอ/ทัชสกรีนได้ ── */
function SignModal({ title, value, onSave, onClear, onClose }: { title: string; value: string; onSave: (v: string) => void; onClear: () => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value }
  }, [])
  const pos = (e: any) => {
    const c = ref.current!, r = c.getBoundingClientRect(), t = e.touches?.[0]
    // แปลงพิกัดจอ → พิกัด canvas จริง (กัน canvas ถูกย่อบนจอเล็กแล้วเส้นเพี้ยน)
    const sx = c.width / r.width, sy = c.height / r.height
    return { x: ((t ? t.clientX : e.clientX) - r.left) * sx, y: ((t ? t.clientY : e.clientY) - r.top) * sy }
  }
  const start = (e: any) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0f2a43'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); dirty.current = true }
  const end = () => { drawing.current = false }
  const clearCanvas = () => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); dirty.current = true }
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', width: '100%', maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12 }}>เซ็นในกรอบสีขาวด้วยเมาส์หรือนิ้ว (ทัชสกรีน) แล้วกด "บันทึกลายเซ็น"</div>
        <canvas ref={ref} width={660} height={240}
          style={{ width: '100%', background: '#fff', borderRadius: 10, border: '1px solid var(--card-border)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={clearCanvas} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>ล้างกระดาน</button>
          <button onClick={onClear} style={{ padding: '8px 16px', background: 'none', border: '1px solid #ef4444', borderRadius: 9, color: '#ef4444', fontSize: 13, cursor: 'pointer' }}>ลบลายเซ็นที่บันทึกไว้</button>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>ปิด</button>
          <button onClick={() => onSave(ref.current!.toDataURL('image/png'))} style={{ padding: '8px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 9, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>บันทึกลายเซ็น</button>
        </div>
      </div>
    </div>
  )
}

function Page({ children, pageId }: { children: React.ReactNode; pageId?: string }) {
  return (
    <div className="rp-page" style={{ width: '100%', maxWidth: 794, minHeight: 1050, background: '#ffffff', color: '#1e293b', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', borderRadius: 4, padding: '48px 56px', fontFamily: "'Sarabun', sans-serif", position: 'relative' }}>
      {children}
      {pageId && <OverlayLayer slideId={pageId} />}
    </div>
  )
}


const ecard: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px' }
const elbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }
const einp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
