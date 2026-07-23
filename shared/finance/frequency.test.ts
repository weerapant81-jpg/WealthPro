import { describe, it, expect } from 'vitest'
import { toMonthly, toAnnual, isMonthlyFreq } from './frequency'
import { HOUSING_CATS, NON_MORTGAGE_CATS, DEBT_PAYMENT_CATS, isNonMortgageDebt, isShortTermDebt } from './debt'

describe('frequency — แปลงหน่วยรายการรายรับ/รายจ่าย', () => {
  it("'MONTHLY' = ต่อเดือน · อย่างอื่นถือเป็นต่อปี", () => {
    expect(isMonthlyFreq('MONTHLY')).toBe(true)
    expect(isMonthlyFreq('YEARLY')).toBe(false)
    expect(isMonthlyFreq(null)).toBe(false)
    expect(isMonthlyFreq(undefined)).toBe(false)
  })
  it('toMonthly / toAnnual', () => {
    expect(toMonthly(12000, 'MONTHLY')).toBe(12000)
    expect(toMonthly(12000, 'YEARLY')).toBe(1000)
    expect(toAnnual(12000, 'MONTHLY')).toBe(144000)
    expect(toAnnual(12000, 'YEARLY')).toBe(12000)
  })
  it('toAnnual = toMonthly × 12 เสมอ', () => {
    for (const f of ['MONTHLY', 'YEARLY']) {
      expect(toAnnual(7777, f)).toBeCloseTo(toMonthly(7777, f) * 12, 6)
    }
  })
})

describe('debt — การจัดหมวดหนี้', () => {
  it('ภาระผ่อนหนี้รวม = ผ่อนบ้าน/คอนโด + ผ่อนรถ + หนี้ไม่จดจำนอง', () => {
    expect(DEBT_PAYMENT_CATS).toEqual([...HOUSING_CATS, 'fixed_car_loan', ...NON_MORTGAGE_CATS])
  })
  it('หนี้ไม่จดจำนอง ไม่รวมผ่อนบ้านและผ่อนรถ', () => {
    for (const c of [...HOUSING_CATS, 'fixed_car_loan']) expect(NON_MORTGAGE_CATS).not.toContain(c)
  })
  it('isNonMortgageDebt จับประเภทหนี้จากข้อความที่ผู้ใช้กรอก', () => {
    for (const t of ['บัตรเครดิต', 'สินเชื่อส่วนบุคคล', 'วงเงินเบิกเกินบัญชี', 'OD ธนาคาร', 'หนี้การศึกษา', 'กยศ.'])
      expect(isNonMortgageDebt(t)).toBe(true)
    for (const t of ['สินเชื่อบ้าน', 'ผ่อนรถยนต์', 'คอนโด', '', null, undefined])
      expect(isNonMortgageDebt(t)).toBe(false)
  })
  it('หนี้ระยะสั้น = ครบกำหนดภายใน 1 ปี · ค่าว่างถือเป็นระยะสั้น', () => {
    expect(isShortTermDebt(1)).toBe(true)
    expect(isShortTermDebt('0.5')).toBe(true)
    expect(isShortTermDebt(1.01)).toBe(false)
    expect(isShortTermDebt(30)).toBe(false)
    expect(isShortTermDebt(null)).toBe(true)
    expect(isShortTermDebt('')).toBe(true)
  })
})
