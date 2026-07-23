import { Request, Response } from 'express'
import axios from 'axios'

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Asset-class benchmark returns (% per year) ───────────────────────────────
const CLASS_BENCHMARKS: Record<string, number | null> = {
  'ตราสารตลาดเงิน':        1.5,
  'ตราสารหนี้ ในประเทศ':  3.0,
  'ตราสารหนี้ ต่างประเทศ': 4.0,
  'ตราสารหนี้ เอกชน':      4.5,
  'หุ้น ในประเทศ':         8.0,
  'หุ้น ต่างประเทศ':       10.0,
  'กองทุนรวม':             6.0,
  'Cryptocurrency':         null,
  'Forex':                  null,
  'ทองคำ':                  null,
  'อื่นๆ':                  null,
}

// ── Per-asset return cache ────────────────────────────────────────────────────
const assetCache = new Map<string, { value: number | null; ts: number }>()

// ── Yahoo Finance 1-year return ───────────────────────────────────────────────
async function yahooReturn(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=1y`
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    const closes: number[] = res.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close
    if (!closes || closes.length < 2) return null
    const valid = closes.filter((v: number) => v != null && !isNaN(v))
    if (valid.length < 2) return null
    const first = valid[0]
    const last  = valid[valid.length - 1]
    return parseFloat(((last - first) / first * 100).toFixed(2))
  } catch {
    return null
  }
}

// Finnomena API — Thai mutual fund 1-year return
async function finnomenaFundReturn(fundCode: string): Promise<number | null> {
  try {
    // Try direct fund code lookup
    const res = await axios.get(
      `https://api.finnomena.com/fund/public/rwdapp/v3/fund/${encodeURIComponent(fundCode.toUpperCase())}/nav/graph`,
      {
        params: { range: '1Y' },
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    )
    const data = res.data?.data?.nav_infos ?? res.data?.data
    if (!Array.isArray(data) || data.length < 2) return null
    const first = data[0]?.value ?? data[0]?.nav
    const last  = data[data.length - 1]?.value ?? data[data.length - 1]?.nav
    if (!first || !last) return null
    return parseFloat(((last - first) / first * 100).toFixed(2))
  } catch {}

  // Try performance summary endpoint
  try {
    const res2 = await axios.get(
      `https://api.finnomena.com/fund/public/rwdapp/v3/fund/${encodeURIComponent(fundCode.toUpperCase())}/perf`,
      {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      }
    )
    const perf = res2.data?.data
    const ret1y = perf?.['1Y'] ?? perf?.['1y'] ?? perf?.ytd ?? perf?.oneYear
    if (typeof ret1y === 'number') return parseFloat(ret1y.toFixed(2))
  } catch {}

  return null
}

const MS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://www.morningstar.co.th/',
  'Origin': 'https://www.morningstar.co.th',
}

async function morningstarFundReturn(identifier: string): Promise<number | null> {
  // Step 1: search for SecId
  let secId: string | null = null
  try {
    const searchRes = await axios.get(
      'https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security/screener',
      {
        params: {
          page: 1, pageSize: 1,
          sortOrder: 'LegalName asc',
          outputType: 'json', version: 1,
          languageId: 'th-TH', currencyId: 'THA',
          universeIds: 'FOTH$$ALL_2862',
          searchTerm: identifier, term: identifier,
          filters: '', subUniverseId: '',
        },
        timeout: 10000, headers: MS_HEADERS,
      }
    )
    const row = searchRes.data?.rows?.[0]
    if (!row) return null
    secId = row.SecId ?? row.secId ?? row.id ?? null
    // If return already in search result
    const direct = row.ReturnM12 ?? row.rp1Year ?? row.ReturnD1Y ?? row.OneYearReturn
    if (typeof direct === 'number' && !isNaN(direct)) return parseFloat(direct.toFixed(2))
  } catch (e: any) {
    console.error('[MS search]', e?.message)
    return null
  }

  if (!secId) return null

  // Step 2: fetch trailing returns by SecId
  try {
    const perfRes = await axios.get(
      `https://lt.morningstar.com/api/rest.svc/klr5zyak8x/security_details/${secId}`,
      {
        params: {
          viewId: 'performance', idtype: 'msid',
          currencyId: 'THA', languageId: 'th-TH',
          locale: 'th-TH', responseViewFormat: 'json',
        },
        timeout: 10000, headers: MS_HEADERS,
      }
    )
    const d = perfRes.data
    // Try common nested paths
    const trailing = d?.TrailingReturn ?? d?.trailingReturn
      ?? d?.fundData?.trailingReturns ?? d?.Returns?.Trailing
    if (trailing) {
      const r = trailing['1Year'] ?? trailing['1year'] ?? trailing['12Month']
        ?? trailing?.M12 ?? trailing?.['1Y']
      if (typeof r === 'number') return parseFloat(r.toFixed(2))
    }
    // Flat fields
    const flat = d?.ReturnM12 ?? d?.rp1Year ?? d?.OneYearReturn
    if (typeof flat === 'number') return parseFloat(flat.toFixed(2))
    console.warn('[MS perf] อ่านผลตอบแทนจากรูปแบบข้อมูลนี้ไม่ออก — ฟิลด์ที่ได้มา:', Object.keys(d ?? {}))
    return null
  } catch (e: any) {
    console.error('[MS perf]', e?.message)
    return null
  }
}

// Try multiple ticker formats from asset name alone
async function lookupReturn(name: string, assetClass?: string): Promise<number | null> {
  const n = name.trim().toUpperCase()
  if (!n) return null

  // กองทุนรวม — ลอง Finnomena ก่อน (เชี่ยวชาญกองทุนไทย)
  if (assetClass === 'กองทุนรวม') {
    const fnRet = await finnomenaFundReturn(name.trim())
    if (fnRet !== null) return fnRet
    const msRet = await morningstarFundReturn(name.trim())
    if (msRet !== null) return msRet
    return null
  }

  // Yahoo Finance: ลองหลาย format สำหรับ asset class อื่น
  const candidates = [
    `${n}.BK`,     // หุ้นไทย SET
    n,             // US stock / ETF
    `${n}-USD`,    // Crypto
    `${n}-USDT`,
    `${n}=F`,      // Futures (GC=F gold)
    `${n}USD=X`,   // Forex
  ]
  for (const ticker of candidates) {
    const r = await yahooReturn(ticker)
    if (r !== null) return r
  }

  // Fallback: ลอง Finnomena สำหรับทุก class
  const fnRet = await finnomenaFundReturn(name.trim())
  if (fnRet !== null) return fnRet

  return null
}

// ── Endpoint: GET /market-returns  (asset-class benchmarks) ──────────────────
let classCache: { data: Record<string, number | null>; ts: number } | null = null

export async function getMarketReturns(_req: Request, res: Response): Promise<void> {
  const now = Date.now()
  if (classCache && now - classCache.ts < CACHE_TTL) { res.json(classCache.data); return }

  // Fetch live: Crypto (BTC) and Gold via CoinGecko
  const data: Record<string, number | null> = { ...CLASS_BENCHMARKS }
  try {
    const btc = await axios.get(
      'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false',
      { timeout: 8000 }
    )
    const pct = btc.data?.market_data?.price_change_percentage_1y
    if (typeof pct === 'number') data['Cryptocurrency'] = parseFloat(pct.toFixed(2))
  } catch {}
  try {
    const gold = await axios.get(
      'https://api.coingecko.com/api/v3/coins/pax-gold?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false',
      { timeout: 8000 }
    )
    const pct = gold.data?.market_data?.price_change_percentage_1y
    if (typeof pct === 'number') data['ทองคำ'] = parseFloat(pct.toFixed(2))
  } catch {}

  classCache = { data, ts: now }
  res.json(data)
}

// ── Endpoint: POST /asset-return  { name, assetClass } ───────────────────────
export async function getAssetReturn(req: Request, res: Response): Promise<void> {
  const { name, assetClass } = req.body as { name: string; assetClass?: string }
  const key = `${assetClass ?? ''}::${(name ?? '').trim().toUpperCase()}`
  if (!(name ?? '').trim()) { res.json({ return: null }); return }

  const cached = assetCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) { res.json({ return: cached.value }); return }

  const value = await lookupReturn(name ?? '', assetClass)
  assetCache.set(key, { value, ts: Date.now() })
  res.json({ return: value })
}
