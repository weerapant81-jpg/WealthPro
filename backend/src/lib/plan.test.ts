import { describe, it, expect } from 'vitest'
import { PLANS, FREE_CLIENT_LIMIT, PROMO_FREE_UNTIL, isPromoFreeActive, effectivePlan, hasFeature } from './plan'

const DAY = 86400_000
const promoEnd = PROMO_FREE_UNTIL.getTime()

describe('PLANS / limits', () => {
  it('ราคาแพ็กเกจตรงกับที่ประกาศขาย', () => {
    expect(PLANS.free.price).toBe(0)
    expect(PLANS.pro.price).toBe(590)
    expect(PLANS.ai.price).toBe(890)
  })
  it('Free จำกัดลูกค้า 5 คน', () => {
    expect(FREE_CLIENT_LIMIT).toBe(5)
  })
})

describe('isPromoFreeActive — โปรฯ เปิดตัว', () => {
  it('ก่อน/ถึงวันสิ้นสุด = ใช้ได้', () => {
    expect(isPromoFreeActive(promoEnd - DAY)).toBe(true)
    expect(isPromoFreeActive(promoEnd)).toBe(true)
  })
  it('หลังวันสิ้นสุด = หมดโปรฯ', () => {
    expect(isPromoFreeActive(promoEnd + 1)).toBe(false)
    expect(isPromoFreeActive(promoEnd + 30 * DAY)).toBe(false)
  })
  it('วันสิ้นสุดเป็นวันที่ถูกต้อง (ไม่ใช่ Invalid Date)', () => {
    expect(Number.isNaN(promoEnd)).toBe(false)
  })
})

describe('effectivePlan', () => {
  it('ไม่มี user → free', () => {
    expect(effectivePlan(null)).toBe('free')
    expect(effectivePlan(undefined)).toBe('free')
  })
  it('SUPER_ADMIN และลูกค้า (USER) ได้สิทธิ์เต็มเสมอ', () => {
    expect(effectivePlan({ role: 'SUPER_ADMIN', plan: 'free' })).toBe('ai')
    expect(effectivePlan({ role: 'USER', plan: 'free' })).toBe('ai')
  })
  it('SUPER_ADMIN ไม่ถูกตัดสิทธิ์แม้แพ็กเกจหมดอายุ', () => {
    expect(effectivePlan({ role: 'SUPER_ADMIN', plan: 'pro', planExpiresAt: new Date(Date.now() - DAY) })).toBe('ai')
  })
  it('FA (ADMIN) ได้สิทธิ์เต็มระหว่างช่วงโปรฯ', () => {
    // ทดสอบเฉพาะเมื่อโปรฯ ยังไม่หมด — หลังหมดโปรฯ กติกาข้อนี้จะเลิกใช้เอง
    if (isPromoFreeActive()) {
      expect(effectivePlan({ role: 'ADMIN', plan: 'free' })).toBe('ai')
    } else {
      expect(effectivePlan({ role: 'ADMIN', plan: 'free' })).toBe('free')
    }
  })
  it('plan ที่ไม่รู้จัก → free', () => {
    expect(effectivePlan({ role: 'OTHER', plan: 'platinum' })).toBe('free')
    expect(effectivePlan({ role: 'OTHER', plan: null })).toBe('free')
  })
  it('แพ็กเกจหมดอายุ → free (บทบาทที่ไม่ได้รับยกเว้น)', () => {
    expect(effectivePlan({ role: 'OTHER', plan: 'ai', planExpiresAt: new Date(Date.now() - DAY) })).toBe('free')
  })
  it('ยังไม่หมดอายุ → ใช้แพ็กเกจตามจริง', () => {
    expect(effectivePlan({ role: 'OTHER', plan: 'pro', planExpiresAt: new Date(Date.now() + DAY) })).toBe('pro')
    expect(effectivePlan({ role: 'OTHER', plan: 'ai' })).toBe('ai')
  })
})

describe('hasFeature', () => {
  it('copilot เฉพาะแพ็กเกจ ai', () => {
    expect(hasFeature('ai', 'copilot')).toBe(true)
    expect(hasFeature('pro', 'copilot')).toBe(false)
    expect(hasFeature('free', 'copilot')).toBe(false)
  })
  it('ฟีเจอร์ pro ใช้ได้ทั้ง pro และ ai', () => {
    expect(hasFeature('pro', 'pro')).toBe(true)
    expect(hasFeature('ai', 'pro')).toBe(true)
    expect(hasFeature('free', 'pro')).toBe(false)
  })
  it('ฟีเจอร์ที่ไม่รู้จัก → ปฏิเสธ (fail closed)', () => {
    expect(hasFeature('ai', 'nope' as any)).toBe(false)
  })
})
