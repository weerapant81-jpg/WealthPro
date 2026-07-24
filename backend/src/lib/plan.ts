// ── ระบบแพ็กเกจ (entitlement) ──
// free : แดชบอร์ด + จัดการข้อมูลลูกค้า
// pro  : ทุกเมนูวางแผน (ไม่รวม AI Copilot)
// ai   : ทุกเมนู + AI Copilot
export type Plan = 'free' | 'pro' | 'ai'
export type Feature = 'pro' | 'copilot'

export const PLANS: Record<Plan, { label: string; price: number }> = {
  free: { label: 'Free', price: 0 },
  pro:  { label: 'Pro',  price: 490 },
  ai:   { label: 'AI',   price: 690 },
}

/** จำนวนลูกค้าสูงสุดของแพ็กเกจ Free (Pro/AI = ไม่จำกัด) */
export const FREE_CLIENT_LIMIT = 5

// ── โปรโมชันเปิดตัว: ใช้ฟรีทุกเมนู (launch grace period) ──
// ถึงสิ้นสุดช่วงนี้ FA ที่ได้รับอนุมัติทุกคน = สิทธิ์เต็ม (ai) ไม่จำกัดลูกค้า
// หลังจากนั้นตกกลับ plan จริง (default free) แล้วเปิดระบบขายตามปกติ
// ปรับวันได้ผ่าน env PROMO_FREE_UNTIL (ISO) — ค่าเริ่มต้น 30 ก.ย. 2026 (สิ้นวัน เวลาไทย)
export const PROMO_FREE_UNTIL = new Date(process.env.PROMO_FREE_UNTIL || '2026-09-30T23:59:59+07:00')
export const isPromoFreeActive = (now: number = Date.now()): boolean =>
  !isNaN(PROMO_FREE_UNTIL.getTime()) && now <= PROMO_FREE_UNTIL.getTime()

/** ลำดับสิทธิ์ — ยิ่งสูงยิ่งครอบคลุม */
const RANK: Record<Plan, number> = { free: 0, pro: 1, ai: 2 }

type PlanUser = {
  role?: string | null
  plan?: string | null
  planExpiresAt?: Date | null
}

/** แพ็กเกจที่ใช้งานได้จริง ณ ตอนนี้ — SUPER_ADMIN/USER = เต็มเสมอ, FA ตกกลับ free เมื่อหมดอายุ */
export function effectivePlan(user: PlanUser | null | undefined): Plan {
  if (!user) return 'free'
  // ผู้ให้บริการ (SUPER_ADMIN) และเจ้าของข้อมูล (USER/ลูกค้า) ได้สิทธิ์เต็ม ไม่ถูกกั้นด้วยแพ็กเกจ FA
  if (user.role === 'SUPER_ADMIN' || user.role === 'USER') return 'ai'
  // ช่วงโปรโมชันเปิดตัว: FA ที่ได้รับอนุมัติทุกคนใช้ฟรีทุกเมนู (สิทธิ์เต็ม)
  if (user.role === 'ADMIN' && isPromoFreeActive()) return 'ai'
  const p = (user.plan ?? 'free') as Plan
  if (!RANK[p] && p !== 'free') return 'free'
  // หมดอายุแล้ว → free
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) return 'free'
  return p
}

/** แพ็กเกจนี้มีสิทธิ์ใช้ฟีเจอร์นี้ไหม */
export function hasFeature(plan: Plan, feature: Feature): boolean {
  if (feature === 'copilot') return plan === 'ai'
  if (feature === 'pro') return RANK[plan] >= RANK.pro
  return false
}
