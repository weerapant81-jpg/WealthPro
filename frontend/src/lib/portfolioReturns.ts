/* พอร์ตการลงทุน 3 ระดับความเสี่ยง — ใช้ร่วมกันระหว่างหน้า "สมมติฐานการลงทุน" และหน้าอื่นๆ
   (เช่น วางแผนทุนการศึกษา) เพื่อให้ดึงอัตราผลตอบแทนพอร์ตจากแหล่งเดียวกัน */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export type Asset = { id: string; name: string; cagr: number; sd: number; inPortfolio: boolean; live?: boolean; note?: string; asOf?: string }
export type PortfolioOption = { label: string; weights: [number, number, number, number] }
export type PortfolioSet = { id: string; label: string; sub: string; color: string; options: PortfolioOption[] }
export type CalcResult = { sigma: number; ret: number; sharpe: number }
export type WeightsMatrix = [number, number, number, number][]

export const DEFAULT_ASSETS: Asset[] = [
  { id: 'deposit', name: 'เงินฝากประจำ',            cagr: 1.00,  sd: 0.00,  inPortfolio: false },
  { id: 'bond',    name: 'ตราสารหนี้ระยะกลาง',       cagr: 3.00,  sd: 4.20,  inPortfolio: true  },
  { id: 'thai',    name: 'หุ้นไทย (SET TRI)',         cagr: 5.00,  sd: 16.20, inPortfolio: true  },
  { id: 'acwi',    name: 'หุ้นโลก (MSCI ACWI)',       cagr: 10.00, sd: 14.70, inPortfolio: true  },
  { id: 'sp500',   name: 'หุ้นสหรัฐฯ (S&P 500)',     cagr: 13.00, sd: 17.40, inPortfolio: true  },
]

// Correlation for 4 portfolio assets: Bond(0), Thai(1), ACWI(2), SP500(3)
export const DEFAULT_CORR: number[][] = [
  [1.00,  0.01, -0.50, -0.50],
  [0.01,  1.00,  0.70,  0.70],
  [-0.50, 0.70,  1.00,  0.95],
  [-0.50, 0.70,  0.95,  1.00],
]

export const PORTFOLIO_SETS: PortfolioSet[] = [
  {
    id: 'low', label: 'พอร์ตเสี่ยงต่ำ', sub: 'Conservative', color: '#10b981',
    options: [
      { label: 'ทางเลือกที่ 1', weights: [80, 10, 5,  5]  },
      { label: 'ทางเลือกที่ 2', weights: [75, 10, 5,  10] },
      { label: 'ทางเลือกที่ 3', weights: [70, 10, 5,  15] },
    ],
  },
  {
    id: 'med', label: 'พอร์ตเสี่ยงกลาง', sub: 'Moderate', color: '#f59e0b',
    options: [
      { label: 'ทางเลือกที่ 1', weights: [55, 15, 5,  25] },
      { label: 'ทางเลือกที่ 2', weights: [60, 10, 10, 20] },
      { label: 'ทางเลือกที่ 3', weights: [65, 15, 5,  15] },
    ],
  },
  {
    id: 'high', label: 'พอร์ตเสี่ยงสูง', sub: 'Aggressive', color: '#f43f5e',
    options: [
      { label: 'ทางเลือกที่ 1', weights: [10, 5,  10, 75] },
      { label: 'ทางเลือกที่ 2', weights: [20, 5,  15, 60] },
      { label: 'ทางเลือกที่ 3', weights: [30, 5,  15, 50] },
    ],
  },
]

export function computePortfolio(
  weights: [number, number, number, number],
  assets: Asset[],
  corr: number[][],
): CalcResult {
  const portAssets = assets.filter(a => a.inPortfolio)
  const [w1, w2, w3, w4] = weights.map(w => w / 100)
  const [s1, s2, s3, s4] = portAssets.map(a => a.sd / 100)
  const [r1, r2, r3, r4] = portAssets.map(a => a.cagr)

  const A = w1**2*s1**2 + w2**2*s2**2 + w3**2*s3**2 + w4**2*s4**2
  const B = 2*w1*w2*s1*s2*corr[0][1]
  const C = 2*w1*w3*s1*s3*corr[0][2]
  const D = 2*w1*w4*s1*s4*corr[0][3]
  const E = 2*w2*w3*s2*s3*corr[1][2]
  const F = 2*w2*w4*s2*s4*corr[1][3]
  const G = 2*w3*w4*s3*s4*corr[2][3]

  const variance = A + B + C + D + E + F + G
  const sigma = Math.sqrt(Math.max(variance, 0)) * 100
  const ret   = w1*r1 + w2*r2 + w3*r3 + w4*r4
  const sharpe = sigma > 0 ? ret / sigma : 0

  return { sigma, ret, sharpe }
}

export function initAllWeights(): WeightsMatrix[] {
  return PORTFOLIO_SETS.map(s => s.options.map(o => [...o.weights] as [number, number, number, number]))
}

// apply correlation matrix from API (4x4: Bond, Thai, ACWI, SP500)
export function applyCorrelation(base: number[][], data: any): { matrix: number[][]; live: boolean; sampleMonths: number } {
  const c = data?.correlation
  if (!c?.matrix || !c.live) return { matrix: base, live: false, sampleMonths: 0 }
  return { matrix: c.matrix, live: true, sampleMonths: c.sampleMonths }
}

// map API response to Asset array
export function applyMarketData(base: Asset[], data: any): Asset[] {
  const m = data?.assets
  if (!m) return base
  return base.map(a => {
    if (a.id === 'deposit' && m.deposit)
      return { ...a, cagr: m.deposit.cagr ?? a.cagr, sd: 0, live: m.deposit.live, note: m.deposit.note, asOf: m.deposit.asOf }
    if (a.id === 'bond' && m.bond)
      return { ...a, cagr: m.bond.cagr ?? a.cagr, sd: m.bond.sd ?? a.sd, live: m.bond.live, note: m.bond.note }
    if (a.id === 'thai' && m.thai)
      return { ...a, cagr: m.thai.cagr ?? a.cagr, sd: m.thai.sd ?? a.sd, live: m.thai.live, note: m.thai.note }
    if (a.id === 'acwi' && m.acwi)
      return { ...a, cagr: m.acwi.cagr ?? a.cagr, sd: m.acwi.sd ?? a.sd, live: m.acwi.live, note: m.acwi.note }
    if (a.id === 'sp500' && m.sp500)
      return { ...a, cagr: m.sp500.cagr ?? a.cagr, sd: m.sp500.sd ?? a.sd, live: m.sp500.live, note: m.sp500.note }
    return a
  })
}

export type PortfolioReturn = { id: string; label: string; color: string; ret: number }

/** อัตราผลตอบแทนพอร์ตที่ดีที่สุด (Sharpe สูงสุด) ของแต่ละระดับความเสี่ยง โดยใช้ข้อมูลตลาดล่าสุด */
export function usePortfolioReturns(): PortfolioReturn[] {
  const { data } = useQuery({
    queryKey: ['market-data'],
    queryFn: () => api.get('/market-data').then(r => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return useMemo(() => {
    const assets = applyMarketData(DEFAULT_ASSETS, data)
    const corr = applyCorrelation(DEFAULT_CORR, data).matrix
    const weights = initAllWeights()
    return PORTFOLIO_SETS.map((set, si) => {
      const results = weights[si].map(w => computePortfolio(w, assets, corr))
      const bestIdx = results.reduce((bi, r, i) => r.sharpe > results[bi].sharpe ? i : bi, 0)
      return { id: set.id, label: set.label, color: set.color, ret: results[bestIdx].ret }
    })
  }, [data])
}
