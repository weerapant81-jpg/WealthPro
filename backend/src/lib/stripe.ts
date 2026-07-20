import Stripe from 'stripe'
import type { Plan } from './plan'

let _stripe: Stripe | null = null

/** Stripe client (lazy) — โยน error ถ้ายังไม่ได้ตั้ง STRIPE_SECRET_KEY */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

/** ระบบชำระเงินพร้อมใช้งานไหม (ตั้ง env ครบ) */
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY

/** price ของแต่ละแพ็กเกจ (จาก env) */
export const priceFor = (plan: 'pro' | 'ai'): string =>
  (plan === 'pro' ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_AI) || ''

/** map price id → แพ็กเกจ (ใช้ตอนรับ webhook) */
export function priceToPlan(priceId?: string | null): Exclude<Plan, 'free'> | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_AI) return 'ai'
  return null
}
