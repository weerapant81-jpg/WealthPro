import { describe, it, expect } from 'vitest'
import { aiMonthlyCapThb, currentPeriod, costThbFromUsage } from './aiCost'

// ราคา default: in 3 / cacheWrite 3.75 / cacheRead 0.3 / out 15 USD ต่อล้าน token, USD_THB = 35
const perM = (usd: number) => (usd / 1_000_000) * 35

describe('aiMonthlyCapThb', () => {
  it('ไม่ตั้ง env → เพดาน default 200 บาท/เดือน', () => {
    expect(aiMonthlyCapThb()).toBe(200)
  })
  it('ตั้ง env เป็นตัวเลข → ใช้ค่านั้น (0 = ไม่จำกัด)', () => {
    const old = process.env.AI_MONTHLY_CAP_THB
    process.env.AI_MONTHLY_CAP_THB = '500'
    expect(aiMonthlyCapThb()).toBe(500)
    process.env.AI_MONTHLY_CAP_THB = '0'
    expect(aiMonthlyCapThb()).toBe(0)
    process.env.AI_MONTHLY_CAP_THB = 'abc'   // ค่าเสีย → ตกกลับ default
    expect(aiMonthlyCapThb()).toBe(200)
    if (old === undefined) delete process.env.AI_MONTHLY_CAP_THB
    else process.env.AI_MONTHLY_CAP_THB = old
  })
})

describe('currentPeriod — รอบเดือน (เวลาไทย)', () => {
  it('รูปแบบ YYYY-MM', () => {
    expect(currentPeriod()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
  })
  it('ตรงกับเดือนตามเวลาไทยของเครื่อง ณ ตอนนี้', () => {
    const d = new Date(Date.now() + 7 * 3600 * 1000)
    expect(currentPeriod()).toBe(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  })
})

describe('costThbFromUsage', () => {
  it('usage ว่าง → 0', () => {
    expect(costThbFromUsage({})).toBe(0)
  })
  it('field เป็น null (ไม่มี cache) → นับเป็น 0 ไม่ใช่ NaN', () => {
    const c = costThbFromUsage({ input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: null, cache_read_input_tokens: null })
    expect(Number.isNaN(c)).toBe(false)
    expect(c).toBeCloseTo(1000 * perM(3) + 100 * perM(15), 10)
  })
  it('คิดราคาแยกตามชนิด token', () => {
    expect(costThbFromUsage({ input_tokens: 1_000_000 })).toBeCloseTo(3 * 35, 10)
    expect(costThbFromUsage({ output_tokens: 1_000_000 })).toBeCloseTo(15 * 35, 10)
    expect(costThbFromUsage({ cache_creation_input_tokens: 1_000_000 })).toBeCloseTo(3.75 * 35, 10)
    expect(costThbFromUsage({ cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.3 * 35, 10)
  })
  it('อ่าน cache ถูกกว่า input ปกติ · output แพงที่สุด', () => {
    const one = (k: string) => costThbFromUsage({ [k]: 10_000 } as any)
    expect(one('cache_read_input_tokens')).toBeLessThan(one('input_tokens'))
    expect(one('input_tokens')).toBeLessThan(one('cache_creation_input_tokens'))
    expect(one('cache_creation_input_tokens')).toBeLessThan(one('output_tokens'))
  })
  it('รวมทุกชนิดเข้าด้วยกัน', () => {
    const c = costThbFromUsage({
      input_tokens: 2000, output_tokens: 500,
      cache_creation_input_tokens: 1000, cache_read_input_tokens: 8000,
    })
    expect(c).toBeCloseTo(2000 * perM(3) + 500 * perM(15) + 1000 * perM(3.75) + 8000 * perM(0.3), 10)
  })
})
