import { useAuth } from '../context/AuthContext'

export type Plan = 'free' | 'pro' | 'ai'
const RANK: Record<Plan, number> = { free: 0, pro: 1, ai: 2 }

/** สิทธิ์แพ็กเกจของผู้ใช้ที่ล็อกอิน — SUPER_ADMIN/ลูกค้า(USER) ได้เต็มเสมอ (backend คืน plan มาให้แล้ว) */
export function usePlan() {
  const { user } = useAuth()
  const full = user?.role === 'SUPER_ADMIN' || user?.role === 'USER'
  const plan: Plan = full ? 'ai' : ((user?.plan as Plan) || 'free')
  return {
    plan,
    hasPro: RANK[plan] >= RANK.pro,
    hasAI: plan === 'ai',
  }
}
