import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer, Area, ComposedChart, Bar,
} from 'recharts'
import { Calculator, Plus, Trash2, TrendingUp, Check, Loader2 } from 'lucide-react'
import { ChartFrame, TableExcelButton } from '../components/exportable'
import { MoneyInput } from '../components/MoneyInput'
import { useIsCompact } from '../hooks/useViewport'
import { useInvestmentMedianByAge } from '../hooks/useInvestmentMonteCarlo'

/* ─── number helpers ────────────────────────────── */
const fmt = (n: number, d = 2) =>
  isFinite(n) && !isNaN(n)
    ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '-'
const fmtM = (n: number) => `${(n / 1_000_000).toFixed(2)}M`

function pvAnnuity(rate: number, n: number, pmt: number) {
  if (rate === 0) return pmt * n
  return pmt * (1 - Math.pow(1 + rate, -n)) / rate
}
function fvAnnuity(rate: number, n: number, pmt: number) {
  if (rate === 0) return pmt * n
  return pmt * (Math.pow(1 + rate, n) - 1) / rate
}

/* ─── types ─────────────────────────────────────── */
interface Goal {
  id: number
  name: string
  amount: number    // today's value
  startYear: number // years after retirement (first occurrence)
  everyYears: number // 0 = one-time, N = repeat every N years
}

export interface Person {
  name: string
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  inflationRate: number
  preRetirementReturn: number
  postRetirementReturn: number
  savingsGrowthRate: number
  monthlyLiving: number
  monthlyHealth: number
  legacy: number
  goals: Goal[]
}

const defaultPerson = (
  name = 'คุณ', currentAge = 45, retirementAge = 60,
  lifeExpectancy = 85, monthlyLiving = 60000,
): Person => ({
  name, currentAge, retirementAge, lifeExpectancy,
  inflationRate: 3, preRetirementReturn: 8, postRetirementReturn: 5,
  savingsGrowthRate: 5,
  monthlyLiving, monthlyHealth: 2000,
  legacy: 1_000_000,
  goals: [
    { id: 1, name: 'ค่าซ่อมแซมบ้าน', amount: 100_000, startYear: 5, everyYears: 5 },
    { id: 2, name: 'ค่าซื้อรถยนต์ใหม่', amount: 1_000_000, startYear: 10, everyYears: 10 },
  ],
})

// Fields auto-filled from other pages — never restored from the saved plan
const DERIVED_KEYS: (keyof Person)[] = [
  'currentAge', 'retirementAge', 'lifeExpectancy',
  'inflationRate', 'preRetirementReturn', 'postRetirementReturn', 'savingsGrowthRate',
]
function mergeManual(base: Person, saved: Partial<Person>): Person {
  const next: Person = { ...base }
  for (const k of Object.keys(saved) as (keyof Person)[]) {
    if (!DERIVED_KEYS.includes(k)) (next as any)[k] = saved[k]
  }
  return next
}

/* ─── calculation ────────────────────────────────── */
interface CalcResult {
  yearsTo: number
  saveYears: number
  yearsAfter: number
  realRate: number
  annualAtRetirement: number
  pvLiving: number
  pvLegacy: number
  pvGoals: number
  totalNeeded: number
  assetAtRetirement: number
  gap: number
  annualSavings: number
  projectionRows: ProjectionRow[]
}

interface ProjectionRow {
  age: number
  phase: 'accumulation' | 'retirement'
  // accumulation
  existingAsset?: number
  savingsAccum?: number
  totalAccum?: number
  // retirement
  openBalance?: number
  withdrawalLiving?: number
  withdrawalGoals?: number
  withdrawalLegacy?: number
  closeBalance?: number
  goalNames?: string[]
}

function pvGoal(g: Goal, yearsToRet: number, yearsAfter: number, infRate: number, retReturn: number) {
  let pv = 0
  let k = g.startYear
  while (k <= yearsAfter) {
    const nominal = g.amount * Math.pow(1 + infRate, yearsToRet + k)
    pv += nominal / Math.pow(1 + retReturn, k)
    if (g.everyYears === 0) break
    k += g.everyYears
  }
  return pv
}

export function calcPerson(p: Person, assetAtRetirement: number, extraAssets = 0, assetReturnPct?: number, existingAssetByAge?: Map<number, number>): CalcResult {
  const yearsTo = Math.max(0, p.retirementAge - p.currentAge)
  // ปีสุดท้ายที่ออมได้คืออายุ (เกษียณ − 1) — พอถึงปีเกษียณไม่มีรายได้ออมแล้ว
  const saveYears = Math.max(0, yearsTo - 1)
  const yearsAfter = Math.max(0, p.lifeExpectancy - p.retirementAge)
  // ปีที่ใช้จ่ายหลังเกษียณ — เริ่มถอนใช้ตั้งแต่ปีอายุเกษียณ (annuity-due) → จำนวนปี = yearsAfter + 1
  const retYears = yearsAfter + 1
  const g = p.inflationRate / 100
  const i = p.preRetirementReturn / 100
  // อัตราโตของ "สินทรัพย์เดิม" (สินทรัพย์ลงทุนที่มี) = ผลตอบแทนพอร์ตจริง ถ้าส่งมา, ไม่งั้นใช้ผลตอบแทนก่อนเกษียณ
  const ia = (assetReturnPct != null ? assetReturnPct : p.preRetirementReturn) / 100
  const r = p.postRetirementReturn / 100
  const realRate = (1 + r) / (1 + g) - 1

  const monthlyTotal = p.monthlyLiving + p.monthlyHealth
  const annualAtRetirement = monthlyTotal * 12 * Math.pow(1 + g, yearsTo)

  // ค่าใช้จ่ายเริ่มถอน ณ ปีอายุเกษียณ (จ่ายต้นปี) → annuity-due
  const pvLiving = pvAnnuity(realRate, retYears, annualAtRetirement) * (1 + realRate)
  const pvLegacy = p.legacy / Math.pow(1 + r, yearsAfter)
  const pvGoals = p.goals.reduce((s, goal) => s + pvGoal(goal, yearsTo, yearsAfter, g, r), 0)
  const totalNeeded = pvLiving + pvLegacy + pvGoals

  const gap = Math.max(0, totalNeeded - assetAtRetirement - extraAssets)
  // ออมงวดสุดท้ายที่อายุ (เกษียณ − 1) แล้วโตอีก 1 ปีจนครบ ณ วันเกษียณ → ตัวคูณ = fvAnnuity(saveYears) × (1+i)
  const dueFactor = fvAnnuity(i, saveYears, 1) * (1 + i)
  const annualSavings = (gap > 0 && dueFactor > 0) ? gap / dueFactor : 0
  // มูลค่าเงินออมสะสม ณ อายุ A: ออมจนถึงอายุ (เกษียณ−1) จากนั้นปล่อยให้โตอย่างเดียว
  const savAt = (yr: number) => {
    if (yr <= 0) return 0
    if (yr <= saveYears) return fvAnnuity(i, yr, annualSavings)
    return fvAnnuity(i, saveYears, annualSavings) * Math.pow(1 + i, yr - saveYears)
  }
  const savedFVAtRetire = savAt(yearsTo)

  // ── Projection rows ──
  const projectionRows: ProjectionRow[] = []

  // Accumulation phase — ออม/สะสม ถึงอายุ (เกษียณ − 1) เท่านั้น (ปีสุดท้ายที่ออม = retireAge − 1)
  const currentAssetImplied = yearsTo > 0 ? assetAtRetirement / Math.pow(1 + ia, yearsTo) : assetAtRetirement
  for (let yr = 0; yr < yearsTo; yr++) {
    // "สินทรัพย์เดิม" = ค่ากลาง (median) จาก Monte Carlo ราย "อายุ" ถ้ามี · ไม่มี → โตแบบ compound
    const mcMedian = existingAssetByAge?.get(p.currentAge + yr)
    const existingAsset = mcMedian != null ? mcMedian : currentAssetImplied * Math.pow(1 + ia, yr)
    const savingsAccum = savAt(yr)
    projectionRows.push({
      age: p.currentAge + yr,
      phase: 'accumulation',
      existingAsset,
      savingsAccum,
      totalAccum: existingAsset + savingsAccum,
    })
  }

  // Retirement phase — expenses grow with inflation each year
  // เงินก้อน ณ เกษียณ (ปกส./PVD/ชดเชย) รวมเข้ายอดตั้งต้นหลังเกษียณ
  let balance = assetAtRetirement + extraAssets + savedFVAtRetire

  // ค่าใช้จ่าย/ปี หลังเกษียณ — เริ่มถอนใช้ตั้งแต่ปีอายุเกษียณ (yr = 0) ถอนต้นปีแล้วยอดที่เหลือเติบโต
  for (let yr = 0; yr <= yearsAfter; yr++) {
    const age = p.retirementAge + yr
    const openBalance = balance

    // Living expense grows with inflation; ปีเกษียณ (yr=0) = ค่าใช้จ่าย ณ เกษียณ
    const withdrawalLiving = annualAtRetirement * Math.pow(1 + g, yr)

    // Goals this year
    const goalsThisYear: { name: string; amount: number }[] = []
    for (const goal of p.goals) {
      let k = goal.startYear
      while (k <= yearsAfter) {
        if (k === yr) {
          const nominal = goal.amount * Math.pow(1 + g, yearsTo + k)
          goalsThisYear.push({ name: goal.name, amount: nominal })
          break
        }
        if (goal.everyYears === 0) break
        k += goal.everyYears
      }
    }
    const withdrawalGoals = goalsThisYear.reduce((s, g2) => s + g2.amount, 0)

    // Legacy at final year
    const isLastYear = yr === yearsAfter
    const withdrawalLegacy = isLastYear ? p.legacy : 0

    // ถอนต้นปี (annuity-due) แล้วยอดคงเหลือเติบโตทั้งปี
    const closeBalance = (openBalance - withdrawalLiving - withdrawalGoals - withdrawalLegacy) * (1 + r)

    projectionRows.push({
      age,
      phase: 'retirement',
      openBalance,
      withdrawalLiving,
      withdrawalGoals,
      withdrawalLegacy,
      closeBalance,
      goalNames: goalsThisYear.map(g2 => g2.name),
    })

    balance = closeBalance
  }

  return {
    yearsTo, saveYears, yearsAfter, realRate: realRate * 100,
    annualAtRetirement, pvLiving, pvLegacy, pvGoals, totalNeeded,
    assetAtRetirement, gap, annualSavings, projectionRows,
  }
}

/* ─── sub-components ─────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 8 }}>
      {children}
    </div>
  )
}


function InputRow({ label, value, onChange, unit, step = 1, pct = false, money = false }: {
  label: string; value: number; onChange: (v: number) => void
  unit?: string; step?: number; pct?: boolean; money?: boolean
}) {
  const inputStyle: React.CSSProperties = {
    width: pct ? 60 : 110, padding: '4px 8px', textAlign: 'right',
    background: 'var(--navy-900)', border: '1px solid var(--card-border)',
    borderRadius: 5, color: 'var(--cyan)', fontSize: 13, fontWeight: 500,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.3, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {money ? (
          <MoneyInput value={value} onChange={onChange} style={inputStyle} />
        ) : (
          <input
            type="number" value={value} step={step}
            onChange={e => onChange(Number(e.target.value))}
            style={inputStyle}
          />
        )}
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32 }}>{unit}</span>}
      </div>
    </div>
  )
}

function SummaryRow({ label, value, color = 'var(--cyan)', bold = false, unit = 'บาท' }: {
  label: string; value: number; color?: string; bold?: boolean; unit?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.3, fontWeight: bold ? 600 : 400, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ width: 95, textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color }}>{fmt(value, 0)}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 48, whiteSpace: 'nowrap' }}>{unit}</span>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>อายุ {label} ปี</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ display: 'flex', gap: 8, color: entry.color, marginBottom: 2 }}>
          <span>{entry.name}:</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>฿{fmt(entry.value, 0)}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── helper: compute mid projection at retirement age ── */
function toNum(v: any) { return parseFloat(String(v ?? '').replace(/,/g, '')) || 0 }

export function useProjectedAssetAtRetirement(retirementAge: number, isSelf: boolean): number | null {
  // "สินทรัพย์ ณ เกษียณ" = ค่ากลาง (median) จาก Monte Carlo ณ อายุเกษียณ
  // → ตรงกับคอลัมน์ "สินทรัพย์เดิม" ในตาราง และ dashboard/รายงานใช้ค่าเดียวกัน
  const medianByAge = useInvestmentMedianByAge(isSelf)
  return useMemo(() => medianByAge.get(retirementAge) ?? null, [medianByAge, retirementAge])
}

/** ผลตอบแทนพอร์ต (weighted avg %) จากสินทรัพย์ลงทุนที่มี — ใช้โตคอลัมน์ "สินทรัพย์เดิม" · null = ไม่มีข้อมูลผลตอบแทน */
export function usePortfolioReturn(isSelf: boolean): number | null {
  const { data: invProfile } = useQuery({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })
  return useMemo(() => {
    const invSrc: any = isSelf ? invProfile : (invProfile?.spouseData ?? {})
    const assets: any[] = invSrc?.investmentAssets ?? []
    let w = 0, c = 0
    assets.forEach((a: any) => { const v = toNum(a.currentValue); const rr = parseFloat(a.annualReturn); if (!isNaN(rr) && v > 0) { c += v; w += rr * v } })
    return c > 0 ? w / c : null
  }, [invProfile, isSelf])
}

/* ─── คำนวณสำรองค่าจากแท็บ projection (ใช้เมื่อยังไม่มีค่าที่บันทึก) ─── */
const RP_TIERS = [
  { min: 120 / 365, max: 1, days: 30 }, { min: 1, max: 3, days: 90 },
  { min: 3, max: 6, days: 180 }, { min: 6, max: 10, days: 240 },
  { min: 10, max: 20, days: 300 }, { min: 20, max: Infinity, days: 400 },
]
const RP_TAX = [
  { upTo: 150000, rate: 0 }, { upTo: 300000, rate: 5 }, { upTo: 500000, rate: 10 },
  { upTo: 750000, rate: 15 }, { upTo: 1000000, rate: 20 }, { upTo: 2000000, rate: 25 },
  { upTo: 5000000, rate: 30 }, { upTo: Infinity, rate: 35 },
]
function rpProgressiveTax(net: number) {
  let tax = 0, prev = 0
  for (const b of RP_TAX) { if (net <= prev) break; tax += (Math.min(net, b.upTo) - prev) * (b.rate / 100); prev = b.upTo }
  return tax
}
const rpNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
export function fallbackProjections(cp: any, prof: any, isSelf: boolean) {
  if (!cp) return { ssoPV: 0, pvdAtRetire: 0, sevNet: 0 }
  const spouseJob = Array.isArray(cp.spouseJobs) ? cp.spouseJobs[0] : null
  const salary = rpNum(isSelf ? cp.salary : (spouseJob?.salary ?? cp.spouseIncome))
  const raiseRate = rpNum(isSelf ? cp.salaryIncreaseRate : spouseJob?.salaryIncreaseRate)
  const workYearsNow = rpNum(isSelf ? cp.workYears : spouseJob?.workYears)
  const currentAge = isSelf
    ? (cp.birthDate ? new Date().getFullYear() - new Date(cp.birthDate).getFullYear() : 45)
    : (cp.spouseAge ?? 45)
  const retirementAge = (isSelf ? prof?.retirementAgeSelf : prof?.retirementAgeSpouse) ?? 60
  const lifeExp = (isSelf ? prof?.lifeExpectancySelf : prof?.lifeExpectancySpouse) ?? 85

  // SSO pension PV
  const discountRate = (prof?.postRetirementReturn ?? 4) / 100
  const pensionYears = Math.max(0, lifeExp - retirementAge)
  const offset = retirementAge - currentAge
  const ceiling = offset >= 6 ? 23000 : offset >= 3 ? 20000 : 17500
  const pensionBase = Math.min(salary, ceiling)
  const N = Math.max(0, Math.round((retirementAge - 30) * 12))
  const ratePct = N >= 180 ? 20 + ((N - 180) / 12) * 1.5 : 0
  const annual = (ratePct / 100) * pensionBase * 12
  const factor = discountRate === 0 ? pensionYears : (1 - Math.pow(1 + discountRate, -pensionYears)) / discountRate
  const ssoPV = annual * factor

  // PVD value at retirement (openingBalance สมมติ 0)
  const empRate = isSelf ? rpNum(cp.pvdEmployeeRate) : 0
  const employerRate = isSelf ? rpNum(cp.pvdEmployerRate) : 0
  const rr = (prof?.pvdReturnRate ?? 4) / 100
  const g = raiseRate / 100
  let empBal = 0, erBal = 0
  for (let age = currentAge; age <= retirementAge; age++) {
    const ys = salary * Math.pow(1 + g, age - currentAge)
    empBal = (empBal + ys * (empRate / 100) * 12) * (1 + rr)
    erBal = (erBal + ys * (employerRate / 100) * 12) * (1 + rr)
  }
  const pvdAtRetire = empBal + erBal

  // Severance after tax
  const yearsToRetire = Math.max(0, retirementAge - currentAge)
  const serviceYears = workYearsNow + yearsToRetire
  const lastSalary = salary * Math.pow(1 + raiseRate / 100, yearsToRetire)
  const idx = RP_TIERS.findIndex(t => serviceYears >= t.min && serviceYears < t.max)
  const severance = lastSalary * ((idx >= 0 ? RP_TIERS[idx].days : 0) / 30)
  const taxYears = Math.round(serviceYears)
  const deduct1 = Math.min(7000 * taxYears, severance)
  const deduct2 = Math.max(0, severance - deduct1) * 0.5
  const netIncome = Math.max(0, severance - deduct1 - deduct2)
  const tax = serviceYears >= 5 ? rpProgressiveTax(netIncome) : 0
  const sevNet = severance - tax

  return { ssoPV, pvdAtRetire, sevNet }
}

/* ─── person panel ───────────────────────────────── */
function PersonPanel({ data, onChange, color, isSelf }: {
  data: Person; onChange: (d: Person) => void; color: string; isSelf: boolean
}) {
  const set = <K extends keyof Person>(k: K, v: Person[K]) => onChange({ ...data, [k]: v })

  // Auto-fill currentAge from client profile + retirementAge/lifeExpectancy from settings
  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
    retry: false,
  })
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then(r => r.data),
    retry: false,
  })

  // ดึงมูลค่าจากแท็บอื่น (ต่อบุคคล) มาแสดงในการ์ดสรุป
  const personKey = isSelf ? 'self' : 'spouse'
  const { data: ssoPlan } = useQuery({ queryKey: ['sso-plan'], queryFn: () => api.get('/sso-plan').then(r => r.data), retry: false })
  const { data: pvdPlan } = useQuery({ queryKey: ['pvd-plan'], queryFn: () => api.get('/pvd-plan').then(r => r.data), retry: false })
  const { data: sevPlan } = useQuery({ queryKey: ['severance-plan'], queryFn: () => api.get('/severance-plan').then(r => r.data), retry: false })
  const fb = fallbackProjections(clientProfile, profile, isSelf)
  const ssoPV = ssoPlan?.[personKey]?.pensionPV ?? fb.ssoPV
  const pvdAtRetire = pvdPlan?.[personKey]?.valueAtRetirement ?? fb.pvdAtRetire
  const sevNet = sevPlan?.[personKey]?.netSeverance ?? fb.sevNet

  const filledAge = useRef(false)
  const filledSettings = useRef(false)
  useEffect(() => {
    if (filledAge.current || !clientProfile) return
    const patch: Partial<Person> = {}
    // อายุปัจจุบันจากวันเกิด
    if (clientProfile.birthDate) {
      const age = new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear()
      if (age > 0) patch.currentAge = age
    }
    // ชื่อลูกค้า/คู่สมรส (เฉพาะชื่อ ไม่มีนามสกุล) — เติมเฉพาะถ้ายังเป็นค่าเริ่มต้น ไม่ทับที่ที่ปรึกษาแก้เอง
    const first = (isSelf ? clientProfile.firstName : clientProfile.spouseProfile?.firstName) || ''
    const last = (isSelf ? clientProfile.lastName : clientProfile.spouseProfile?.lastName) || ''
    // ถือว่า "ยังเป็นค่าเริ่มต้น" รวมถึงชื่อเต็มที่เคยเติมไว้ (คุณ<ชื่อ นามสกุล>) เพื่อ downgrade กลับเป็นชื่ออย่างเดียว
    const isDefaultName = !data.name.trim() || data.name === 'คุณ' || data.name === 'คู่สมรส' || data.name === `คุณ${`${first} ${last}`.trim()}`
    if (first && isDefaultName) patch.name = `คุณ${first}`
    if (Object.keys(patch).length) {
      onChange({ ...data, ...patch })
      filledAge.current = true
    }
  }, [clientProfile])
  useEffect(() => {
    if (filledSettings.current || !profile) return
    const retAge = isSelf ? profile.retirementAgeSelf : profile.retirementAgeSpouse
    const lifeExp = isSelf ? profile.lifeExpectancySelf : profile.lifeExpectancySpouse
    const updates: Partial<Person> = {}
    if (retAge) updates.retirementAge = retAge
    if (lifeExp) updates.lifeExpectancy = lifeExp
    if (profile.inflationRate != null) updates.inflationRate = profile.inflationRate
    if (profile.preRetirementReturn != null) updates.preRetirementReturn = profile.preRetirementReturn
    if (profile.postRetirementReturn != null) updates.postRetirementReturn = profile.postRetirementReturn
    if (Object.keys(updates).length > 0) {
      onChange({ ...data, ...updates })
      filledSettings.current = true
    }
  }, [profile])
  // Auto-fill savingsGrowthRate from salary-increase rate in client profile
  const filledRate = useRef(false)
  useEffect(() => {
    if (filledRate.current || !clientProfile) return
    const raw = isSelf
      ? clientProfile.salaryIncreaseRate
      : (Array.isArray(clientProfile.spouseJobs) ? clientProfile.spouseJobs[0]?.salaryIncreaseRate : null)
    const rate = Number(raw)
    if (raw != null && raw !== '' && !isNaN(rate)) {
      onChange({ ...data, savingsGrowthRate: rate })
      filledRate.current = true
    }
  }, [clientProfile])

  const projectedAsset = useProjectedAssetAtRetirement(data.retirementAge, isSelf)
  const portReturn = usePortfolioReturn(isSelf)   // อัตราผลตอบแทนพอร์ต (fallback เมื่อไม่มีข้อมูล Monte Carlo)
  const medianByAge = useInvestmentMedianByAge(isSelf)   // ค่ากลาง Monte Carlo ราย "อายุ" (จากหน้ามูลค่าสินทรัพย์ลงทุน)
  const [manualAsset] = useState<number | null>(null)
  const assetAtRetirement = manualAsset ?? projectedAsset ?? 0

  const extraAssets = ssoPV + pvdAtRetire + sevNet
  const totalAssets = assetAtRetirement + extraAssets
  // คอลัมน์ "สินทรัพย์เดิม" = ค่ากลาง Monte Carlo ราย "อายุ" (ถ้าไม่มี → โตด้วยผลตอบแทนพอร์ต)
  const result = useMemo(() => calcPerson(data, assetAtRetirement, extraAssets, portReturn ?? 0, medianByAge), [data, assetAtRetirement, extraAssets, portReturn, medianByAge])

  // Graduated savings: solve first-year payment of a growing annuity whose FV == gap
  const gradSavings = useMemo(() => {
    const n = result.saveYears   // ออมงวดสุดท้ายที่อายุ (เกษียณ − 1)
    const gap = result.gap
    const i = data.preRetirementReturn / 100
    const gr = data.savingsGrowthRate / 100
    if (n <= 0 || gap <= 0) return { first: 0, last: 0 }
    const x = (1 + gr) / (1 + i)
    // FV ณ อายุ (เกษียณ−1) ของเงินออมที่โตปีละ gr แล้วโตอีก 1 ปีจนถึงวันเกษียณ → × (1+i)
    const factor = (Math.abs(x - 1) < 1e-9
      ? n * Math.pow(1 + i, n - 1)
      : Math.pow(1 + i, n - 1) * (1 - Math.pow(x, n)) / (1 - x)) * (1 + i)
    const first = gap / factor
    const last = first * Math.pow(1 + gr, n - 1)
    return { first, last }
  }, [result.saveYears, result.gap, data.preRetirementReturn, data.savingsGrowthRate])

  const chartData = result.projectionRows.map(row => ({
    age: row.age,
    total: row.phase === 'accumulation' ? Math.max(0, row.totalAccum ?? 0) : undefined,
    assets: row.phase === 'accumulation' ? Math.max(0, row.existingAsset ?? 0) : undefined,
    savings: row.phase === 'accumulation' ? Math.max(0, row.savingsAccum ?? 0) : undefined,
    balance: row.phase === 'retirement' ? (row.closeBalance ?? 0) : undefined,
    retBalance: row.phase === 'retirement' ? Math.max(0, row.closeBalance ?? 0) : undefined,
    living: row.phase === 'retirement' ? (row.withdrawalLiving ?? 0) : undefined,
    goals: row.phase === 'retirement' && (row.withdrawalGoals ?? 0) > 0 ? row.withdrawalGoals : undefined,
    legacy: row.phase === 'retirement' && (row.withdrawalLegacy ?? 0) > 0 ? row.withdrawalLegacy : undefined,
  }))

  // Bridge — ย้ายจุดเริ่มเส้นหลังเกษียณ (เงินก้อน ณ เกษียณ) มาที่อายุ retireAge−1
  // ให้เส้นส้มเริ่มจากแถวสะสมแถวสุดท้าย (ไม่กระโดดชันที่ 59→60)
  const lastAccum = [...result.projectionRows].reverse().find(r => r.phase === 'accumulation')
  const firstRet = result.projectionRows.find(r => r.phase === 'retirement')
  if (lastAccum && firstRet) {
    const idx = chartData.findIndex(d => d.age === lastAccum.age)
    const total = lastAccum.totalAccum ?? 0
    if (idx >= 0) {
      // เส้นสะสม (ฟ้า) จบตามจริง — เส้นเกษียณ (ส้ม) เริ่มจากจุดเดียวกันที่อายุ retireAge−1 (ไม่ดัน total ให้พุ่งชัน)
      chartData[idx] = { ...chartData[idx], balance: total, retBalance: total }
    }
  }

  function addGoal() {
    onChange({ ...data, goals: [...data.goals, { id: Date.now(), name: '', amount: 0, startYear: 5, everyYears: 0 }] })
  }
  function removeGoal(id: number) {
    onChange({ ...data, goals: data.goals.filter(g => g.id !== id) })
  }
  function setGoal<K extends keyof Goal>(id: number, k: K, v: Goal[K]) {
    onChange({ ...data, goals: data.goals.map(g => g.id === id ? { ...g, [k]: v } : g) })
  }

  const breakEvenAge = result.projectionRows.find(r => r.phase === 'retirement' && (r.closeBalance ?? 0) <= 0)?.age
  const compact = useIsCompact()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 320px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>

      {/* ── Left: all inputs ── */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0, borderRight: '1px solid var(--card-border)', paddingRight: 24 }}>

        {/* Name */}
        <input
          value={data.name}
          onChange={e => set('name', e.target.value)}
          placeholder="ชื่อ..."
          style={{ width: '100%', padding: '4px 2px', background: 'transparent', border: 'none', borderBottom: `1px solid ${color}50`, color, fontSize: 15, fontWeight: 700, outline: 'none', marginBottom: 12 }}
        />

        <SectionLabel>ข้อมูลส่วนตัว</SectionLabel>
        <InputRow label="อายุปัจจุบัน" value={data.currentAge} onChange={v => set('currentAge', v)} unit="ปี" />
        <InputRow label="อายุเกษียณ" value={data.retirementAge} onChange={v => set('retirementAge', v)} unit="ปี" />
        <InputRow label="อายุขัย" value={data.lifeExpectancy} onChange={v => set('lifeExpectancy', v)} unit="ปี" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, padding: '5px 8px', background: 'var(--navy-900)', borderRadius: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>ออมได้ <strong style={{ color }}>{result.saveYears} ปี</strong> (ถึงอายุ {data.retirementAge - 1})</span>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>หลังเกษียณ <strong style={{ color }}>{result.yearsAfter} ปี</strong></span>
        </div>

        <SectionLabel>ข้อมูลเศรษฐกิจ</SectionLabel>
        <InputRow label="เงินเฟ้อ (g)" value={data.inflationRate} onChange={v => set('inflationRate', v)} unit="%" step={0.1} pct />
        <InputRow label="ผลตอบแทนก่อนเกษียณ (i)" value={data.preRetirementReturn} onChange={v => set('preRetirementReturn', v)} unit="%" step={0.1} pct />
        <InputRow label="ผลตอบแทนหลังเกษียณ (r)" value={data.postRetirementReturn} onChange={v => set('postRetirementReturn', v)} unit="%" step={0.1} pct />
        <div style={{ marginTop: 6, padding: '4px 8px', background: 'var(--navy-900)', borderRadius: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Real rate = <strong style={{ color }}>{result.realRate.toFixed(2)}%</strong></span>
        </div>

        <SectionLabel>ความต้องการหลังเกษียณ</SectionLabel>
        <InputRow label="ค่าใช้จ่าย/เดือน" value={data.monthlyLiving} onChange={v => set('monthlyLiving', v)} unit="บาท" money />
        <InputRow label="ค่าสุขภาพ/เดือน" value={data.monthlyHealth} onChange={v => set('monthlyHealth', v)} unit="บาท" money />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-secondary)' }}>รวม ณ วันเกษียณ</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 110, padding: '4px 8px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 5, color, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
              {fmt(result.annualAtRetirement / 12, 0)}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 32 }}>บาท</span>
          </div>
        </div>
        <InputRow label="เงินมรดก" value={data.legacy} onChange={v => set('legacy', v)} unit="บาท" money />


        <SectionLabel>เป้าหมายอื่นๆ</SectionLabel>
        {data.goals.map(goal => (
          <div key={goal.id} style={{ marginBottom: 6, padding: '7px 8px', background: 'var(--navy-900)', borderRadius: 6 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
              <input value={goal.name} onChange={e => setGoal(goal.id, 'name', e.target.value)} placeholder="ชื่อเป้าหมาย"
                style={{ flex: 1, padding: '2px 4px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
              <button onClick={() => removeGoal(goal.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2 }}><Trash2 size={12} /></button>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <MoneyInput value={goal.amount} onChange={v => setGoal(goal.id, 'amount', v)}
                style={{ flex: 1, padding: '3px 5px', textAlign: 'right', background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ปีที่</span>
              <input type="number" value={goal.startYear} min={1} step={1} onChange={e => setGoal(goal.id, 'startYear', Number(e.target.value))}
                style={{ width: 38, padding: '3px 4px', textAlign: 'center', background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ทุก</span>
              <input type="number" value={goal.everyYears} min={0} step={1} onChange={e => setGoal(goal.id, 'everyYears', Number(e.target.value))}
                style={{ width: 38, padding: '3px 4px', textAlign: 'center', background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ปี</span>
            </div>
          </div>
        ))}
        <button onClick={addGoal} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: '1px dashed var(--card-border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', marginTop: 2 }}>
          <Plus size={11} /> เพิ่มเป้าหมาย
        </button>

        {/* Summary — highlighted card */}
        <div style={{
          marginTop: 16,
          borderRadius: 14,
          background: `linear-gradient(160deg, ${color}1a, var(--navy-900) 60%)`,
          border: `1px solid ${color}55`,
          boxShadow: `0 10px 30px -14px ${color}80`,
          overflow: 'hidden',
        }}>
          {/* Header bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: `${color}22`, borderBottom: `1px solid ${color}40` }}>
            <Calculator size={16} color={color} />
            <span style={{ fontSize: 13.5, fontWeight: 800, color, letterSpacing: '0.02em' }}>สรุปผลการคำนวณ</span>
          </div>

          {/* Body */}
          <div style={{ padding: '12px 16px 14px' }}>
            {/* ส่วนที่ 1: เงินเกษียณที่ต้องการ */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 2 }}>เงินเกษียณที่ต้องการ</div>
            <SummaryRow label="ค่าใช้จ่ายดำรงชีพ" value={result.pvLiving} color="var(--cyan)" />
            <SummaryRow label="เป้าหมายพิเศษ" value={result.pvGoals} color="#f59e0b" />
            <SummaryRow label="มรดก" value={result.pvLegacy} color="#a78bfa" />
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
            <SummaryRow label="รวม" value={result.totalNeeded} color="#f87171" bold />

            {/* ส่วนที่ 2: สินทรัพย์เกษียณที่มี */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', margin: '12px 0 2px' }}>สินทรัพย์เกษียณที่มี</div>
            <SummaryRow label="สินทรัพย์ ณ เกษียณ" value={result.assetAtRetirement} color="#4ade80" />
            <SummaryRow label="บำนาญประกันสังคม" value={ssoPV} color="#22d3ee" />
            <SummaryRow label="มูลค่า PVD/กบข" value={pvdAtRetire} color="#22d3ee" />
            <SummaryRow label="เงินชดเชยตามกฎหมาย" value={sevNet} color="#22d3ee" />
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
            <SummaryRow label="รวม" value={totalAssets} color="#4ade80" bold />

            {/* ส่วนที่ 3: ส่วนที่ขาด */}
            {/* Hero band: gap */}
            <div style={{
              marginTop: 12,
              padding: '13px 14px',
              borderRadius: 11,
              background: result.gap > 0 ? 'rgba(248,113,113,0.13)' : 'rgba(74,222,128,0.13)',
              border: `1.5px solid ${result.gap > 0 ? '#f87171' : '#4ade80'}66`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: result.gap > 0 ? '#f87171' : '#4ade80', whiteSpace: 'nowrap' }}>
                  {result.gap > 0 ? 'ส่วนที่ยังขาด' : 'เกินเป้าหมาย'}
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: result.gap > 0 ? '#f87171' : '#4ade80' }}>
                    {fmt(Math.abs(result.gap), 0)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span>
                </span>
              </div>

              {breakEvenAge && (
                <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: '#f87171' }}>⚠ เงินหมดที่อายุ {breakEvenAge} ปี</div>
              )}
            </div>

            {result.gap > 0 && (
              <div style={{ marginTop: 10 }}>
                <SummaryRow label="เงินที่ต้องออมเพิ่ม" value={result.annualSavings} color={color} unit="บาท/ปี" />
                <SummaryRow label="ต้องออมต่อเดือน" value={result.annualSavings / 12} color={color} unit="บาท/เดือน" />
              </div>
            )}
          </div>
        </div>

        {/* What-if: graduated (growing) savings */}
        <div style={{ marginTop: 14, borderRadius: 12, background: 'var(--navy-900)', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'var(--divider)', borderBottom: '1px solid var(--card-border)' }}>
            <TrendingUp size={15} color={color} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>กรณีเพิ่มเงินออมทุกปี</span>
          </div>
          <div style={{ padding: '8px 14px 12px' }}>
            <InputRow label="อัตราการเพิ่มเงินออม" value={data.savingsGrowthRate} onChange={v => set('savingsGrowthRate', v)} unit="%/ปี" step={0.5} pct />
            <SummaryRow label="เงินที่ออมปีแรก" value={gradSavings.first} color={color} unit="บาท/ปี" />
            <SummaryRow label="เงินที่ออมปีสุดท้าย" value={gradSavings.last} color={color} unit="บาท/ปี" />
          </div>
        </div>
      </div>

      {/* ── Right: chart + table ── */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Chart */}
        <div style={{ background: 'var(--navy-900)', borderRadius: 12, padding: '16px 16px 10px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>การคาดการณ์มูลค่าเงินในอนาคต</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
            สะสม (อายุ {data.currentAge}–{data.retirementAge - 1}) → ใช้เงิน (อายุ {data.retirementAge}–{data.lifeExpectancy})
          </div>
          <ChartFrame title="การคาดการณ์มูลค่าเงินในอนาคต" filename="retirement-projection" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
              <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false}
                label={{ value: 'อายุ (ปี)', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                label={{ value: 'ล้านบาท', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              <ReferenceLine x={data.retirementAge - 1} stroke={color} strokeDasharray="6 3" label={{ value: 'เกษียณ', fill: color, fontSize: 11, position: 'top' }} />
              <ReferenceLine y={0} stroke="#f87171" strokeDasharray="4 2" />
              <Bar dataKey="living" name="ค่าใช้จ่าย/ปี" fill="#f8717150" stroke="#f87171" strokeWidth={0.5} barSize={16} />
              <Bar dataKey="goals" name="เป้าหมายพิเศษ" fill="#f59e0b50" stroke="#f59e0b" strokeWidth={0.5} barSize={16} />
              <Bar dataKey="legacy" name="เงินมรดก" fill="#a78bfa50" stroke="#a78bfa" strokeWidth={0.5} barSize={16} />
              <Area type="monotone" dataKey="total" name="มูลค่ารวม (สะสม)" stroke={color} fill={`${color}20`} strokeWidth={2} connectNulls={false} dot={false} />
              <Line type="monotone" dataKey="assets" name="สินทรัพย์เดิม" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="retBalance" name="เงินคงเหลือ (หลังเกษียณ)" stroke="#10b981" strokeWidth={2.5} dot={false} connectNulls={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
          </ChartFrame>
        </div>

        {/* Table */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>ตารางคำนวณปีต่อปี</div>
            <TableExcelButton filename="ตารางเกษียณปีต่อปี" title="เกษียณปีต่อปี" />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--navy-900)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>อายุ</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>ระยะ</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--cyan)', fontWeight: 600, whiteSpace: 'nowrap' }}>สินทรัพย์เดิม</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--cyan)', fontWeight: 600, whiteSpace: 'nowrap' }}>เงินออมสะสม</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>มูลค่ารวม / คงเหลือ</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>ค่าใช้จ่าย/ปี</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>เป้าหมายพิเศษ</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>เงินมรดก</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {result.projectionRows.map((row, idx) => {
                  const isRet = row.phase === 'retirement'
                  const isRetireYear = row.age === data.retirementAge
                  const balance = isRet ? row.closeBalance ?? 0 : row.totalAccum ?? 0
                  const isNegative = isRet && balance < 0
                  return (
                    <tr key={row.age} style={{
                      background: isRetireYear ? `${color}12` : isNegative ? 'rgba(248,113,113,0.08)' : idx % 2 === 0 ? 'transparent' : 'var(--hover)',
                    }}>
                      <td style={{ padding: '5px 10px', textAlign: 'center', fontWeight: isRetireYear ? 700 : 400, color: isRetireYear ? color : 'var(--text-primary)' }}>{row.age}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                        {isRet
                          ? <span style={{ fontSize: 10, padding: '1px 6px', background: '#f59e0b20', color: '#f59e0b', borderRadius: 4 }}>เกษียณ</span>
                          : <span style={{ fontSize: 10, padding: '1px 6px', background: `${color}15`, color, borderRadius: 4 }}>สะสม</span>}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{isRet ? '—' : fmt(row.existingAsset ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{isRet ? '—' : fmt(row.savingsAccum ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: isNegative ? '#f87171' : isRetireYear ? color : 'var(--text-primary)' }}>{fmt(balance)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171' }}>{isRet ? fmt(row.withdrawalLiving ?? 0) : '—'}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>{isRet && (row.withdrawalGoals ?? 0) > 0 ? fmt(row.withdrawalGoals ?? 0) : '—'}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#a78bfa' }}>{isRet && (row.withdrawalLegacy ?? 0) > 0 ? fmt(row.withdrawalLegacy ?? 0) : '—'}</td>
                      <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                        {isRetireYear ? '🎯 เริ่มเกษียณ ' : ''}
                        {row.goalNames?.join(', ')}
                        {isNegative ? ' ⚠ เงินหมด' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── main page ──────────────────────────────────── */
export default function RetirementPlanPage({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const tab = person
  const [self, setSelf] = useState<Person>(defaultPerson('คุณ', 45, 60, 85, 60000))
  const [spouse, setSpouse] = useState<Person>(defaultPerson('คู่สมรส', 45, 55, 85, 40000))

  const current = tab === 'self' ? self : spouse
  const setCurrent = tab === 'self' ? setSelf : setSpouse
  const color = tab === 'self' ? '#06b6d4' : '#c084fc'

  // ── Load saved plan once ──
  const qc = useQueryClient()
  const loadedRef = useRef(false)
  const { data: saved, isFetched } = useQuery({
    queryKey: ['retirement-plan'],
    queryFn: () => api.get('/retirement-plan').then(r => r.data),
    retry: false,
  })
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved) {
      // Merge only manually-entered fields; derived fields (age/rates/etc.)
      // always come from their source pages via auto-fill.
      if (saved.self) setSelf(s => mergeManual(s, saved.self))
      if (saved.spouse) setSpouse(s => mergeManual(s, saved.spouse))
    }
    loadedRef.current = true
  }, [isFetched, saved])

  // ── Debounced autosave ──
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  // อัปเดต cache ของ react-query ทุกครั้งที่บันทึก เพื่อกันโหลดค่าเก่าเมื่อสลับแท็บกลับมา
  const persist = (payload: { self: Person; spouse: Person }) => {
    qc.setQueryData(['retirement-plan'], payload)
    return api.put('/retirement-plan', payload)
  }
  const save = useMutation({
    mutationFn: (payload: { self: Person; spouse: Person }) => persist(payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: (e: any) => { console.error('[retirement-plan save]', e?.response?.data ?? e?.message); setStatus('idle') },
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // เก็บค่าล่าสุดไว้ flush ตอน unmount (สลับแท็บ/ออกจากหน้า ก่อน debounce จะยิง)
  const valuesRef = useRef<{ self: Person; spouse: Person }>({ self, spouse })
  valuesRef.current = { self, spouse }
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ self, spouse }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [self, spouse])
  // Flush ค่าล่าสุดทันทีเมื่อ component ถูก unmount
  useEffect(() => {
    return () => {
      if (loadedRef.current) {
        persist(valuesRef.current).catch(() => {})
      }
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes rp-spin { to { transform: rotate(360deg) } } .spin { animation: rp-spin 0.9s linear infinite }`}</style>
      {/* สถานะบันทึก (หัวข้อหลักแสดงโดย PageHeader ของหน้าวางแผนการเงินแล้ว) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, fontSize: 12.5, minHeight: 16, marginTop: -8 }}>
        {status === 'saving' && <><Loader2 size={14} className="spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
        {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
      </div>

      {/* Main panel */}
      <div style={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '24px' }}>
        <PersonPanel key={tab} data={current} onChange={setCurrent} color={color} isSelf={tab === 'self'} />
      </div>
    </div>
  )
}
