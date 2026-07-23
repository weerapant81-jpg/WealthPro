// ── ความถี่ของรายการรายรับ/รายจ่ายในตาราง Income & Expense (enum ในฐานข้อมูล) ──
// โมดูลกลาง: frontend และ backend ต้องแปลงหน่วยด้วยกติกาเดียวกัน

/** ค่าใน DB: 'MONTHLY' = ต่อเดือน · อย่างอื่น (เช่น 'YEARLY') = ต่อปี */
export const MONTHLY = 'MONTHLY'

export function isMonthlyFreq(frequency?: string | null): boolean {
  return frequency === MONTHLY
}

/** แปลงเป็นจำนวนต่อเดือน */
export function toMonthly(amount: number, frequency?: string | null): number {
  return isMonthlyFreq(frequency) ? amount : amount / 12
}

/** แปลงเป็นจำนวนต่อปี */
export function toAnnual(amount: number, frequency?: string | null): number {
  return isMonthlyFreq(frequency) ? amount * 12 : amount
}
