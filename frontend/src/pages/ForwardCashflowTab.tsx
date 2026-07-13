import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { calc, defaultState, type TaxState } from '../lib/tax'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Check, Loader2, RefreshCw, X, Maximize2 } from 'lucide-react'
import { ResponsiveContainer, ComposedChart, Bar, Line as RLine, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell, ReferenceLine } from 'recharts'
import { ChartFrame, TableExcelButton } from '../components/exportable'
import { useRetirementBalances } from '../hooks/useRetirementBalances'

/* ── helpers ── */
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
const fmt0 = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')
const toMonthly = (amount: number, freq: string) => freq === 'QUARTERLY' ? amount / 3 : freq === 'ANNUALLY' ? amount / 12 : amount
const uid = () => Math.random().toString(36).slice(2, 9)

type Line = { id: string; label: string; base: number; growth: number; startAge: number; endAge: number; auto?: boolean; ov?: Record<string, number> }
type CashflowData = {
  incomeWork: Line[]
  incomeAsset: Line[]
  expFixed: Line[]
  expVar: Line[]
  expSaving: Line[]
  goalEducation: Line[]
  goalRetire: Line[]
  goalInsurance: Line[]
  deductManual: Line[]
}
const emptyData = (): CashflowData => ({
  incomeWork: [], incomeAsset: [], expFixed: [], expVar: [], expSaving: [],
  goalEducation: [], goalRetire: [], goalInsurance: [], deductManual: [],
})

const lineAt = (l: Line, age: number, retireAge: number): number => {
  const o = l.ov?.[String(age)]
  if (o != null) return o   // override รายช่อง (เช่น ที่อายุเกษียณ)
  if (age < l.startAge || age > l.endAge) return 0
  const g = 1 + l.growth / 100
  // ก่อน/ถึงเกษียณ หรือบรรทัดที่เริ่มหลังเกษียณ → คำนวณจากค่าตั้งต้นปกติ
  if (age <= retireAge || l.startAge > retireAge) return l.base * Math.pow(g, age - l.startAge)
  // หลังเกษียณ → ใช้ค่า ณ อายุเกษียณ (override หรือสูตร) เป็นจุดเริ่มต้น แล้วโตด้วย %เดิม
  const anchor = l.ov?.[String(retireAge)] ?? l.base * Math.pow(g, retireAge - l.startAge)
  return anchor * Math.pow(g, age - retireAge)
}
const sumAt = (lines: Line[], age: number, retireAge: number) => lines.reduce((s, l) => s + lineAt(l, age, retireAge), 0)

/* ── รายการหักอัตโนมัติที่ไม่ได้อยู่ใน /expenses: ประกันสังคม / PVD / เบี้ยประกันชีวิต ── */
const _norm = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
function autoFixedItems(isSelf: boolean, cp: any, lifeInsurances: any[], currentAge: number, retireAge: number): Line[] {
  const welfare = isSelf ? cp : cp?.spouseProfile
  const srcs: any[] = isSelf ? (cp?.incomeSources ?? []) : (cp?.spouseIncomeSources ?? [])
  const spJob = Array.isArray(cp?.spouseJobs) ? cp.spouseJobs[0] : null
  const salSrc = srcs.find(s => s.label === 'เงินเดือน')
  const salaryM = salSrc ? toNum(salSrc.amount) : (isSelf ? toNum(cp?.salary) : (toNum(spJob?.salary) || toNum(cp?.spouseIncome)))
  const raise = isSelf ? toNum(cp?.salaryIncreaseRate) : toNum(spJob?.salaryIncreaseRate)
  const out: Line[] = []
  if (welfare?.hasSocialSecurity && salaryM > 0)
    out.push({ id: uid(), label: 'ประกันสังคม', base: Math.min(salaryM, 17500) * 0.05 * 12, growth: 0, startAge: currentAge, endAge: retireAge - 1, auto: true })
  if (welfare?.hasPVD && Number(welfare?.pvdEmployeeRate) > 0 && salaryM > 0)
    out.push({ id: uid(), label: 'เงินสะสมกองทุนสำรองเลี้ยงชีพ (ส่วนลูกจ้าง)', base: salaryM * 12 * (Number(welfare.pvdEmployeeRate) / 100), growth: raise || 0, startAge: currentAge, endAge: retireAge - 1, auto: true })
  const pn = _norm(isSelf ? `${cp?.firstName ?? ''} ${cp?.lastName ?? ''}` : `${cp?.spouseProfile?.firstName ?? ''} ${cp?.spouseProfile?.lastName ?? ''}`)
  const lifeAnnual = (Array.isArray(lifeInsurances) ? lifeInsurances : [])
    .filter(p => { const ins = _norm(p?.insuredPerson); return (p?.premium ?? 0) > 0 && !!ins && !!pn && (ins.includes(pn) || pn.includes(ins)) })
    .reduce((s, p) => s + (p.premium || 0), 0)
  if (lifeAnnual > 0) out.push({ id: uid(), label: 'เบี้ยประกันชีวิต', base: lifeAnnual, growth: 0, startAge: currentAge, endAge: retireAge - 1, auto: true })
  return out
}

/* ── auto-seed from existing data ── */
function seedData(
  person: 'self' | 'spouse',
  cp: any, prof: any, expenses: any[], liabilities: any[],
  currentAge: number, retireAge: number, lifeInsurances: any[] = [],
): CashflowData {
  const d = emptyData()
  const infl = prof?.inflationRate ?? 3
  const med = prof?.medicalInflation ?? 5
  const edu = prof?.educationInflation ?? 5
  const isSelf = person === 'self'
  const spJob = Array.isArray(cp?.spouseJobs) ? cp.spouseJobs[0] : null
  const salaryM = isSelf ? toNum(cp?.salary) : (toNum(spJob?.salary) || toNum(cp?.spouseIncome))
  const raise = isSelf ? toNum(cp?.salaryIncreaseRate) : toNum(spJob?.salaryIncreaseRate)
  const srcs: any[] = isSelf ? (cp?.incomeSources ?? []) : (cp?.spouseIncomeSources ?? [])

  // รายได้จากการทำงาน — ทำงานปีสุดท้ายคืออายุ (เกษียณ − 1), พอถึงปีเกษียณรายได้ทำงาน = 0
  const workEnd = retireAge - 1
  // เงินเดือน — ดึงทุกงานจากรายรับ (เช่น งานประจำ + ที่ปรึกษา); fallback = cp.salary
  const salaryJobs = srcs.filter(s => s.label === 'เงินเดือน' && toNum(s.amount) > 0)
  if (salaryJobs.length) {
    for (const s of salaryJobs) d.incomeWork.push({ id: uid(), label: s.source ? `เงินเดือน — ${s.source}` : 'เงินเดือน', base: toNum(s.amount) * 12, growth: raise || 5, startAge: currentAge, endAge: workEnd, auto: true })
  } else if (salaryM > 0) {
    d.incomeWork.push({ id: uid(), label: 'เงินเดือน', base: salaryM * 12, growth: raise || 5, startAge: currentAge, endAge: workEnd, auto: true })
  } else {
    d.incomeWork.push({ id: uid(), label: 'เงินเดือน', base: 600000, growth: 5, startAge: currentAge, endAge: workEnd })
  }
  const bonus = srcs.find(s => s.label === 'โบนัส')
  d.incomeWork.push({ id: uid(), label: 'โบนัส', base: bonus ? toNum(bonus.amount) : 0, growth: raise || 5, startAge: currentAge, endAge: workEnd, auto: !!bonus })
  const extra = srcs.find(s => s.label === 'รายได้จากอาชีพเสริม')
  if (extra && toNum(extra.amount) > 0) d.incomeWork.push({ id: uid(), label: 'รายได้จากอาชีพเสริม', base: toNum(extra.amount) * 12, growth: 5, startAge: currentAge, endAge: workEnd, auto: true })

  // รายได้จากทรัพย์สิน
  const rent = srcs.find(s => s.label === 'รายได้จากค่าเช่า')
  const divd = srcs.find(s => s.label === 'เงินปันผล')
  const invs = srcs.find(s => s.label === 'รายได้จากการลงทุน')
  d.incomeAsset.push({ id: uid(), label: 'รายได้จากค่าเช่า', base: rent ? toNum(rent.amount) * 12 : 0, growth: prof?.rentInflation ?? 4, startAge: currentAge, endAge: retireAge - 1, auto: !!rent })
  d.incomeAsset.push({ id: uid(), label: 'เงินปันผล/ดอกเบี้ย', base: (divd ? toNum(divd.amount) * 12 : 0) + (invs ? toNum(invs.amount) * 12 : 0), growth: 0, startAge: currentAge, endAge: retireAge - 1, auto: !!(divd || invs) })

  // ค่าใช้จ่าย (จาก /expenses) — แยกตาม prefix + อัตราเติบโตตามประเภท
  const rentInfl = prof?.rentInflation ?? 4
  const growthFor = (cat: string, name: string) => {
    const c = String(cat || '').toLowerCase(); const n = String(name || '')
    if (/loan|credit/.test(c) || /ผ่อน|กู้|สินเชื่อ|หนี้/.test(n)) return 0           // ผ่อนหนี้ = คงที่
    if (/_ins/.test(c) || /ประกัน/.test(n)) return 0                                  // เบี้ยประกัน = คงที่
    if (/health|med/.test(c) || /สุขภาพ|รักษาพยาบาล|แพทย์/.test(n)) return med         // ค่ารักษา = เงินเฟ้อการแพทย์
    if (/edu/.test(c) || /การศึกษา|เล่าเรียน|ค่าเทอม|โรงเรียน/.test(n)) return edu       // การศึกษา = เงินเฟ้อการศึกษา
    if (/ค่าเช่า|เช่าบ้าน|เช่าคอนโด/.test(n)) return rentInfl                          // ค่าเช่า
    return infl                                                                        // ทั่วไป
  }
  const fx = (expenses ?? []).filter(e => String(e.category).startsWith('fixed_'))
  const vr = (expenses ?? []).filter(e => String(e.category).startsWith('var_') && e.category !== 'var_tax')
  const sv = (expenses ?? []).filter(e => String(e.category).startsWith('saving_'))
  for (const e of fx) d.expFixed.push({ id: uid(), label: e.name, base: toMonthly(toNum(e.amount), e.frequency) * 12, growth: growthFor(e.category, e.name), startAge: currentAge, endAge: retireAge - 1, auto: true })
  for (const e of vr) d.expVar.push({ id: uid(), label: e.name, base: toMonthly(toNum(e.amount), e.frequency) * 12, growth: growthFor(e.category, e.name), startAge: currentAge, endAge: retireAge - 1, auto: true })
  for (const e of sv) d.expSaving.push({ id: uid(), label: e.name, base: toMonthly(toNum(e.amount), e.frequency) * 12, growth: 0, startAge: currentAge, endAge: retireAge - 1, auto: true })

  // หนี้ → ค่าใช้จ่ายคงที่ (จ่ายจนปิดหนี้)
  for (const l of (liabilities ?? [])) {
    const annual = toNum(l.monthlyPayment) * 12
    if (annual <= 0) continue
    const yearsLeft = Math.max(1, Math.ceil(toNum(l.balance) / annual))
    d.expFixed.push({ id: uid(), label: l.name || 'ผ่อนหนี้', base: annual, growth: 0, startAge: currentAge, endAge: Math.min(currentAge + yearsLeft - 1, retireAge - 1), auto: true })
  }

  // รายการหักอัตโนมัติ (ประกันสังคม/PVD/เบี้ยประกันชีวิต) — ไม่ได้อยู่ใน /expenses
  d.expFixed.push(...autoFixedItems(isSelf, cp, lifeInsurances, currentAge, retireAge))

  if (!d.expVar.length) {
    d.expVar.push({ id: uid(), label: 'ค่าอาหาร', base: 168000, growth: infl, startAge: currentAge, endAge: retireAge - 1 })
    d.expVar.push({ id: uid(), label: 'ค่าเดินทาง', base: 72000, growth: infl, startAge: currentAge, endAge: retireAge - 1 })
    d.expVar.push({ id: uid(), label: 'ของใช้ส่วนตัว', base: 60000, growth: infl, startAge: currentAge, endAge: retireAge - 1 })
  }
  if (!d.expSaving.length) {
    d.expSaving.push({ id: uid(), label: 'กองทุน RMF', base: 0, growth: 0, startAge: currentAge, endAge: retireAge - 1 })
    d.expSaving.push({ id: uid(), label: 'กองทุน Thai ESG', base: 0, growth: 0, startAge: currentAge, endAge: retireAge - 1 })
  }

  // เป้าหมาย (ตัวอย่าง) — สิ้นสุดที่ (เกษียณ − 1); การศึกษาใช้ช่วงที่สั้นกว่าหากถึงก่อน
  d.goalEducation.push({ id: uid(), label: 'เงินออมเพื่อการศึกษาบุตร', base: 0, growth: edu, startAge: currentAge, endAge: Math.min(currentAge + 15, retireAge - 1) })
  d.goalRetire.push({ id: uid(), label: 'เงินออมเพื่อการเกษียณ (RMF)', base: 0, growth: 0, startAge: currentAge, endAge: retireAge - 1 })
  d.goalInsurance.push({ id: uid(), label: 'เบี้ยประกันเพื่อคุ้มครองความเสี่ยง', base: 0, growth: 0, startAge: currentAge, endAge: retireAge - 1 })

  // ลดหย่อนเพิ่มเติม (ตัวอย่าง — ส่วนตัว/บุตร/บิดามารดา ดึงอัตโนมัติแยกในเครื่องคำนวณภาษี)
  return d
}

/* ── tax per year: สร้าง TaxState จากบรรทัด project แล้ว ── */
// คีย์ที่เป็น "เงินได้" — เอาจากงบ (โปรเจกต์รายปี); ที่เหลือ (ค่าลดหย่อน/สถานะบุคคล) ดึงจากหน้าวางแผนภาษี
const INCOME_KEYS = new Set(['income40_1', 'income40_2', 'income40_3', 'interest', 'dividend', 'prof40_6', 'prof40_6type', 'income40_7', 'rental', 'other40', 'prepaid'])
function buildTaxState(d: CashflowData, age: number, cp: any, retireAge: number, taxPlan?: TaxState | null): TaxState {
  const t = defaultState()
  // รายได้ (จากงบ — โปรเจกต์รายปี)
  for (const l of d.incomeWork) {
    const v = lineAt(l, age, retireAge)
    // เงินเดือน (ทุกงาน รวมที่ปรึกษาแบบลูกจ้าง) + โบนัส = 40(1) · วิชาชีพอิสระจริง = 40(6) · อื่นๆ = 40(8)
    if (/เงินเดือน|ค่าจ้าง|โบนัส/.test(l.label)) t.income40_1 += v
    else if (/วิชาชีพ|แพทย์|ทนาย|วิศวก|สถาปนิก|บัญชี/.test(l.label)) t.prof40_6 += v
    else t.other40 += v
  }
  for (const l of d.incomeAsset) {
    const v = lineAt(l, age, retireAge)
    if (l.label.includes('เช่า')) t.rental += v
    else if (l.label.includes('ปันผล') || l.label.includes('ดอกเบี้ย')) t.dividend += v
    else t.other40 += v
  }

  if (taxPlan) {
    // ── ค่าลดหย่อน + สถานะบุคคล ดึงจากหน้าวางแผนภาษี (คงที่ทุกปี) ──
    for (const k of Object.keys(taxPlan)) if (!INCOME_KEYS.has(k)) (t as any)[k] = (taxPlan as any)[k]
    return t
  }

  // ── fallback: ยังไม่มีข้อมูลจากหน้าวางแผนภาษี → ประมาณจากบรรทัดในงบ ──
  const all = [...d.expFixed, ...d.expSaving, ...d.goalInsurance]
  for (const l of all) {
    const v = lineAt(l, age, retireAge)
    if (l.label.includes('ประกันสังคม')) t.socialSec += v
    else if (l.label.includes('สำรองเลี้ยงชีพ') || l.label.toUpperCase().includes('PVD')) t.pvd += v
    else if (l.label.toUpperCase().includes('RMF')) t.rmf += v
    else if (l.label.includes('ESG')) t.thaiesg += v
    else if (l.label.includes('สุขภาพ')) t.healthIns += v
    else if (l.label.includes('ประกันชีวิต') || l.label.includes('ชีวิตและสุขภาพ') || l.label.includes('บำนาญ')) t.lifeIns += v
  }
  t.children = Math.min((Array.isArray(cp?.children) ? cp.children.length : 0), 3)
  const pi = cp?.parentsInfo
  t.parents = (pi?.fatherName ? 1 : 0) + (pi?.motherName ? 1 : 0)
  t.maritalStatus = cp?.maritalStatus === 'สมรส' ? 'married' : 'single'
  return t
}

/* ── projection ── */
type ProjRow = { age: number; year: number; inWork: number; inAsset: number; retIncome: number; retBalance: number; inTotal: number; retExpense: number; exFixed: number; exVar: number; exSaving: number; tax: number; outTotal: number; net: number; goalEdu: number; goalRet: number; goalIns: number; goalTotal: number; remain: number; taxBreak?: ReturnType<typeof calc> }

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '14px 16px' }

/* ════════ MAIN ════════ */
export default function ForwardCashflowTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const qc = useQueryClient()
  const { data: cp } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: prof } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  // รายจ่าย/หนี้สิน = ดึงแยกต่อบุคคลจากงบกระแสเงินสด/งบดุล (person: client+shared / spouse+shared) ให้ตรงกับหน้างบการเงิน
  const { data: expensesSelf } = useQuery({ queryKey: ['expenses', 'client'], queryFn: () => api.get('/expenses', { params: { person: 'client' } }).then(r => r.data), retry: false })
  const { data: expensesSpouse } = useQuery({ queryKey: ['expenses', 'spouse'], queryFn: () => api.get('/expenses', { params: { person: 'spouse' } }).then(r => r.data), retry: false })
  const { data: liabilitiesSelf } = useQuery({ queryKey: ['liabilities', 'client'], queryFn: () => api.get('/liabilities', { params: { person: 'client' } }).then(r => r.data), retry: false })
  const { data: liabilitiesSpouse } = useQuery({ queryKey: ['liabilities', 'spouse'], queryFn: () => api.get('/liabilities', { params: { person: 'spouse' } }).then(r => r.data), retry: false })
  const expenses = person === 'self' ? expensesSelf : expensesSpouse
  const liabilities = person === 'self' ? liabilitiesSelf : liabilitiesSpouse
  const { data: lifeInsurances } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: taxPlan } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  // เงินคงเหลือกองทุนเกษียณรายปี (จากหน้าวางแผนเกษียณ) → เงินได้หลังเกษียณ
  const { byAge: retBalByAge, byAgeOpen: retOpenByAge, byAgeExp: retExpByAge } = useRetirementBalances(person === 'self' ? 'client' : 'spouse')
  const { data: saved, isFetched } = useQuery({ queryKey: ['cashflow-plan'], queryFn: () => api.get('/cashflow-plan').then(r => r.data), retry: false })

  // อายุ / เกษียณ / อายุขัย
  const isSelf = person === 'self'
  const selfAge = cp?.birthDate ? new Date().getFullYear() - new Date(cp.birthDate).getFullYear() : null
  const currentAge = (isSelf ? selfAge : (cp?.spouseAge ?? null)) ?? 35
  const retireAge = (isSelf ? prof?.retirementAgeSelf : prof?.retirementAgeSpouse) ?? 60
  const lifeExp = (isSelf ? prof?.lifeExpectancySelf : prof?.lifeExpectancySpouse) ?? 85

  const [selfData, setSelfData] = useState<CashflowData>(emptyData())
  const [spouseData, setSpouseData] = useState<CashflowData>(emptyData())
  const data = isSelf ? selfData : spouseData
  const setData = isSelf ? setSelfData : setSpouseData
  const setSec = (k: keyof CashflowData, v: Line[]) => setData(p => ({ ...p, [k]: v }))

  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || !isFetched || !cp || !prof || lifeInsurances === undefined
      || expensesSelf === undefined || expensesSpouse === undefined
      || liabilitiesSelf === undefined || liabilitiesSpouse === undefined) return
    const li = lifeInsurances ?? []
    // แต่ละบุคคลใช้รายจ่าย/หนี้สินของตัวเอง (client+shared สำหรับ self, spouse+shared สำหรับคู่สมรส)
    const seedSelf = seedData('self', cp, prof, expensesSelf ?? [], liabilitiesSelf ?? [], selfAge ?? 35, prof?.retirementAgeSelf ?? 60, li)
    const seedSpouse = seedData('spouse', cp, prof, expensesSpouse ?? [], liabilitiesSpouse ?? [], cp?.spouseAge ?? 35, prof?.retirementAgeSpouse ?? 60, li)
    // ทุกรายการสิ้นสุดที่ (เกษียณ − 1) — clamp ข้อมูลเดิมที่ตั้ง endAge ไว้ไกลกว่านั้น (รวมค่าใช้จ่ายคงที่/ออม/เป้าหมาย)
    const clampAll = (d: CashflowData, retAge: number): CashflowData => {
      const cap = (arr?: Line[]) => (arr ?? []).map(l => ({ ...l, endAge: Math.min(l.endAge, retAge - 1) }))
      return {
        ...d,
        incomeWork: cap(d.incomeWork), incomeAsset: cap(d.incomeAsset),
        expFixed: cap(d.expFixed), expVar: cap(d.expVar), expSaving: cap(d.expSaving),
        goalEducation: cap(d.goalEducation), goalRetire: cap(d.goalRetire), goalInsurance: cap(d.goalInsurance),
      }
    }
    // income = แหล่งเดียว (รายรับล่าสุด) → sync ทุกครั้งที่โหลด · รายจ่าย/ออม/เป้าหมาย ใช้ที่บันทึกไว้
    // + เติมรายการหักอัตโนมัติ (ประกันสังคม/PVD/เบี้ยประกันชีวิต) ถ้ายังไม่มี
    const withFreshIncome = (savedD: any, seedD: CashflowData, retAge: number, autos: Line[]) => {
      const merged = clampAll({ ...emptyData(), ...savedD, incomeWork: seedD.incomeWork, incomeAsset: seedD.incomeAsset }, retAge)
      const missing = autos.filter(a => !merged.expFixed.some(l => _norm(l.label).includes(_norm(a.label).slice(0, 8))))
      merged.expFixed = [...merged.expFixed, ...missing]
      return merged
    }
    const autoSelf = autoFixedItems(true, cp, li, selfAge ?? 35, prof?.retirementAgeSelf ?? 60)
    const autoSpouse = autoFixedItems(false, cp, li, cp?.spouseAge ?? 35, prof?.retirementAgeSpouse ?? 60)
    setSelfData((saved?.self && Object.keys(saved.self).length) ? withFreshIncome(saved.self, seedSelf, prof?.retirementAgeSelf ?? 60, autoSelf) : seedSelf)
    setSpouseData((saved?.spouse && Object.keys(saved.spouse).length) ? withFreshIncome(saved.spouse, seedSpouse, prof?.retirementAgeSpouse ?? 60, autoSpouse) : seedSpouse)
    loadedRef.current = true
  }, [isFetched, saved, cp, prof, expensesSelf, expensesSpouse, liabilitiesSelf, liabilitiesSpouse, lifeInsurances])

  // autosave
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const persist = (payload: any) => { qc.setQueryData(['cashflow-plan'], payload); return api.put('/cashflow-plan', payload) }
  const save = useMutation({ mutationFn: (p: any) => persist(p), onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 1500) }, onError: () => setStatus('idle') })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valuesRef = useRef<any>({ self: selfData, spouse: spouseData })
  valuesRef.current = { self: selfData, spouse: spouseData }
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ self: selfData, spouse: spouseData }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [selfData, spouseData])
  useEffect(() => () => { if (loadedRef.current) persist(valuesRef.current).catch(() => {}) }, [])

  // ── build projection ──
  const rows = useMemo<ProjRow[]>(() => {
    const out: ProjRow[] = []
    const yr0 = new Date().getFullYear() + 543
    for (let age = currentAge; age <= lifeExp; age++) {
      const inWork = sumAt(data.incomeWork, age, retireAge)
      const inAsset = sumAt(data.incomeAsset, age, retireAge)
      // เงินได้หลังเกษียณ = มูลค่ากองทุนเกษียณต้นปี (openBalance) — เงินก้อนที่มีให้ใช้ในปีนั้น
      const retIncome = age >= retireAge ? (retOpenByAge[age] ?? 0) : 0
      // มูลค่าคงเหลือกองทุนเกษียณ ปลายปี (compound แล้ว) — แสดงอ้างอิง
      const retBalance = age >= retireAge ? (retBalByAge[age] ?? 0) : 0
      // รายจ่ายหลังเกษียณ = ค่าใช้จ่าย/ปี + เป้าหมายพิเศษ + เงินมรดก (จากหน้าวางแผนเกษียณ)
      const retExpense = age >= retireAge ? (retExpByAge[age] ?? 0) : 0
      const exFixed = sumAt(data.expFixed, age, retireAge)
      const exVar = sumAt(data.expVar, age, retireAge)
      const exSaving = sumAt(data.expSaving, age, retireAge)
      const taxBreak = age <= retireAge ? calc(buildTaxState(data, age, cp, retireAge, taxPlan?.[person] ?? null)) : undefined
      const tax = taxBreak ? taxBreak.netTax : 0
      const inTotal = inWork + inAsset + retIncome
      const outTotal = exFixed + exVar + exSaving + tax + retExpense
      const net = inTotal - outTotal
      const goalEdu = sumAt(data.goalEducation, age, retireAge)
      const goalRet = sumAt(data.goalRetire, age, retireAge)
      const goalIns = sumAt(data.goalInsurance, age, retireAge)
      const goalTotal = goalEdu + goalRet + goalIns
      out.push({ age, year: yr0 + (age - currentAge), inWork, inAsset, retIncome, retBalance, inTotal, retExpense, exFixed, exVar, exSaving, tax, outTotal, net, goalEdu, goalRet, goalIns, goalTotal, remain: net - goalTotal, taxBreak })
    }
    return out
  }, [data, currentAge, lifeExp, retireAge, cp, taxPlan, person, retBalByAge, retExpByAge, retOpenByAge])

  const taxRows = rows.filter(r => r.age <= retireAge)
  const chartData = rows.map(r => ({ age: r.age, net: Math.round(r.net), remain: Math.round(r.remain), expense: Math.round(r.outTotal) }))
  const preData = chartData.filter(d => d.age < retireAge)
  const postData = chartData.filter(d => d.age >= retireAge)
  const [expanded, setExpanded] = useState<string | null>(null)
  const CHARTS = [
    { key: 'pre', title: 'ก่อนเกษียณ', sub: `อายุ ${currentAge}–${retireAge - 1}`, data: preData },
    { key: 'post', title: 'หลังเกษียณ', sub: `อายุ ${retireAge}–${lifeExp}`, data: postData },
  ]
  const chartEl = (dataset: any[], height: number, showExpense = false) => (
    <ChartFrame title="กระแสเงินสดล่วงหน้า" filename="forward-cashflow" height={height}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={dataset}>
        <CartesianGrid stroke="var(--grid)" />
        <XAxis dataKey="age" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => (v / 1e6).toFixed(1) + 'M'} />
        <Tooltip formatter={(v: any) => fmt0(v) + ' บาท'} contentStyle={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
        {showExpense && <Bar dataKey="expense" name="รายจ่าย/ปี" barSize={height > 300 ? 12 : 7} fill="#f59e0bb0" />}
        <Bar dataKey="net" name="กระแสสุทธิ" barSize={height > 300 ? 12 : 7} fill="#22c55e">
          {dataset.map((d, i) => <Cell key={i} fill={d.net < 0 ? '#ef4444cc' : '#22c55ecc'} />)}
        </Bar>
        <RLine dataKey="remain" name="คงเหลือหลังเป้าหมาย" stroke="#94a3b8" strokeWidth={1.5}
          dot={(p: any) => p?.cx == null ? <g key={p?.index} /> : <circle key={p.index} cx={p.cx} cy={p.cy} r={height > 300 ? 3 : 2.5} fill={(p?.payload?.remain ?? 0) < 0 ? '#ef4444' : '#22c55e'} />} />
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  )

  // ── UI ──
  const updateLine = (secKey: keyof CashflowData, id: string, patch: Partial<Line>) =>
    setSec(secKey, data[secKey].map(l => l.id === id ? { ...l, ...patch } : l))
  const delLine = (secKey: keyof CashflowData, id: string) => setSec(secKey, data[secKey].filter(l => l.id !== id))
  const addLine = (secKey: keyof CashflowData, isIncome: boolean) => {
    // ค่าเริ่มต้นของทุกรายการ = สิ้นสุดที่อายุเกษียณ − 1 (แก้ไขเป็น "ตลอด/∞" เองได้ที่ช่องจำนวนปี)
    const endAge = retireAge - 1
    setSec(secKey, [...data[secKey], { id: uid(), label: '', base: 0, growth: isIncome ? 5 : (prof?.inflationRate ?? 3), startAge: currentAge, endAge }])
  }
  // ดึงข้อมูลใหม่จากต้นทาง (รายรับ/รายจ่าย/หนี้) — เขียนทับของเดิม
  const reseed = () => {
    if (!cp || !prof) return
    if (!confirm('ดึงข้อมูลใหม่จากรายรับ/รายจ่าย/หนี้สินล่าสุด? รายการที่แก้ไขเองในหน้านี้จะถูกเขียนทับ')) return
    const age = isSelf ? (selfAge ?? 35) : (cp?.spouseAge ?? 35)
    setData(seedData(person, cp, prof, expenses ?? [], liabilities ?? [], age, retireAge, lifeInsurances ?? []))
  }

  const th: React.CSSProperties = { position: 'sticky', left: 0, background: 'var(--navy-950)', zIndex: 2, padding: '5px 10px', textAlign: 'left', fontSize: 11.5, whiteSpace: 'nowrap', borderRight: '1px solid var(--card-border)', width: 260, minWidth: 260, maxWidth: 260, boxSizing: 'border-box' }
  const td: React.CSSProperties = { padding: '4px 8px', textAlign: 'right', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', borderBottom: '1px solid var(--divider)' }
  const tdLabel: React.CSSProperties = { ...th, fontWeight: 400, color: 'var(--text-secondary)', borderBottom: '1px solid var(--divider)' }

  const Row = ({ label, getter, color, bold, indent, signColor }: { label: string; getter: (r: ProjRow) => number; color?: string; bold?: boolean; indent?: boolean; signColor?: boolean }) => (
    <tr style={bold ? { background: 'var(--hover)' } : undefined}>
      <td style={{ ...tdLabel, fontWeight: bold ? 700 : 400, paddingLeft: indent ? 22 : 10, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</td>
      {rows.map(r => { const v = getter(r); const c = signColor ? (v < 0 ? '#f87171' : '#22c55e') : (color ?? (v < 0 ? '#f87171' : 'var(--text-primary)')); return <td key={r.age} style={{ ...td, color: c, fontWeight: bold ? 700 : 400 }}>{v === 0 ? '–' : fmt0(v)}</td> })}
    </tr>
  )
  const SecHeader = ({ title }: { title: string }) => (
    <tr><td style={{ ...th, fontWeight: 700, color: 'var(--cyan-light)', background: 'var(--navy-950)', borderBottom: '1px solid var(--card-border)' }}>{title}</td>
      {rows.map(r => <td key={r.age} style={{ ...td, borderBottom: '1px solid var(--card-border)' }} />)}</tr>
  )
  // แถวรายการแก้ไขได้ — ช่องปีแรกแก้ค่าตั้งต้น, ปีถัดไปคำนวณตาม %เติบโต
  const cellInp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '3px 5px', textAlign: 'right', background: 'var(--cyan-dim)', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--cyan)', fontSize: 11, fontFamily: 'monospace', outline: 'none' }
  const ELine = ({ secKey, line, color }: { secKey: keyof CashflowData; line: Line; color: string }) => (
    <tr key={line.id}>
      <td style={{ ...tdLabel, paddingLeft: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input value={line.label} onChange={e => updateLine(secKey, line.id, { label: e.target.value })} placeholder="รายการ"
            style={{ flex: 1, minWidth: 120, padding: '2px 4px', background: 'transparent', border: '1px solid transparent', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11.5, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--card-border)')} onBlur={e => (e.currentTarget.style.borderColor = 'transparent')} />
          <span title="โต%/ปี"><input type="number" step={0.5} value={line.growth} onChange={e => updateLine(secKey, line.id, { growth: Number(e.target.value) })} style={{ width: 42, padding: '2px 3px', textAlign: 'right', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 10, outline: 'none' }} /></span>
          <span title="จำนวนปีที่ได้รับ/ครบกำหนด (เว้นว่าง = ตลอด)" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <input type="number" placeholder="∞" value={line.endAge >= lifeExp ? '' : (line.endAge - line.startAge + 1)}
              onChange={e => { const n = Number(e.target.value); updateLine(secKey, line.id, { endAge: n > 0 ? line.startAge + n - 1 : lifeExp }) }}
              style={{ width: 38, padding: '2px 3px', textAlign: 'right', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 4, color: '#fbbf24', fontSize: 10, outline: 'none' }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>ปี</span>
          </span>
          <button onClick={() => delLine(secKey, line.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 0 }}><Trash2 size={12} /></button>
        </div>
      </td>
      {rows.map((r, idx) => idx === 0
        ? <td key={r.age} style={{ ...td, padding: '2px 4px' }}><input value={line.base ? line.base.toLocaleString('en-US') : ''} inputMode="numeric"
            onChange={e => { const raw = e.target.value.replace(/,/g, ''); if (raw === '' || /^\d+$/.test(raw)) updateLine(secKey, line.id, { base: Number(raw || 0) }) }} style={cellInp} /></td>
        : <td key={r.age} style={{ ...td, color: lineAt(line, r.age, retireAge) > 0 ? color : 'var(--text-muted)' }}>{(() => { const v = lineAt(line, r.age, retireAge); return v > 0 ? fmt0(v) : '–' })()}</td>)}
    </tr>
  )
  const AddRow = ({ secKey, isIncome, accent }: { secKey: keyof CashflowData; isIncome: boolean; accent: string }) => (
    <tr><td style={{ ...tdLabel, paddingLeft: 22 }}>
      <button onClick={() => addLine(secKey, isIncome)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'none', border: `1px dashed ${accent}55`, borderRadius: 5, color: accent, fontSize: 10.5, cursor: 'pointer' }}><Plus size={11} /> เพิ่มรายการ</button>
    </td>{rows.map(r => <td key={r.age} style={td} />)}</tr>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes cf-spin{to{transform:rotate(360deg)}}.cf-spin{animation:cf-spin .9s linear infinite}`}</style>

      {/* คำบรรยาย + สถานะบันทึก (หัวข้อหลักแสดงโดย PageHeader ของหน้าวางแผนการเงิน) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: -6 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: 200 }}>ประมาณการกระแสเงินสดรายปี อายุ {currentAge}–{lifeExp} ปี (เกษียณ {retireAge}) · ภาษีคำนวณถึงปีก่อนเกษียณ</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          {status === 'saving' && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="cf-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></span>}
          {status === 'saved' && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={13} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></span>}
          <button onClick={reseed} title="ดึงรายรับ/รายจ่าย/หนี้สินล่าสุดมาสร้างใหม่ (เขียนทับการแก้ไขในหน้านี้)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', color: 'var(--cyan-light)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={12} /> ดึงข้อมูลใหม่
          </button>
        </div>
      </div>

      {/* Charts — แยกก่อน/หลังเกษียณ (คลิกเพื่อขยาย) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {CHARTS.map(c => (
          <div key={c.key} onClick={() => setExpanded(c.key)} title="คลิกเพื่อขยาย"
            style={{ ...card, cursor: 'zoom-in', transition: 'border-color .15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{c.title} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>· {c.sub}</span></p>
              <Maximize2 size={13} style={{ color: 'var(--text-muted)' }} />
            </div>
            {chartEl(c.data, 220, c.key === 'post')}
          </div>
        ))}
      </div>

      {/* Modal — กราฟขยาย */}
      {expanded && (() => {
        const c = CHARTS.find(x => x.key === expanded); if (!c) return null
        return createPortal(
          <div onClick={() => setExpanded(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, width: 'min(1000px, 96vw)', maxHeight: '92vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{c.title} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>· {c.sub}</span></p>
                <button onClick={() => setExpanded(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
              </div>
              {chartEl(c.data, 480, c.key === 'post')}
            </div>
          </div>, document.body)
      })()}

      {/* Projection table A+B (แก้ตัวเลขปีแรกได้) */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          ประมาณการงบประมาณล่วงหน้า <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>แก้ช่องปีแรก / %เติบโต / ปีครบกำหนดชำระ (ช่อง "ปี") ได้โดยตรง</span>
          <span style={{ marginLeft: 'auto' }}><TableExcelButton filename="ประมาณการงบประมาณล่วงหน้า" title="งบประมาณ" /></span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dense-table" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, background: 'var(--navy-950)', borderBottom: '2px solid var(--card-border)' }}>อายุ / ปี พ.ศ. <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)' }}>(ช่อง: %โต)</span></th>
                {rows.map(r => <th key={r.age} style={{ ...td, color: r.age === retireAge ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--card-border)' }}>{r.age}<div style={{ fontSize: 9, fontWeight: 400 }}>{r.year}</div></th>)}
              </tr>
            </thead>
            <tbody>
              <SecHeader title="กระแสเงินสดรับ" />
              {data.incomeWork.map(l => ELine({ secKey: 'incomeWork', line: l, color: '#22c55e' }))}
              {data.incomeAsset.map(l => ELine({ secKey: 'incomeAsset', line: l, color: '#22c55e' }))}
              {AddRow({ secKey: 'incomeWork', isIncome: true, accent: '#22c55e' })}
              <Row label="มูลค่ากองทุนเกษียณ (ต้นปี)" getter={r => r.retIncome} color="#22c55e" indent />
              <Row label="รวมกระแสเงินสดรับ" getter={r => r.inTotal} color="#22c55e" bold />

              <SecHeader title="กระแสเงินสดจ่าย — ค่าใช้จ่ายคงที่" />
              {data.expFixed.map(l => ELine({ secKey: 'expFixed', line: l, color: '#f59e0b' }))}
              {AddRow({ secKey: 'expFixed', isIncome: false, accent: '#f59e0b' })}
              <Row label="รวมค่าใช้จ่ายคงที่" getter={r => r.exFixed} color="#f59e0b" bold />

              <SecHeader title="ค่าใช้จ่ายผันแปร (ภาษีคำนวณให้)" />
              {data.expVar.map(l => ELine({ secKey: 'expVar', line: l, color: '#f59e0b' }))}
              {AddRow({ secKey: 'expVar', isIncome: false, accent: '#f59e0b' })}
              <Row label="ภาษีเงินได้" getter={r => r.tax} color="#fb923c" indent />
              <Row label="รวมค่าใช้จ่ายผันแปร (รวมภาษี)" getter={r => r.exVar + r.tax} color="#f59e0b" bold />

              <SecHeader title="ค่าใช้จ่ายเพื่อการออม/ลงทุน" />
              {data.expSaving.map(l => ELine({ secKey: 'expSaving', line: l, color: '#0ea5e9' }))}
              {AddRow({ secKey: 'expSaving', isIncome: false, accent: '#0ea5e9' })}
              <Row label="รวมเพื่อการออม/ลงทุน" getter={r => r.exSaving} color="#0ea5e9" bold />

              <Row label="รายจ่ายหลังเกษียณ (ค่าใช้จ่าย+เป้าหมาย+มรดก)" getter={r => r.retExpense} color="#f59e0b" indent />
              <Row label="รวมกระแสเงินสดจ่าย" getter={r => r.outTotal} color="#f87171" bold />
              <Row label="กระแสเงินสดสุทธิ" getter={r => r.net} bold signColor />

              <SecHeader title="ค่าใช้จ่ายเพื่อเป้าหมายทางการเงิน" />
              {data.goalEducation.map(l => ELine({ secKey: 'goalEducation', line: l, color: '#a78bfa' }))}
              {data.goalRetire.map(l => ELine({ secKey: 'goalRetire', line: l, color: '#a78bfa' }))}
              {data.goalInsurance.map(l => ELine({ secKey: 'goalInsurance', line: l, color: '#a78bfa' }))}
              {AddRow({ secKey: 'goalEducation', isIncome: false, accent: '#a78bfa' })}
              <Row label="รวมรายจ่ายเพื่อเป้าหมาย" getter={r => r.goalTotal} color="#a78bfa" bold />
              <Row label="กระแสเงินสดคงเหลือ" getter={r => r.remain} bold signColor />
              <Row label="มูลค่าคงเหลือกองทุนเกษียณ (ปลายปี)" getter={r => r.retBalance} color="#22d3ee" indent />
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax projection C */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>ประมาณการภาษีเงินได้ล่วงหน้า (ถึงปีก่อนเกษียณ)<TableExcelButton filename="ประมาณการภาษีล่วงหน้า" title="ภาษี" /></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dense-table" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, background: 'var(--navy-950)', borderBottom: '2px solid var(--card-border)' }}>อายุ / ปี พ.ศ.</th>
                {taxRows.map(r => <th key={r.age} style={{ ...td, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '2px solid var(--card-border)' }}>{r.age}<div style={{ fontSize: 9, fontWeight: 400 }}>{r.year}</div></th>)}
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdLabel}>เงินได้พึงประเมิน</td>{taxRows.map(r => <td key={r.age} style={td}>{fmt0(r.taxBreak!.ti)}</td>)}</tr>
              <tr><td style={tdLabel}>(−) ค่าใช้จ่าย</td>{taxRows.map(r => <td key={r.age} style={td}>{fmt0(r.taxBreak!.expD)}</td>)}</tr>
              <tr><td style={tdLabel}>(−) ค่าลดหย่อนรวม</td>{taxRows.map(r => <td key={r.age} style={td}>{fmt0(r.taxBreak!.allD - r.taxBreak!.expD)}</td>)}</tr>
              <tr style={{ background: 'var(--hover)' }}><td style={{ ...tdLabel, fontWeight: 700, color: 'var(--text-primary)' }}>เงินได้สุทธิ</td>{taxRows.map(r => <td key={r.age} style={{ ...td, fontWeight: 700 }}>{fmt0(r.taxBreak!.ni)}</td>)}</tr>
              <tr><td style={{ ...tdLabel, fontWeight: 700, color: '#fb923c' }}>ภาษีที่ต้องชำระ</td>{taxRows.map(r => <td key={r.age} style={{ ...td, color: '#fb923c', fontWeight: 700 }}>{fmt0(r.taxBreak!.tax)}</td>)}</tr>
              <tr><td style={tdLabel}>อัตราภาษีที่แท้จริง</td>{taxRows.map(r => <td key={r.age} style={{ ...td, color: 'var(--text-muted)' }}>{r.taxBreak!.eff.toFixed(1)}%</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
