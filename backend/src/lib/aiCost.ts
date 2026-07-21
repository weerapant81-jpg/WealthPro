// ── ต้นทุน AI Copilot (Claude API) + เพดานโควตารายเดือนต่อผู้ใช้ ──
// ราคาต่อ 1 ล้าน token (USD) ของ claude-sonnet-5 — ปรับได้ผ่าน env ถ้าราคาปรับ
const USD_PER_M = {
  input: Number(process.env.AI_PRICE_IN || 3),          // input ปกติ
  cacheWrite: Number(process.env.AI_PRICE_CACHE_W || 3.75), // เขียน cache (1.25x)
  cacheRead: Number(process.env.AI_PRICE_CACHE_R || 0.3),   // อ่าน cache (0.1x)
  output: Number(process.env.AI_PRICE_OUT || 15),        // output
}
const USD_THB = Number(process.env.USD_THB || 35)

/** เพดานต้นทุน AI ต่อผู้ใช้ต่อเดือน (บาท) — 0 = ไม่จำกัด */
export const aiMonthlyCapThb = (): number => {
  const v = Number(process.env.AI_MONTHLY_CAP_THB)
  return Number.isFinite(v) ? v : 200
}

/** รอบเดือนปัจจุบัน "YYYY-MM" (เวลาไทย) */
export function currentPeriod(): string {
  const d = new Date(Date.now() + 7 * 3600 * 1000) // ปรับเป็น UTC+7
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** ต้นทุน (บาท) ของการเรียก 1 ครั้งจาก usage ที่ Anthropic คืนมา */
export function costThbFromUsage(u: Usage): number {
  const inTok = u.input_tokens ?? 0
  const cw = u.cache_creation_input_tokens ?? 0
  const cr = u.cache_read_input_tokens ?? 0
  const out = u.output_tokens ?? 0
  const usd =
    (inTok * USD_PER_M.input +
      cw * USD_PER_M.cacheWrite +
      cr * USD_PER_M.cacheRead +
      out * USD_PER_M.output) / 1_000_000
  return usd * USD_THB
}
