import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { ChartFrame, TableExcelButton } from '../../components/exportable'
import { Briefcase, Check, Loader2 } from 'lucide-react'
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
  salary: number
  empOpen: number; empRet: number; empEnd: number
  erOpen: number;  erRet: number;  erEnd: number
  carry: number
  total: number
}

function NumIn({ value, onChange, suffix, width = 110, money = false }: {
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
        <input type="text" inputMode="numeric" value={text}
          onChange={e => {
            const raw = e.target.value.replace(/,/g, '')
            if (raw === '') { setText(''); onChange(0); return }
            if (!/^\d+$/.test(raw)) return
            const n = Number(raw); setText(n.toLocaleString('en-US')); onChange(n)
          }} style={style} />
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

export default function ProjectionPVDTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
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

  // มูลค่ากองทุนสำรองเลี้ยงชีพ จาก "ข้อมูลสินทรัพย์ลงทุน" (จับรายการที่ชื่อ/ประเภทสื่อถึง PVD/กบข)
  const invSrc = isSelf ? invProfile : (invProfile?.spouseData ?? {})
  const pvdAssetValue = useMemo(() => {
    const list: any[] = invSrc?.investmentAssets ?? []
    const isPvd = (a: any) => /สำรองเลี้ยงชีพ|กบข|provident|pvd/i.test(`${a?.assetName ?? ''} ${a?.assetClass ?? ''}`)
    return list.filter(isPvd).reduce((s, a) => s + (parseFloat(String(a?.currentValue ?? '').replace(/,/g, '')) || 0), 0)
  }, [invSrc])

  // ── Assumptions (editable, auto-filled) ──
  const [salary, setSalary] = useState(30000)
  const [raiseRate, setRaiseRate] = useState(3)
  const [empRate, setEmpRate] = useState(5)
  const [employerRate, setEmployerRate] = useState(5)
  const [returnOverride, setReturnOverride] = useState<number | null>(null)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [currentAge, setCurrentAge] = useState(45)
  const [retirementAge, setRetirementAge] = useState(60)

  // อัตราผลตอบแทน: อิงจาก "ตั้งค่า → กองทุนสำรองเลี้ยงชีพ" เสมอ (พิมพ์ทับเพื่อทดลองได้)
  const returnRate = returnOverride ?? (profile?.pvdReturnRate ?? 4)

  const filled = useMemo(() => ({ s: false, raise: false, emp: false, er: false, a: false, ret: false }), [])
  useEffect(() => {
    if (!clientProfile) return
    const spouseJob = Array.isArray(clientProfile.spouseJobs) ? clientProfile.spouseJobs[0] : null
    const salaryVal = isSelf ? clientProfile.salary : (spouseJob?.salary ?? clientProfile.spouseIncome)
    const raiseVal = isSelf ? clientProfile.salaryIncreaseRate : spouseJob?.salaryIncreaseRate
    const ageVal = isSelf
      ? (clientProfile.birthDate ? new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear() : null)
      : (clientProfile.spouseAge ?? null)
    if (!filled.s && salaryVal != null) { setSalary(toNum(salaryVal)); filled.s = true }
    if (!filled.raise && raiseVal != null) { setRaiseRate(toNum(raiseVal)); filled.raise = true }
    if (isSelf) {
      if (!filled.emp && clientProfile.pvdEmployeeRate != null) { setEmpRate(toNum(clientProfile.pvdEmployeeRate)); filled.emp = true }
      if (!filled.er && clientProfile.pvdEmployerRate != null) { setEmployerRate(toNum(clientProfile.pvdEmployerRate)); filled.er = true }
    }
    if (!filled.a && ageVal && ageVal > 0) { setCurrentAge(ageVal); filled.a = true }
  }, [clientProfile])
  useEffect(() => {
    if (!profile) return
    const retAge = isSelf ? profile.retirementAgeSelf : profile.retirementAgeSpouse
    if (!filled.ret && retAge) { setRetirementAge(retAge); filled.ret = true }
  }, [profile])

  // ── Load saved PVD plan once (saved values win over auto-fill) ──
  const loadedRef = useRef(false)
  const { data: savedPlan, isFetched } = useQuery({
    queryKey: ['pvd-plan'],
    queryFn: () => api.get('/pvd-plan').then(r => r.data),
    retry: false,
  })
  const fullSavedRef = useRef<any>(null)
  fullSavedRef.current = savedPlan ?? {}
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    const p = savedPlan?.[person]
    if (p) {
      // restore ONLY manually-entered fields; salary/age/rates always auto-fill from source
      if (p.returnOverride != null) setReturnOverride(p.returnOverride)
      if (Number(p.openingBalance) > 0) setOpeningBalance(p.openingBalance)
    }
    loadedRef.current = true
  }, [isFetched, savedPlan])

  // ── ดึง "ยอดยกมา" จากมูลค่ากองทุน PVD ในสินทรัพย์ลงทุน (เฉพาะเมื่อยังไม่มีค่าที่บันทึกไว้) ──
  const obFilledRef = useRef(false)
  useEffect(() => {
    if (obFilledRef.current || !isFetched) return
    const p = savedPlan?.[person]
    // ถือว่า > 0 = ผู้ใช้เคยกรอกเอง → ค่าเดิมชนะ; ถ้าเป็น 0/ว่าง = ยังไม่ได้กรอก → ดึงจากสินทรัพย์
    if (p && Number(p.openingBalance) > 0) { obFilledRef.current = true; return }
    if (pvdAssetValue > 0) { setOpeningBalance(pvdAssetValue); obFilledRef.current = true }
  }, [isFetched, savedPlan, pvdAssetValue, person])

  // ── Debounced autosave + flush on unmount (per-person slice, merged) ──
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  function persist(values: any) {
    const merged = { ...(fullSavedRef.current ?? {}), [person]: values }
    fullSavedRef.current = merged
    qc.setQueryData(['pvd-plan'], merged)
    return api.put('/pvd-plan', merged)
  }
  const save = useMutation({
    mutationFn: (values: any) => persist(values),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: (e: any) => { console.error('[pvd-plan save]', e?.response?.data ?? e?.message); setStatus('idle') },
  })
  // Keep latest values in a ref so we can flush on unmount
  const valuesRef = useRef<any>(null)
  valuesRef.current = { salary, raiseRate, empRate, employerRate, returnOverride, openingBalance, currentAge, retirementAge }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate(valuesRef.current), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [salary, raiseRate, empRate, employerRate, returnOverride, openingBalance, currentAge, retirementAge])

  // Flush the latest values immediately when leaving the tab/page (debounce may not have fired)
  useEffect(() => {
    return () => {
      if (loadedRef.current && valuesRef.current) {
        persist(valuesRef.current).catch(() => {})
      }
    }
  }, [])

  // ── Build projection ──
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    const rr = returnRate / 100
    const g = raiseRate / 100
    let empBal = 0, erBal = 0, carry = openingBalance
    for (let age = currentAge; age <= retirementAge; age++) {
      const yearSalary = salary * Math.pow(1 + g, age - currentAge)
      const empC = yearSalary * (empRate / 100) * 12
      const erC = yearSalary * (employerRate / 100) * 12
      const empOpen = empBal + empC, empRet = empOpen * rr, empEnd = empOpen + empRet
      const erOpen = erBal + erC,    erRet = erOpen * rr,   erEnd = erOpen + erRet
      carry = carry * (1 + rr)
      const total = empEnd + erEnd + carry
      out.push({ age, salary: yearSalary, empOpen, empRet, empEnd, erOpen, erRet, erEnd, carry, total })
      empBal = empEnd; erBal = erEnd
    }
    return out
  }, [salary, raiseRate, empRate, employerRate, returnRate, openingBalance, currentAge, retirementAge])

  const monthlyContrib = salary * ((empRate + employerRate) / 100)
  const valueAtRetirement = rows.length ? rows[rows.length - 1].total : 0
  // เก็บ "มูลค่ากองทุน ณ ปีเกษียณ" ไว้ในข้อมูลที่บันทึก เพื่อให้การ์ดสรุปแผนเกษียณดึงไปใช้
  valuesRef.current = { ...valuesRef.current, valueAtRetirement }

  const chartData = rows.map(r => ({ age: r.age, emp: r.empEnd, er: r.erEnd, carry: r.carry, total: r.total }))

  const C_EMP = '#06b6d4', C_ER = '#22c55e', C_CARRY = '#94a3b8'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <style>{`@keyframes pvd-spin { to { transform: rotate(360deg) } } .pvd-spin { animation: pvd-spin 0.9s linear infinite }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Briefcase size={15} color="var(--cyan)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>มูลค่ากองทุนสำรองเลี้ยงชีพ (PVD/กบข)</p>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          {status === 'saving' && <><Loader2 size={14} className="pvd-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
          {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(165px, 100%), 1fr))', gap: 14 }}>
        {[
          { label: 'อัตราสะสม+สมทบ', value: `${(empRate + employerRate).toFixed(0)}%`, color: 'var(--cyan-light)' },
          { label: 'เงินสะสม+สมทบ/เดือน', value: `${fmt(monthlyContrib, 0)} บาท`, color: '#22c55e' },
          { label: 'ผลตอบแทน (ต่อปี)', value: `${returnRate.toFixed(2)}%`, color: '#f59e0b' },
          { label: `มูลค่า ณ เกษียณ (อายุ ${retirementAge})`, value: `${fmt(valueAtRetirement, 0)} บาท`, color: '#4ade80' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
            <p style={{ fontSize: 17, fontWeight: 700, color, marginTop: 4 }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '300px 1fr', gap: 20, alignItems: 'stretch' }}>

        {/* Assumptions */}
        <div style={{ ...card }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', marginBottom: 10 }}>สมมติฐาน</p>
          <Field label="เงินเดือนปัจจุบัน"><NumIn value={salary} onChange={setSalary} suffix="บาท/เดือน" money width={100} /></Field>
          <Field label="อัตราเพิ่มเงินเดือน"><NumIn value={raiseRate} onChange={setRaiseRate} suffix="%/ปี" width={70} /></Field>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="อัตราเงินสะสม ลูกจ้าง"><NumIn value={empRate} onChange={setEmpRate} suffix="%" width={70} /></Field>
          <Field label="อัตราเงินสมทบ นายจ้าง"><NumIn value={employerRate} onChange={setEmployerRate} suffix="%" width={70} /></Field>
          <Field label="อัตราผลตอบแทนกองทุน"><NumIn value={returnRate} onChange={setReturnOverride} suffix="% ต่อปี" width={70} /></Field>
          {profile?.pvdReturnAsOf && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
              {profile.pvdReturnAsOf} · ตั้งค่าได้ที่ "ตั้งค่า → กองทุนสำรองเลี้ยงชีพ"
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="ยอดยกมา"><NumIn value={openingBalance} onChange={setOpeningBalance} suffix="บาท" money width={100} /></Field>
          {pvdAssetValue > 0 && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
              ดึงจากมูลค่ากองทุน PVD ในข้อมูลสินทรัพย์ลงทุน ({fmt(pvdAssetValue)} บาท) · พิมพ์ทับเพื่อปรับได้
            </div>
          )}
          <Field label="อายุปัจจุบัน"><NumIn value={currentAge} onChange={setCurrentAge} suffix="ปี" width={70} /></Field>
          <Field label="อายุเกษียณ"><NumIn value={retirementAge} onChange={setRetirementAge} suffix="ปี" width={70} /></Field>
        </div>

        {/* Chart — stretches to match assumptions height (equal bottom edge) */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            มูลค่ากองทุนสำรองเลี้ยงชีพสะสม (บาท)
          </p>
          <ChartFrame title="มูลค่ากองทุนสำรองเลี้ยงชีพสะสม" filename="pvd-fund" height={320}>
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
          <TableExcelButton filename="ตารางกองทุนสำรองเลี้ยงชีพ" title="PVD" />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              <th rowSpan={2} style={thBase}>อายุ</th>
              <th rowSpan={2} style={thBase}>เงินเดือน</th>
              <th colSpan={3} style={{ ...thGroup, color: C_EMP }}>ส่วนสะสมลูกจ้าง</th>
              <th colSpan={3} style={{ ...thGroup, color: C_ER }}>ส่วนสมทบนายจ้าง</th>
              <th rowSpan={2} style={{ ...thBase, color: 'var(--text-primary)', fontWeight: 700 }}>รวมสิ้นปี</th>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              {['ต้นงวด', 'ผลตอบแทน', 'เงินสะสม', 'ต้นงวด', 'ผลตอบแทน', 'เงินสะสม'].map((h, i) => (
                <th key={i} style={thSub}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {openingBalance > 0 && (
              <tr style={{ borderBottom: '1px solid var(--divider)', background: 'var(--hover)' }}>
                <td style={td} colSpan={8}>ยอดยกมา</td>
                <td style={{ ...tdNum, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(openingBalance)}</td>
              </tr>
            )}
            {rows.map(r => {
              const isRetire = r.age === retirementAge
              return (
                <tr key={r.age} style={{ borderBottom: '1px solid var(--divider)', background: isRetire ? 'rgba(245,158,11,0.07)' : 'transparent' }}>
                  <td style={{ ...td, fontWeight: isRetire ? 700 : 400, color: isRetire ? '#f59e0b' : 'var(--text-secondary)' }}>{r.age}{isRetire && ' ⭐'}</td>
                  <td style={tdNum}>{fmt(r.salary, 0)}</td>
                  <td style={tdNum}>{fmt(r.empOpen)}</td><td style={tdNum}>{fmt(r.empRet)}</td><td style={{ ...tdNum, color: C_EMP }}>{fmt(r.empEnd)}</td>
                  <td style={tdNum}>{fmt(r.erOpen)}</td><td style={tdNum}>{fmt(r.erRet)}</td><td style={{ ...tdNum, color: C_ER }}>{fmt(r.erEnd)}</td>
                  <td style={{ ...tdNum, fontWeight: 700, color: isRetire ? '#f59e0b' : 'var(--text-primary)' }}>{fmt(r.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          วิธีคิด: แต่ละปีนำเงินสะสม (ลูกจ้าง) + เงินสมทบ (นายจ้าง) = เงินเดือน × อัตรา% × 12 บวกเข้ายอด แล้วทบผลตอบแทนทั้งก้อน · เงินเดือนเพิ่มตามอัตราขึ้นเงินเดือนทุกปี
        </p>
      </div>
    </div>
  )
}

const thBase: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, verticalAlign: 'bottom' }
const thGroup: React.CSSProperties = { padding: '6px 10px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, borderLeft: '1px solid var(--card-border)' }
const thSub: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }
const tdNum: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }
