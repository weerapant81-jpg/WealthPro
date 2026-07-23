// ── ฟังก์ชันคณิตศาสตร์พื้นฐานที่ใช้ซ้ำทั้งแอป ──
// เดิมโค้ดเหล่านี้ถูกคัดลอกไปไว้ในหลายไฟล์ (mulberry32 7 ที่ · percentile 5 ที่ · annualizedReturn 6 ที่)
// ย้ายมารวมที่นี่เพื่อกันการแก้ที่เดียวแล้วอีกที่ไม่ตาม

/** แปลงค่าที่ผู้ใช้กรอก (string/number/มีลูกน้ำ) เป็นตัวเลข — ไม่คืน NaN */
export function toNum(v: any): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

/** ตัวสุ่มแบบกำหนด seed ได้ (deterministic) — ใช้กับ Monte Carlo เพื่อให้ผลลัพธ์ซ้ำเดิมได้ */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** เปอร์เซ็นไทล์จากอาร์เรย์ที่ "เรียงจากน้อยไปมากแล้ว" (p = 0–1) — ประมาณค่าเชิงเส้นระหว่างสองตำแหน่ง */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * ผลตอบแทนต่อปีแบบทบต้น (%) จากต้นทุน → มูลค่าปัจจุบัน นับจากวันที่ลงทุน
 * คืน null เมื่อข้อมูลไม่พอ: ต้นทุน/มูลค่า ≤ 0, ไม่มีวันที่, วันที่ไม่ถูกต้อง หรือลงทุนยังไม่ถึง 1 วัน
 */
export function annualizedReturn(cost: number, value: number, investDate: string, now: number = Date.now()): number | null {
  if (cost <= 0 || value <= 0 || !investDate) return null
  const start = new Date(investDate)
  if (isNaN(start.getTime())) return null
  const years = (now - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1 / 365.25) return null
  return (Math.pow(value / cost, 1 / years) - 1) * 100
}

// ตัวคูณ annuity แบบ "ออมเพิ่มขึ้นทุกปี" อัตรา g (growing annuity, จ่ายปลายงวด m งวด, คิดลด r)
// PV = S × factor โดย S = เงินออมปีแรก, งวดที่ k = S × (1+g)^(k-1)
export function growAnnuityFactor(r: number, g: number, m: number): number {
  if (m <= 0) return 0
  const q = (1 + g) / (1 + r)
  if (Math.abs(q - 1) < 1e-9) return m / (1 + g)
  return (1 / (1 + r)) * (1 - Math.pow(q, m)) / (1 - q)
}
