import crypto from 'crypto'
import axios from 'axios'

const ENV = process.env.SETTRADE_ENV ?? 'sandbox'
const IS_SANDBOX = ENV === 'sandbox'

const BASE_URL    = IS_SANDBOX ? 'https://open-api-test.settrade.com' : 'https://open-api.settrade.com'
const MARKET_URL  = IS_SANDBOX ? 'https://marketapi-test.settrade.com' : 'https://marketapi.settrade.com'

const APP_ID     = process.env.SETTRADE_APP_ID     ?? ''
const APP_SECRET = process.env.SETTRADE_APP_SECRET  ?? ''
const BROKER_ID  = IS_SANDBOX ? '098' : (process.env.SETTRADE_BROKER_ID ?? '')
const APP_CODE   = process.env.SETTRADE_APP_CODE   ?? ''

// ── ECDSA P-256 signature (same as Python SDK) ─────────────────────────────
function signECDSA(secret: string, content: string): string {
  const keyBytes = Buffer.from(secret, 'base64')
  // Wrap raw 32-byte private key into PKCS8 DER for P-256 (secp256r1)
  const pkcs8Header = Buffer.from(
    '308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420',
    'hex'
  )
  const pkcs8 = Buffer.concat([pkcs8Header, keyBytes])
  const privateKey = crypto.createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })
  const sign = crypto.createSign('SHA256')
  sign.update(content)
  return sign.sign(privateKey, 'hex')
}

// ── Token cache ────────────────────────────────────────────────────────────
let cachedToken: string | null = null
let tokenType: string = 'Bearer'
let refreshToken: string | null = null
let expiresAt: number = 0

async function login(): Promise<void> {
  const ts = Date.now().toString()
  const params = ''
  const content = `${APP_ID}.${params}.${ts}`
  const sig = signECDSA(APP_SECRET, content)

  const loginPath = `${BASE_URL}/api/oam/v1/${BROKER_ID}/broker-apps/${APP_CODE}/login`
  const res = await axios.post(loginPath, {
    apiKey: APP_ID,
    params,
    signature: sig,
    timestamp: ts,
  })

  cachedToken  = res.data.access_token
  tokenType    = res.data.token_type ?? 'Bearer'
  refreshToken = res.data.refresh_token
  expiresAt    = Math.floor(Date.now() / 1000) + (res.data.expires_in ?? 1800)
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) { await login(); return }
  try {
    const refreshPath = `${BASE_URL}/api/oam/v1/${BROKER_ID}/broker-apps/${APP_CODE}/refresh-token`
    const res = await axios.post(refreshPath, { apiKey: APP_ID, refreshToken })
    cachedToken  = res.data.access_token
    refreshToken = res.data.refresh_token
    expiresAt    = Math.floor(Date.now() / 1000) + (res.data.expires_in ?? 1800)
  } catch {
    await login()
  }
}

async function getToken(): Promise<string> {
  if (!cachedToken || Math.floor(Date.now() / 1000) >= expiresAt - 60) {
    await (cachedToken ? refreshAccessToken() : login())
  }
  return `${tokenType} ${cachedToken}`
}

// ── Market Data API ────────────────────────────────────────────────────────
async function marketGet(path: string, params?: Record<string, any>) {
  const auth = await getToken()
  const url = `${MARKET_URL}/api/marketdata/v3/${BROKER_ID}${path}`
  const res = await axios.get(url, {
    headers: { Authorization: auth },
    params,
  })
  return res.data
}

// quote ราคาปัจจุบัน + ข้อมูลหลักทรัพย์
export async function getQuote(symbol: string) {
  return marketGet(`/quote/${symbol}`)
}

// candlestick OHLCV — ใช้คำนวณผลตอบแทนย้อนหลัง
export async function getCandlestick(
  symbol: string,
  interval: '1D' | '1W' | '1M' = '1M',
  limit = 13   // 13 เดือน → คำนวณ 1Y return ได้
) {
  const url = `${MARKET_URL}/api/techchart/v3/${BROKER_ID}/candlesticks`
  const auth = await getToken()
  const res = await axios.get(url, {
    headers: { Authorization: auth },
    params: { symbol, interval, limit },
  })
  return res.data
}

// คำนวณผลตอบแทนต่อปี (%) จาก candlestick
export async function getAnnualReturn(symbol: string): Promise<number | null> {
  try {
    const data = await getCandlestick(symbol, '1M', 13)
    const candles: { close: number }[] = data?.data ?? data?.candles ?? data
    if (!Array.isArray(candles) || candles.length < 2) return null
    const oldest = candles[0].close
    const latest = candles[candles.length - 1].close
    if (!oldest || !latest) return null
    // annualised return จาก monthly data
    const n = candles.length - 1
    const totalReturn = (latest - oldest) / oldest
    const annual = (Math.pow(1 + totalReturn, 12 / n) - 1) * 100
    return Math.round(annual * 100) / 100
  } catch {
    return null
  }
}
