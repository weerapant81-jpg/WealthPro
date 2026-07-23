// ── เกณฑ์อัตราส่วนทางการเงิน 8 ตัว (แหล่งเดียว กัน drift) ──
// backend ใช้ตัดสิน state ที่ส่งให้หน้าเว็บ · frontend ใช้ตัวเลขเป้าหมายเดียวกัน
// ในการคำนวณ "ต้องเพิ่ม/ลดเท่าไหร่ถึงจะผ่านเกณฑ์" — ถ้าแก้เกณฑ์ ต้องแก้ที่นี่ที่เดียว

export type RatioState = 'good' | 'warning' | 'danger' | 'nodata'
export type RatioKey = 'ratio1' | 'ratio2' | 'ratio3' | 'ratio4' | 'ratio5' | 'ratio6' | 'ratio7' | 'ratio8'

type Rule =
  | { dir: 'min'; good: number; warning: number }          // ยิ่งมากยิ่งดี
  | { dir: 'max'; good: number; warning: number }          // ยิ่งน้อยยิ่งดี
  | { dir: 'band'; good: number; goodMax: number }         // ดีเมื่ออยู่ในช่วง · ต่ำกว่า = ระวัง · สูงกว่า = เกินจำเป็น

export const RATIO_RULES: Record<RatioKey, Rule> = {
  ratio1: { dir: 'min',  good: 1,   warning: 0.5 },  // สภาพคล่อง / หนี้ระยะสั้น (เท่า)
  ratio2: { dir: 'band', good: 3,   goodMax: 6 },    // เงินสำรองฉุกเฉิน (เดือน)
  ratio3: { dir: 'min',  good: 15,  warning: 10 },   // สภาพคล่อง / ความมั่งคั่งสุทธิ (%)
  ratio4: { dir: 'max',  good: 50,  warning: 70 },   // หนี้สินรวม / สินทรัพย์รวม (%)
  ratio5: { dir: 'max',  good: 35,  warning: 45 },   // ภาระผ่อนหนี้รวม / รายได้ (%)
  ratio6: { dir: 'max',  good: 15,  warning: 20 },   // หนี้ไม่จดจำนอง / รายได้ (%)
  ratio7: { dir: 'min',  good: 10,  warning: 5 },    // อัตราการออม (%)
  ratio8: { dir: 'min',  good: 50,  warning: 25 },   // สินทรัพย์ลงทุน / ความมั่งคั่งสุทธิ (%)
}

/** ค่าเป้าหมายที่ถือว่า "ผ่านเกณฑ์" ของอัตราส่วนนั้น — ใช้คำนวณช่องว่างในคำแนะนำ */
export const ratioTarget = (key: RatioKey): number => RATIO_RULES[key].good

/** ขอบบนของช่วงที่ดี (เฉพาะอัตราส่วนแบบช่วง เช่น เงินสำรองฉุกเฉิน 3–6 เดือน) */
export const ratioTargetMax = (key: RatioKey): number | null => {
  const r = RATIO_RULES[key]
  return r.dir === 'band' ? r.goodMax : null
}

/** สถานะของอัตราส่วนตามเกณฑ์ — null (ไม่มีข้อมูล) → 'nodata' */
export function ratioState(key: string, value: number | null | undefined): RatioState {
  if (value === null || value === undefined || isNaN(value)) return 'nodata'
  const rule = RATIO_RULES[key as RatioKey]
  if (!rule) return 'nodata'
  switch (rule.dir) {
    case 'min':  return value >= rule.good ? 'good' : value >= rule.warning ? 'warning' : 'danger'
    case 'max':  return value <  rule.good ? 'good' : value <  rule.warning ? 'warning' : 'danger'
    case 'band': return (value >= rule.good && value <= rule.goodMax) ? 'good' : value < rule.good ? 'warning' : 'danger'
  }
}

// ── คะแนนสุขภาพการเงิน (0–100) — แปลงจากสถานะอัตราส่วน ──
export const RATIO_CATEGORIES = {
  liquidity: ['ratio1', 'ratio2', 'ratio3'] as RatioKey[],
  debt:      ['ratio4', 'ratio5', 'ratio6'] as RatioKey[],
  savings:   ['ratio7', 'ratio8'] as RatioKey[],
}

export const scoreOfState = (st: RatioState | string): number | null =>
  st === 'good' ? 100 : st === 'warning' ? 60 : st === 'danger' ? 20 : null

/** คะแนนเฉลี่ยของหมวด — ข้ามอัตราส่วนที่ไม่มีข้อมูล · ไม่มีข้อมูลเลย → null */
export function categoryScore(keys: RatioKey[], stateOf: (k: RatioKey) => RatioState | string): number | null {
  const vals: number[] = []
  for (const k of keys) {
    const s = scoreOfState(stateOf(k))
    if (s !== null) vals.push(s)
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}
