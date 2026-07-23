import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FileText, Printer, Check, Loader2, FileStack, Presentation, Pencil, Download, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { useClient } from '../context/ClientContext'
import { PageHeader } from '../components/ui'
import PresentationDeck, { SlideEditor, OverlayLayer, DECK_SLIDES, type SlideEl, type CustomSlide } from './report/PresentationDeck'
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Area, ReferenceLine } from 'recharts'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { calc as calcTaxCalc, defaultState as defaultTaxState } from '../lib/tax'
import { hasSpouseInfo } from '../lib/spouse'
import { monthlyIncome as incMonthly } from '../lib/income'
import { useInsuranceCoverage } from '../components/InsuranceCoverageSummary'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../lib/portfolioReturns'
import { mulberry32, toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR, DomainCard } from './report/primitives'
import { fmt } from './report/format'
import Acknowledgement from './report/sections/Acknowledgement'
import Assumptions from './report/sections/Assumptions'
import type { ReportCtx } from './report/ctx'
import ServiceAgreement from './report/sections/ServiceAgreement'
import AdvisorProfile from './report/sections/AdvisorProfile'
import ActionPlanSummary from './report/sections/ActionPlanSummary'
import ClientGoals from './report/sections/ClientGoals'
import RetirementSection from './report/sections/RetirementSection'
import EducationSection from './report/sections/EducationSection'
import TaxSection from './report/sections/TaxSection'
import EstateSection from './report/sections/EstateSection'
import ExecutiveSummary from './report/sections/ExecutiveSummary'
import BasicInfo from './report/sections/BasicInfo'
import InsuranceSection from './report/sections/InsuranceSection'
import PortfolioReco from './report/sections/PortfolioReco'




interface Sec { k: string; t: string; lvl: 1 | 2; auto?: string }
const SECTIONS: Sec[] = [
  { k: 'service', t: 'ข้อตกลงในการให้บริการ', lvl: 1, auto: 'service' },
  { k: 'execsum', t: 'บทสรุปผู้บริหาร', lvl: 1, auto: 'execsum' },
  { k: 'actionplan', t: 'สรุปแผนดำเนินการ', lvl: 1, auto: 'actionplan' },
  { k: 'basicinfo', t: 'วิเคราะห์ข้อมูลพื้นฐาน', lvl: 1, auto: 'basicinfo' },
  { k: 'clientgoals', t: 'เป้าหมายทางการเงินของลูกค้า', lvl: 1, auto: 'goals' },
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



  // ค่าที่หัวข้อรายงาน (ซึ่งแยกไปเป็นคอมโพเนนต์ในโฟลเดอร์ report/sections) ต้องใช้
  const ctx: ReportCtx = {
    client, advisor, profile, clientName, today, age, hasSpouse, children,
    eduPlan, eduCosts, eduInf, eduRet, retR, retRSp, insR, insRSp, eduR, covSelf, covSp,
    ratios, ratiosSp, sm, taxPlanQ, estatePlanQ, marketData,
    title, secs, setText, signatures, setSignatures, setSigning,
    actionItems,
  }

  function autoNode(kind: string) {
    if (kind === 'service') return <ServiceAgreement ctx={ctx} />
    if (kind === 'ack2') return <Acknowledgement />
    if (kind === 'taxfull') return <TaxSection ctx={ctx} />
    if (kind === 'estatefull') return <EstateSection ctx={ctx} />
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
                  <Area isAnimationActive={false} dataKey="band" stroke="none" fill={TEAL} fillOpacity={0.15} />
                  <Line isAnimationActive={false} dataKey="ค่ากลาง" stroke={TEAL} strokeWidth={2} dot={false} />
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
                      <Area isAnimationActive={false} dataKey="band" name="ช่วง 80% (พอร์ตใหม่)" stroke="none" fill={selP.color} fillOpacity={0.13} />
                      <Line isAnimationActive={false} dataKey="พอร์ตเดิม" stroke={AMBERR} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                      <Line isAnimationActive={false} dataKey="พอร์ตใหม่" stroke={selP.color} strokeWidth={2.5} dot={false} />
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
    if (kind === 'advprofile') return <AdvisorProfile ctx={ctx} />
    if (kind === 'assumptions') {
      return <Assumptions profile={profile} client={client} retPlan={retPlan} portRet={portRet} eduInf={eduInf} eduRet={eduRet} eduCosts={eduCosts} />
    }
    if (kind === 'execsum') return <ExecutiveSummary ctx={ctx} />
    if (kind === 'actionplan') return <ActionPlanSummary ctx={ctx} />
    if (kind === 'goals') return <ClientGoals ctx={ctx} />

    if (kind === 'basicinfo') return <BasicInfo ctx={ctx} />
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
                        <Pie isAnimationActive={false} data={alloc.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={50} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`} labelLine={false}>
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
        .map(sc => { const m = incMonthly(sc); return { name: sc.label || 'รายรับ', note: sc.source, m, v: m * 12 } })
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
    if (kind === 'insurance') return <InsuranceSection ctx={ctx} />
    if (kind === 'education') return <EducationSection ctx={ctx} />
    if (kind === 'retirement') return <RetirementSection ctx={ctx} />
    if (kind === 'portfolio_reco') return <PortfolioReco ctx={ctx} />
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
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 6 }}>แผนการเงินแบบองค์รวม 6 ด้าน</div>
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
