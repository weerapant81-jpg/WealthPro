import { useState, useMemo, useEffect } from 'react'
import { Calculator, Home, Car, Clock, CreditCard, ShieldCheck, RefreshCw } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartFrame, TableExcelButton } from '../components/exportable'
import { useIsCompact } from '../hooks/useViewport'

/* ── helpers ── */
const fmt = (n: number, d = 2) =>
  isFinite(n) && !isNaN(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-'
const fmt0 = (n: number) => fmt(n, 0)
const axisMoney = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`

/* recessive-styled recharts axes shared across calculators */
const chartCommon = {
  grid: <CartesianGrid stroke="var(--divider)" vertical={false} />,
  tipStyle: { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 } as React.CSSProperties,
}

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px' }
const numStyle: React.CSSProperties = { width: 150, padding: '7px 10px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 7, color: 'var(--cyan)', fontSize: 14, fontWeight: 500, fontFamily: 'monospace', outline: 'none' }

function MoneyInput({ value, onChange, width = 150 }: { value: number; onChange: (v: number) => void; width?: number }) {
  const [text, setText] = useState(value ? value.toLocaleString('en-US') : '')
  useEffect(() => { setText(value ? value.toLocaleString('en-US') : '') }, [value])
  return (
    <input type="text" inputMode="numeric" value={text}
      onChange={e => {
        const raw = e.target.value.replace(/,/g, '')
        if (raw === '') { setText(''); onChange(0); return }
        if (!/^\d*\.?\d*$/.test(raw)) return
        setText(e.target.value); onChange(Number(raw) || 0)
      }}
      style={{ ...numStyle, width }} />
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
      <div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>{hint && <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{hint}</div>}</div>
      {children}
    </div>
  )
}

function NumIn({ value, onChange, suffix, width = 100, step = 1 }: { value: number; onChange: (v: number) => void; suffix?: string; width?: number; step?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ ...numStyle, width }} />
      {suffix && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 40 }}>{suffix}</span>}
    </div>
  )
}

function ResultCard({ label, value, unit = 'บาท', color = 'var(--cyan)', big = false }: { label: string; value: string; unit?: string; color?: string; big?: boolean }) {
  return (
    <div style={{ background: 'var(--navy-900)', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: big ? 24 : 17, fontWeight: 700, color, fontFamily: 'monospace', marginTop: 3 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unit}</div>
    </div>
  )
}

/* ── 1. Home loan (reducing balance) + prepayment comparison ── */
const ymText = (m: number) => `${Math.floor(m / 12)} ปี ${m % 12} เดือน`

function HomeLoanCalc() {
  const [amount, setAmount] = useState(3000000)
  const [rate, setRate] = useState(6)
  const [years, setYears] = useState(30)
  const [extraMonthly, setExtraMonthly] = useState(0)
  const [extraYearly, setExtraYearly] = useState(0)

  const compact = useIsCompact()
  const r = rate / 100 / 12, n = years * 12
  const pmt = r === 0 ? amount / n : amount * r / (1 - Math.pow(1 + r, -n))

  // simulate payoff with optional extra payments
  function simulate(exM: number, exY: number) {
    let bal = amount, months = 0, interest = 0
    const yearly: { year: number; principal: number; interest: number; balance: number }[] = []
    let yp = 0, yi = 0
    while (bal > 0.5 && months < n * 3 + 12) {
      const i = bal * r
      let pay = pmt + exM
      if ((months + 1) % 12 === 0) pay += exY
      pay = Math.min(pay, bal + i)
      const principal = pay - i
      bal = bal + i - pay; interest += i; months++
      yp += principal; yi += i
      if (months % 12 === 0 || bal <= 0.5) { yearly.push({ year: Math.ceil(months / 12), principal: yp, interest: yi, balance: Math.max(0, bal) }); yp = 0; yi = 0 }
    }
    return { months, interest, totalPaid: amount + interest, yearly }
  }

  const base = useMemo(() => simulate(0, 0), [amount, rate, years])
  const ext = useMemo(() => simulate(extraMonthly, extraYearly), [amount, rate, years, extraMonthly, extraYearly])
  const hasExtra = extraMonthly > 0 || extraYearly > 0
  const saveInterest = base.interest - ext.interest
  const saveMonths = base.months - ext.months

  const extByYear = new Map(ext.yearly.map(s => [s.year, s.balance]))
  const chartData = base.yearly.map(s => ({ year: s.year, base: Math.round(s.balance), extra: hasExtra ? Math.round(extByYear.get(s.year) ?? 0) : undefined }))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', marginBottom: 8 }}>ข้อมูลสินเชื่อบ้าน</p>
          <Field label="วงเงินกู้"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="อัตราดอกเบี้ย (ลดต้นลดดอก)" hint="แบบ Effective Rate"><NumIn value={rate} onChange={setRate} suffix="%/ปี" step={0.1} /></Field>
          <Field label="ระยะเวลาผ่อน"><NumIn value={years} onChange={setYears} suffix="ปี" /></Field>
          <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
          <Field label="จ่ายเพิ่มทุกเดือน" hint="เพิ่มจากค่างวดปกติ"><MoneyInput value={extraMonthly} onChange={setExtraMonthly} /></Field>
          <Field label="จ่ายเพิ่มทุกปี" hint="เช่น โบนัส (ทบงวดสิ้นปี)"><MoneyInput value={extraYearly} onChange={setExtraYearly} /></Field>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'ค่างวดปกติ/เดือน', value: pmt, color: '#4ade80' },
              { label: 'ดอกเบี้ยรวม (จ่ายปกติ)', value: base.interest, color: '#f87171' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span><span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: r.color }}>{fmt0(r.value)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison */}
        <div style={{ ...card, background: hasExtra ? 'linear-gradient(160deg, rgba(74,222,128,0.12), var(--card-bg) 60%)' : undefined, border: hasExtra ? '1.5px solid rgba(74,222,128,0.45)' : '1px solid var(--card-border)' }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>เปรียบเทียบ: จ่ายปกติ vs จ่ายเพิ่ม</p>
          {!hasExtra ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>ใส่ "จ่ายเพิ่มทุกเดือน" หรือ "ทุกปี" เพื่อดูว่าประหยัดดอกเบี้ยและผ่อนจบเร็วขึ้นเท่าไร</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--divider)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ระยะเวลาผ่อน (ปกติ)</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{ymText(base.months)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--divider)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ระยะเวลาผ่อน (จ่ายเพิ่ม)</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#4ade80', fontWeight: 700 }}>{ymText(ext.months)}</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ประหยัดดอกเบี้ย</span>
                  <span><span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#4ade80' }}>{fmt0(saveInterest)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ผ่อนจบเร็วขึ้น</span>
                  <span><span style={{ fontSize: 15, fontWeight: 700, color: '#0ea5e9' }}>{ymText(saveMonths)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({saveMonths} งวด)</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ดอกเบี้ยรวม (จ่ายเพิ่ม)</span>
                  <span><span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{fmt0(ext.interest)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ยอดผ่อนรวม (จ่ายเพิ่ม)</span>
                  <span><span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt0(ext.totalPaid)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ ...card }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>ยอดหนี้คงเหลือตามเวลา</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{hasExtra ? 'เส้นเขียว = จ่ายเพิ่ม ผ่อนจบเร็วกว่า' : 'ใส่ยอดจ่ายเพิ่มเพื่อเทียบเส้นที่ผ่อนจบเร็วขึ้น'}</p>
          <ChartFrame title="ยอดหนี้คงเหลือตามเวลา" filename="loan-balance" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 6, bottom: 4 }}>
              {chartCommon.grid}
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false} />
              <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={44} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any) => [`${fmt0(v)} บาท`, '']} labelFormatter={y => `ปีที่ ${y}`} contentStyle={chartCommon.tipStyle} />
              {hasExtra && <Legend wrapperStyle={{ fontSize: 12 }} />}
              <Line type="monotone" dataKey="base" stroke="#94a3b8" strokeWidth={2} dot={false} name="จ่ายปกติ" activeDot={{ r: 4, strokeWidth: 0 }} />
              {hasExtra && <Line type="monotone" dataKey="extra" stroke="#10b981" strokeWidth={2.5} dot={false} name="จ่ายเพิ่ม" activeDot={{ r: 4, strokeWidth: 0 }} />}
            </LineChart>
          </ResponsiveContainer>
          </ChartFrame>
        </div>

        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>ตารางผ่อนรายปี {hasExtra ? '(กรณีจ่ายเพิ่ม)' : ''}</p>
            <TableExcelButton filename="ตารางผ่อนรายปี" title="ผ่อนรายปี" />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              <th style={th}>ปีที่</th><th style={thR}>เงินต้น</th><th style={thR}>ดอกเบี้ย</th><th style={thR}>คงเหลือ</th>
            </tr></thead>
            <tbody>{(hasExtra ? ext : base).yearly.map((s, idx) => (
              <tr key={s.year} style={{ background: idx % 2 ? 'var(--hover)' : 'transparent' }}>
                <td style={td}>{s.year}</td>
                <td style={tdR}>{fmt0(s.principal)}</td>
                <td style={{ ...tdR, color: '#f87171' }}>{fmt0(s.interest)}</td>
                <td style={{ ...tdR, color: 'var(--cyan-light)' }}>{fmt0(s.balance)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── 2. Car loan (flat rate — Thai standard) ── */
function CarLoanCalc() {
  const [price, setPrice] = useState(800000)
  const [down, setDown] = useState(160000)
  const [rate, setRate] = useState(3.5)
  const [years, setYears] = useState(5)

  const compact = useIsCompact()
  const principal = Math.max(0, price - down)
  const n = years * 12
  const totalInterest = principal * (rate / 100) * years
  const totalPaid = principal + totalInterest
  const monthly = n > 0 ? totalPaid / n : 0
  const effRate = rate * 1.8  // approx effective rate from flat rate

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', marginBottom: 8 }}>ข้อมูลสินเชื่อรถ</p>
        <Field label="ราคารถ"><MoneyInput value={price} onChange={setPrice} /></Field>
        <Field label="เงินดาวน์"><MoneyInput value={down} onChange={setDown} /></Field>
        <Field label="อัตราดอกเบี้ย (คงที่/Flat)" hint="แบบดอกเบี้ยคงที่ตลอดสัญญา"><NumIn value={rate} onChange={setRate} suffix="%/ปี" step={0.1} /></Field>
        <Field label="ระยะเวลาผ่อน"><NumIn value={years} onChange={setYears} suffix="ปี" /></Field>
      </div>
      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>ผลการคำนวณ</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'ค่างวด/เดือน', value: fmt0(monthly), unit: 'บาท', color: '#4ade80' },
            { label: 'ยอดจัดไฟแนนซ์', value: fmt0(principal), unit: 'บาท', color: 'var(--cyan)' },
            { label: 'ดอกเบี้ยรวม', value: fmt0(totalInterest), unit: 'บาท', color: '#f87171' },
            { label: 'ยอดผ่อนรวม', value: fmt0(totalPaid), unit: 'บาท', color: 'var(--text-primary)' },
            { label: 'จำนวนงวด', value: `${n}`, unit: 'งวด', color: 'var(--text-primary)' },
            { label: 'ดอกเบี้ยแท้จริง (ประมาณ)', value: effRate.toFixed(2), unit: '%/ปี (≈ flat × 1.8)', color: '#f59e0b' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
              <span><span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: r.color }}>{r.value}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.unit}</span></span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6 }}>
          สินเชื่อรถส่วนใหญ่ใช้ดอกเบี้ยแบบคงที่ (Flat) คิดจากยอดจัดเต็มจำนวนตลอดสัญญา · อัตราดอกเบี้ยที่แท้จริง (Effective) จะสูงกว่าราว 1.8 เท่า
        </p>
      </div>
    </div>
  )
}

/* ── 3. Time Value of Money ── */
function TVMCalc() {
  const [mode, setMode] = useState<'fv' | 'pv' | 'pmt'>('fv')
  const [pv, setPv] = useState(100000)
  const [pmt, setPmt] = useState(0)
  const [fv, setFv] = useState(0)
  const [rate, setRate] = useState(5)
  const [years, setYears] = useState(10)
  const [freq, setFreq] = useState(12)

  const compact = useIsCompact()
  const r = rate / 100 / freq, n = years * freq
  const f = Math.pow(1 + r, n)

  let result = 0, label = ''
  if (mode === 'fv') {
    result = pv * f + (r === 0 ? pmt * n : pmt * ((f - 1) / r))
    label = 'มูลค่าอนาคต (FV)'
  } else if (mode === 'pv') {
    result = (fv - (r === 0 ? pmt * n : pmt * ((f - 1) / r))) / f
    label = 'มูลค่าปัจจุบัน (PV)'
  } else {
    result = r === 0 ? (fv - pv) / n : (fv - pv * f) / ((f - 1) / r)
    label = 'เงินงวดต่องวด (PMT)'
  }

  const modes = [['fv', 'หามูลค่าอนาคต (FV)'], ['pv', 'หามูลค่าปัจจุบัน (PV)'], ['pmt', 'หาเงินงวด (PMT)']] as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', marginBottom: 10 }}>มูลค่าเงินตามเวลา</p>
        <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 9, marginBottom: 12 }}>
          {modes.map(([k, lb]) => (
            <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, background: mode === k ? 'var(--cyan-dim)' : 'transparent', color: mode === k ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: mode === k ? 600 : 400 }}>{lb}</button>
          ))}
        </div>
        {mode !== 'pv' && <Field label="มูลค่าปัจจุบัน (PV)"><MoneyInput value={pv} onChange={setPv} /></Field>}
        {mode !== 'fv' && <Field label="มูลค่าอนาคต (FV)"><MoneyInput value={fv} onChange={setFv} /></Field>}
        {mode !== 'pmt' && <Field label="เงินงวดต่องวด (PMT)"><MoneyInput value={pmt} onChange={setPmt} /></Field>}
        <Field label="อัตราผลตอบแทน"><NumIn value={rate} onChange={setRate} suffix="%/ปี" step={0.1} /></Field>
        <Field label="จำนวนปี"><NumIn value={years} onChange={setYears} suffix="ปี" /></Field>
        <Field label="งวดต่อปี" hint="12 = รายเดือน, 1 = รายปี"><NumIn value={freq} onChange={setFreq} suffix="งวด" /></Field>
      </div>
      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>ผลลัพธ์</p>
        <div style={{ background: 'linear-gradient(160deg, var(--cyan-dim), var(--card-bg) 60%)', border: '1.5px solid var(--cyan)', borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--cyan)', fontFamily: 'monospace', margin: '6px 0' }}>{fmt0(result)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>บาท</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10, marginTop: 12 }}>
          <ResultCard label="อัตราต่องวด" value={(r * 100).toFixed(4)} unit="%" color="var(--text-primary)" />
          <ResultCard label="จำนวนงวดรวม" value={`${n}`} unit="งวด" color="var(--text-primary)" />
        </div>
      </div>

      {/* กราฟการเติบโตของเงินรายปี (เต็มความกว้างใต้ทั้งสองคอลัมน์) */}
      <div style={{ ...card, gridColumn: '1 / -1' }}>
        {(() => {
          // ค่าที่ใช้จริงตามโหมด: ตัวที่หาได้ = result
          const pv0 = mode === 'pv' ? Math.max(0, result) : pv
          const pmt0 = mode === 'pmt' ? Math.max(0, result) : pmt
          const rows = Array.from({ length: years + 1 }, (_, y) => {
            const k = y * freq
            const fk = Math.pow(1 + r, k)
            const fromPV = pv0 * fk
            const fromPMT = r === 0 ? pmt0 * k : pmt0 * ((fk - 1) / r)
            return { year: y, เงินต้น: Math.round(fromPV), เงินงวดสะสม: Math.round(fromPMT), มูลค่ารวม: Math.round(fromPV + fromPMT) }
          })
          return (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>การเติบโตของเงินรายปี</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                เริ่มจากมูลค่าปัจจุบัน {fmt0(pv0)} บาท{pmt0 > 0 ? ` + เงินงวด ${fmt0(pmt0)} บาท/งวด (${freq} งวด/ปี)` : ''} · ผลตอบแทน {rate}%/ปี เป็นเวลา {years} ปี
              </p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v: any) => `ปีที่ ${v}`} />
                    <YAxis tickFormatter={(v: any) => axisMoney(v)} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={52} />
                    <Tooltip formatter={(v: any) => `${fmt0(v)} บาท`} labelFormatter={(l: any) => `สิ้นปีที่ ${l}`}
                      contentStyle={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {pmt0 > 0 && <Line dataKey="เงินต้น" stroke="#f59e0b" strokeWidth={1.8} strokeDasharray="5 4" dot={false} />}
                    {pmt0 > 0 && <Line dataKey="เงินงวดสะสม" stroke="#a78bfa" strokeWidth={1.8} strokeDasharray="5 4" dot={false} />}
                    <Line dataKey="มูลค่ารวม" stroke="var(--cyan)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

/* ── 4. Debt payoff (credit card / personal / informal) ── */
const DEBT_TYPES = [
  { key: 'credit', label: 'บัตรเครดิต', rate: 16, locked: true, note: 'เพดานดอกเบี้ยตามกฎหมาย 16%/ปี' },
  { key: 'personal', label: 'สินเชื่อส่วนบุคคล', rate: 25, locked: true, note: 'เพดานดอกเบี้ยตามกฎหมาย 25%/ปี' },
  { key: 'informal', label: 'เงินกู้นอกระบบ', rate: 60, locked: false, note: 'กรอกอัตราดอกเบี้ยเอง (ตามกฎหมายแพ่งห้ามเกิน 15%/ปี)' },
] as const

function DebtCalc() {
  const [type, setType] = useState<'credit' | 'personal' | 'informal'>('credit')
  const compact = useIsCompact()
  const cur = DEBT_TYPES.find(t => t.key === type)!
  const [balance, setBalance] = useState(50000)
  const [rate, setRate] = useState(16)
  const [payMode, setPayMode] = useState<'fixed' | 'minpct'>('fixed')
  const [monthlyPay, setMonthlyPay] = useState(3000)
  const [minPct, setMinPct] = useState(8)

  useEffect(() => { if (cur.locked) setRate(cur.rate) }, [type])

  const res = useMemo(() => {
    const r = rate / 100 / 12
    let bal = balance, months = 0, totalInterest = 0, totalPaid = 0
    const floor = 500
    const rows: { year: number; interest: number; paid: number; balance: number }[] = []
    let yi = 0, yp = 0
    let never = false
    while (bal > 0.5) {
      const interest = bal * r
      let pay = payMode === 'fixed' ? monthlyPay : Math.max(bal * minPct / 100, floor)
      pay = Math.min(pay, bal + interest)
      if (pay <= interest) { never = true; break }
      bal = bal + interest - pay
      totalInterest += interest; totalPaid += pay; months++
      yi += interest; yp += pay
      if (months % 12 === 0) { rows.push({ year: months / 12, interest: yi, paid: yp, balance: Math.max(0, bal) }); yi = 0; yp = 0 }
      if (months > 1200) { never = true; break }
    }
    if (!never && (yi > 0 || yp > 0)) rows.push({ year: Math.ceil(months / 12), interest: yi, paid: yp, balance: 0 })
    return { months, totalInterest, totalPaid, never, rows }
  }, [balance, rate, payMode, monthlyPay, minPct])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', marginBottom: 10 }}>ข้อมูลหนี้</p>
        <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 9, marginBottom: 12 }}>
          {DEBT_TYPES.map(t => (
            <button key={t.key} onClick={() => setType(t.key)} style={{ flex: 1, padding: '6px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11.5, background: type === t.key ? 'var(--cyan-dim)' : 'transparent', color: type === t.key ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: type === t.key ? 600 : 400 }}>{t.label}</button>
          ))}
        </div>
        <Field label="ยอดหนี้คงค้าง"><MoneyInput value={balance} onChange={setBalance} /></Field>
        <Field label="อัตราดอกเบี้ย" hint={cur.note}>
          {cur.locked
            ? <div style={{ ...numStyle, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'var(--navy-800)' }}>{rate}%</div>
            : <NumIn value={rate} onChange={setRate} suffix="%/ปี" step={0.5} />}
        </Field>
        <div style={{ borderTop: '1px solid var(--card-border)', margin: '8px 0' }} />
        <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 9, marginBottom: 8 }}>
          {([['fixed', 'จ่ายคงที่/เดือน'], ['minpct', 'จ่ายขั้นต่ำ %']] as const).map(([k, lb]) => (
            <button key={k} onClick={() => setPayMode(k)} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: payMode === k ? 'var(--cyan-dim)' : 'transparent', color: payMode === k ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: payMode === k ? 600 : 400 }}>{lb}</button>
          ))}
        </div>
        {payMode === 'fixed'
          ? <Field label="ชำระต่อเดือน"><MoneyInput value={monthlyPay} onChange={setMonthlyPay} /></Field>
          : <>
              <Field label="ชำระขั้นต่ำ" hint="% ของยอดคงค้าง (ขั้นต่ำ 500 บาท)"><NumIn value={minPct} onChange={setMinPct} suffix="%" step={1} /></Field>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <div style={{ flex: 1, background: 'var(--navy-900)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>ชำระขั้นต่ำเดือนแรก</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'monospace' }}>{fmt0(Math.max(balance * minPct / 100, 500))} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
                </div>
                <div style={{ flex: 1, background: 'var(--navy-900)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>ชำระปีแรก (รวม)</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'monospace' }}>{fmt0(res.rows[0]?.paid ?? 0)} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>* ยอดชำระขั้นต่ำลดลงทุกเดือนตามยอดคงค้าง</div>
            </>}
      </div>

      <div style={{ ...card }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>ผลการคำนวณ</p>
        {res.never ? (
          <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 10, padding: '14px 16px', color: '#f87171', fontSize: 13, lineHeight: 1.6 }}>
            ⚠ ยอดชำระต่อเดือนน้อยกว่าดอกเบี้ยที่เกิดขึ้น — หนี้จะไม่มีวันหมด กรุณาเพิ่มยอดชำระ
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>ระยะเวลาปลดหนี้</span>
                <span><span style={{ fontSize: 17, fontWeight: 800, color: '#4ade80' }}>{Math.floor(res.months / 12)} ปี {res.months % 12} เดือน</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({res.months} งวด)</span></span>
              </div>
              {[
                { label: 'ดอกเบี้ยรวมที่จ่าย', value: res.totalInterest, color: '#f87171' },
                { label: 'ยอดจ่ายรวมทั้งหมด', value: res.totalPaid, color: 'var(--cyan)' },
                { label: 'เงินต้น', value: balance, color: 'var(--text-primary)' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                  <span><span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700, color: r.color }}>{fmt0(r.value)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
                </div>
              ))}
            </div>
            {res.rows.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>ยอดหนี้คงเหลือจนปลดหนี้</p>
                <ChartFrame title="ยอดหนี้คงเหลือจนปลดหนี้" filename="debt-payoff" height={180}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={res.rows} margin={{ top: 6, right: 12, left: 6, bottom: 4 }}>
                    {chartCommon.grid}
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false} />
                    <YAxis tickFormatter={axisMoney} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={44} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [`${fmt0(v)} บาท`, 'คงเหลือ']} labelFormatter={y => `ปีที่ ${y}`} contentStyle={chartCommon.tipStyle} />
                    <Line type="monotone" dataKey="balance" stroke="var(--cyan)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
                </ChartFrame>
              </div>
            )}
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                <TableExcelButton filename="ตารางปลดหนี้" title="ปลดหนี้" />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th style={th}>ปีที่</th><th style={thR}>ดอกเบี้ย</th><th style={thR}>ชำระ</th><th style={thR}>คงเหลือ</th>
                </tr></thead>
                <tbody>{res.rows.map((s, idx) => (
                  <tr key={s.year} style={{ background: idx % 2 ? 'var(--hover)' : 'transparent' }}>
                    <td style={td}>{s.year}</td>
                    <td style={{ ...tdR, color: '#f87171' }}>{fmt0(s.interest)}</td>
                    <td style={tdR}>{fmt0(s.paid)}</td>
                    <td style={{ ...tdR, color: 'var(--cyan-light)' }}>{fmt0(s.balance)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '7px 8px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '6px 8px', color: 'var(--text-secondary)' }
const tdR: React.CSSProperties = { padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }

/* ── 5. IRR แบบประกัน — กระแสเงินสด: จ่ายเบี้ยต้นปี · เงินคืนระหว่างสัญญา · เงินครบสัญญาปีสุดท้าย ── */
function irrOf(cfs: number[]): number | null {
  // NPV(r) = Σ cf_t / (1+r)^t — หา r ด้วย bisection (ช่วง -99% ถึง 100%)
  const npv = (r: number) => cfs.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0)
  let lo = -0.99, hi = 1
  const nLo = npv(lo), nHi = npv(hi)
  if (isNaN(nLo) || isNaN(nHi) || nLo * nHi > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const v = npv(mid)
    if (Math.abs(v) < 1e-7) return mid
    if (v * nLo > 0) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function InsuranceIRRCalc() {
  const compact = useIsCompact()
  const [name, setName] = useState('')
  const [premium, setPremium] = useState(50000)
  const [payYears, setPayYears] = useState(10)
  const [cashback, setCashback] = useState(5000)
  const [startYear, setStartYear] = useState(2)
  const [everyYears, setEveryYears] = useState(2)
  const [termYears, setTermYears] = useState(20)
  const [maturity, setMaturity] = useState(600000)
  // ทุนประกัน — แสดงประกอบเท่านั้น ไม่มีผลต่อ IRR · แก้รายปีได้ (บางแบบทุนเพิ่มขึ้นตามปี)
  const [sumAssured, setSumAssured] = useState(0)
  const [saOv, setSaOv] = useState<Record<number, number>>({})
  // เงินรับรายปีที่แก้ทับในตาราง (บางแบบคืนไม่เท่ากันในแต่ละปี) — มีผลต่อ IRR
  const [cbOv, setCbOv] = useState<Record<number, number>>({})

  const res = useMemo(() => {
    const N = Math.max(1, Math.round(termYears))
    const pay = Math.min(Math.max(1, Math.round(payYears)), N)
    const ev = Math.max(0, Math.round(everyYears))
    const st = Math.max(1, Math.round(startYear))
    // เงินคืนตามรอบ → ทับด้วยค่าที่แก้เองรายปี (cbOv) ถ้ามี
    const sched: number[] = Array.from({ length: N + 1 }, () => 0)
    if (ev > 0 && cashback > 0) for (let t = st; t < N; t += ev) sched[t] = cashback
    const backAt = (t: number) => cbOv[t] ?? sched[t]
    // cfs[t] = กระแสเงินสด ณ ต้นปีที่ t+1 (t=0..N) — เบี้ยจ่ายต้นปี, เงินคืน/ครบสัญญารับปลายปี
    const cfs: number[] = Array.from({ length: N + 1 }, () => 0)
    for (let t = 0; t < pay; t++) cfs[t] -= premium
    let nCashback = 0, totalCashback = 0
    for (let t = 0; t < N; t++) { const b = backAt(t); if (b > 0) { cfs[t] += b; nCashback++; totalCashback += b } }
    cfs[N] += maturity
    const irr = irrOf(cfs)
    const totalPremium = premium * pay
    const totalReceive = totalCashback + maturity
    // แสดงทุกปี 1..N (คอลัมน์ทุนประกันต้องมีทุกปีแม้ปีนั้นไม่มีจ่าย/รับ)
    const rows = cfs.map((cf, t) => ({ year: t, out: t < pay ? premium : 0, back: cf + (t < pay ? premium : 0) }))
      .filter((r, t) => t < N || r.back > 0)
    return { irr, totalPremium, totalCashback, nCashback, totalReceive, net: totalReceive - totalPremium, rows, N }
  }, [premium, payYears, cashback, startYear, everyYears, termYears, maturity, cbOv])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 380px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>ข้อมูลแบบประกัน</p>
          <button onClick={() => {
            setName(''); setPremium(0); setPayYears(0); setCashback(0); setStartYear(0)
            setEveryYears(0); setTermYears(0); setMaturity(0); setSumAssured(0); setSaOv({}); setCbOv({})
          }} title="ล้างทุกค่าเป็น 0 เพื่อกรอกแบบใหม่"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={11} /> เริ่มต้นใหม่
          </button>
        </div>
        <Field label="ชื่อแบบประกัน">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น สะสมทรัพย์ 20/10"
            style={{ ...numStyle, width: 190, textAlign: 'left', fontFamily: 'inherit' }} />
        </Field>
        <Field label="เบี้ยประกัน/ปี"><MoneyInput value={premium} onChange={setPremium} /></Field>
        <Field label="ชำระเบี้ยกี่ปี"><NumIn value={payYears} onChange={setPayYears} suffix="ปี" /></Field>
        <Field label="เงินคืนระหว่างสัญญา/ครั้ง" hint="กรอก 0 ถ้าไม่มีเงินคืน"><MoneyInput value={cashback} onChange={setCashback} /></Field>
        <Field label="ปีที่เริ่มคืน" hint="เงินคืนครั้งแรกสิ้นปีที่เท่าไหร่"><NumIn value={startYear} onChange={setStartYear} suffix="ปี" /></Field>
        <Field label="คืนทุก ๆ"><NumIn value={everyYears} onChange={setEveryYears} suffix="ปี" /></Field>
        <Field label="ครบสัญญากี่ปี"><NumIn value={termYears} onChange={setTermYears} suffix="ปี" /></Field>
        <Field label="เงินครบสัญญา"><MoneyInput value={maturity} onChange={setMaturity} /></Field>
        <Field label="ทุนประกัน" hint="แสดงประกอบในตาราง · ไม่มีผลต่อ IRR"><MoneyInput value={sumAssured} onChange={setSumAssured} /></Field>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={card}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
            ผลการคำนวณ{name.trim() ? ` · ${name.trim()}` : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <ResultCard label="IRR (ผลตอบแทนที่แท้จริง)" value={res.irr == null ? '—' : (res.irr * 100).toFixed(2)} unit="%/ปี" color={res.irr != null && res.irr > 0 ? '#4ade80' : '#f87171'} big />
            <ResultCard label="เบี้ยรวมที่จ่าย" value={fmt0(res.totalPremium)} color="#f87171" />
            <ResultCard label={`เงินคืนระหว่างสัญญา (${res.nCashback} ครั้ง)`} value={fmt0(res.totalCashback)} color="#f59e0b" />
            <ResultCard label="เงินรับรวมทั้งสัญญา" value={fmt0(res.totalReceive)} color="var(--cyan)" />
            <ResultCard label="ส่วนต่างรับ − จ่าย" value={fmt0(res.net)} color={res.net >= 0 ? '#4ade80' : '#f87171'} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
            สมมติฐาน: จ่ายเบี้ยต้นปี (ปีที่ 1–{Math.min(payYears, termYears)}) · เงินคืนเริ่มสิ้นปีที่ {startYear} รับทุก ๆ {everyYears || '—'} ปี จนถึงก่อนครบสัญญา · เงินครบสัญญารับปลายปีที่ {res.N} · IRR ไม่รวมมูลค่าความคุ้มครองชีวิต
          </p>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>ตารางกระแสเงินสด</p>
            <TableExcelButton filename={`irr-ประกัน${name.trim() ? '-' + name.trim() : ''}`} />
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 11 }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>ปีที่</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>เบี้ยจ่าย</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>เงินรับ</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>สุทธิ</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }} title="แก้ไขรายปีได้ · ไม่มีผลต่อ IRR">ทุนประกัน</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '3px 8px', color: 'var(--text-secondary)' }}>{r.year === res.N ? `${res.N} (ครบสัญญา)` : r.year + 1}</td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.out > 0 ? '#f87171' : 'var(--text-muted)' }}>{r.out > 0 ? fmt0(r.out) : '–'}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                      {r.year < res.N ? (
                        <input type="text" inputMode="numeric" title="แก้ไขเงินรับของปีนี้ได้ · มีผลต่อ IRR"
                          value={r.back ? r.back.toLocaleString('en-US') : ''}
                          placeholder="–"
                          onChange={e => {
                            const raw = e.target.value.replace(/,/g, '')
                            if (raw !== '' && !/^\d+$/.test(raw)) return
                            setCbOv(p => ({ ...p, [r.year]: raw === '' ? 0 : Number(raw) }))
                          }}
                          style={{ width: 92, padding: '2px 6px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 5, color: '#4ade80', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
                      ) : (
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: r.back > 0 ? '#4ade80' : 'var(--text-muted)', paddingRight: 4 }}>{r.back > 0 ? fmt0(r.back) : '–'}</span>
                      )}
                    </td>
                    <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'monospace', color: r.back - r.out >= 0 ? 'var(--cyan)' : '#f87171' }}>{fmt0(r.back - r.out)}</td>
                    <td style={{ padding: '2px 4px', textAlign: 'right' }}>
                      <input type="text" inputMode="numeric"
                        value={(saOv[r.year] ?? sumAssured) ? (saOv[r.year] ?? sumAssured).toLocaleString('en-US') : ''}
                        placeholder="–"
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '')
                          if (raw !== '' && !/^\d+$/.test(raw)) return
                          setSaOv(p => ({ ...p, [r.year]: raw === '' ? 0 : Number(raw) }))
                        }}
                        style={{ width: 92, padding: '2px 6px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 5, color: '#a78bfa', fontSize: 11, fontFamily: 'monospace', outline: 'none' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'home', label: 'คำนวณหนี้บ้าน', icon: Home, Comp: HomeLoanCalc },
  { key: 'car', label: 'คำนวณหนี้รถ', icon: Car, Comp: CarLoanCalc },
  { key: 'debt', label: 'คำนวณหนี้', icon: CreditCard, Comp: DebtCalc },
  { key: 'tvm', label: 'มูลค่าเงินตามเวลา', icon: Clock, Comp: TVMCalc },
  { key: 'insirr', label: 'IRR แบบประกัน', icon: ShieldCheck, Comp: InsuranceIRRCalc },
]

export default function CalculatorPage() {
  const [tab, setTab] = useState('home')
  const Active = TABS.find(t => t.key === tab)!.Comp

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: 'var(--cyan-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calculator size={22} color="var(--cyan)" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เครื่องคิดเลข</h1>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--card-border)' }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontSize: 13.5, fontWeight: active ? 600 : 400, color: active ? 'var(--cyan-light)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent', marginBottom: -1 }}>
              <Icon size={15} />{label}
            </button>
          )
        })}
      </div>

      <Active />
    </div>
  )
}
