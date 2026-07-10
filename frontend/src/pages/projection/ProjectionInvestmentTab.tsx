import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { ChartFrame, TableExcelButton } from '../../components/exportable'
import { card } from '../../styles/dark'
import { Trash2, RotateCcw, TrendingUp } from 'lucide-react'

function fmt(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} พันล้าน`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} ล้าน`
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n)
}
function toNum(v: any) { return parseFloat(String(v ?? '').replace(/,/g, '')) || 0 }

// ผลตอบแทนต่อปีแบบ CAGR — เหมือนหน้า "ข้อมูลสินทรัพย์และการลงทุน" (กัน drift)
function annualizedReturn(cost: number, value: number, investDate: string): number | null {
  if (cost <= 0 || value <= 0 || !investDate) return null
  const start = new Date(investDate)
  if (isNaN(start.getTime())) return null
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1 / 365.25) return null
  return (Math.pow(value / cost, 1 / years) - 1) * 100
}

type Row = { age: number; year: number; p10: number; p50: number; p90: number; band: [number, number] }

// ── Monte Carlo helpers ──────────────────────────────────────────────────────
// seeded PRNG (mulberry32) — ผลคงที่ทุกครั้ง (กราฟไม่กระพริบ)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export default function ProjectionInvestmentTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const isSelf = person === 'self'
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const toggleExclude = (i: number) => setExcluded(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })
  const { data: invProfile } = useQuery({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })
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
  const { data: retPlan } = useQuery({
    queryKey: ['retirement-plan'],
    queryFn: () => api.get('/retirement-plan').then(r => r.data),
    retry: false,
  })

  // ── Derive inputs ──────────────────────────────────────────────────────────
  const planKey = isSelf ? 'self' : 'spouse'
  const birthDate = clientProfile?.birthDate ? new Date(clientProfile.birthDate) : null
  const selfAge = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : null
  const currentAge = isSelf ? selfAge : (clientProfile?.spouseAge ?? null)

  // อายุขัย = ตามสมมุติฐานแผนเกษียณเป็นหลัก → settings → ค่าเริ่มต้น 85 (จบที่อายุขัย ไม่เกินไป)
  const expectedLifespan = retPlan?.[planKey]?.lifeExpectancy ?? (isSelf ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? 85

  const investmentAssets: any[] = invProfile?.investmentAssets ?? []

  // ผลตอบแทนต่อรายการ (CAGR; ถ้าคำนวณไม่ได้ใช้ค่าที่กรอกมือแทน)
  const assetReturn = (a: any): number | null => {
    let r = annualizedReturn(toNum(a.investAmount), toNum(a.currentValue), a.investDate)
    if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
    return r
  }

  // นับเฉพาะรายการที่เลือก (ไม่ถูกตัดออก) — ผู้ใช้เลือกได้ว่าจะเอารายการไหนมาคำนวณ
  const isIncluded = (i: number) => !excluded.has(i)

  // Total current investment value (เฉพาะที่เลือก)
  const totalValue = investmentAssets.reduce((s: number, a: any, i: number) => s + (isIncluded(i) ? toNum(a.currentValue) : 0), 0)

  // ผลตอบแทนพอร์ต (weighted avg) — คำนวณจาก CAGR ให้ตรงกับหน้า "ข้อมูลสินทรัพย์และการลงทุน"
  let weightedReturn = 0
  let coveredVal = 0
  investmentAssets.forEach((a: any, i: number) => {
    if (!isIncluded(i)) return
    const val = toNum(a.currentValue)
    const r = assetReturn(a)
    if (r !== null && val > 0) { coveredVal += val; weightedReturn += r * val }
  })
  const portfolioReturn = coveredVal > 0 ? weightedReturn / coveredVal : null

  // ── ระดับความเสี่ยง → ความผันผวน (SD) ──────────────────────────────────────
  const riskSrc = isSelf ? profile : profile?.spouseRisk
  const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
  const tier: 'low' | 'mid' | 'high' =
    /สูง/.test(riskLabel) ? 'high'
    : /กลาง|ปานกลาง/.test(riskLabel) ? 'mid'
    : /ต่ำ/.test(riskLabel) ? 'low'
    : ((portfolioReturn ?? 0) >= 8 ? 'high' : (portfolioReturn ?? 0) >= 4 ? 'mid' : 'low')
  const SD_MAP = { low: 6, mid: 11, high: 16 } as const
  const TIER_LABEL = { low: 'ความเสี่ยงต่ำ', mid: 'ความเสี่ยงปานกลาง', high: 'ความเสี่ยงสูง' } as const
  const sigma = SD_MAP[tier]
  const N_SIM = 1000

  // ── Monte Carlo projection (GBM, seeded) → เปอร์เซ็นไทล์ P10 / P50 / P90 ต่อปี ──
  const rows = useMemo<Row[]>(() => {
    if (currentAge === null || portfolioReturn === null || totalValue <= 0) return []
    const mu = portfolioReturn / 100
    const sd = sigma / 100
    const years = expectedLifespan - currentAge
    const rng = mulberry32((Math.round(totalValue) ^ (Math.round(portfolioReturn * 100) << 3) ^ (sigma << 1) ^ 0x9e3779b9) >>> 0)
    const valuesByYear: number[][] = Array.from({ length: years + 1 }, () => [])
    for (let p = 0; p < N_SIM; p++) {
      let v = totalValue
      valuesByYear[0].push(v)
      for (let y = 1; y <= years; y++) {
        let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
        const u2 = rng()
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)  // Box-Muller
        v *= Math.exp((mu - (sd * sd) / 2) + sd * z)                          // GBM step
        valuesByYear[y].push(v)
      }
    }
    const currentYear = new Date().getFullYear()
    return valuesByYear.map((arr, y) => {
      const s = arr.slice().sort((a, b) => a - b)
      const p10 = percentile(s, 0.10), p50 = percentile(s, 0.50), p90 = percentile(s, 0.90)
      return { age: currentAge + y, year: currentYear + y, p10, p50, p90, band: [p10, p90] as [number, number] }
    })
  }, [totalValue, portfolioReturn, sigma, currentAge, expectedLifespan])

  // ── Scenario colors ────────────────────────────────────────────────────────
  const C_LOW  = '#fb7185'   // P10 (แย่)
  const C_MID  = '#06b6d4'   // median
  const C_HIGH = '#10b981'   // P90 (ดี)

  const retirementAge = retPlan?.[planKey]?.retirementAge ?? (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60

  const noData = totalValue === 0 || portfolioReturn === null || currentAge === null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrendingUp size={15} color="var(--cyan)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>มูลค่าสินทรัพย์ลงทุน</p>
      </div>

      {/* ── Info cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(165px, 100%), 1fr))', gap: 14 }}>
        {[
          { label: 'มูลค่าสินทรัพย์ลงทุน (ที่เลือก)', value: totalValue > 0 ? fmtFull(totalValue) : '—', color: '#10b981' },
          { label: 'ผลตอบแทนพอร์ต (ต่อปี)', value: portfolioReturn !== null ? `${portfolioReturn.toFixed(2)}%` : '—', color: 'var(--cyan-light)' },
          { label: 'อายุปัจจุบัน', value: currentAge !== null ? `${currentAge} ปี` : '—', color: 'var(--text-primary)' },
          { label: 'อายุขัยที่คาดไว้', value: `${expectedLifespan} ปี`, color: 'var(--text-primary)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: '14px 18px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
            <p style={{ fontSize: 17, fontWeight: 700, color, marginTop: 4 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Asset list (เลือกรายการที่จะนำมาคำนวณ) — order:1 ดันลงล่างสุด เพื่อให้กราฟอยู่บน ── */}
      {investmentAssets.length > 0 && (
        <div style={{ ...card, order: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>รายการสินทรัพย์ที่นำมาคำนวณ</p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              เลือก {investmentAssets.length - excluded.size}/{investmentAssets.length} รายการ · กดปุ่มเพื่อตัดออก/นำกลับ
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>สินทรัพย์</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ประเภท</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ผลตอบแทน</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>มูลค่าปัจจุบัน</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {investmentAssets.map((a: any, i: number) => {
                const inc = isIncluded(i)
                const r = assetReturn(a)
                const dim = inc ? 1 : 0.4
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)', background: inc ? 'transparent' : 'rgba(244,63,94,0.05)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 500, opacity: dim, textDecoration: inc ? 'none' : 'line-through' }}>{a.assetName || '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 12, opacity: dim }}>{a.assetClass || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--cyan-light)', opacity: dim }}>{r !== null ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}%` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981', opacity: dim }}>{fmtFull(toNum(a.currentValue))}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button onClick={() => toggleExclude(i)} title={inc ? 'ตัดออกจากการคำนวณ' : 'นำกลับมาคำนวณ'}
                        style={{ display: 'flex', margin: '0 auto', padding: 5, borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${inc ? 'var(--card-border)' : '#10b98155'}`, background: 'transparent',
                          color: inc ? 'var(--text-muted)' : '#10b981' }}>
                        {inc ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)' }}>
                <td colSpan={3} style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>รวม (ที่เลือก)</td>
                <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>{fmtFull(totalValue)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {noData ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {totalValue === 0
              ? 'กรุณากรอกข้อมูลสินทรัพย์การลงทุนในแท็บ "ข้อมูลลูกค้า → ข้อมูลสินทรัพย์และการลงทุน"'
              : portfolioReturn === null
              ? 'กรุณากรอก "ผลตอบแทน (ต่อปี)" ของสินทรัพย์แต่ละรายการในแท็บ "ข้อมูลลูกค้า → ข้อมูลสินทรัพย์และการลงทุน"'
              : 'กรุณากรอกวันเกิดในแท็บ "ข้อมูลลูกค้า"'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Legend ── */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'ดี (P90)', color: C_HIGH },
              { label: 'กลาง / คาดการณ์ (median)', color: C_MID },
              { label: 'แย่ (P10)', color: C_LOW },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 28, height: 3, background: color, borderRadius: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              จำลอง {N_SIM.toLocaleString()} ครั้ง · {TIER_LABEL[tier]} · SD {sigma}% · ผลตอบแทนคาดหวัง {portfolioReturn.toFixed(2)}%
            </span>
          </div>

          {/* ── Chart ── */}
          {(() => {
            const retireRow = rows.find(r => r.age === retirementAge)
            const showRetireLine = retirementAge >= (currentAge ?? 0) && retirementAge <= expectedLifespan

            const RetireLabel = (props: any) => {
              const { viewBox } = props
              if (!retireRow || !viewBox) return null
              const { x } = viewBox as { x: number; y: number; height: number }
              const boxW = 210, boxH = 90, pad = 10
              const bx = x + 8, by = 8
              return (
                <g>
                  <rect x={bx} y={by} width={boxW} height={boxH} rx={8}
                    fill="var(--card-bg)" stroke="#f59e0b" strokeWidth={1.5} opacity={0.97} />
                  <text x={bx + pad} y={by + 17} fontSize={12} fontWeight={700} fill="#f59e0b">เกษียณ อายุ {retirementAge} ปี</text>
                  <circle cx={bx + pad + 5} cy={by + 34} r={4} fill={C_HIGH} />
                  <text x={bx + pad + 15} y={by + 39} fontSize={13} fontWeight={700} fill={C_HIGH}>ดี {fmtFull(retireRow.p90)}</text>
                  <circle cx={bx + pad + 5} cy={by + 57} r={4} fill={C_MID} />
                  <text x={bx + pad + 15} y={by + 62} fontSize={13} fontWeight={700} fill={C_MID}>กลาง {fmtFull(retireRow.p50)}</text>
                  <circle cx={bx + pad + 5} cy={by + 80} r={4} fill={C_LOW} />
                  <text x={bx + pad + 15} y={by + 85} fontSize={13} fontWeight={700} fill={C_LOW}>แย่ {fmtFull(retireRow.p10)}</text>
                </g>
              )
            }

            return (
              <div style={card}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  มูลค่าสินทรัพย์ลงทุนในอนาคต — แบบจำลอง Monte Carlo (บาท)
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
                  จากอายุ {currentAge} ถึง {expectedLifespan} ปี · แถบทึบ = ช่วงผลลัพธ์ 80% (P10–P90) · เส้นกลาง = ค่ากลาง (median) · เส้นประส้ม = เกษียณ ({retirementAge} ปี)
                </p>
                <ChartFrame title="มูลค่าสินทรัพย์ลงทุนในอนาคต (Monte Carlo)" filename="investment-monte-carlo" height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 8, right: 24, left: 10, bottom: 8 }}>
                    <defs>
                      <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C_MID} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C_MID} stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--divider)" vertical={false} />
                    <XAxis dataKey="age" tickFormatter={v => `${v} ปี`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} interval={4} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false} />
                    <YAxis
                      tickFormatter={v => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={70} axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any, name: any) => Array.isArray(v) ? [`${fmtFull(v[0])} – ${fmtFull(v[1])}`, name] : [fmtFull(v), name]}
                      labelFormatter={age => `อายุ ${age} ปี (ปี ${rows.find(r => r.age === age)?.year ?? ''})`}
                      contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {showRetireLine && (
                      <ReferenceLine x={retirementAge} stroke="#f59e0b" strokeDasharray="4 4" label={<RetireLabel />} />
                    )}
                    <Area type="monotone" dataKey="band" stroke="none" fill="url(#mcBand)" name="ช่วง 80% (P10–P90)" />
                    <Line type="monotone" dataKey="p90" stroke={C_HIGH} dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="ดี (P90)" />
                    <Line type="monotone" dataKey="p50" stroke={C_MID}  dot={false} strokeWidth={2.5} activeDot={{ r: 4, strokeWidth: 0 }} name="ค่ากลาง (median)" />
                    <Line type="monotone" dataKey="p10" stroke={C_LOW}  dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="แย่ (P10)" />
                  </ComposedChart>
                </ResponsiveContainer>
                </ChartFrame>
              </div>
            )
          })()}

          {/* ── Table every 5 years ── */}
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>ตารางสรุปทุก 5 ปี (Monte Carlo)</p>
              <TableExcelButton filename="ตารางลงทุน-MonteCarlo" title="Monte Carlo" />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['อายุ', 'ปี พ.ศ.', 'แย่ (P10)', 'ค่ากลาง (median)', 'ดี (P90)'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'อายุ' || h === 'ปี พ.ศ.' ? 'left' : 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(r => r.age === currentAge || r.age === retirementAge || r.age % 5 === 0)
                  .filter((r, i, arr) => i === 0 || r.age !== arr[i - 1].age)
                  .map((row, idx) => {
                    const isRetire = row.age === retirementAge
                    return (
                      <tr key={row.age} style={{
                        background: isRetire ? 'rgba(245,158,11,0.08)' : idx % 2 ? 'var(--hover)' : 'transparent',
                      }}>
                        <td style={{ padding: '8px 12px', fontWeight: isRetire ? 700 : 400, color: isRetire ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {row.age} ปี {isRetire && '⭐ เกษียณ'}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{row.year}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C_LOW, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.p10)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C_MID, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.p50)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C_HIGH, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmt(row.p90)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
