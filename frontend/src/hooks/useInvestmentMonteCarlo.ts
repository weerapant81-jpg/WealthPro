import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

/* ค่ากลาง (median / P50) ของ "มูลค่าสินทรัพย์ลงทุนในอนาคต" ราย "อายุ" ตามแบบจำลอง Monte Carlo
   — ใช้ตรรกะเดียวกับหน้า "มูลค่าสินทรัพย์ลงทุน" (ProjectionInvestmentTab) แบบนับทุกรายการ (ไม่มีปุ่มตัดออก)
   คืน Map<อายุ, median> · ว่างเปล่าถ้าไม่มีข้อมูลพอคำนวณ */

const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

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
function annualizedReturn(cost: number, value: number, investDate: string): number | null {
  if (cost <= 0 || value <= 0 || !investDate) return null
  const start = new Date(investDate)
  if (isNaN(start.getTime())) return null
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1 / 365.25) return null
  return (Math.pow(value / cost, 1 / years) - 1) * 100
}

export function useInvestmentMedianByAge(isSelf: boolean): Map<number, number> {
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })

  return useMemo(() => {
    const map = new Map<number, number>()
    const invSrc: any = isSelf ? (invProfile ?? {}) : (invProfile?.spouseData ?? {})
    const assets: any[] = invSrc?.investmentAssets ?? []
    const birthDate = clientProfile?.birthDate ? new Date(clientProfile.birthDate) : null
    const currentAge = isSelf
      ? (birthDate ? new Date().getFullYear() - birthDate.getFullYear() : null)
      : (clientProfile?.spouseAge ?? null)
    const planKey = isSelf ? 'self' : 'spouse'
    const expectedLifespan = (isSelf ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? retPlan?.[planKey]?.lifeExpectancy ?? 85
    if (currentAge === null) return map

    const assetReturn = (a: any): number | null => {
      let r = annualizedReturn(toNum(a.investAmount), toNum(a.currentValue), a.investDate)
      if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
      return r
    }
    const totalValue = assets.reduce((s, a) => s + toNum(a.currentValue), 0)
    let weightedReturn = 0, coveredVal = 0
    assets.forEach(a => { const v = toNum(a.currentValue); const r = assetReturn(a); if (r !== null && v > 0) { coveredVal += v; weightedReturn += r * v } })
    const portfolioReturn = coveredVal > 0 ? weightedReturn / coveredVal : null
    if (portfolioReturn === null || totalValue <= 0) return map

    const riskSrc = isSelf ? profile : profile?.spouseRisk
    const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
    const tier: 'low' | 'mid' | 'high' =
      /สูง/.test(riskLabel) ? 'high'
      : /กลาง|ปานกลาง/.test(riskLabel) ? 'mid'
      : /ต่ำ/.test(riskLabel) ? 'low'
      : (portfolioReturn >= 8 ? 'high' : portfolioReturn >= 4 ? 'mid' : 'low')
    const sigma = ({ low: 6, mid: 11, high: 16 } as const)[tier]

    const mu = portfolioReturn / 100, sd = sigma / 100
    const years = Math.max(0, expectedLifespan - currentAge)
    const N_SIM = 1000
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
    valuesByYear.forEach((arr, y) => {
      const s = arr.slice().sort((a, b) => a - b)
      map.set(currentAge + y, percentile(s, 0.50))
    })
    return map
  }, [invProfile, clientProfile, profile, retPlan, isSelf])
}
