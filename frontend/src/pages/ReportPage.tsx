import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FileText, Printer, Check, Loader2, FileStack, Presentation, Pencil } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { PageHeader } from '../components/ui'
import PresentationDeck, { type SlideEl, type CustomSlide } from './report/PresentationDeck'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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
  const annualAtRet = ((p.monthlyLiving ?? 0) + (p.monthlyHealth ?? 0)) * 12 * Math.pow(1 + g, yearsTo)
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

interface Sec { k: string; t: string; lvl: 1 | 2; auto?: string }
const SECTIONS: Sec[] = [
  { k: 'service', t: 'ข้อตกลงในการให้บริการ', lvl: 1 },
  { k: 'exec', t: 'บทสรุปผู้บริหาร', lvl: 1 },
  { k: 'reco', t: 'ข้อเสนอแนะ', lvl: 1 },
  { k: 'action', t: 'แผนปฏิบัติการ', lvl: 1 },
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
  { k: 'appendix', t: 'เอกสารแนบ', lvl: 1 },
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

  function autoNode(kind: string) {
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
      const a = calcRetire(retPlan?.self, assetAtRet(retPlan?.self)), b = calcRetire(retPlan?.spouse, assetAtRet(retPlan?.spouse))
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
            /* หน้ากระดาษ = สไลด์ 16:9 พอดี · สไลด์เต็มหน้าเสมอ (footer ชิดขอบล่างจริง) */
            @page { size: 297mm 167mm; margin: 0; }
            html, body { height: auto !important; }
            #report-paper { gap: 0 !important; }
            .pd-slide {
              width: 100vw !important; height: 100vh !important; max-width: none !important; aspect-ratio: auto !important;
              box-shadow: none !important; border-radius: 0 !important; margin: 0 !important;
              page-break-after: always; break-after: page; break-inside: avoid; overflow: hidden !important;
            }
            .pd-slide:last-of-type { page-break-after: auto; break-after: auto; }
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
              <button onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'var(--cyan)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={16} /> พิมพ์ / บันทึก PDF
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
          {/* Cover */}
          <Page>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'center', marginTop: 80 }}>
                <div style={{ fontSize: 14, color: '#64748b', letterSpacing: 2 }}>FINANCIAL PLAN</div>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f2a43', margin: '16px 0' }}>{title}</h1>
                <div style={{ fontSize: 18, color: '#334155', marginTop: 8 }}>จัดทำเพื่อ คุณ{clientName}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{today}</div>
              </div>
              {/* Advisor card */}
              <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
                {advisor?.photo
                  ? <img src={advisor.photo} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #0284c7' }} />
                  : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e2e8f0' }} />}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f2a43' }}>{advisor?.fullName || 'ที่ปรึกษาการเงิน'}</div>
                  {advisor?.position && <div style={{ fontSize: 12.5, color: '#475569' }}>{advisor.position}</div>}
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                    {[advisor?.phone, advisor?.email].filter(Boolean).join(' · ')}
                  </div>
                  {advisor?.address && <div style={{ fontSize: 11, color: '#64748b' }}>{advisor.address}</div>}
                </div>
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
          {included.map(s => (
            <Page key={s.k}>
              <h2 style={{ fontSize: s.lvl === 1 ? 20 : 16, fontWeight: 700, color: '#0f2a43', borderBottom: '2px solid #0284c7', paddingBottom: 6, marginBottom: 14 }}>{s.t}</h2>
              {s.auto && autoNode(s.auto)}
              {(secs[s.k]?.text || '').split('\n').map((p, i) => (
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
