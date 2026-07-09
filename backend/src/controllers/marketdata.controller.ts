import { Request, Response } from 'express'
import axios from 'axios'

// ─── Cache (5 min TTL) ────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; ts: number }
const cache = new Map<string, CacheEntry<any>>()
const TTL = 5 * 60 * 1000

function getCached<T>(key: string): T | null {
  const e = cache.get(key)
  if (e && Date.now() - e.ts < TTL) return e.data
  return null
}
function setCached<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() })
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

// Returns map of "YYYY-MM" -> monthly return
function monthlyReturnMap(priceMap: Record<string, number>): Record<string, number> {
  const keys = Object.keys(priceMap).sort()
  const out: Record<string, number> = {}
  for (let i = 1; i < keys.length; i++) {
    out[keys[i]] = priceMap[keys[i]] / priceMap[keys[i - 1]] - 1
  }
  return out
}

function cagrFromPrices(prices: number[]): number {
  if (prices.length < 2) return 0
  const years = (prices.length - 1) / 12
  return (Math.pow(prices[prices.length - 1] / prices[0], 1 / years) - 1) * 100
}

// SD of monthly returns, annualized by * sqrt(12)
function annualizedSD(monthlyRets: number[]): number {
  if (monthlyRets.length < 2) return 0
  const mean = monthlyRets.reduce((s, r) => s + r, 0) / monthlyRets.length
  const variance = monthlyRets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (monthlyRets.length - 1)
  return Math.sqrt(variance) * Math.sqrt(12) * 100
}

// Pearson correlation using aligned dates
function pearson(a: Record<string, number>, b: Record<string, number>): number {
  const keys = Object.keys(a).filter(k => b[k] !== undefined)
  if (keys.length < 12) return 0
  const xs = keys.map(k => a[k])
  const ys = keys.map(k => b[k])
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length
  const my = ys.reduce((s, v) => s + v, 0) / ys.length
  const num = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(
    xs.reduce((s, v) => s + (v - mx) ** 2, 0) *
    ys.reduce((s, v) => s + (v - my) ** 2, 0)
  )
  return den === 0 ? 0 : num / den
}

// ─── Yahoo Finance: fetch monthly prices with dates ───────────────────────────

async function fetchYahooWithDates(symbol: string): Promise<{ priceMap: Record<string, number>; prices: number[] }> {
  const now = Math.floor(Date.now() / 1000)
  const tenYearsAgo = now - 10 * 365 * 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  const res = await axios.get(url, {
    params: { period1: tenYearsAgo, period2: now, interval: '1mo', events: 'history' },
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 10000,
  })
  const result = res.data?.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${symbol}`)
  const timestamps: number[] = result.timestamp ?? []
  const closes: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? []

  const priceMap: Record<string, number> = {}
  timestamps.forEach((t, i) => {
    if (closes[i] != null) {
      const d = new Date(t * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      priceMap[key] = closes[i]
    }
  })
  const prices = Object.keys(priceMap).sort().map(k => priceMap[k])
  return { priceMap, prices }
}

// ─── BOT API: Fixed Deposit Rate ─────────────────────────────────────────────

async function fetchBOTDepositRate(): Promise<{ rate: number; asOf: string }> {
  try {
    const res = await axios.get('https://api.bot.or.th/bot/public/financial-institutions-rates/v1/deposit/term', {
      params: { start_period: '2024-01', end_period: new Date().toISOString().slice(0, 7) },
      headers: { 'X-IBM-Client-Id': 'ask-for-api-key' },
      timeout: 8000,
    })
    const rows: any[] = res.data?.result?.data?.data_detail ?? []
    const last = rows.filter(r => r.period).sort((a, b) => b.period.localeCompare(a.period))[0]
    if (last) return { rate: parseFloat(last.avg_rate_12m ?? last.value ?? '0'), asOf: last.period }
  } catch { /* BOT API requires registration */ }
  return { rate: 1.50, asOf: 'ข้อมูลอ้างอิง' }
}

// ─── Build correlation matrix [Bond, Thai, ACWI, SP500] ──────────────────────

function buildCorrMatrix(
  retMaps: Record<string, number>[],  // [bond, thai, acwi, sp500]
): { matrix: number[][]; sampleMonths: number; live: boolean } {
  const n = retMaps.length
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1
      if (j < i) return 0 // fill lower half after
      return parseFloat(pearson(retMaps[i], retMaps[j]).toFixed(2))
    })
  )
  // mirror upper to lower
  for (let i = 0; i < n; i++)
    for (let j = 0; j < i; j++)
      matrix[i][j] = matrix[j][i]

  // count common months for bond vs thai (most restrictive pair)
  const commonKeys = Object.keys(retMaps[0]).filter(k => retMaps[1][k] !== undefined)
  return { matrix, sampleMonths: commonKeys.length, live: commonKeys.length >= 12 }
}

// ─── Main Controller ──────────────────────────────────────────────────────────

export async function getMarketData(_req: Request, res: Response) {
  const cached = getCached<any>('market_data')
  if (cached) return res.json({ ...cached, fromCache: true })

  const errors: string[] = []

  // Fetch all 4 assets + bond proxy (AGG) in parallel
  const [sp500Res, acwiRes, tdexRes, aggRes, botRes] = await Promise.allSettled([
    fetchYahooWithDates('^GSPC'),
    fetchYahooWithDates('ACWI'),
    fetchYahooWithDates('TDEX.BK'),
    fetchYahooWithDates('AGG'),   // iShares Core US Aggregate Bond — proxy for bond correlation
    fetchBOTDepositRate(),
  ])

  const extract = <T>(r: PromiseSettledResult<T>, fallback: T, label: string): T => {
    if (r.status === 'fulfilled') return r.value
    errors.push(`${label}: ${(r.reason as Error).message}`)
    return fallback
  }

  const emptyFetch: { priceMap: Record<string, number>; prices: number[] } = { priceMap: {}, prices: [] }
  const sp500Data = extract(sp500Res, emptyFetch, 'S&P 500')
  const acwiData  = extract(acwiRes,  emptyFetch, 'ACWI')
  const tdexData  = extract(tdexRes,  emptyFetch, 'SET')
  const aggData   = extract(aggRes,   emptyFetch, 'Bond(AGG)')
  const deposit   = extract(botRes,   { rate: 1.50, asOf: 'ข้อมูลอ้างอิง' }, 'BOT')

  // Compute asset metrics
  function assetStats(data: typeof emptyFetch, fallbackCagr: number, fallbackSd: number, note: string) {
    if (data.prices.length < 13) return { cagr: fallbackCagr, sd: fallbackSd, note: `${note} (ข้อมูลอ้างอิง)`, live: false }
    const mRets = Object.values(monthlyReturnMap(data.priceMap))
    return {
      cagr: parseFloat(cagrFromPrices(data.prices).toFixed(2)),
      sd:   parseFloat(annualizedSD(mRets).toFixed(2)),
      note, live: true,
    }
  }

  const sp500Stats = assetStats(sp500Data, 13.00, 17.40, 'S&P 500 (Yahoo Finance)')
  const acwiStats  = assetStats(acwiData,  10.00, 14.70, 'iShares MSCI ACWI ETF (Proxy)')
  const thaiStats  = assetStats(tdexData,  5.00,  16.20, 'TDEX ETF (Proxy SET TRI)')
  // Bond: use AGG for SD/note, keep ThaiBMA reference for CAGR
  const bondCagr   = 3.00  // ThaiBMA reference (no free API)
  const bondSd     = aggData.prices.length >= 13
    ? parseFloat(annualizedSD(Object.values(monthlyReturnMap(aggData.priceMap))).toFixed(2))
    : 4.20

  // ─── Correlation matrix ─────────────────────────────────────────────────────
  // Order: [Bond(AGG), Thai(TDEX), ACWI, SP500] — same order as portfolio weights
  const retMaps = [aggData, tdexData, acwiData, sp500Data].map(d =>
    Object.keys(d.priceMap).length > 0 ? monthlyReturnMap(d.priceMap) : {}
  )
  const corrResult = retMaps.every(m => Object.keys(m).length > 0)
    ? buildCorrMatrix(retMaps)
    : { matrix: null, sampleMonths: 0, live: false }

  const data = {
    fetchedAt: new Date().toISOString(),
    assets: {
      deposit: { cagr: deposit.rate, sd: 0.00, note: 'ธปท. เงินฝากประจำ 12 เดือน', asOf: deposit.asOf, live: deposit.asOf !== 'ข้อมูลอ้างอิง' },
      bond:    { cagr: bondCagr, sd: bondSd, note: aggData.prices.length >= 13 ? 'ThaiBMA อ้างอิง / SD: AGG ETF (Proxy)' : 'ค่าอ้างอิง', live: false },
      thai:    thaiStats,
      acwi:    acwiStats,
      sp500:   sp500Stats,
    },
    correlation: corrResult,  // { matrix: number[][], sampleMonths, live }
    errors,
  }

  setCached('market_data', data)
  res.json({ ...data, fromCache: false })
}

export async function refreshMarketData(_req: Request, res: Response) {
  cache.delete('market_data')
  return getMarketData(_req, res)
}
