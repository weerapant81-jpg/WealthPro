import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Calculator, Check, Loader2, User, Users, RefreshCw } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { calc, defaultState, BRACKETS, expenseFor, type TaxState, type ExpenseKey } from '../lib/tax'
import { MoneyInput } from '../components/MoneyInput'
import { hasSpouseInfo } from '../lib/spouse'
import { annualIncome, taxCodeOf, INCOME_40 } from '../lib/income'
import { toNum } from '@shared/finance/math'

/* ── helpers ── */
const fmt = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')

/* ── UI bits ── */
const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '16px 18px' }

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  )
}

// จับคู่รายรับ (incomeSources) → มาตรา 40(x)  ·  เงินเดือน=รายเดือน(×12) · โบนัส=รายปี
function mapIncomeSources(sources: any): Partial<TaxState> | null {
  if (!Array.isArray(sources)) return null
  const acc = { income40_1: 0, income40_2: 0, income40_3: 0, prof40_6: 0, income40_7: 0, rental: 0, dividend: 0, interest: 0, other40: 0 }
  for (const s of sources) {
    const annual = annualIncome(s)   // freq-aware (รายเดือน ×12 · รายปี ตามยอด · เผื่อ 'โบนัส' เดิม)
    if (annual <= 0) continue
    const code = taxCodeOf(s?.label)
    const txt = `${s?.label || ''} ${s?.source || ''}`
    // จัดหมวดจากรหัส 40(x) ที่ผู้ใช้เลือกก่อน · ถ้าไม่มีค่อย fallback ด้วยคำในข้อความ (ข้อมูลเก่า)
    if (code === '1' || (!code && /เงินเดือน|ค่าจ้าง|โบนัส|salary/.test(txt))) acc.income40_1 += annual
    else if (code === '2' || (!code && /คอมมิช|นายหน้า|เบี้ยประชุม|commission/.test(txt))) acc.income40_2 += annual
    else if (code === '3' || (!code && /ลิขสิทธิ์|goodwill|สิทธิบัตร/.test(txt))) acc.income40_3 += annual
    else if (code === '4' || (!code && /ปันผล|ดอกเบี้ย|ลงทุน|dividend|interest|invest/.test(txt))) {
      if (/ดอกเบี้ย|interest/.test(txt)) acc.interest += annual
      else acc.dividend += annual                                                          // 40(4) default = เงินปันผล
    }
    else if (code === '5' || (!code && /ค่าเช่า|เช่า|rent/.test(txt))) acc.rental += annual
    else if (code === '6' || (!code && /วิชาชีพ|แพทย์|ทนาย|วิศวก|สถาปนิก|บัญชี/.test(txt))) acc.prof40_6 += annual
    else if (code === '7' || (!code && /รับเหมา|contractor/.test(txt))) acc.income40_7 += annual
    else acc.other40 += annual                                                             // 40(8)/อื่นๆ
  }
  return Object.values(acc).some(v => v > 0) ? acc : null
}

// แปลงความถี่ → รายปี
const toAnnual = (amount: any, freq: any): number => {
  const a = parseFloat(String(amount ?? '').replace(/,/g, '')) || 0
  switch (freq) { case 'MONTHLY': return a * 12; case 'QUARTERLY': return a * 4; case 'WEEKLY': return a * 52; case 'DAILY': return a * 365; default: return a }
}
// ลดหย่อนจากรายจ่าย/ออม ในงบกระแสเงินสด (/expenses)
function mapExpenseDeductions(expenses: any): Partial<TaxState> {
  if (!Array.isArray(expenses)) return {}
  const acc: any = {}
  for (const e of expenses) {
    const amt = toAnnual(e?.amount, e?.frequency)
    if (amt <= 0) continue
    const cat = String(e?.category || ''), nm = String(e?.name || ''), t = `${cat} ${nm}`
    if (cat === 'saving_rmf' || /\brmf\b/i.test(nm)) acc.rmf = (acc.rmf || 0) + amt
    else if (/thai\s?esg|thaiesg/i.test(t)) acc.thaiesg = (acc.thaiesg || 0) + amt
    else if (/บำนาญ|annuity/i.test(t)) acc.annuityIns = (acc.annuityIns || 0) + amt
    else if (/ประกันชีวิต|life_ins/i.test(t)) acc.lifeIns = (acc.lifeIns || 0) + amt
    else if (/ประกันสุขภาพ|health_ins/i.test(t)) acc.healthIns = (acc.healthIns || 0) + amt
    else if (/บริจาค|donat/i.test(t)) acc.donation = (acc.donation || 0) + amt
  }
  return acc
}
// ลดหย่อนจากข้อมูลลูกค้า: PVD (อัตราสะสม×เงินเดือน) + ประกันสังคม (5% ของค่าจ้าง ≤15,000)
function mapProfileDeductions(prof: any, salaryMonthly: number): Partial<TaxState> {
  const acc: any = {}
  if (prof?.hasPVD && Number(prof?.pvdEmployeeRate) > 0 && salaryMonthly > 0) acc.pvd = salaryMonthly * 12 * (Number(prof.pvdEmployeeRate) / 100)
  if (prof?.hasSocialSecurity && salaryMonthly > 0) acc.socialSec = Math.min(15000, salaryMonthly) * 0.05 * 12
  return acc
}

// ลดหย่อนเบี้ยประกันจากหน้าวางแผนประกัน (LifeInsurancePolicy) จับคู่ตามชื่อผู้เอาประกัน
function mapInsuranceDeductions(policies: any, personName: string): Partial<TaxState> {
  if (!Array.isArray(policies) || !personName) return {}
  const norm = (x: any) => String(x || '').replace(/\s+/g, '').toLowerCase()
  const pn = norm(personName)
  if (!pn) return {}
  const acc: any = {}
  for (const p of policies) {
    const ins = norm(p?.insuredPerson)
    if (!ins || !(ins.includes(pn) || pn.includes(ins))) continue
    const prem = Number(p?.premium) || 0
    if (prem <= 0) continue
    const t = String(p?.insuranceType || '')
    if (/บำนาญ/.test(t)) acc.annuityIns = (acc.annuityIns || 0) + prem
    else if (/สุขภาพ/.test(t)) acc.healthIns = (acc.healthIns || 0) + prem
    else acc.lifeIns = (acc.lifeIns || 0) + prem   // ชีวิต/ตลอดชีพ/สะสมทรัพย์
  }
  return acc
}

export default function TaxPlanningPage() {
  const compact = useIsCompact()
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: saved, isFetched } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  const { data: expenses } = useQuery({ queryKey: ['expenses'], queryFn: () => api.get('/expenses').then(r => r.data), retry: false })
  const { data: lifeInsurances } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const incomeSourcesOf = (p: 'self' | 'spouse') => p === 'spouse' ? clientProfile?.spouseIncomeSources : clientProfile?.incomeSources
  const personNameOf = (p: 'self' | 'spouse') => {
    const src = p === 'spouse' ? clientProfile?.spouseProfile : clientProfile
    return `${src?.firstName ?? ''} ${src?.lastName ?? ''}`.trim()
  }
  const salaryMonthlyOf = (p: 'self' | 'spouse') => {
    if (p === 'self') return parseFloat(String(clientProfile?.salary ?? '')) || 0
    const spJob = Array.isArray(clientProfile?.spouseJobs) ? clientProfile.spouseJobs[0] : null
    return parseFloat(String(spJob?.salary ?? clientProfile?.spouseIncome ?? '')) || 0
  }
  // ดึงเงินได้ + ค่าลดหย่อน จากงบกระแสเงินสด/ข้อมูลลูกค้า (รายจ่าย–ออม ใช้กับ self)
  const pullAllFor = (p: 'self' | 'spouse'): Partial<TaxState> | null => {
    const inc = mapIncomeSources(incomeSourcesOf(p)) || {}
    const prof = p === 'self' ? clientProfile : clientProfile?.spouseProfile
    const ded = mapProfileDeductions(prof, salaryMonthlyOf(p))
    const expDed = p === 'self' ? mapExpenseDeductions(expenses) : {}
    const insDed = mapInsuranceDeductions(lifeInsurances, personNameOf(p))   // เบี้ยประกันจากหน้าประกัน (จับคู่ชื่อ)
    const merged = { ...inc, ...expDed, ...ded, ...insDed }
    return Object.keys(merged).length ? merged : null
  }

  const [person, setPerson] = useState<'self' | 'spouse'>('self')
  const [showAllInc, setShowAllInc] = useState(false)   // เงินได้พึงประเมิน: แสดงเฉพาะที่มีรายได้ / ทั้งหมด
  const [selfS, setSelfS] = useState<TaxState>(defaultState())
  const [spouseS, setSpouseS] = useState<TaxState>(defaultState())
  const s = person === 'self' ? selfS : spouseS
  const setS = person === 'self' ? setSelfS : setSpouseS
  const set = <K extends keyof TaxState>(k: K, v: TaxState[K]) => setS(p => ({ ...p, [k]: v }))
  // แก้ค่าใช้จ่ายรายมาตรา (null = ลบ override กลับไปใช้ค่า default)
  const setExpense = (k: ExpenseKey, v: number | null) => setS(p => {
    const ov = { ...(p.expenseOverride ?? {}) }
    if (v == null) delete ov[k]; else ov[k] = v
    return { ...p, expenseOverride: Object.keys(ov).length ? ov : undefined }
  })
  const M = (label: string, k: keyof TaxState, hint?: string) =>
    <Row label={label} hint={hint}><MoneyInput value={s[k] as number} onChange={v => set(k, v as any)} /></Row>

  const clientName = clientProfile?.firstName ? `คุณ${clientProfile.firstName}` : 'ลูกค้า'
  const spouseName = clientProfile?.spouseProfile?.firstName ? `คุณ${clientProfile.spouseProfile.firstName}` : 'คู่สมรส'
  const showSpouse = hasSpouseInfo(clientProfile)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('self') }, [showSpouse, person])

  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    const spJob = Array.isArray(clientProfile?.spouseJobs) ? clientProfile.spouseJobs[0] : null
    const selfIncome = toNum(clientProfile?.salary) * 12
    const spouseIncome = (toNum(spJob?.salary) || toNum(clientProfile?.spouseIncome)) * 12
    if (saved && typeof saved === 'object' && (saved.self || saved.spouse)) {
      // รูปแบบใหม่ {self, spouse}
      setSelfS(p => ({ ...p, ...(saved.self ?? {}) }))
      setSpouseS(p => ({ ...p, ...(saved.spouse ?? {}) }))
    } else if (saved && typeof saved === 'object') {
      // รูปแบบเก่า (flat) → ถือเป็นของลูกค้า
      setSelfS(p => ({ ...p, ...saved }))
    } else if (selfIncome) {
      setSelfS(p => ({ ...p, income40_1: selfIncome }))
    }
    // auto-fill เงินเดือนคู่สมรสถ้ายังว่าง
    if (spouseIncome) setSpouseS(p => p.income40_1 ? p : { ...p, income40_1: spouseIncome })
    loadedRef.current = true
  }, [isFetched, saved, clientProfile])

  // auto-seed เงินได้ + ลดหย่อน จากงบกระแสเงินสด/ข้อมูลลูกค้า เมื่อข้อมูลพร้อม
  const cfSeededRef = useRef(false)
  useEffect(() => {
    if (cfSeededRef.current || !loadedRef.current || !clientProfile || expenses === undefined || lifeInsurances === undefined) return
    cfSeededRef.current = true
    const accSelf = pullAllFor('self')
    const accSpouse = pullAllFor('spouse')
    if (accSelf) setSelfS(p => ({ ...p, ...accSelf }))
    if (accSpouse) setSpouseS(p => ({ ...p, ...accSpouse }))
  }, [clientProfile, expenses, lifeInsurances, isFetched])

  const qc = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const persist = (payload: any) => { qc.setQueryData(['tax-plan'], payload); return api.put('/tax-plan', payload) }
  const save = useMutation({
    mutationFn: (payload: any) => persist(payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valuesRef = useRef<any>({ self: selfS, spouse: spouseS })
  valuesRef.current = { self: selfS, spouse: spouseS }
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ self: selfS, spouse: spouseS }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [selfS, spouseS])
  useEffect(() => {
    return () => { if (loadedRef.current) persist(valuesRef.current).catch(() => {}) }
  }, [])

  const c = useMemo(() => calc(s), [s])

  // ── "หลังวางแผน" — ค่าลดหย่อนที่วางแผนจะทำเพิ่ม (เก็บใน state/tax-plan คีย์ planned) ──
  const planned: Record<string, number> = (s as any).planned ?? {}
  const setPlanned = (key: string, v: number) => setS(p => {
    const cur = { ...(((p as any).planned) ?? {}) }
    if (v > 0) cur[key] = v; else delete cur[key]
    return { ...p, planned: Object.keys(cur).length ? cur : undefined } as any
  })
  const hasPlanned = Object.keys(planned).length > 0
  const cP = useMemo(() => calc({ ...s, ...planned } as TaxState), [s])

  // ── ตารางเงินได้ 3 คอลัมน์: เงินได้ · ค่าใช้จ่าย (ตามมาตรา) · เงินหลังค่าใช้จ่าย ──
  // ค่าใช้จ่ายคิดตามเกณฑ์สรรพากร (ตรงกับ lib/tax.ts calc)
  type IncRow = { label: string; sec: string; key: keyof TaxState; inc: number; exp: number; note: string; prof?: boolean; expKey?: ExpenseKey; over?: boolean }
  const eKey = (k: ExpenseKey): { expKey: ExpenseKey; exp: number; over: boolean } =>
    ({ expKey: k, exp: expenseFor(s, k), over: s.expenseOverride?.[k] != null })
  // ชื่อประเภทเงินได้ใช้ชุดเดียวกับหน้า "ที่มาของรายได้" (shared/finance/income.ts)
  // ดึงจากค่าคงที่กลาง ไม่พิมพ์ซ้ำ — ที่ผ่านมาสองหน้านี้เรียกชื่อไม่เหมือนกัน ทำให้ที่ปรึกษาจับคู่ไม่ถูก
  const sec40 = (code: string) => INCOME_40.find(c => c.code === code)!.label.replace(/^40\(\d\)\s*/, '')
  const incomeRows: IncRow[] = [
    { label: sec40('1'), sec: '40(1)', key: 'income40_1', inc: s.income40_1, note: 'หัก 50% รวม (1)-(3) ≤100,000', ...eKey('income40_1') },
    { label: sec40('2'), sec: '40(2)', key: 'income40_2', inc: s.income40_2, note: 'หัก 50% รวม (1)-(3) ≤100,000', ...eKey('income40_2') },
    { label: sec40('3'), sec: '40(3)', key: 'income40_3', inc: s.income40_3, note: 'หัก 50% รวม (1)-(3) ≤100,000', ...eKey('income40_3') },
    // 40(4) แยกเป็นสองช่องกรอก เพราะคิดภาษีคนละแบบได้ แต่อยู่ในประเภทเดียวกัน
    { label: `${sec40('4')} — ดอกเบี้ย`, sec: '40(4)', key: 'interest', inc: s.interest, exp: 0, note: 'หักค่าใช้จ่ายไม่ได้' },
    { label: `${sec40('4')} — เงินปันผล`, sec: '40(4)', key: 'dividend', inc: s.dividend, exp: 0, note: 'หักค่าใช้จ่ายไม่ได้' },
    { label: sec40('5'), sec: '40(5)', key: 'rental', inc: s.rental, note: 'หัก 30% (บ้าน/สิ่งปลูกสร้าง)', ...eKey('rental') },
    { label: sec40('6'), sec: '40(6)', key: 'prof40_6', inc: s.prof40_6, note: 'แพทย์ 60% · อื่นๆ 40%', prof: true, ...eKey('prof40_6') },
    { label: sec40('7'), sec: '40(7)', key: 'income40_7', inc: s.income40_7, note: 'หัก 60%', ...eKey('income40_7') },
    { label: sec40('8'), sec: '40(8)', key: 'other40', inc: s.other40, note: 'หัก 60%', ...eKey('other40') },
  ]
  const totInc = incomeRows.reduce((a, r) => a + r.inc, 0)
  const totExp = incomeRows.reduce((a, r) => a + r.exp, 0)
  // แสดงเฉพาะประเภทที่มีรายได้ (ดึงจากที่มาของรายได้) · กดปุ่มเพื่อเผยประเภทอื่นสำหรับกรอกเพิ่มเอง
  const visibleIncomeRows = showAllInc ? incomeRows : incomeRows.filter(r => r.inc > 0)

  // ── สิทธิ์ลดหย่อนคงเหลือ (ยังทำเพิ่มได้อีกเท่าไหร่ตามเพดาน เพื่อลดภาษี) ──
  const net1 = c.ti - c.expD                          // เงินได้หลังหักค่าใช้จ่าย (ฐาน % ตาม lib/tax)
  const pos = (n: number) => Math.max(0, Math.round(n))
  const grpUsed = Math.min(s.rmf, net1 * 0.30) + Math.min(s.annuityIns, Math.min(net1 * 0.15, 200000))
    + Math.min(s.pvd, 500000) + Math.min(s.govPension, 500000) + Math.min(s.nsf, 30000)
  const grpRoom = Math.max(0, 500000 - grpUsed)       // เพดานกลุ่มเกษียณรวม 500,000
  const rem: Partial<Record<keyof TaxState, number>> = {
    lifeIns: pos(100000 - s.lifeIns - Math.min(s.healthIns, 25000)),
    healthIns: pos(Math.min(25000 - s.healthIns, 100000 - s.lifeIns - s.healthIns)),
    parentHealthIns: pos(15000 - s.parentHealthIns),
    socialSec: pos(10500 - s.socialSec),
    rmf: pos(Math.min(net1 * 0.30 - s.rmf, grpRoom)),
    annuityIns: pos(Math.min(Math.min(net1 * 0.15, 200000) - s.annuityIns, grpRoom)),
    pvd: pos(Math.min(500000 - s.pvd, grpRoom)),
    govPension: pos(Math.min(500000 - s.govPension, grpRoom)),
    nsf: pos(Math.min(30000 - s.nsf, grpRoom)),
    thaiesg: pos(Math.min(net1 * 0.30, 300000) - s.thaiesg),
    mortgage: pos(100000 - s.mortgage),
    easyReceipt: pos(50000 - s.easyReceipt),
    shopDee: pos(50000 - s.shopDee),
    otop: pos(10000 - s.otop),
    donation: pos(net1 * 0.05 - s.donation),
    eduDonation: pos(net1 * 0.10 - s.eduDonation),
    politicalDonate: pos(10000 - s.politicalDonate),
  }
  // แถวลดหย่อน 4 คอลัมน์: รายการ · จำนวน · เพิ่มได้อีก(ตามสิทธิ์) · หลังวางแผน
  const dCols = '1fr 118px 88px 118px'
  const DeductHead = (
    <div style={{ display: 'grid', gridTemplateColumns: dCols, gap: 10, padding: '0 0 6px', marginBottom: 4, borderBottom: '1px solid var(--card-border)' }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>รายการ</span>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>จำนวน (บาท)</span>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>เพิ่มได้อีก</span>
      <span style={{ fontSize: 10.5, color: '#22c55e', fontWeight: 700, textAlign: 'right' }}>หลังวางแผน</span>
    </div>
  )
  const MR = (label: string, key: keyof TaxState, hint?: string, remaining?: number) => (
    <div style={{ display: 'grid', gridTemplateColumns: dCols, gap: 10, alignItems: 'center', padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{hint}</div>}
      </div>
      <MoneyInput value={s[key] as number} onChange={v => set(key, v as any)} style={{ width: '100%', padding: '6px 9px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)', fontSize: 13, fontWeight: 500, fontFamily: 'monospace', outline: 'none' }} />
      <div style={{ textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>
        {remaining === undefined ? null
          : remaining > 0
            ? <span style={{ color: '#10b981' }}>+{fmt(remaining)}</span>
            : <span style={{ color: 'var(--text-muted)' }}>เต็มสิทธิ์</span>}
      </div>
      <MoneyInput value={planned[key as string] ?? 0} onChange={v => setPlanned(key as string, v)}
        placeholder={(s[key] as number) > 0 ? fmt(s[key] as number) : '—'}
        style={{ width: '100%', padding: '6px 9px', textAlign: 'right', background: 'var(--navy-900)', border: `1px solid ${planned[key as string] != null ? '#22c55e' : 'var(--card-border)'}`, borderRadius: 6, color: '#22c55e', fontSize: 13, fontWeight: 600, fontFamily: 'monospace', outline: 'none' }} />
    </div>
  )

  // ดึงเงินได้ + ลดหย่อน จากงบกระแสเงินสด (ปุ่ม resync ด้วยมือ)
  const pullFromCashflow = () => {
    const acc = pullAllFor(person)
    if (acc) setS(p => ({ ...p, ...acc }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes tx-spin{to{transform:rotate(360deg)}}.tx-spin{animation:tx-spin .9s linear infinite}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, background: 'var(--cyan-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calculator size={22} color="var(--cyan)" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>วางแผนภาษีเงินได้บุคคลธรรมดา</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>คำนวณภาษีตามอัตราก้าวหน้า ปีภาษี 2569</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            {status === 'saving' && <><Loader2 size={14} className="tx-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
            {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 10, border: '1px solid var(--card-border)' }}>
            {([['self', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).filter(([key]) => showSpouse || key === 'self').map(([key, col, Icon, name]) => (
              <button key={key} onClick={() => setPerson(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: person === key ? `${col}20` : 'transparent', color: person === key ? col : 'var(--text-muted)', fontWeight: person === key ? 600 : 400, fontSize: 13 }}>
                <Icon size={14} />{name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 450px', gap: 20, alignItems: 'start' }}>
        {/* ── Inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', margin: 0 }}>เงินได้พึงประเมิน</p>
              <button onClick={pullFromCashflow} disabled={!pullAllFor(person)} title="ดึงเงินได้ + ค่าลดหย่อน (RMF/ESG/PVD/ประกันสังคม ฯลฯ) จากงบกระแสเงินสดและข้อมูลลูกค้า"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 8, border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', color: 'var(--cyan-light)', fontSize: 12, fontWeight: 600, cursor: pullAllFor(person) ? 'pointer' : 'not-allowed', opacity: pullAllFor(person) ? 1 : 0.5 }}>
                <RefreshCw size={12} /> ดึงจากงบกระแสเงินสด
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 500 }}>
                {/* header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.4fr) 138px 112px 126px', gap: 8, alignItems: 'end', padding: '0 2px 8px', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>ประเภทเงินได้</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>เงินได้</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>ค่าใช้จ่าย</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>เงินหลังค่าใช้จ่าย</span>
                </div>
                {/* rows — แสดงเฉพาะประเภทที่มีรายได้ (ดึงจากที่มาของรายได้) */}
                {visibleIncomeRows.map(r => (
                  <div key={r.sec + r.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.4fr) 138px 112px 126px', gap: 8, alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--divider)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{r.label}</span>
                        <span style={{ fontSize: 10, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 5, padding: '1px 6px', flexShrink: 0 }}>{r.sec}</span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.note}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      {r.prof && (
                        <select value={s.prof40_6type} onChange={e => set('prof40_6type', e.target.value as any)}
                          style={{ padding: '3px 6px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 11, width: 130 }}>
                          <option value="other">อื่นๆ (40%)</option><option value="doctor">แพทย์ (60%)</option>
                        </select>
                      )}
                      <MoneyInput value={r.inc} onChange={v => set(r.key, v as any)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {r.expKey
                        ? <MoneyInput value={Math.round(r.exp)} onChange={v => setExpense(r.expKey!, v)} />
                        : <span style={{ fontSize: 12.5, fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: 12.5, fontFamily: 'monospace', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(r.inc - r.exp)}</div>
                  </div>
                ))}
                {visibleIncomeRows.length === 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '12px 2px' }}>
                    ยังไม่มีรายได้ — เพิ่มได้ที่หน้า “ข้อมูลลูกค้า → ที่มาของรายได้” หรือกด “แสดงทุกประเภท” เพื่อกรอกเอง
                  </div>
                )}
                {/* toggle แสดงทุกประเภท/เฉพาะที่มีรายได้ */}
                <button onClick={() => setShowAllInc(v => !v)}
                  style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan-light)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', padding: '2px 0' }}>
                  {showAllInc ? '− แสดงเฉพาะประเภทที่มีรายได้' : '+ แสดงทุกประเภทเงินได้ (เพื่อกรอกเพิ่มเอง)'}
                </button>
                {/* total */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,1.4fr) 138px 112px 126px', gap: 8, alignItems: 'center', padding: '11px 2px 2px', marginTop: 4, borderTop: '2px solid var(--card-border)' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>รวม</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-primary)' }}>{fmt(totInc)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', color: '#f59e0b' }}>−{fmt(totExp)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right', color: 'var(--cyan-light)' }}>{fmt(totInc - totExp)}</span>
                </div>
              </div>
            </div>
          </div>

          <Sec title="ค่าลดหย่อนส่วนตัว / ครอบครัว">
            <Row label="สถานภาพสมรส">
              <select value={s.maritalStatus} onChange={e => set('maritalStatus', e.target.value as any)}
                style={{ padding: '6px 10px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12.5 }}>
                <option value="single">โสด</option><option value="married">สมรส</option>
              </select>
            </Row>
            {s.maritalStatus === 'married' && (
              <Row label="คู่สมรสมีเงินได้?" hint="ถ้าไม่มี ลดหย่อนคู่สมรส 60,000">
                <input type="checkbox" checked={s.spouseIncome} onChange={e => set('spouseIncome', e.target.checked)} style={{ width: 18, height: 18 }} />
              </Row>
            )}
            <Row label="จำนวนบุตร" hint="คนละ 30,000 (สูงสุด 3)"><input type="number" value={s.children} onChange={e => set('children', Number(e.target.value))} style={cntInp} /></Row>
            <Row label="บิดามารดาในอุปการะ" hint="คนละ 30,000"><input type="number" value={s.parents} onChange={e => set('parents', Number(e.target.value))} style={cntInp} /></Row>
            <Row label="ผู้พิการในอุปการะ" hint="คนละ 60,000"><input type="number" value={s.disabled} onChange={e => set('disabled', Number(e.target.value))} style={cntInp} /></Row>
          </Sec>

          <Sec title="ประกัน / การออมเพื่อเกษียณ">
            {DeductHead}
            {MR('ประกันชีวิต', 'lifeIns', 'สูงสุด 100,000', rem.lifeIns)}
            {MR('ประกันสุขภาพ', 'healthIns', 'สูงสุด 25,000 (รวมชีวิต ≤100,000)', rem.healthIns)}
            {MR('ประกันสุขภาพบิดามารดา', 'parentHealthIns', 'สูงสุด 15,000', rem.parentHealthIns)}
            {MR('ประกันสังคม', 'socialSec', 'สูงสุด 10,500', rem.socialSec)}
            {MR('RMF', 'rmf', '≤30% เงินได้', rem.rmf)}
            {MR('ประกันบำนาญ', 'annuityIns', '≤15% เงินได้, ≤200,000', rem.annuityIns)}
            {MR('กองทุนสำรองเลี้ยงชีพ (PVD)', 'pvd', undefined, rem.pvd)}
            {MR('กบข./GPF', 'govPension', undefined, rem.govPension)}
            {MR('กอช./NSF', 'nsf', 'สูงสุด 30,000', rem.nsf)}
            {MR('Thai ESG', 'thaiesg', '≤30% เงินได้, ≤300,000', rem.thaiesg)}
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>* RMF+บำนาญ+PVD+กบข.+กอช. รวมกันไม่เกิน 500,000 · "เพิ่มได้อีก" คิดเพดานกลุ่มแล้ว</div>
          </Sec>

          <Sec title="กระตุ้นเศรษฐกิจ / บริจาค">
            {DeductHead}
            {MR('ดอกเบี้ยกู้ซื้อบ้าน', 'mortgage', 'สูงสุด 100,000', rem.mortgage)}
            {MR('Easy E-Receipt', 'easyReceipt', 'สูงสุด 50,000', rem.easyReceipt)}
            {MR('ช้อปดีมีคืน', 'shopDee', 'สูงสุด 50,000', rem.shopDee)}
            {MR('OTOP/สินค้าชุมชน', 'otop', 'สูงสุด 10,000', rem.otop)}
            {MR('เงินบริจาคทั่วไป', 'donation', 'หัก 2 เท่า, ≤10% เงินได้สุทธิ', rem.donation)}
            {MR('บริจาคการศึกษา/กีฬา', 'eduDonation', '≤10% เงินได้สุทธิ', rem.eduDonation)}
            {MR('บริจาคพรรคการเมือง', 'politicalDonate', 'สูงสุด 10,000', rem.politicalDonate)}
            {MR('ค่าซื้อบ้านหลังใหม่', 'newHome', 'หัก 0.5%, สูงสุด 100,000')}
          </Sec>

          <Sec title="ภาษีที่ชำระล่วงหน้า">
            {M('ภาษีหัก ณ ที่จ่าย / ชำระแล้ว', 'prepaid')}
          </Sec>
        </div>

        {/* ── Results (sticky) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>
          <div style={{ ...card, background: 'linear-gradient(160deg, var(--cyan-dim), var(--card-bg) 60%)', border: '1.5px solid var(--cyan)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ภาษีที่ต้องชำระ (สุทธิ)</p>
            <p style={{ fontSize: 30, fontWeight: 800, color: 'var(--cyan)', fontFamily: 'monospace', margin: '4px 0' }}>{fmt(c.netTax)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span></p>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>≈ {fmt(c.mth)} บาท/เดือน · ภาษีก่อนหัก {fmt(c.tax)}</p>
          </div>

          {hasPlanned && (
            <div style={{ ...card, border: '1.5px solid #22c55e', background: 'linear-gradient(160deg, rgba(34,197,94,0.10), var(--card-bg) 60%)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ภาษีหลังวางแผน (สุทธิ)</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace', margin: '4px 0' }}>{fmt(cP.netTax)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span></p>
              <p style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                {c.netTax - cP.netTax > 0
                  ? <>ประหยัดภาษีได้ <b style={{ color: '#22c55e', fontFamily: 'monospace' }}>{fmt(c.netTax - cP.netTax)}</b> บาท/ปี · ลดหย่อนเพิ่ม {fmt(cP.allD - c.allD)} บาท</>
                  : 'ยังไม่ลดลง — ลองเพิ่มค่าลดหย่อนในคอลัมน์ "หลังวางแผน"'}
              </p>
            </div>
          )}

          <Sec title="สรุป">
            {hasPlanned && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px 96px', gap: 8, padding: '0 0 5px', borderBottom: '1px solid var(--card-border)', marginBottom: 4 }}>
                <span />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>ปัจจุบัน</span>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, textAlign: 'right' }}>หลังวางแผน</span>
              </div>
            )}
            {([
              ['เงินได้พึงประเมินรวม', fmt(c.ti), fmt(cP.ti), 'var(--text-primary)'],
              ['หักค่าใช้จ่าย', `−${fmt(c.expD)}`, `−${fmt(cP.expD)}`, 'var(--text-secondary)'],
              ['หักค่าลดหย่อนรวม', `−${fmt(c.perD + c.insD + c.savD + c.spendD)}`, `−${fmt(cP.perD + cP.insD + cP.savD + cP.spendD)}`, 'var(--text-secondary)'],
              ['เงินได้สุทธิ (ฐานภาษี)', fmt(c.ni), fmt(cP.ni), 'var(--cyan-light)'],
              ['ภาษีที่ต้องชำระ', fmt(c.netTax), fmt(cP.netTax), '#f59e0b'],
              ['อัตราภาษีขั้นสูงสุด', `${c.mr}%`, `${cP.mr}%`, '#f59e0b'],
              ['อัตราภาษีเฉลี่ย', `${c.eff.toFixed(2)}%`, `${cP.eff.toFixed(2)}%`, '#f59e0b'],
            ] as const).map(([l, cur, plan, col], i) => (
              hasPlanned ? (
                <div key={l} style={{ display: 'grid', gridTemplateColumns: '1fr 96px 96px', gap: 8, alignItems: 'baseline', padding: '3px 0', borderTop: i === 3 ? '1px solid var(--card-border)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l}</span>
                  <b style={{ fontFamily: 'monospace', color: col, textAlign: 'right', fontSize: 12 }}>{cur}</b>
                  <b style={{ fontFamily: 'monospace', color: plan !== cur ? '#22c55e' : 'var(--text-muted)', textAlign: 'right', fontSize: 12 }}>{plan}</b>
                </div>
              ) : (
                <div key={l} style={{ borderTop: i === 3 ? '1px solid var(--card-border)' : 'none', paddingTop: i === 3 ? 4 : 0 }}>
                  <Row label={l}><b style={{ fontFamily: 'monospace', color: col }}>{cur}</b></Row>
                </div>
              )
            ))}
            {hasPlanned && c.netTax - cP.netTax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0 0', marginTop: 4, borderTop: '1px solid var(--card-border)', fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>ประหยัดภาษีได้</span>
                <b style={{ fontFamily: 'monospace', color: '#22c55e' }}>{fmt(c.netTax - cP.netTax)} บาท/ปี</b>
              </div>
            )}
          </Sec>

          <Sec title="ภาษีแต่ละขั้น">
            {hasPlanned && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, padding: '0 0 5px', borderBottom: '1px solid var(--card-border)', marginBottom: 3 }}>
                <span />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>ปัจจุบัน</span>
                <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, textAlign: 'right' }}>หลังวางแผน</span>
              </div>
            )}
            {BRACKETS.map((b, i) => {
              const filled = c.ni > b.min ? Math.min(c.ni, b.max) - b.min : 0
              const filledP = cP.ni > b.min ? Math.min(cP.ni, b.max) - b.min : 0
              if (filled <= 0 && filledP <= 0 && b.rate > 0) return null
              const tCur = filled * b.rate, tPlan = filledP * b.rate
              return hasPlanned ? (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, alignItems: 'center', fontSize: 11.5, padding: '3px 0', color: 'var(--text-secondary)' }}>
                  <span>{b.rate === 0 ? 'ยกเว้น' : `${b.rate * 100}%`} · {fmt(b.min)}–{b.max > 5e9 ? '∞' : fmt(b.max)}</span>
                  <span style={{ fontFamily: 'monospace', textAlign: 'right', color: tCur > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{fmt(tCur)}</span>
                  <span style={{ fontFamily: 'monospace', textAlign: 'right', color: tPlan !== tCur ? '#22c55e' : 'var(--text-muted)' }}>{fmt(tPlan)}</span>
                </div>
              ) : (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0', color: 'var(--text-secondary)' }}>
                  <span>{b.rate === 0 ? 'ยกเว้น' : `${b.rate * 100}%`} · {fmt(b.min)}–{b.max > 5e9 ? '∞' : fmt(b.max)}</span>
                  <span style={{ fontFamily: 'monospace', color: tCur > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{fmt(tCur)}</span>
                </div>
              )
            })}
            {hasPlanned ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, alignItems: 'center', fontSize: 12, padding: '5px 0 0', marginTop: 3, borderTop: '1px solid var(--card-border)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>ภาษีรวม</span>
                <b style={{ fontFamily: 'monospace', textAlign: 'right', color: '#f59e0b' }}>{fmt(c.tax)}</b>
                <b style={{ fontFamily: 'monospace', textAlign: 'right', color: '#22c55e' }}>{fmt(cP.tax)}</b>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0 0', marginTop: 3, borderTop: '1px solid var(--card-border)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>ภาษีรวม</span>
                <b style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{fmt(c.tax)}</b>
              </div>
            )}
          </Sec>

          {(c.deducts.length > 0 || cP.deducts.length > 0) && (
            <Sec title="รายการลดหย่อน">
              {hasPlanned && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, padding: '0 0 5px', borderBottom: '1px solid var(--card-border)', marginBottom: 3 }}>
                  <span />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textAlign: 'right' }}>ปัจจุบัน</span>
                  <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, textAlign: 'right' }}>หลังวางแผน</span>
                </div>
              )}
              {(() => {
                // รวมรายการจากทั้งสองกรณี (บางรายการมีเฉพาะหลังวางแผน)
                const items = hasPlanned
                  ? cP.deducts.map(dp => ({ ...dp, cur: c.deducts.find(d => d.l === dp.l)?.v ?? 0, plan: dp.v }))
                      .concat(c.deducts.filter(d => !cP.deducts.some(dp => dp.l === d.l)).map(d => ({ ...d, cur: d.v, plan: 0 })))
                  : c.deducts.map(d => ({ ...d, cur: d.v, plan: d.v }))
                return items.map((d, i) => (
                  hasPlanned ? (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, alignItems: 'center', fontSize: 11.5, padding: '3px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.c, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.l}</span>
                      </span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>{d.cur > 0 ? fmt(d.cur) : '—'}</span>
                      <span style={{ fontFamily: 'monospace', color: d.plan !== d.cur ? '#22c55e' : 'var(--text-muted)', textAlign: 'right' }}>{d.plan > 0 ? fmt(d.plan) : '—'}</span>
                    </div>
                  ) : (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, padding: '3px 0' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.c }} />{d.l}
                      </span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{fmt(d.cur)}</span>
                    </div>
                  )
                ))
              })()}
              {hasPlanned && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 82px', gap: 8, alignItems: 'center', fontSize: 12, padding: '5px 0 0', marginTop: 3, borderTop: '1px solid var(--card-border)', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-primary)' }}>รวมลดหย่อน</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', textAlign: 'right' }}>{fmt(c.allD - c.expD)}</span>
                  <span style={{ fontFamily: 'monospace', color: '#22c55e', textAlign: 'right' }}>{fmt(cP.allD - cP.expD)}</span>
                </div>
              )}
            </Sec>
          )}
        </div>
      </div>
    </div>
  )
}

const cntInp: React.CSSProperties = { width: 70, padding: '6px 9px', textAlign: 'center', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)', fontSize: 13, fontWeight: 500, outline: 'none' }
