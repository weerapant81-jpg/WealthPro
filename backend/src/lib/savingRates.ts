// ── อัตราดอกเบี้ยการออมอ้างอิง (ธนาคารแห่งประเทศไทย) ──
// ใช้ API ของ ธปท. gateway ใหม่ (gateway.api.bot.or.th) — ต้องมี BOT_API_KEY ใน env
// แสดงเป็นข้อมูลอ้างอิงอย่างเดียว ที่ปรึกษาแก้ไม่ได้ และไม่ถูกนำไปคำนวณอัตโนมัติ
//
// endpoint + รูปแบบ JSON ยืนยันจากการยิงจริงแล้ว (23 ก.ค. 2569):
//   /DepositRate/v2/deposit_rate/               → อัตราดอกเบี้ยเงินฝากรายธนาคาร
//   /Stat-InterbankTransactionRate/v2/INTRBNK_TXN_RATE/ → อัตราดอกเบี้ยกู้ยืมระหว่างธนาคาร
//   /PolicyRate/v3/policy_rate/                 → อัตราดอกเบี้ยนโยบาย
// ข้อจำกัด: ขอข้อมูลได้ครั้งละไม่เกิน 31 วัน · โควตา 200 ครั้ง/ชั่วโมง (เราแคช 24 ชม.)
import axios from 'axios'

const BASE = 'https://gateway.api.bot.or.th'
const CACHE_MS = 24 * 60 * 60 * 1000
const TIMEOUT_MS = 15000
const LOOKBACK_DAYS = 14        // เผื่อวันหยุดยาว — ต้องไม่เกิน 31

export type RateRow = {
  key: string
  label: string
  value: number | null          // % ต่อปี · null = ยังไม่มีข้อมูล
  detail: string                // ที่มาของตัวเลข เช่น "เฉลี่ย 15 ธนาคาร"
  note?: string                 // เหตุผลที่ยังไม่มีข้อมูล
}

export type SavingRatesRef = {
  source: string
  sourceUrl: string
  asOf: string | null           // วันที่ของข้อมูลล่าสุด (YYYY-MM-DD)
  rows: RateRow[]
  fetchedAt: string
}

let cache: { at: number; data: SavingRatesRef } | null = null

const round2 = (n: number) => Math.round(n * 100) / 100
const num = (v: any): number | null => {
  const n = parseFloat(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}
const ymd = (d: Date) => d.toISOString().slice(0, 10)
/** YYYY-MM-DD (ค.ศ.) → DD/MM/พ.ศ. */
const thaiDate = (iso: string | null | undefined): string | null => {
  const m = String(iso ?? '').match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${Number(m[1]) + 543}` : null
}
const avg = (xs: number[]): number | null => xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null

function botGet(path: string, params: Record<string, any>) {
  const key = process.env.BOT_API_KEY ?? ''
  if (!key) throw new Error('BOT_API_KEY not set')
  return axios.get(`${BASE}${path}`, {
    params,
    timeout: TIMEOUT_MS,
    headers: { Authorization: `Bearer ${key}` },
  })
}

const detailOf = (res: any) => res?.data?.result?.data?.data_detail
const periodRange = () => {
  const end = new Date()
  const start = new Date(end.getTime() - LOOKBACK_DAYS * 86400_000)
  return { start_period: ymd(start), end_period: ymd(end) }
}

/** แถวของ "งวดล่าสุด" ที่มีข้อมูลจริง */
function latestPeriodRows<T extends { period?: string }>(rows: T[]): { period: string; rows: T[] } | null {
  const periods = rows.map(r => String(r.period ?? '')).filter(Boolean).sort()
  const latest = periods[periods.length - 1]
  if (!latest) return null
  return { period: latest, rows: rows.filter(r => String(r.period) === latest) }
}

/** ดอกเบี้ยเงินฝาก — เฉลี่ยข้ามธนาคารพาณิชย์ที่จดทะเบียนในไทย (ใช้กึ่งกลางของช่วง min–max ของแต่ละธนาคาร) */
async function fetchDepositRates(): Promise<{ asOf: string; saving: number | null; fixed: Record<string, number | null>; banks: number } | null> {
  const res = await botGet('/DepositRate/v2/deposit_rate/', periodRange())
  const all = detailOf(res)
  if (!Array.isArray(all) || !all.length) return null
  const thai = all.filter((r: any) => String(r?.bank_type_name_eng ?? '').includes('registered in Thailand'))
  const latest = latestPeriodRows(thai.length ? thai : all)
  if (!latest) return null

  // กึ่งกลางของ min–max ต่อธนาคาร แล้วเฉลี่ยข้ามธนาคาร (ข้ามธนาคารที่ไม่ประกาศ)
  const midOf = (r: any, f: string): number | null => {
    const lo = num(r[`${f}_min`]), hi = num(r[`${f}_max`])
    if (lo === null && hi === null) return null
    if (lo === null) return hi
    if (hi === null) return lo
    return (lo + hi) / 2
  }
  const avgField = (f: string) => avg(latest.rows.map((r: any) => midOf(r, f)).filter((v): v is number => v !== null && v > 0))

  return {
    asOf: latest.period,
    saving: avgField('saving'),
    fixed: {
      m3: avgField('fix_3_mths'), m6: avgField('fix_6_mths'),
      m12: avgField('fix_12_mths'), m24: avgField('fix_24_mths'),
    },
    banks: latest.rows.length,
  }
}

/** ตลาดเงิน — อัตรากู้ยืมระหว่างธนาคารข้ามคืน (O/N) ถ่วงน้ำหนัก */
async function fetchMoneyMarket(): Promise<{ asOf: string; value: number } | null> {
  const res = await botGet('/Stat-InterbankTransactionRate/v2/INTRBNK_TXN_RATE/', periodRange())
  const all = detailOf(res)
  if (!Array.isArray(all)) return null
  const on = all.filter((r: any) => String(r?.term_type_name_eng ?? '').trim() === 'O/N' && num(r?.weighted_average_interest_rate) !== null)
  const latest = latestPeriodRows(on)
  const v = latest ? num(latest.rows[0]?.weighted_average_interest_rate) : null
  return latest && v !== null ? { asOf: latest.period, value: round2(v) } : null
}

/** อัตราดอกเบี้ยนโยบาย (กนง.) */
async function fetchPolicyRate(): Promise<{ asOf: string | null; value: number } | null> {
  const res = await botGet('/PolicyRate/v3/policy_rate/', {})
  const r = res?.data?.result
  const v = num(r?.data)
  return v !== null ? { asOf: thaiDate(String(r?.announcement_date ?? '').replace(/\//g, '-')), value: v } : null
}


/** ดึงอัตราดอกเบี้ยการออมอ้างอิงทั้งหมด — คืน null ถ้าไม่มี key หรือดึงไม่ได้เลย */
export async function getSavingRatesRef(): Promise<SavingRatesRef | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
  if (!process.env.BOT_API_KEY) return null

  const [dep, mm, pol] = await Promise.all([
    fetchDepositRates().catch(() => null),
    fetchMoneyMarket().catch(() => null),
    fetchPolicyRate().catch(() => null),
  ])
  if (!dep && !mm && !pol) return cache?.data ?? null

  const fixedParts = dep
    ? ([['3 เดือน', dep.fixed.m3], ['6 เดือน', dep.fixed.m6], ['12 เดือน', dep.fixed.m12], ['24 เดือน', dep.fixed.m24]] as const)
      .filter(([, v]) => v !== null).map(([l, v]) => `${l} ${v!.toFixed(2)}%`)
    : []

  const rows: RateRow[] = [
    {
      key: 'saving', label: 'เงินฝากออมทรัพย์', value: dep?.saving ?? null,
      detail: dep ? `เฉลี่ยธนาคารพาณิชย์ไทย ${dep.banks} แห่ง` : '',
      ...(dep ? {} : { note: 'ดึงข้อมูลไม่สำเร็จ' }),
    },
    {
      key: 'fixed', label: 'เงินฝากประจำ 12 เดือน', value: dep?.fixed.m12 ?? null,
      detail: fixedParts.length ? fixedParts.join(' · ') : '',
      ...(dep ? {} : { note: 'ดึงข้อมูลไม่สำเร็จ' }),
    },
    {
      key: 'moneyMarket', label: 'ตลาดเงิน', value: mm?.value ?? null,
      detail: mm ? 'กู้ยืมระหว่างธนาคารข้ามคืน (O/N) ถ่วงน้ำหนัก' : '',
      ...(mm ? {} : { note: 'ดึงข้อมูลไม่สำเร็จ' }),
    },
    // พันธบัตรระยะสั้น/ระยะยาว — ตัดออก เพราะไม่มีชุดข้อมูลนี้ใน API ของ ธปท. ที่เข้าถึงได้
    {
      key: 'policy', label: 'อัตราดอกเบี้ยนโยบาย (กนง.)', value: pol?.value ?? null,
      detail: pol?.asOf ? `ประกาศ ${pol.asOf}` : '',
      ...(pol ? {} : { note: 'ดึงข้อมูลไม่สำเร็จ' }),
    },
  ]

  const data: SavingRatesRef = {
    source: 'ธนาคารแห่งประเทศไทย (BOT API)',
    sourceUrl: 'https://www.bot.or.th/th/statistics/interest-rate.html',
    asOf: dep?.asOf ?? mm?.asOf ?? null,
    rows,
    fetchedAt: new Date().toISOString(),
  }
  cache = { at: Date.now(), data }
  return data
}
