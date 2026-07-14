import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FileText, Printer, Check, Loader2, FileStack, Presentation, Pencil, Download } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { PageHeader } from '../components/ui'
import PresentationDeck, { type SlideEl, type CustomSlide } from './report/PresentationDeck'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { calc as calcTaxCalc, defaultState as defaultTaxState } from '../lib/tax'

const fmt = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

/* ── financial math (mirror of feature pages) ── */
function pvAnnuity(rate: number, n: number, pmt: number) { return rate === 0 ? pmt * n : pmt * (1 - Math.pow(1 + rate, -n)) / rate }
function pmtForFV(rate: number, n: number, fv: number) { return rate === 0 ? fv / n : fv * rate / (Math.pow(1 + rate, n) - 1) }

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

function insNeed(plan: any, autoIncome: number) {
  if (!plan) return null
  const income = plan.income || autoIncome
  const sum = (arr: any[]) => (arr ?? []).reduce((s, it) => s + toNum(it.amount), 0)
  const familyExpense = Math.max(0, income - sum(plan.deductions))
  const realRate = (1 + (plan.returnRate ?? 5.9) / 100) / (1 + (plan.incomeGrowth ?? 5) / 100) - 1
  const pv = pvAnnuity(realRate, plan.years ?? 20, familyExpense)
  const debt = sum(plan.debts), assets = sum(plan.assets)
  const need = pv + debt, net = Math.max(0, need - assets)
  return { familyExpense, pv, debt, assets, need, net }
}

function calcRetire(p: any, asset: number) {
  if (!p) return null
  const yearsTo = Math.max(0, (p.retirementAge ?? 60) - (p.currentAge ?? 45))
  const yearsAfter = Math.max(0, (p.lifeExpectancy ?? 85) - (p.retirementAge ?? 60))
  const g = (p.inflationRate ?? 3) / 100, i = (p.preRetirementReturn ?? 8) / 100, r = (p.postRetirementReturn ?? 5) / 100
  const realRate = (1 + r) / (1 + g) - 1
  const annualAtRet = p.needMethod === 'replacement'
    ? (p.annualIncome ?? 0) * Math.pow(1 + (p.savingsGrowthRate ?? 0) / 100, yearsTo) * ((p.replacementRate ?? 70) / 100)
    : ((p.monthlyLiving ?? 0) + (p.monthlyHealth ?? 0)) * 12 * Math.pow(1 + g, yearsTo)
  const pvLiving = pvAnnuity(realRate, yearsAfter, annualAtRet)
  const pvLegacy = (p.legacy ?? 0) / Math.pow(1 + r, yearsAfter)
  let pvGoals = 0
  for (const goal of (p.goals ?? [])) {
    let k = goal.startYear
    while (k <= yearsAfter) {
      pvGoals += (goal.amount * Math.pow(1 + g, yearsTo + k)) / Math.pow(1 + r, k)
      if (!goal.everyYears) break
      k += goal.everyYears
    }
  }
  const totalNeeded = pvLiving + pvLegacy + pvGoals
  const gap = Math.max(0, totalNeeded - asset)
  const annualSavings = gap > 0 ? pmtForFV(i, yearsTo, gap) : 0
  return { totalNeeded, asset, gap, annualSavings, monthly: annualSavings / 12, yearsTo, yearsAfter }
}

/* ── Monte Carlo success rate: โอกาสที่เงินพอใช้ถึงอายุขัย ── */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type McOpts = {
  curAge: number; retAge: number; lifeExp: number
  startAssets: number; annualSaving: number; savingGrowth: number
  mu: number; sigma: number; lumpAtRet: number; expense1: number; inflation: number
}
function mcSuccessRate(o: McOpts): number {
  const N = 600
  if (o.lifeExp <= o.curAge) return 0
  const seed = (Math.round(o.startAssets) ^ (Math.round(o.mu * 10000) << 2) ^ (o.retAge << 8) ^ (o.lifeExp << 3) ^ Math.round(o.expense1)) >>> 0
  const rng = mulberry32(seed || 1)
  let ok = 0
  for (let p = 0; p < N; p++) {
    let v = o.startAssets, save = o.annualSaving, exp = o.expense1, alive = true
    for (let age = o.curAge; age < o.lifeExp; age++) {
      let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
      const growth = Math.exp((o.mu - (o.sigma * o.sigma) / 2) + o.sigma * z)
      if (age < o.retAge) {
        v = v * growth + save
        save *= 1 + o.savingGrowth
        if (age + 1 === o.retAge) v += o.lumpAtRet
      } else {
        v = (v - exp) * growth
        exp *= 1 + o.inflation
        if (v < 0) { alive = false; break }
      }
    }
    if (alive) ok++
  }
  return Math.round((ok / N) * 100)
}

interface Sec { k: string; t: string; lvl: 1 | 2; auto?: string }
const SECTIONS: Sec[] = [
  { k: 'letter', t: 'จดหมายจากนักวางแผนการเงิน', lvl: 1, auto: 'letter' },
  { k: 'clientgoals', t: 'เป้าหมายของคุณ', lvl: 1, auto: 'clientgoals' },
  { k: 'service', t: 'ข้อตกลงในการให้บริการ', lvl: 1 },
  { k: 'exec', t: 'บทสรุปผู้บริหาร', lvl: 1, auto: 'exec' },
  { k: 'domains', t: 'บทวิเคราะห์การวางแผนการเงิน 6 ด้าน', lvl: 1, auto: 'domains' },
  { k: 'reco', t: 'ข้อเสนอแนะ', lvl: 1 },
  { k: 'scenarios', t: 'การทดสอบความทนทานของแผน (Scenario & Monte Carlo)', lvl: 1, auto: 'scenarios' },
  { k: 'action', t: 'แผนปฏิบัติการ', lvl: 1, auto: 'action' },
  { k: 'personal', t: 'สรุปผลการวิเคราะห์ข้อมูลส่วนบุคคลเบื้องต้น', lvl: 1, auto: 'personal' },
  { k: 'finance', t: 'สรุปผลการวิเคราะห์ข้อมูลทางการเงินส่วนบุคคล', lvl: 1, auto: 'finance' },
  { k: 'fin_balance', t: 'งบดุล', lvl: 2, auto: 'balance' },
  { k: 'fin_cashflow', t: 'งบกระแสเงินสด', lvl: 2, auto: 'cashflow' },
  { k: 'fin_ratio', t: 'การวิเคราะห์อัตราส่วนทางการเงิน', lvl: 2 },
  { k: 'goals', t: 'ผลการวิเคราะห์เป้าหมายทางการเงิน', lvl: 1 },
  { k: 'g_debt', t: 'สรุปผลการวิเคราะห์ด้านหนี้สิน', lvl: 2, auto: 'debt' },
  { k: 'g_insurance', t: 'การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย', lvl: 2, auto: 'insurance' },
  { k: 'g_education', t: 'เป้าหมายทางการเงินเพื่อการศึกษาบุตร', lvl: 2, auto: 'education' },
  { k: 'g_retire', t: 'ความต้องการทางการเงินเพื่อการเกษียณ', lvl: 2, auto: 'retirement' },
  { k: 'g_tax', t: 'กลยุทธ์ในการวางแผนภาษี', lvl: 2 },
  { k: 'g_estate', t: 'แนวทางการจัดการทรัพย์สินและมรดก', lvl: 2 },
  { k: 'g_port', t: 'รูปแบบพอร์ตลงทุนที่เหมาะสม', lvl: 2, auto: 'portfolio' },
  { k: 'g_monitor', t: 'แนวทางในการควบคุมและวัดผลการดำเนินงาน', lvl: 2 },
  { k: 'g_calendar', t: 'สรุปปฏิทินชีวิต', lvl: 2 },
  { k: 'assumptions', t: 'สมมติฐานที่ใช้ในการวางแผน', lvl: 1, auto: 'assumptions' },
  { k: 'appendix', t: 'เอกสารแนบ', lvl: 1 },
  { k: 'acknowledge', t: 'การรับทราบและข้อจำกัดของรายงาน', lvl: 1, auto: 'ack' },
]

// หัวข้อที่ autoNode จัดการข้อความเองทั้งหมด (ช่องพิมพ์ = แก้ข้อความ default ไม่ใช่ต่อท้าย)
const TEXT_HANDLED = new Set(['letter', 'clientgoals', 'acknowledge'])

const DEFAULT_LETTER = [
  'เป้าหมายของคุณคือหัวใจของแผนฉบับนี้ — จากการพูดคุยร่วมกัน เราได้เรียนรู้ถึงตัวตน คุณค่าที่คุณยึดถือ และเป้าหมายที่คุณต้องการ เราไม่ได้พิจารณาเพียงผลกระทบทางตัวเลขของการตัดสินใจแต่ละครั้ง แต่รวมถึงมิติด้านความรู้สึกด้วย ความตั้งใจของเราคือช่วยให้คุณควบคุมการเงินของตนเองได้ดีขึ้น ปราศจากความกังวล เพื่อให้คุณมีอิสระในการใช้ชีวิตตามที่ต้องการ',
  'แผนฉบับนี้จัดทำแบบองค์รวม — เราวิเคราะห์ความมั่งคั่งสุทธิ กระแสเงินสด พอร์ตการลงทุน แผนเกษียณ การบริหารความเสี่ยง และการส่งมอบมรดกของคุณ ในบริบทของแผนภาพรวมเดียวกัน ไม่แยกส่วน เพื่อค้นหาความเสี่ยงและโอกาสที่เชื่อมโยงกันในทุกด้านของชีวิตทางการเงิน',
  'ชีวิตเปลี่ยนแปลงอยู่เสมอ และการเปลี่ยนแปลงส่วนใหญ่ล้วนมีผลทางการเงิน แผนการเงินจึงไม่ใช่เอกสารสรุปสถานะครั้งเดียว แต่เป็นกระบวนการต่อเนื่องที่ช่วยให้คุณตัดสินใจได้ดีขึ้นเมื่อสถานการณ์เปลี่ยนไป เราได้สรุปข้อเสนอแนะและแผนปฏิบัติการสำคัญไว้ในรายงานนี้ และจะทบทวนร่วมกับคุณอย่างสม่ำเสมอ',
]

const DEFAULT_ACK = [
  'ข้อเสนอแนะในรายงานฉบับนี้จัดทำขึ้นจากข้อมูลที่ท่านให้ไว้และสมมติฐานที่ระบุในหัวข้อ "สมมติฐานที่ใช้ในการวางแผน" หากข้อมูลส่วนบุคคล สถานการณ์ทางการเงิน หรือภาวะตลาดเปลี่ยนแปลงไป ข้อเสนอแนะเหล่านี้อาจเปลี่ยนแปลงตาม จึงควรทบทวนแผนอย่างน้อยปีละ 1 ครั้ง หรือเมื่อมีเหตุการณ์สำคัญในชีวิต',
  'ประมาณการต่าง ๆ ในรายงาน (รวมถึงผลการจำลอง Monte Carlo) เป็นเพียงการคาดการณ์ตามสมมติฐาน ไม่ใช่การรับประกันผลตอบแทนในอนาคต การเปลี่ยนแปลงตัวแปรเพียงเล็กน้อยอาจทำให้ผลลัพธ์ต่างไปอย่างมีนัยสำคัญ ผลการดำเนินงานในอดีตไม่ได้ยืนยันถึงผลการดำเนินงานในอนาคต',
  'รายงานฉบับนี้ไม่ถือเป็นคำแนะนำด้านกฎหมาย บัญชี หรือภาษีเฉพาะกรณี สำหรับประเด็นด้านกฎหมายและภาษี ควรปรึกษาผู้เชี่ยวชาญเฉพาะด้านก่อนดำเนินการ',
  'ข้าพเจ้าได้อ่านและรับทราบเนื้อหาของรายงานฉบับนี้ รวมถึงสมมติฐานและข้อจำกัดข้างต้นแล้ว',
]

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
  const { data: insPlan } = useQuery({ queryKey: ['insurance-plan'], queryFn: () => api.get('/insurance-plan').then(r => r.data), retry: false })
  const { data: saved, isFetched } = useQuery({ queryKey: ['report-plan'], queryFn: () => api.get('/report-plan').then(r => r.data), retry: false })
  const { data: taxPlanQ } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  const { data: actionData } = useQuery({ queryKey: ['action-items'], queryFn: () => api.get('/action-items').then(r => r.data), retry: false })
  const actionItems: any[] = Array.isArray(actionData) ? actionData : (actionData?.items ?? [])
  // คำแนะนำรายหมวดที่ที่ปรึกษาพิมพ์ไว้ในหน้าแผนปฏิบัติการ (แหล่งเดียวกัน — ไม่ต้องพิมพ์ซ้ำ)
  const domainAdvice: Record<string, string> = (!Array.isArray(actionData) && actionData?.advice) || {}
  // readiness กลาง (สูตรเดียวกับหน้าแผน/แผนปฏิบัติการ — กัน drift)
  const retR = useRetirementReadiness('client')
  const insR = useInsuranceReadiness('client')
  const eduR = useEducationReadiness()

  const [title, setTitle] = useState('แผนการเงินส่วนบุคคล')
  const [mode, setMode] = useState<'full' | 'pres'>('full')
  const [pres, setPres] = useState<Record<string, { comment?: string; hidden?: boolean }>>({})
  const [editMode, setEditMode] = useState(false)
  const [overlays, setOverlays] = useState<Record<string, SlideEl[]>>({})
  const [customSlides, setCustomSlides] = useState<CustomSlide[]>([])
  const [thankYouPhoto, setThankYouPhoto] = useState('')
  const [secs, setSecs] = useState<Record<string, SecData>>(() =>
    Object.fromEntries(SECTIONS.map(s => [s.k, { include: true, text: '' }])))
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved && typeof saved === 'object') {
      if (saved.title) setTitle(saved.title)
      if (saved.mode === 'pres' || saved.mode === 'full') setMode(saved.mode)
      if (saved.pres && typeof saved.pres === 'object') {
        const next: Record<string, { comment?: string; hidden?: boolean }> = {}
        for (const k of Object.keys(saved.pres)) {
          const v = saved.pres[k]
          next[k] = typeof v === 'string' ? { comment: v } : (v || {})   // backward-compat: string → {comment}
        }
        setPres(next)
      }
      if (saved.overlays && typeof saved.overlays === 'object') setOverlays(saved.overlays)
      if (Array.isArray(saved.customSlides)) setCustomSlides(saved.customSlides)
      if (typeof saved.thankYouPhoto === 'string') setThankYouPhoto(saved.thankYouPhoto)
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
    timer.current = setTimeout(() => save.mutate({ title, secs, mode, pres, overlays, customSlides, thankYouPhoto }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [title, secs, mode, pres, overlays, customSlides, thankYouPhoto])

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
  const spouseJob = Array.isArray(client?.spouseJobs) ? client.spouseJobs[0] : null
  const autoIncSelf = toNum(client?.salary) * 12
  const autoIncSpouse = (toNum(spouseJob?.salary) || toNum(client?.spouseIncome)) * 12
  const invAssets: any[] = invProfile?.investmentAssets ?? []
  const totalInv = invAssets.reduce((s, a) => s + toNum(a.currentValue), 0)
  let _wr = 0, _cv = 0
  invAssets.forEach(a => { const v = toNum(a.currentValue), rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { _cv += v; _wr += rr * v } })
  const portRet = _cv > 0 ? _wr / _cv : 0
  const assetAtRet = (p: any) => { const yt = Math.max(0, (p?.retirementAge ?? 60) - (p?.currentAge ?? 45)); return totalInv * Math.pow(1 + portRet / 100, yt) }
  const eduCosts = profile?.educationCosts ?? {}
  const eduInf = profile?.educationInflation ?? 5, eduRet = profile?.educationFundReturn ?? 4
  const children: any[] = client?.children ?? []

  function DataTable({ rows }: { rows: [string, number, string?][] }) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
        <tbody>{rows.map(([l, v, color], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '7px 4px', color: '#475569' }}>{l}</td>
            <td style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: color || '#0f2a43' }}>{fmt(v)} บาท</td>
          </tr>
        ))}</tbody>
      </table>
    )
  }

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
    if (kind === 'letter') {
      const custom = (secs['letter']?.text || '').trim()
      const paras = custom ? custom.split('\n').filter(Boolean) : DEFAULT_LETTER
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.8, marginBottom: 14 }}>เรียน คุณ{clientName}</p>
          {paras.map((p, i) => <p key={i} style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.9, marginBottom: 12, textIndent: 28 }}>{p}</p>)}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 14, color: '#1e293b' }}>ด้วยความเคารพ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 22 }}>{advisor?.fullName || 'นักวางแผนการเงิน'}</div>
            {advisor?.position && <div style={{ fontSize: 12.5, color: '#64748b' }}>{advisor.position}</div>}
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{today}</div>
          </div>
        </div>
      )
    }
    if (kind === 'clientgoals') {
      const custom = (secs['clientgoals']?.text || '').trim()
      const derived: string[] = []
      if (retR) derived.push(`มีเงินเพียงพอสำหรับการใช้ชีวิตหลังเกษียณตามมาตรฐานที่ต้องการ`)
      if (eduR && eduR.childCount > 0) derived.push(`เตรียมทุนการศึกษาให้บุตร ${eduR.childCount} คน จนจบระดับการศึกษาที่วางแผนไว้`)
      if (insR) derived.push('คุ้มครองรายได้และภาระของครอบครัวจากเหตุการณ์ไม่คาดฝันด้วยทุนประกันที่เหมาะสม')
      derived.push('บริหารภาษีอย่างมีประสิทธิภาพภายใต้สิทธิประโยชน์ที่กฎหมายกำหนด')
      derived.push(profile?.estatePlan ? 'ส่งมอบทรัพย์สินให้ทายาทอย่างเป็นระบบตามความประสงค์' : 'จัดทำแผนมรดกและพินัยกรรมเพื่อส่งมอบทรัพย์สินตามความประสงค์')
      const goals = custom ? custom.split('\n').filter(Boolean) : derived
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 14 }}>เป้าหมายต่อไปนี้คือสิ่งที่เราให้ความสำคัญที่สุดในการจัดทำแผน ทุกข้อเสนอแนะในรายงานล้วนมุ่งไปสู่เป้าหมายเหล่านี้</p>
          {goals.map((g, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', marginBottom: 8, background: '#f8fafc', borderRadius: 10, borderLeft: `4px solid ${TEAL}` }}>
              <span style={{ color: TEAL, fontWeight: 800, fontSize: 15, lineHeight: 1.5 }}>›</span>
              <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 600, lineHeight: 1.7 }}>{g}</span>
            </div>
          ))}
        </div>
      )
    }
    if (kind === 'scenarios') {
      const rp = retPlan?.self
      if (!rp) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลแผนเกษียณ — กรอกที่หน้า "วางแผนเกษียณ" ก่อน</div>
      const curAge = rp.currentAge ?? age ?? 45
      const retAge = profile?.retirementAgeSelf ?? rp.retirementAge ?? 60
      const lifeExp = profile?.lifeExpectancySelf ?? rp.lifeExpectancy ?? 85
      const inflation = (rp.inflationRate ?? profile?.inflationRate ?? 3) / 100
      const sgr = (rp.savingsGrowthRate ?? 0) / 100
      // ความผันผวนตามระดับความเสี่ยง (ตรรกะเดียวกับแบบจำลองหน้ามูลค่าสินทรัพย์ลงทุน)
      const riskLabel = String(profile?.riskLabel ?? profile?.riskLevel ?? '')
      const sigmaPct = /สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (portRet >= 8 ? 16 : portRet >= 4 ? 11 : 6)
      const mu = (portRet > 0 ? portRet : (rp.preRetirementReturn ?? 5)) / 100
      const lump = retR ? retR.sources.sso + retR.sources.pvd + retR.sources.severance : 0
      const saving = retR?.annualSavings ?? 0
      const expenseAt = (ra: number) => rp.needMethod === 'replacement'
        ? (rp.annualIncome ?? 0) * Math.pow(1 + sgr, Math.max(0, ra - curAge)) * ((rp.replacementRate ?? 70) / 100)
        : ((rp.monthlyLiving ?? 0) + (rp.monthlyHealth ?? 0)) * 12 * Math.pow(1 + inflation, Math.max(0, ra - curAge))
      const base: McOpts = { curAge, retAge, lifeExp, startAssets: totalInv, annualSaving: saving, savingGrowth: sgr, mu, sigma: sigmaPct / 100, lumpAtRet: lump, expense1: expenseAt(retAge), inflation }
      const scenarios: { name: string; desc: string; o: McOpts }[] = [
        { name: 'แผนพื้นฐาน', desc: `ออมเพิ่มตามแผน ${fmt(saving)} บาท/ปี · เกษียณอายุ ${retAge} · อายุขัย ${lifeExp} ปี · เงินเฟ้อ ${(inflation * 100).toFixed(1)}%`, o: base },
        { name: 'ไม่ออมเพิ่มจากปัจจุบัน', desc: 'เหมือนแผนพื้นฐาน แต่ไม่มีการออมเพิ่ม — ใช้เฉพาะสินทรัพย์ที่มีและเงินก้อน ณ เกษียณ', o: { ...base, annualSaving: 0 } },
        { name: `อายุยืนถึง ${lifeExp + 5} ปี`, desc: 'เหมือนแผนพื้นฐาน แต่ต้องใช้เงินหลังเกษียณนานขึ้นอีก 5 ปี', o: { ...base, lifeExp: lifeExp + 5 } },
        { name: 'เงินเฟ้อสูงขึ้น +1%', desc: `เงินเฟ้อตลอดแผนเพิ่มเป็น ${(inflation * 100 + 1).toFixed(1)}% ต่อปี`, o: { ...base, inflation: inflation + 0.01, expense1: expenseAt(retAge) * Math.pow(1.01, Math.max(0, retAge - curAge)) } },
        ...(retAge - 5 > curAge ? [{ name: `เกษียณเร็วขึ้น 5 ปี (อายุ ${retAge - 5})`, desc: 'ระยะเวลาออมสั้นลงและใช้เงินหลังเกษียณนานขึ้น', o: { ...base, retAge: retAge - 5, expense1: expenseAt(retAge - 5) } }] : []),
        { name: 'ผลตอบแทนต่ำกว่าคาด −2%', desc: `ผลตอบแทนพอร์ตเฉลี่ยลดจาก ${(mu * 100).toFixed(1)}% เหลือ ${(mu * 100 - 2).toFixed(1)}% ต่อปี`, o: { ...base, mu: mu - 0.02 } },
      ]
      const results = scenarios.map(s => ({ ...s, pct: mcSuccessRate(s.o) }))
      const tone = (p: number) => p >= 80 ? GREENR : p >= 60 ? AMBERR : REDR
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.8, marginBottom: 6 }}>
            เพื่อทดสอบความยั่งยืนของแผน เราจำลอง "ชีวิตทางการเงิน" ของคุณ 600 เส้นทางด้วยเทคนิค Monte Carlo โดยสุ่มลำดับผลตอบแทนตามความผันผวนของพอร์ต ({sigmaPct}% ต่อปี) ตัวเลขที่แสดงคือสัดส่วนของเส้นทางที่เงินยังเหลือถึงอายุขัยที่วางแผนไว้
          </p>
          <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
            หมายเหตุ: การเปลี่ยนตัวแปรเพียงเล็กน้อยอาจทำให้ผลลัพธ์ต่างกันมาก ผล Monte Carlo จึงเหมาะกับการ "เปรียบเทียบระหว่างทางเลือก" มากกว่าการชี้ขาดว่าแผนสำเร็จหรือล้มเหลว — ค่าที่ต่ำหมายถึงความยืดหยุ่นในอนาคตน้อยลง ไม่ใช่ความล้มเหลวแน่นอน
          </p>
          {results.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 16px', marginBottom: 8, breakInside: 'avoid' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{i + 1}. {s.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.6, marginTop: 3 }}>{s.desc}</div>
                <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(3, s.pct)}%`, borderRadius: 999, background: tone(s.pct) }} />
                </div>
              </div>
              <div style={{ width: 76, textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: tone(s.pct) }}>{s.pct}%</div>
                <div style={{ fontSize: 9.5, color: '#94a3b8', letterSpacing: 0.5 }}>โอกาสสำเร็จ</div>
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (kind === 'action') {
      // checklist แยกฝั่งผู้รับผิดชอบ (สไตล์ Immediate Action Items)
      const ownerTh = (o: string) => o === 'client' ? 'ลูกค้า' : o === 'advisor' ? 'ที่ปรึกษา' : o === 'spouse' ? 'คู่สมรส' : (o || '')
      type Ln = { plan: string; amount: number; schedule: string; owner: string; done: boolean }
      const lines: Ln[] = []
      for (const it of actionItems) {
        const rows: any[] = Array.isArray(it.subPlan) ? it.subPlan : []
        const done = it.status === 'done' || !!it.completedAt
        if (!rows.length) { lines.push({ plan: it.title, amount: toNum(it.target), schedule: it.dueDate || '', owner: ownerTh(it.owner), done }); continue }
        for (const r of rows) {
          const plan = String(r?.desc || r?.method || r?.who || '').trim()
          const amount = toNum(r?.amount ?? r?.premium)
          if (!plan && amount <= 0 && !r?.schedule) continue
          lines.push({ plan: plan || it.title, amount, schedule: r?.schedule || '', owner: String(r?.owner || '').trim() || ownerTh(it.owner), done })
        }
      }
      if (!lines.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีรายการในแผนปฏิบัติการ — เพิ่มได้ที่หน้า "แผนปฏิบัติการ"</div>
      const advisorLines = lines.filter(l => l.owner === 'ที่ปรึกษา')
      const clientLines = lines.filter(l => l.owner !== 'ที่ปรึกษา')
      const fmtDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' }) }
      const Group = ({ title, items }: { title: string; items: Ln[] }) => items.length === 0 ? null : (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', borderBottom: `2px solid ${TEAL}`, paddingBottom: 6, marginBottom: 8 }}>{title}</div>
          {items.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 2px', borderBottom: '1px solid #f8fafc' }}>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: l.done ? GREENR : '#94a3b8' }}>{l.done ? '☑' : '☐'}</span>
              <span style={{ flex: 1, fontSize: 13, color: l.done ? '#94a3b8' : '#1e293b', lineHeight: 1.7, textDecoration: l.done ? 'line-through' : 'none' }}>
                {l.plan}
                {l.owner && l.owner !== 'ที่ปรึกษา' && <span style={{ color: '#94a3b8', fontSize: 11.5 }}> · {l.owner}</span>}
              </span>
              {l.amount > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', whiteSpace: 'nowrap' }}>{fmt(l.amount)} ฿</span>}
              {l.schedule && <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(l.schedule)}</span>}
            </div>
          ))}
        </div>
      )
      return (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 14 }}>เราแนะนำให้ดำเนินการตามรายการต่อไปนี้เพื่อยกระดับสถานะการเงินของคุณให้สอดคล้องกับสมมติฐานในแผน โดยแบ่งตามผู้รับผิดชอบ</p>
          <Group title="รายการที่คุณต้องดำเนินการ" items={clientLines} />
          <Group title="รายการที่นักวางแผนการเงินจะดำเนินการให้" items={advisorLines} />
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
        </div>
      )
    }
    if (kind === 'ack') {
      const custom = (secs['acknowledge']?.text || '').trim()
      const paras = custom ? custom.split('\n').filter(Boolean) : DEFAULT_ACK
      return (
        <div style={{ marginBottom: 16 }}>
          {paras.map((p, i) => <p key={i} style={{ fontSize: 13, color: '#475569', lineHeight: 1.9, marginBottom: 10 }}>{p}</p>)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginTop: 56 }}>
            {[[`คุณ${clientName}`, 'ลูกค้า'], [advisor?.fullName || 'นักวางแผนการเงิน', 'นักวางแผนการเงิน']].map(([name, role]) => (
              <div key={role} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #94a3b8', height: 44 }} />
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 8 }}>{name}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{role}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 14 }}>วันที่ ____ / ____ / ________</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (kind === 'exec') {
      const score: number | null = ratios?.healthScore ?? null
      const scoreLabel: string = ratios?.healthLabel ?? ''
      const emMonths = sm.totalMonthlyExp > 0 ? sm.liquidAssets / sm.totalMonthlyExp : 0
      const gaps: string[] = []
      if (sm.totalMonthlyExp > 0 && emMonths < 6) gaps.push(`เงินสำรองฉุกเฉินครอบคลุม ~${emMonths.toFixed(1)} เดือน ต่ำกว่าเกณฑ์ 6 เดือน`)
      if (insR && insR.gap > 0) gaps.push(`ทุนประกันชีวิตยังขาดอีก ${fmt(insR.gap)} บาท จากทุนที่แนะนำ ${fmt(insR.need)} บาท`)
      if (retR && retR.gap > 0) gaps.push(`ทุนเกษียณยังขาดอีก ${fmt(retR.gap)} บาท (ควรออมเพิ่ม ~${fmt(retR.annualSavings)} บาท/ปี)`)
      if (eduR && eduR.childCount > 0) gaps.push(`ทุนการศึกษาบุตร ${eduR.childCount} คน ต้องเตรียมรวม ${fmt(eduR.totalNominal)} บาท (~${fmt(eduR.monthlySaving)} บาท/เดือน)`)
      if (!gaps.length) gaps.push('ไม่พบช่องว่างสำคัญ — สถานะการเงินโดยรวมอยู่ในเกณฑ์ดี')
      const circ = 2 * Math.PI * 52
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '215px 1fr', gap: 16, marginBottom: 16 }}>
            {/* Health score ring */}
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Financial Health Score</div>
              <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
                <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx={60} cy={60} r={52} fill="none" stroke="#e2e8f0" strokeWidth={9} />
                  <circle cx={60} cy={60} r={52} fill="none" stroke={TEAL} strokeWidth={9} strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100)} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: '#0f172a' }}>{score ?? '—'}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: TEAL, textTransform: 'uppercase', letterSpacing: 1 }}>{scoreLabel || 'สุขภาพการเงิน'}</div>
            </div>
            {/* Key gaps */}
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>⚠ ประเด็นสำคัญที่ตรวจพบ</div>
              {gaps.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#475569', lineHeight: 1.7 }}>
                  <span style={{ color: TEAL, fontWeight: 800 }}>•</span>{g}
                </div>
              ))}
            </div>
          </div>
          {/* stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {([['สินทรัพย์รวม', sm.totalAssets], ['หนี้สินรวม', sm.totalDebtBalance], ['ความมั่งคั่งสุทธิ', sm.netWorth]] as const).map(([l, v]) => (
              <div key={l} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{l}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: l === 'หนี้สินรวม' ? AMBERR : '#0f172a', fontFamily: 'monospace', marginTop: 4 }}>{fmt(toNum(v))} ฿</div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    if (kind === 'domains') {
      const emMonths = sm.totalMonthlyExp > 0 ? sm.liquidAssets / sm.totalMonthlyExp : 0
      const savingsRate = sm.monthlyIncome > 0 ? (sm.annualSavings / (sm.monthlyIncome * 12)) * 100 : 0
      const debtToAsset = sm.totalAssets > 0 ? (sm.totalDebtBalance / sm.totalAssets) * 100 : 0
      const tp = taxPlanQ?.self
      const tc = tp ? calcTaxCalc({ ...defaultTaxState(), ...tp }) : null
      const liqOk = emMonths >= 6 && debtToAsset <= 50 && savingsRate >= 10
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <DomainCard no={1} advice={domainAdvice.liquidity} title="การบริหารสภาพคล่อง/หนี้สิน"
            status={liqOk ? { label: 'เพียงพอ', tone: 'good' } : { label: 'ควรปรับปรุง', tone: 'warn' }}
            pct={Math.min(100, emMonths / 6 * 100)}
            rows={[['เงินสำรองฉุกเฉิน (เดือน)', `${emMonths.toFixed(1)} / 6.0`], ['อัตราการออม', `${savingsRate.toFixed(0)}%`], ['หนี้สินต่อสินทรัพย์', `${debtToAsset.toFixed(0)}%`]]} />
          <DomainCard no={2} advice={domainAdvice.investment} title="การวางแผนการลงทุน/เป้าหมาย"
            status={totalInv > 0 ? { label: 'ดำเนินการอยู่', tone: 'good' } : { label: 'เริ่มวางแผน', tone: 'warn' }}
            pct={totalInv > 0 ? 80 : 15}
            rows={[['สินทรัพย์ลงทุนรวม', `${fmt(totalInv)} ฿`], ['ผลตอบแทนพอร์ต (เฉลี่ย)', `${portRet.toFixed(1)}%`]]} />
          <DomainCard no={3} advice={domainAdvice.insurance} title="การวางแผนประกัน & ความเสี่ยง"
            status={insR ? (insR.gap > 0 ? { label: `ขาด ${fmt(insR.gap)} ฿`, tone: 'warn' } : { label: 'เพียงพอ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
            pct={insR && insR.need > 0 ? insR.have / insR.need * 100 : 0}
            rows={[['ทุนประกันที่แนะนำ', insR ? `${fmt(insR.need)} ฿` : '—'], ['ความคุ้มครองที่มี', insR ? `${fmt(insR.have)} ฿` : '—'], ['ส่วนที่ยังขาด', insR && insR.gap > 0 ? `${fmt(insR.gap)} ฿` : 'เพียงพอ']]} />
          <DomainCard no={4} advice={domainAdvice.retirement} title="การวางแผนเกษียณอายุ"
            status={retR ? (retR.gap > 0 ? { label: `ขาด ${fmt(retR.gap)} ฿`, tone: 'warn' } : { label: 'พร้อมเกษียณ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
            pct={retR?.readinessPct ?? 0}
            rows={[['ทุนเกษียณที่ต้องการ', retR ? `${fmt(retR.needed)} ฿` : '—'], ['ทรัพย์สินที่เตรียมแล้ว', retR ? `${fmt(retR.have)} ฿` : '—'], ['ต้องออมเพิ่ม/ปี', retR && retR.gap > 0 ? `${fmt(retR.annualSavings)} ฿` : '—']]} />
          <DomainCard no={5} advice={domainAdvice.tax} title="การวางแผนภาษี"
            status={tc ? { label: 'วางแผนแล้ว', tone: 'good' } : { label: 'ยังไม่วางแผน', tone: 'warn' }}
            pct={tc ? 75 : 10}
            rows={[['เงินได้สุทธิ', tc ? `${fmt(tc.ni)} ฿` : '—'], ['ภาษีที่ต้องชำระ', tc ? `${fmt(tc.netTax)} ฿` : '—'], ['อัตราภาษีที่แท้จริง', tc ? `${tc.eff.toFixed(1)}%` : '—']]} />
          <DomainCard no={6} advice={domainAdvice.estate} title="การวางแผนส่งมอบมรดก"
            status={profile?.estatePlan ? { label: 'มีแผนแล้ว', tone: 'good' } : { label: 'ควรจัดทำ', tone: 'warn' }}
            pct={profile?.estatePlan ? 70 : 15}
            rows={[['ความมั่งคั่งสุทธิ (กองมรดก)', `${fmt(toNum(sm.netWorth))} ฿`], ['สถานะแผนมรดก/พินัยกรรม', profile?.estatePlan ? 'จัดทำแล้ว' : 'ยังไม่จัดทำ']]} />
        </div>
      )
    }
    if (kind === 'personal') return (
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
        {[
          `ชื่อ-นามสกุล: คุณ${clientName}`,
          age != null ? `อายุ: ${age} ปี` : '',
          client?.maritalStatus ? `สถานภาพสมรส: ${client.maritalStatus}` : '',
          client?.occupation ? `อาชีพ: ${client.occupation}` : '',
          client?.dependents != null ? `จำนวนผู้อยู่ในอุปการะ: ${client.dependents} คน` : '',
        ].filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 13, color: '#334155', padding: '3px 0' }}>{l}</div>)}
      </div>
    )
    if (kind === 'finance') return (
      <DataTable rows={[
        ['สินทรัพย์รวม', toNum(sm.totalAssets), '#0284c7'],
        ['หนี้สินรวม', toNum(sm.totalDebtBalance), '#f87171'],
        ['ความมั่งคั่งสุทธิ', toNum(sm.netWorth), '#10b981'],
        ['รายได้รวมต่อปี', toNum(sm.totalAnnualIncome)],
        ['กระแสเงินสดสุทธิต่อปี', toNum(sm.netAnnualCashFlow)],
      ]} />
    )
    if (kind === 'balance') {
      const A = toNum(sm.totalAssets), L = toNum(sm.totalDebtBalance), NW = toNum(sm.netWorth)
      return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <DataTable rows={[['สินทรัพย์รวม', A, '#0284c7'], ['หนี้สินรวม', L, '#f87171'], ['ความมั่งคั่งสุทธิ', NW, '#10b981']]} />
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'สินทรัพย์', v: A }, { name: 'หนี้สิน', v: L }, { name: 'ความมั่งคั่งสุทธิ', v: NW }]}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
                <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {['#0284c7', '#f87171', '#10b981'].map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    if (kind === 'cashflow') {
      const inc = toNum(sm.totalAnnualIncome), net = toNum(sm.netAnnualCashFlow), exp = inc - net
      return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <DataTable rows={[['รายได้รวมต่อปี', inc, '#10b981'], ['ค่าใช้จ่าย+ชำระหนี้ต่อปี', exp, '#f87171'], ['กระแสเงินสดสุทธิต่อปี', net, '#0284c7']]} />
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[{ name: 'รายได้', v: inc }, { name: 'รายจ่าย', v: exp }, { name: 'คงเหลือ', v: net }]}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={48} />
                <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {['#10b981', '#f87171', '#0284c7'].map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    if (kind === 'debt') {
      const L = toNum(sm.totalDebtBalance), A = toNum(sm.totalAssets), mp = toNum(sm.totalMonthlyPayment)
      return <DataTable rows={[
        ['ภาระหนี้สินคงค้างรวม', L, '#f87171'],
        ['ภาระผ่อนชำระต่อเดือน', mp, '#f59e0b'],
        ['อัตราส่วนหนี้สินต่อสินทรัพย์ (%)', A > 0 ? Math.round(L / A * 100) : 0, '#475569'],
      ]} />
    }
    if (kind === 'insurance') {
      const rows: any[] = []
      const a = insNeed(insPlan?.self, autoIncSelf), b = insNeed(insPlan?.spouse, autoIncSpouse)
      const block = (name: string, x: any) => x && (
        <div key={name} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f2a43', marginBottom: 4 }}>{name}</div>
          <DataTable rows={[
            ['ทุนประกันที่ต้องการ', x.need, '#f59e0b'],
            ['(−) สินทรัพย์/เงินชดเชยที่มี', x.assets, '#10b981'],
            ['ทุนประกันที่ต้องการเพิ่ม (สุทธิ)', x.net, '#0284c7'],
          ]} />
        </div>
      )
      rows.push(block(`คุณ${[client?.firstName].filter(Boolean).join('') || 'ลูกค้า'}`, a))
      rows.push(block(client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', b))
      return <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>{rows}</div>
    }
    if (kind === 'education') {
      if (!children.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลบุตร</div>
      return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ ...thL }}>บุตร</th><th style={thRr}>ค่าเล่าเรียนรวม</th><th style={thRr}>เงินก้อนวันนี้</th><th style={thRr}>ออม/ปี</th><th style={thRr}>ออม/เดือน</th>
            </tr></thead>
            <tbody>{children.map((c, i) => {
              const e = eduForChild(toNum(c.age), eduPlan?.[i], eduCosts, eduInf, eduRet)
              return <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdL}>{c.name || `บุตรคนที่ ${i + 1}`} (อายุ {toNum(c.age)})</td>
                <td style={tdRr}>{fmt(e.totalNominal)}</td>
                <td style={{ ...tdRr, color: '#f59e0b' }}>{fmt(e.totalPV)}</td>
                <td style={{ ...tdRr, color: '#10b981' }}>{fmt(e.annual)}</td>
                <td style={{ ...tdRr, color: '#10b981' }}>{fmt(e.monthly)}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      )
    }
    if (kind === 'retirement') {
      // อายุเกษียณ/อายุขัย = แหล่งเดียวจากหน้าสมมติฐาน (profile) override ค่าที่บันทึกในแผน
      const selfP = retPlan?.self ? { ...retPlan.self, retirementAge: profile?.retirementAgeSelf ?? retPlan.self.retirementAge, lifeExpectancy: profile?.lifeExpectancySelf ?? retPlan.self.lifeExpectancy } : retPlan?.self
      const spouseP = retPlan?.spouse ? { ...retPlan.spouse, retirementAge: profile?.retirementAgeSpouse ?? retPlan.spouse.retirementAge, lifeExpectancy: profile?.lifeExpectancySpouse ?? retPlan.spouse.lifeExpectancy } : retPlan?.spouse
      const a = calcRetire(selfP, assetAtRet(retPlan?.self)), b = calcRetire(spouseP, assetAtRet(retPlan?.spouse))
      const persons = [
        { name: `คุณ${client?.firstName || 'ลูกค้า'}`, c: a },
        { name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', c: b },
      ].filter(x => x.c)
      return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid #cbd5e1' }}>
              <th style={thL}>ผู้เกษียณ</th><th style={thRr}>เงินที่ต้องการ</th><th style={thRr}>สินทรัพย์ ณ เกษียณ</th><th style={thRr}>ส่วนที่ขาด</th><th style={thRr}>ออม/เดือน</th>
            </tr></thead>
            <tbody>{persons.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdL}>{p.name}</td>
                <td style={tdRr}>{fmt(p.c!.totalNeeded)}</td>
                <td style={{ ...tdRr, color: '#10b981' }}>{fmt(p.c!.asset)}</td>
                <td style={{ ...tdRr, color: '#f87171' }}>{fmt(p.c!.gap)}</td>
                <td style={{ ...tdRr, color: '#0284c7' }}>{fmt(p.c!.monthly)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={persons.map(p => ({ name: p.name, ต้องการ: Math.round(p.c!.totalNeeded), มีอยู่: Math.round(p.c!.asset) }))}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={42} />
                <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ต้องการ" fill="#f59e0b" radius={[5, 5, 0, 0]} />
                <Bar dataKey="มีอยู่" fill="#10b981" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
    if (kind === 'portfolio') {
      if (allocation.total === 0) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน</div>
      return (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 220, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocation.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`}>
                  {allocation.rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1 }}>
            <DataTable rows={allocation.rows.map((r, i) => [r.name, r.value, PIE_COLORS[i % PIE_COLORS.length]] as [string, number, string])} />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f2a43', textAlign: 'right' }}>รวม {fmt(allocation.total)} บาท</div>
          </div>
        </div>
      )
    }
    return null
  }

  const included = SECTIONS.filter(s => secs[s.k]?.include)

  // ── Export PDF เอง (jsPDF + html2canvas) — ชัวร์ทุกอุปกรณ์ โดยเฉพาะ iPad ที่ print เบราว์เซอร์เพี้ยน ──
  const [exporting, setExporting] = useState(false)
  async function exportPdf() {
    const paper = document.getElementById('report-paper')
    if (!paper) return
    // pres → จับ .pd-slide (16:9) · full → จับ .rp-page (A4 portrait)
    const isPres = mode === 'pres'
    const els = Array.from(paper.querySelectorAll(isPres ? '.pd-slide' : '.rp-page')) as HTMLElement[]
    if (!els.length) return
    setExporting(true)
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
      const fmtPage: [number, number] = isPres ? [297, 210] : [210, 297]   // mm (pres = A4 แนวนอน)
      const pdf = new jsPDF({ orientation: isPres ? 'landscape' : 'portrait', unit: 'mm', format: fmtPage })
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        // เปิด overflow ชั่วคราว + จับความสูงเต็ม (scrollHeight) กันเนื้อหาแน่นโดนตัดขอบล่าง
        const prevOverflow = el.style.overflow
        el.style.overflow = 'visible'
        const fullH = el.scrollHeight
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          height: fullH, windowHeight: fullH,
          ignoreElements: e => e.classList?.contains('no-print') })
        el.style.overflow = prevOverflow
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
              {mode === 'pres' && (
                <button onClick={() => setEditMode(e => !e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: editMode ? 'var(--cyan)' : 'transparent', color: editMode ? '#00201d' : 'var(--text-secondary)', border: `1px solid ${editMode ? 'var(--cyan)' : 'var(--card-border)'}` }}>
                  <Pencil size={15} /> {editMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขสไลด์'}
                </button>
              )}
              {status === 'saving' && <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={14} className="rp-spin" /> กำลังบันทึก...</span>}
              {status === 'saved' && <span style={{ fontSize: 12.5, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> บันทึกแล้ว</span>}
              <button onClick={() => window.print()} title="ใช้ระบบพิมพ์ของเบราว์เซอร์ (เหมาะกับเดสก์ท็อป)"
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
        <PresentationDeck title={title} pres={pres}
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
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Editor */}
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingRight: 4 }}>
          <div style={ecard}>
            <label style={elbl}>ชื่อรายงาน</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={einp} />
          </div>
          {SECTIONS.map(s => (
            <div key={s.k} style={ecard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="checkbox" checked={secs[s.k]?.include ?? true} onChange={e => setInc(s.k, e.target.checked)} />
                <span style={{ fontSize: 12.5, fontWeight: s.lvl === 1 ? 700 : 500, color: s.lvl === 1 ? 'var(--cyan)' : 'var(--text-secondary)' }}>
                  {s.lvl === 2 ? '— ' : ''}{s.t}
                </span>
              </div>
              <textarea value={secs[s.k]?.text ?? ''} onChange={e => setText(s.k, e.target.value)}
                placeholder="พิมพ์เนื้อหา/ข้อเสนอแนะสำหรับหัวข้อนี้..." rows={3}
                style={{ ...einp, resize: 'vertical', minHeight: 56 }} />
            </div>
          ))}
        </div>

        {/* Paper preview */}
        <div id="report-paper" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
          {/* Cover — สไตล์มืออาชีพ (โลโก้ · แถบชื่อเรื่อง · แบนเนอร์ · ข้อมูลลูกค้า/ที่ปรึกษา) */}
          <Page>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: '30px 0', borderTop: '1px solid #f1f5f9', marginTop: 28 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>จัดทำเพื่อ</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>คุณ{clientName}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>เอกสารเฉพาะบุคคล · ห้ามเผยแพร่</div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase', margin: '18px 0 4px' }}>วันที่จัดทำรายงาน</div>
                  <div style={{ fontSize: 14, color: '#334155' }}>{today}</div>
                </div>
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
          <Page>
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
            <Page key={s.k}>
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
      )}
    </div>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="rp-page" style={{ width: '100%', maxWidth: 794, minHeight: 1050, background: '#ffffff', color: '#1e293b', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', borderRadius: 4, padding: '48px 56px', fontFamily: "'Sarabun', sans-serif" }}>
      {children}
    </div>
  )
}

const thL: React.CSSProperties = { padding: '6px 6px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 700 }
const thRr: React.CSSProperties = { padding: '6px 6px', textAlign: 'right', fontSize: 11, color: '#64748b', fontWeight: 700 }
const tdL: React.CSSProperties = { padding: '6px 6px', textAlign: 'left', color: '#334155' }
const tdRr: React.CSSProperties = { padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: '#0f2a43', fontWeight: 600 }

const ecard: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '10px 12px' }
const elbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }
const einp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }
