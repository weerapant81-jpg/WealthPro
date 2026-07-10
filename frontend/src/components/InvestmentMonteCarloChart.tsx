import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { ChartFrame } from './exportable'

/* กราฟจำลองมูลค่าสินทรัพย์ลงทุนในอนาคต (Monte Carlo) — ใช้ตรรกะเดียวกับแท็บ "มูลค่าสินทรัพย์ลงทุน"
   (นับทุกรายการ ไม่มีปุ่มตัดออก) เพื่อนำไปแสดงในแดชบอร์ด/หน้าอื่นได้ */

const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
const fmtFull = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n)
function annualizedReturn(cost: number, value: number, investDate: string): number | null {
  if (cost <= 0 || value <= 0 || !investDate) return null
  const start = new Date(investDate)
  if (isNaN(start.getTime())) return null
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1 / 365.25) return null
  return (Math.pow(value / cost, 1 / years) - 1) * 100
}
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
type Row = { age: number; year: number; p10: number; p50: number; p90: number; band: [number, number] }

const C_LOW = '#fb7185', C_MID = '#06b6d4', C_HIGH = '#10b981'
const N_SIM = 1000

export default function InvestmentMonteCarloChart({ person = 'self', height = 300 }: { person?: 'self' | 'spouse'; height?: number }) {
  const isSelf = person === 'self'
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })

  const key = isSelf ? 'self' : 'spouse'
  const birthDate = clientProfile?.birthDate ? new Date(clientProfile.birthDate) : null
  const selfAge = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : null
  const currentAge = isSelf ? selfAge : (clientProfile?.spouseAge ?? null)
  // อายุขัย/อายุเกษียณ = ตามสมมุติฐานแผนเกษียณเป็นหลัก → settings → ค่าเริ่มต้น (จบที่อายุขัย ไม่เกินไป)
  const expectedLifespan = retPlan?.[key]?.lifeExpectancy ?? (isSelf ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? 85
  const retirementAge = retPlan?.[key]?.retirementAge ?? (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
  const investmentAssets: any[] = invProfile?.investmentAssets ?? []

  const assetReturn = (a: any): number | null => {
    let r = annualizedReturn(toNum(a.investAmount), toNum(a.currentValue), a.investDate)
    if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
    return r
  }
  const totalValue = investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
  let weightedReturn = 0, coveredVal = 0
  investmentAssets.forEach((a: any) => {
    const val = toNum(a.currentValue), r = assetReturn(a)
    if (r !== null && val > 0) { coveredVal += val; weightedReturn += r * val }
  })
  const portfolioReturn = coveredVal > 0 ? weightedReturn / coveredVal : null

  const riskSrc = isSelf ? profile : profile?.spouseRisk
  const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
  const tier: 'low' | 'mid' | 'high' =
    /สูง/.test(riskLabel) ? 'high'
      : /กลาง|ปานกลาง/.test(riskLabel) ? 'mid'
        : /ต่ำ/.test(riskLabel) ? 'low'
          : ((portfolioReturn ?? 0) >= 8 ? 'high' : (portfolioReturn ?? 0) >= 4 ? 'mid' : 'low')
  const sigma = { low: 6, mid: 11, high: 16 }[tier]

  const rows = useMemo<Row[]>(() => {
    if (currentAge === null || portfolioReturn === null || totalValue <= 0) return []
    const mu = portfolioReturn / 100, sd = sigma / 100
    const years = expectedLifespan - currentAge
    const rng = mulberry32((Math.round(totalValue) ^ (Math.round(portfolioReturn * 100) << 3) ^ (sigma << 1) ^ 0x9e3779b9) >>> 0)
    const valuesByYear: number[][] = Array.from({ length: years + 1 }, () => [])
    for (let p = 0; p < N_SIM; p++) {
      let v = totalValue
      valuesByYear[0].push(v)
      for (let y = 1; y <= years; y++) {
        let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
        const u2 = rng()
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        v *= Math.exp((mu - (sd * sd) / 2) + sd * z)
        valuesByYear[y].push(v)
      }
    }
    const cy = new Date().getFullYear()
    return valuesByYear.map((arr, y) => {
      const srt = arr.slice().sort((a, b) => a - b)
      return { age: currentAge + y, year: cy + y, p10: percentile(srt, 0.10), p50: percentile(srt, 0.50), p90: percentile(srt, 0.90), band: [percentile(srt, 0.10), percentile(srt, 0.90)] as [number, number] }
    })
  }, [totalValue, portfolioReturn, sigma, currentAge, expectedLifespan])

  if (totalValue === 0 || portfolioReturn === null || currentAge === null) {
    return <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน — กรอกที่หน้าสินทรัพย์-ลงทุน</div>
  }
  const showRetire = retirementAge >= currentAge && retirementAge <= expectedLifespan

  return (
    <ChartFrame title="จำลองมูลค่าสินทรัพย์ลงทุน (Monte Carlo)" filename="monte-carlo" height={height}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="dashMcBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C_MID} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C_MID} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis dataKey="age" tickFormatter={v => `${v}`} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={4} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={44} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: any, name: any) => Array.isArray(v) ? [`${fmtFull(v[0])} – ${fmtFull(v[1])}`, name] : [fmtFull(v), name]}
          labelFormatter={age => `อายุ ${age} ปี`}
          contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {showRetire && <ReferenceLine x={retirementAge} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `เกษียณ ${retirementAge}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />}
        <Area type="monotone" dataKey="band" stroke="none" fill="url(#dashMcBand)" name="ช่วง 80% (P10–P90)" />
        <Line type="monotone" dataKey="p90" stroke={C_HIGH} dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="ดี (P90)" />
        <Line type="monotone" dataKey="p50" stroke={C_MID} dot={false} strokeWidth={2.5} name="ค่ากลาง (median)" />
        <Line type="monotone" dataKey="p10" stroke={C_LOW} dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="แย่ (P10)" />
      </ComposedChart>
    </ResponsiveContainer>
    </ChartFrame>
  )
}
