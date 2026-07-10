import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { ChartFrame, TableExcelButton } from '../../components/exportable'
import { Shield, Check, Loader2 } from 'lucide-react'
import { useIsCompact } from '../../hooks/useViewport'
import { card } from '../../styles/dark'

/* ── helpers ── */
const fmt = (n: number, d = 2) =>
  isFinite(n) && !isNaN(n)
    ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '-'
const fmtK = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

interface Row {
  age: number
  base: number
  empOpen: number; empRet: number; empEnd: number
  erOpen: number;  erRet: number;  erEnd: number
  govOpen: number; govRet: number; govEnd: number
  carry: number
  total: number
}

/* ── small editable inputs ── */
function NumIn({ value, onChange, suffix, width = 120, money = false }: {
  value: number; onChange: (v: number) => void; suffix?: string; width?: number; money?: boolean
}) {
  const [text, setText] = useState(money ? (value ? value.toLocaleString('en-US') : '') : '')
  useEffect(() => { if (money) setText(value ? value.toLocaleString('en-US') : '') }, [value, money])
  const style: React.CSSProperties = {
    width, padding: '6px 10px', textAlign: 'right',
    background: 'var(--navy-900)', border: '1px solid var(--card-border)',
    borderRadius: 6, color: 'var(--cyan)', fontSize: 13, fontWeight: 500, outline: 'none',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {money ? (
        <input
          type="text" inputMode="numeric" value={text}
          onChange={e => {
            const raw = e.target.value.replace(/,/g, '')
            if (raw === '') { setText(''); onChange(0); return }
            if (!/^\d+$/.test(raw)) return
            const n = Number(raw)
            setText(n.toLocaleString('en-US'))
            onChange(n)
          }}
          style={style}
        />
      ) : (
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} style={style} />
      )}
      {suffix && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 56 }}>{suffix}</span>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  )
}

export default function ProjectionSocialSecurityTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const compact = useIsCompact()
  const isSelf = person === 'self'
  const qc = useQueryClient()
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
  const { data: invProfile } = useQuery({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })

  // มูลค่ากองทุนประกันสังคม จาก "ข้อมูลสินทรัพย์ลงทุน" (จับรายการที่ชื่อ/ประเภทสื่อถึงประกันสังคม)
  const ssInvSrc = isSelf ? invProfile : (invProfile?.spouseData ?? {})
  const ssoAssetValue = useMemo(() => {
    const list: any[] = ssInvSrc?.investmentAssets ?? []
    const isSso = (a: any) => /ประกันสังคม|สปส|social\s*security|sso/i.test(`${a?.assetName ?? ''} ${a?.assetClass ?? ''}`)
    return list.filter(isSso).reduce((s, a) => s + (parseFloat(String(a?.currentValue ?? '').replace(/,/g, '')) || 0), 0)
  }, [ssInvSrc])

  // ── Assumptions (editable, auto-filled from profile) ──
  const [salary, setSalary] = useState(15000)
  const [baseOverrides, setBaseOverrides] = useState<Record<number, number>>({})
  const [empRate, setEmpRate] = useState(3)
  const [employerRate, setEmployerRate] = useState(3)
  const [govRate, setGovRate] = useState(1)
  const [returnRate, setReturnRate] = useState(3.19)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [currentAge, setCurrentAge] = useState(45)
  const [retirementAge, setRetirementAge] = useState(60)

  // ── Pension assumptions ──
  const [startContribAge, setStartContribAge] = useState(30)
  const [discountRate, setDiscountRate] = useState(4)

  // จำนวนปีรับบำนาญ (n) = อายุขัย − อายุเกษียณ (อายุขัยจากหน้าตั้งค่า)
  const lifeExpectancy = (isSelf ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? 85
  const pensionYears = Math.max(0, lifeExpectancy - retirementAge)

  const filled = useMemo(() => ({ s: false, a: false, ret: false, rate: false, disc: false }), [])
  useEffect(() => {
    if (!clientProfile) return
    const spouseJob = Array.isArray(clientProfile.spouseJobs) ? clientProfile.spouseJobs[0] : null
    const salaryVal = isSelf ? clientProfile.salary : (spouseJob?.salary ?? clientProfile.spouseIncome)
    const ageVal = isSelf
      ? (clientProfile.birthDate ? new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear() : null)
      : (clientProfile.spouseAge ?? null)
    if (!filled.s && salaryVal != null) { setSalary(toNum(salaryVal)); filled.s = true }
    if (!filled.a && ageVal && ageVal > 0) { setCurrentAge(ageVal); filled.a = true }
  }, [clientProfile])
  useEffect(() => {
    if (!profile) return
    const retAge = isSelf ? profile.retirementAgeSelf : profile.retirementAgeSpouse
    if (!filled.ret && retAge) { setRetirementAge(retAge); filled.ret = true }
    if (!filled.rate && profile.ssoReturnRate != null) { setReturnRate(profile.ssoReturnRate); filled.rate = true }
    if (!filled.disc && profile.postRetirementReturn != null) { setDiscountRate(profile.postRetirementReturn); filled.disc = true }
  }, [profile])

  // ── Load saved SSO plan once (saved values win over auto-fill) ──
  const loadedRef = useRef(false)
  const { data: savedPlan, isFetched } = useQuery({
    queryKey: ['sso-plan'],
    queryFn: () => api.get('/sso-plan').then(r => r.data),
    retry: false,
  })
  // full saved object {self, spouse}; this person's slice = savedPlan?.[person]
  const fullSavedRef = useRef<any>(null)
  fullSavedRef.current = savedPlan ?? {}
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    const p = savedPlan?.[person]
    if (p) {
      // restore ONLY manually-entered fields; salary/age/rates always auto-fill from source
      if (p.baseOverrides) setBaseOverrides(p.baseOverrides)
      if (Number(p.openingBalance) > 0) setOpeningBalance(p.openingBalance)
      if (p.startContribAge != null) setStartContribAge(p.startContribAge)
    }
    loadedRef.current = true
  }, [isFetched, savedPlan])

  // ── ดึง "ยอดยกมา" จากมูลค่ากองทุนประกันสังคมในสินทรัพย์ลงทุน (เฉพาะเมื่อยังไม่มีค่าที่บันทึกไว้) ──
  const obFilledRef = useRef(false)
  useEffect(() => {
    if (obFilledRef.current || !isFetched) return
    const p = savedPlan?.[person]
    if (p && Number(p.openingBalance) > 0) { obFilledRef.current = true; return } // เคยกรอกเอง → ค่าเดิมชนะ
    if (ssoAssetValue > 0) { setOpeningBalance(ssoAssetValue); obFilledRef.current = true }
  }, [isFetched, savedPlan, ssoAssetValue, person])

  // ── Debounced autosave + flush on unmount (per-person slice, merged) ──
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  function persist(values: any) {
    const merged = { ...(fullSavedRef.current ?? {}), [person]: values }
    fullSavedRef.current = merged
    qc.setQueryData(['sso-plan'], merged)
    return api.put('/sso-plan', merged)
  }
  const save = useMutation({
    mutationFn: (values: any) => persist(values),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: (e: any) => { console.error('[sso-plan save]', e?.response?.data ?? e?.message); setStatus('idle') },
  })
  const valuesRef = useRef<any>(null)
  valuesRef.current = { salary, baseOverrides, empRate, employerRate, govRate, returnRate, openingBalance, currentAge, retirementAge, startContribAge, discountRate }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate(valuesRef.current), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [salary, baseOverrides, empRate, employerRate, govRate, returnRate, openingBalance, currentAge, retirementAge, startContribAge, discountRate])
  useEffect(() => {
    return () => {
      if (loadedRef.current && valuesRef.current) {
        persist(valuesRef.current).catch(() => {})
      }
    }
  }, [])

  // Default contribution-base ceiling steps up over time (17,500 → 20,000 @ +3y → 23,000 @ +6y)
  const defaultCeiling = (offset: number) => offset >= 6 ? 23000 : offset >= 3 ? 20000 : 17500

  // ── Build projection ──
  const rows = useMemo<Row[]>(() => {
    const baseFor = (age: number) => baseOverrides[age] ?? Math.min(salary, defaultCeiling(age - currentAge))
    const out: Row[] = []
    const rr = returnRate / 100
    let empBal = 0, erBal = 0, govBal = 0, carry = openingBalance
    for (let age = currentAge; age <= retirementAge; age++) {
      const base = baseFor(age)
      const empC = base * (empRate / 100) * 12
      const erC = base * (employerRate / 100) * 12
      const govC = base * (govRate / 100) * 12
      const empOpen = empBal + empC, empRet = empOpen * rr, empEnd = empOpen + empRet
      const erOpen = erBal + erC,    erRet = erOpen * rr,   erEnd = erOpen + erRet
      const govOpen = govBal + govC, govRet = govOpen * rr, govEnd = govOpen + govRet
      carry = carry * (1 + rr)
      const total = empEnd + erEnd + govEnd + carry
      out.push({ age, base, empOpen, empRet, empEnd, erOpen, erRet, erEnd, govOpen, govRet, govEnd, carry, total })
      empBal = empEnd; erBal = erEnd; govBal = govEnd
    }
    return out
  }, [salary, baseOverrides, empRate, employerRate, govRate, returnRate, openingBalance, currentAge, retirementAge])

  const base = rows.length ? rows[0].base : Math.min(salary, 17500)
  const monthlyContrib = base * ((empRate + employerRate + govRate) / 100)
  const valueAtRetirement = rows.length ? rows[rows.length - 1].total : 0

  // Pension base = contribution base (เงินเดือน) at retirement year, from the table
  const pensionBase = rows.length ? rows[rows.length - 1].base : Math.min(salary, 17500)

  // ── Pension calculation (เงินบำนาญ) ──
  const pension = useMemo(() => {
    const N = Math.max(0, Math.round((retirementAge - startContribAge) * 12))
    const eligible = N >= 180
    const ratePct = eligible ? 20 + ((N - 180) / 12) * 1.5 : 0
    const monthly = (ratePct / 100) * pensionBase
    const annual = monthly * 12
    const i = discountRate / 100
    const n = pensionYears
    const factor = i === 0 ? n : (1 - Math.pow(1 + i, -n)) / i
    const pv = annual * factor
    return { N, eligible, ratePct, monthly, annual, pv }
  }, [retirementAge, startContribAge, pensionBase, pensionYears, discountRate])

  // เก็บ "มูลค่าปัจจุบัน ณ เกษียณ" (บำนาญ) ไว้ในข้อมูลที่บันทึก เพื่อให้การ์ดสรุปแผนเกษียณดึงไปใช้
  valuesRef.current = { ...valuesRef.current, pensionPV: pension.pv }

  const chartData = rows.map(r => ({
    age: r.age,
    emp: r.empEnd, er: r.erEnd, gov: r.govEnd, carry: r.carry, total: r.total,
  }))

  const C_EMP = '#06b6d4', C_ER = '#22c55e', C_GOV = '#f59e0b', C_CARRY = '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Shield size={15} color="var(--cyan)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>มูลค่ากองทุนประกันสังคม</p>
        <style>{`@keyframes sso-spin { to { transform: rotate(360deg) } } .sso-spin { animation: sso-spin 0.9s linear infinite }`}</style>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          {status === 'saving' && <><Loader2 size={14} className="sso-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
          {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
        </div>
      </div>

      {/* บำเหน็จ + บำนาญ (สองคอลัมน์ระนาบเดียวกัน) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, alignItems: 'stretch' }}>

      {/* ── เงินบำเหน็จชราภาพ ── */}
      <div style={{ ...card }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>เงินบำเหน็จชราภาพ</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ฐานเงินเดือนสมทบ</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: 'var(--cyan)' }}>{fmt(base, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--divider)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>เงินสมทบ/เดือน</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: 'var(--cyan)' }}>{fmt(monthlyContrib, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 0', marginTop: 4, borderTop: '1px solid var(--card-border)', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>เงินบำเหน็จชราภาพ</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{fmt(valueAtRetirement, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</span></span>
        </div>
      </div>

      {/* ── เงินบำนาญประกันสังคม ── */}
      <div style={{ ...card }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>เงินบำนาญประกันสังคม</p>

        {!pension.eligible && (
          <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 12 }}>
            ⚠ ส่งสมทบ {pension.N} เดือน ({(pension.N / 12).toFixed(1)} ปี) — ไม่ถึงเกณฑ์ 180 เดือน (15 ปี) จึงได้รับ "บำเหน็จ" แทนบำนาญ
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>บำนาญที่ได้รับ</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: 'var(--cyan-light)' }}>{fmt(pension.monthly, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท/เดือน</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--divider)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>บำนาญที่ได้รับ</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#f59e0b' }}>{fmt(pension.annual, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท/ปี</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0 0', marginTop: 4, borderTop: '1px solid var(--card-border)', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>มูลค่าปัจจุบัน ณ เกษียณ</span>
          <span><span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{fmt(pension.pv, 0)}</span> <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</span></span>
        </div>
      </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '300px 1fr', gap: 20, alignItems: 'stretch' }}>

        {/* Assumptions */}
        <div style={{ ...card }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', marginBottom: 10 }}>สมมติฐาน</p>
          <Field label="เงินเดือนปัจจุบัน"><NumIn value={salary} onChange={setSalary} suffix="บาท/เดือน" money /></Field>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '2px 0 4px', lineHeight: 1.5 }}>
            ฐานสมทบ (เพดาน) ปรับขั้นบันได: 17,500 → 20,000 (อีก 3 ปี) → 23,000 (อีก 6 ปี) · แก้ไขรายปีได้ในตาราง
          </div>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="ลูกจ้างสมทบ"><NumIn value={empRate} onChange={setEmpRate} suffix="%" width={70} /></Field>
          <Field label="นายจ้างสมทบ"><NumIn value={employerRate} onChange={setEmployerRate} suffix="%" width={70} /></Field>
          <Field label="รัฐบาลสมทบ"><NumIn value={govRate} onChange={setGovRate} suffix="%" width={70} /></Field>
          <Field label="อัตราผลตอบแทน"><NumIn value={returnRate} onChange={setReturnRate} suffix="% ต่อปี" width={70} /></Field>
          {profile?.ssoReturnAsOf && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
              {profile.ssoReturnAsOf} · ตั้งค่าได้ที่หน้า "ตั้งค่า → กองทุนประกันสังคม"
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="ยอดยกมา"><NumIn value={openingBalance} onChange={setOpeningBalance} suffix="บาท" money /></Field>
          {ssoAssetValue > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
              ดึงจากมูลค่ากองทุนประกันสังคมในข้อมูลสินทรัพย์ลงทุน ({fmt(ssoAssetValue)} บาท) · พิมพ์ทับเพื่อปรับได้
            </div>
          )}
          <Field label="อายุปัจจุบัน"><NumIn value={currentAge} onChange={setCurrentAge} suffix="ปี" width={70} /></Field>
          <Field label="อายุเกษียณ"><NumIn value={retirementAge} onChange={setRetirementAge} suffix="ปี" width={70} /></Field>
        </div>

        {/* Chart — stretches to match assumptions height (equal bottom edge) */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            มูลค่ากองทุนประกันสังคมสะสม (บาท)
          </p>
          <ChartFrame title="มูลค่ากองทุนประกันสังคมสะสม" filename="social-security" height={320}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="age" tickFormatter={v => `${v}`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={56} />
                <Tooltip
                  formatter={(v: any, n: any) => [`${fmt(v, 0)} บาท`, n]}
                  labelFormatter={a => `อายุ ${a} ปี`}
                  contentStyle={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={retirementAge} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'เกษียณ', fill: '#f59e0b', fontSize: 11, position: 'insideTopLeft' }} />
                <Bar dataKey="emp"   name="ส่วนลูกจ้าง" stackId="a" fill={C_EMP} />
                <Bar dataKey="er"    name="ส่วนนายจ้าง" stackId="a" fill={C_ER} />
                <Bar dataKey="gov"   name="ส่วนรัฐ" stackId="a" fill={C_GOV} />
                <Bar dataKey="carry" name="ยอดยกมา" stackId="a" fill={C_CARRY} />
                <Line type="monotone" dataKey="total" name="รวมสิ้นปี" stroke="#fff" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>ตารางการคำนวณปีต่อปี</p>
          <TableExcelButton filename="ตารางประกันสังคม" title="ประกันสังคม" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              <th rowSpan={2} style={thBase}>อายุ</th>
              <th rowSpan={2} style={thBase}>เงินเดือน</th>
              <th colSpan={3} style={{ ...thGroup, color: C_EMP }}>ส่วนสะสมลูกจ้าง</th>
              <th colSpan={3} style={{ ...thGroup, color: C_ER }}>ส่วนสมทบนายจ้าง</th>
              <th colSpan={3} style={{ ...thGroup, color: C_GOV }}>ส่วนสมทบรัฐ</th>
              <th rowSpan={2} style={{ ...thBase, color: 'var(--text-primary)', fontWeight: 700 }}>รวมสิ้นปี</th>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              {['ต้นงวด', 'ผลตอบแทน', 'เงินสะสม', 'ต้นงวด', 'ผลตอบแทน', 'เงินสะสม', 'ต้นงวด', 'ผลตอบแทน', 'เงินสะสม'].map((h, i) => (
                <th key={i} style={thSub}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {openingBalance > 0 && (
              <tr style={{ borderBottom: '1px solid var(--divider)', background: 'var(--hover)' }}>
                <td style={td} colSpan={11}>ยอดยกมา</td>
                <td style={{ ...tdNum, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(openingBalance)}</td>
              </tr>
            )}
            {rows.map(r => {
              const isRetire = r.age === retirementAge
              return (
                <tr key={r.age} style={{ borderBottom: '1px solid var(--divider)', background: isRetire ? 'rgba(245,158,11,0.07)' : 'transparent' }}>
                  <td style={{ ...td, fontWeight: isRetire ? 700 : 400, color: isRetire ? '#f59e0b' : 'var(--text-secondary)' }}>{r.age}{isRetire && ' ⭐'}</td>
                  <td style={{ ...tdNum, padding: '3px 6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <NumIn value={r.base} onChange={v => setBaseOverrides(o => ({ ...o, [r.age]: v }))} money width={88} />
                    </div>
                  </td>
                  <td style={tdNum}>{fmt(r.empOpen)}</td><td style={tdNum}>{fmt(r.empRet)}</td><td style={{ ...tdNum, color: C_EMP }}>{fmt(r.empEnd)}</td>
                  <td style={tdNum}>{fmt(r.erOpen)}</td><td style={tdNum}>{fmt(r.erRet)}</td><td style={{ ...tdNum, color: C_ER }}>{fmt(r.erEnd)}</td>
                  <td style={tdNum}>{fmt(r.govOpen)}</td><td style={tdNum}>{fmt(r.govRet)}</td><td style={{ ...tdNum, color: C_GOV }}>{fmt(r.govEnd)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: isRetire ? '#f59e0b' : 'var(--text-primary)' }}>{fmt(r.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thBase: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, verticalAlign: 'bottom' }
const thGroup: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, borderLeft: '1px solid var(--card-border)' }
const thSub: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }
const tdNum: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }
