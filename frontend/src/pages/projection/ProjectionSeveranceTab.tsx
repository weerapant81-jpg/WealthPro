import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Scale } from 'lucide-react'
import { useIsCompact } from '../../hooks/useViewport'
import { card } from '../../styles/dark'
import { TableExcelButton } from '../../components/exportable'

/* ── helpers ── */
const fmt = (n: number, d = 2) =>
  isFinite(n) && !isNaN(n)
    ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '-'
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

/* ค่าชดเชยตาม พ.ร.บ.คุ้มครองแรงงาน (มาตรา 118) */
const TIERS = [
  { min: 120 / 365, max: 1,        label: 'ครบ 120 วัน แต่ไม่ถึง 1 ปี', days: 30 },
  { min: 1,         max: 3,        label: '1 ปี แต่ไม่ถึง 3 ปี',        days: 90 },
  { min: 3,         max: 6,        label: '3 ปี แต่ไม่ถึง 6 ปี',        days: 180 },
  { min: 6,         max: 10,       label: '6 ปี แต่ไม่ถึง 10 ปี',       days: 240 },
  { min: 10,        max: 20,       label: '10 ปี แต่ไม่ถึง 20 ปี',      days: 300 },
  { min: 20,        max: Infinity, label: '20 ปีขึ้นไป',                days: 400 },
]
function tierIndex(years: number) {
  return TIERS.findIndex(t => years >= t.min && years < t.max)
}

/* อัตราภาษีเงินได้บุคคลธรรมดาแบบขั้นบันได */
const TAX_BRACKETS = [
  { upTo: 150000, rate: 0 },
  { upTo: 300000, rate: 5 },
  { upTo: 500000, rate: 10 },
  { upTo: 750000, rate: 15 },
  { upTo: 1000000, rate: 20 },
  { upTo: 2000000, rate: 25 },
  { upTo: 5000000, rate: 30 },
  { upTo: Infinity, rate: 35 },
]
function progressiveTax(net: number) {
  let tax = 0, prev = 0
  for (const b of TAX_BRACKETS) {
    if (net <= prev) break
    const taxable = Math.min(net, b.upTo) - prev
    tax += taxable * (b.rate / 100)
    prev = b.upTo
  }
  return tax
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

export default function ProjectionSeveranceTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
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

  // ── Assumptions (editable, auto-filled from DB) ──
  const [salary, setSalary] = useState(15000)
  const [raiseRate, setRaiseRate] = useState(0)
  const [currentAge, setCurrentAge] = useState(45)
  // อายุเกษียณ — ดึงจากหน้าสมมติฐาน (แหล่งเดียว) · แก้ที่หน้าสมมติฐาน
  const retirementAge = (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
  const [workYearsNow, setWorkYearsNow] = useState(0)
  const [lastSalaryOverride, setLastSalaryOverride] = useState<number | null>(null)

  const filled = useMemo(() => ({ s: false, r: false, a: false, w: false, ret: false }), [])
  useEffect(() => {
    if (!clientProfile) return
    const spouseJob = Array.isArray(clientProfile.spouseJobs) ? clientProfile.spouseJobs[0] : null
    const salaryVal = isSelf ? clientProfile.salary : (spouseJob?.salary ?? clientProfile.spouseIncome)
    const raiseVal = isSelf ? clientProfile.salaryIncreaseRate : spouseJob?.salaryIncreaseRate
    const workVal = isSelf ? clientProfile.workYears : spouseJob?.workYears
    const ageVal = isSelf
      ? (clientProfile.birthDate ? new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear() : null)
      : (clientProfile.spouseAge ?? null)
    if (!filled.s && salaryVal != null) { setSalary(toNum(salaryVal)); filled.s = true }
    if (!filled.r && raiseVal != null) { setRaiseRate(toNum(raiseVal)); filled.r = true }
    if (!filled.w && workVal != null) { setWorkYearsNow(toNum(workVal)); filled.w = true }
    if (!filled.a && ageVal && ageVal > 0) { setCurrentAge(ageVal); filled.a = true }
  }, [clientProfile])

  // ── Calculation ──
  const calc = useMemo(() => {
    const yearsToRetire = Math.max(0, retirementAge - currentAge)
    const serviceYears = workYearsNow + yearsToRetire
    const projectedLast = salary * Math.pow(1 + raiseRate / 100, yearsToRetire)
    const lastSalary = lastSalaryOverride ?? projectedLast
    const idx = tierIndex(serviceYears)
    const days = idx >= 0 ? TIERS[idx].days : 0
    const severance = lastSalary * (days / 30)

    // ── ภาษีเงินได้ (เงินได้จ่ายครั้งเดียวเพราะเหตุออกจากงาน) ──
    const taxYears = Math.round(serviceYears)
    const eligible = serviceYears >= 5
    const deduct1 = Math.min(7000 * taxYears, severance)
    const deduct2 = Math.max(0, severance - deduct1) * 0.5
    const netIncome = Math.max(0, severance - deduct1 - deduct2)
    const tax = eligible ? progressiveTax(netIncome) : 0
    const netSeverance = severance - tax

    return {
      yearsToRetire, serviceYears, lastSalary, idx, days, severance,
      taxYears, eligible, deduct1, deduct2, netIncome, tax, netSeverance,
    }
  }, [salary, raiseRate, currentAge, retirementAge, workYearsNow, lastSalaryOverride])

  // ── เก็บ "เงินชดเชยที่ได้รับจริง (หลังหักภาษี)" ต่อบุคคล เพื่อให้การ์ดสรุปแผนเกษียณดึงไปใช้ ──
  const { data: savedSev } = useQuery({ queryKey: ['severance-plan'], queryFn: () => api.get('/severance-plan').then(r => r.data), retry: false })
  const savedSevRef = useRef<any>(null)
  savedSevRef.current = savedSev ?? {}
  const sevTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSev = useMutation({
    mutationFn: (merged: any) => { qc.setQueryData(['severance-plan'], merged); return api.put('/severance-plan', merged) },
  })
  useEffect(() => {
    const slice = { netSeverance: calc.netSeverance, serviceYears: calc.serviceYears, tax: calc.tax }
    if (JSON.stringify(savedSevRef.current?.[person] ?? {}) === JSON.stringify(slice)) return
    if (sevTimer.current) clearTimeout(sevTimer.current)
    sevTimer.current = setTimeout(() => {
      const merged = { ...(savedSevRef.current ?? {}), [person]: slice }
      savedSevRef.current = merged
      saveSev.mutate(merged)
    }, 800)
    return () => { if (sevTimer.current) clearTimeout(sevTimer.current) }
  }, [calc.netSeverance, calc.serviceYears, calc.tax, person])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Scale size={15} color="var(--cyan)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>เงินชดเชยตามกฎหมายแรงงาน (กรณีเกษียณอายุ)</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Assumptions */}
        <div style={{ ...card }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', marginBottom: 10 }}>ข้อมูล (ดึงจากข้อมูลลูกค้า)</p>
          <Field label="เงินเดือนปัจจุบัน"><NumIn value={salary} onChange={setSalary} suffix="บาท" money width={100} /></Field>
          <Field label="อัตราขึ้นเงินเดือน"><NumIn value={raiseRate} onChange={setRaiseRate} suffix="%/ปี" width={70} /></Field>
          <Field label="อายุงานปัจจุบัน"><NumIn value={workYearsNow} onChange={setWorkYearsNow} suffix="ปี" width={70} /></Field>
          <Field label="อายุงาน ณ เกษียณ">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 70, padding: '6px 10px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)', fontSize: 13, fontWeight: 600 }}>{fmt(calc.serviceYears, 1)}</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 56 }}>ปี</span>
            </div>
          </Field>
          <Field label="อัตราค่าชดเชย">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 70, padding: '6px 10px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>{calc.days}</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 56 }}>วัน</span>
            </div>
          </Field>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="เงินเดือนสุดท้าย (ณ เกษียณ)"><NumIn value={calc.lastSalary} onChange={setLastSalaryOverride} suffix="บาท" money width={100} /></Field>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', padding: '0 0 4px', lineHeight: 1.5 }}>
            ค่าเริ่มต้นประมาณการจากเงินเดือน × อัตราขึ้น · แก้เพื่อทดลองได้
          </div>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="อายุปัจจุบัน"><NumIn value={currentAge} onChange={setCurrentAge} suffix="ปี" width={70} /></Field>
          <Field label="อายุเกษียณ">
            <span><span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--cyan)' }}>{retirementAge}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ปี · จากสมมติฐาน</span></span>
          </Field>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div>ระยะถึงเกษียณ: <strong style={{ color: 'var(--cyan)' }}>{calc.yearsToRetire} ปี</strong></div>
          </div>
        </div>

        {/* Result + tier table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Highlighted results: ก่อนภาษี / ภาษี / รับจริง */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
            <div style={{ ...card, background: 'linear-gradient(160deg, rgba(74,222,128,0.12), var(--card-bg) 60%)', border: '1px solid rgba(74,222,128,0.4)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>เงินชดเชยที่จะได้รับเมื่อเกษียณ</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#4ade80', fontFamily: 'monospace', margin: '4px 0' }}>
                {fmt(calc.severance, 0)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                = เงินเดือนสุดท้าย {fmt(calc.lastSalary, 0)} ฿ ÷ 30 × {calc.days} วัน
                {calc.days === 0 && ' (อายุงานไม่ถึง 120 วัน)'}
              </p>
            </div>
            <div style={{ ...card, background: 'linear-gradient(160deg, rgba(248,113,113,0.12), var(--card-bg) 60%)', border: '1px solid rgba(248,113,113,0.4)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>ภาษีที่ต้องชำระ</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#f87171', fontFamily: 'monospace', margin: '4px 0' }}>
                {fmt(calc.tax, 0)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>คำนวณแบบเงินได้ออกจากงาน (ดูรายละเอียดด้านล่าง)</p>
            </div>
            <div style={{ ...card, background: 'linear-gradient(160deg, rgba(6,182,212,0.14), var(--card-bg) 60%)', border: '1px solid rgba(6,182,212,0.5)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>เงินชดเชยที่ได้รับจริง</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--cyan-light)', fontFamily: 'monospace', margin: '4px 0' }}>
                {fmt(calc.netSeverance, 0)} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>= ค่าชดเชย − ภาษี</p>
            </div>
          </div>

          {/* Tier table */}
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>อัตราค่าชดเชยตามอายุงาน</p>
              <TableExcelButton filename="ตารางค่าชดเชยเกษียณ" title="ค่าชดเชย" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>พ.ร.บ. คุ้มครองแรงงาน มาตรา 118 (การเกษียณอายุถือเป็นการเลิกจ้าง — มาตรา 118/1)</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>อายุงาน</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ค่าชดเชย (วัน)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>เป็นเงิน (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t, i) => {
                  const active = i === calc.idx
                  const amount = calc.lastSalary * (t.days / 30)
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--divider)',
                      background: active ? 'rgba(74,222,128,0.1)' : 'transparent',
                    }}>
                      <td style={{ padding: '8px 12px', fontWeight: active ? 700 : 400, color: active ? '#4ade80' : 'var(--text-secondary)' }}>
                        {t.label}{active && ' ⭐'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: active ? 700 : 400, color: active ? '#4ade80' : 'var(--text-secondary)' }}>{t.days}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: active ? 700 : 400, color: active ? '#4ade80' : 'var(--text-muted)' }}>{fmt(amount, 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
              วิธีคิด: เงินเดือนสุดท้าย ÷ 30 = ค่าจ้างต่อวัน แล้วคูณด้วยจำนวนวันค่าชดเชยตามอายุงาน · เงินเดือนสุดท้ายประมาณการจากเงินเดือนปัจจุบัน ปรับด้วยอัตราขึ้นเงินเดือนถึงปีเกษียณ
            </p>
          </div>

          {/* ── ภาษีเงินได้จากค่าชดเชย ── */}
          <div style={{ ...card }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>ภาษีเงินได้จากค่าชดเชย</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              เงินได้ที่จ่ายครั้งเดียวเพราะเหตุออกจากงาน (แยกคำนวณด้วยใบแนบ ภ.ง.ด.90/91)
            </p>

            {!calc.eligible && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginBottom: 12, lineHeight: 1.6 }}>
                ⚠ อายุงาน {fmt(calc.serviceYears, 1)} ปี (ไม่ถึง 5 ปี) — ใช้สิทธิแยกคำนวณไม่ได้ ต้องนำไปรวมกับเงินได้ปกติของปีนั้น (ตัวเลขด้านล่างจึงเป็นการประมาณการเบื้องต้น)
              </div>
            )}

            {/* Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
              {[
                { label: 'ค่าชดเชย (เงินได้)', value: calc.severance, color: 'var(--text-primary)' },
                { label: `หักค่าใช้จ่ายส่วนที่ 1 (7,000 × ${calc.taxYears} ปี)`, value: -calc.deduct1, color: 'var(--text-secondary)' },
                { label: 'หักค่าใช้จ่ายส่วนที่ 2 (50% ของส่วนที่เหลือ)', value: -calc.deduct2, color: 'var(--text-secondary)' },
                { label: 'เงินได้สุทธิ (ฐานคำนวณภาษี)', value: calc.netIncome, color: 'var(--cyan-light)' },
                { label: 'ภาษีเงินได้', value: calc.tax, color: '#f87171' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--divider)' : 'none' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: r.color }}>
                    {r.value < 0 ? '−' : ''}{fmt(Math.abs(r.value), 0)} บาท
                  </span>
                </div>
              ))}
            </div>

            {/* Net result */}
            <div style={{ borderRadius: 10, background: 'linear-gradient(160deg, rgba(74,222,128,0.14), var(--navy-900) 60%)', border: '1px solid rgba(74,222,128,0.45)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', whiteSpace: 'nowrap' }}>เงินชดเชยที่ได้รับจริง</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{fmt(calc.netSeverance, 0)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</span>
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 6 }}>
                = ค่าชดเชย {fmt(calc.severance, 0)} − ภาษี {fmt(calc.tax, 0)} บาท
              </div>
            </div>

            <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
              หมายเหตุ: ค่าชดเชยเพราะเหตุเกษียณอายุ/สิ้นสุดสัญญา ไม่ได้รับยกเว้น 300,000 บาทแรก · เป็นการประมาณการ ไม่รวมเงินก้อนอื่น (PVD/บำเหน็จ) ที่อาจต้องนำมารวมคำนวณในใบแนบเดียวกัน
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
