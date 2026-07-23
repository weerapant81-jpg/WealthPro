import { describe, it, expect } from 'vitest'
import {
  INCOME_40, INCOME_40_LABELS, taxCodeOf, migrateIncomeLabel,
  isAnnualIncome, monthlyIncome, annualIncome,
  toNum, sumMonthlyIncome, findSalaryRow,
} from './income'

describe('toNum', () => {
  it('รองรับตัวเลขที่มีลูกน้ำ และไม่คืน NaN', () => {
    expect(toNum('1,234,567')).toBe(1234567)
    expect(toNum(500)).toBe(500)
    expect(toNum('')).toBe(0)
    expect(toNum(null)).toBe(0)
    expect(toNum('abc')).toBe(0)
  })
})

describe('sumMonthlyIncome', () => {
  it('รวมทุกแหล่งเป็นต่อเดือน โดยข้ามแถวยอด ≤ 0', () => {
    expect(sumMonthlyIncome([
      { label: '40(1) เงินเดือน/ค่าจ้าง/โบนัส', amount: '50000' },
      { label: '40(1) เงินเดือน/ค่าจ้าง/โบนัส', amount: '120000', freq: 'รายปี' },
      { label: '40(5) ค่าเช่าทรัพย์สิน', amount: '0' },
      { label: '40(8) ธุรกิจ', amount: '' },
    ])).toBe(60000)
  })
  it('ไม่มีข้อมูล → 0', () => {
    expect(sumMonthlyIncome([])).toBe(0)
    expect(sumMonthlyIncome(null)).toBe(0)
    expect(sumMonthlyIncome(undefined)).toBe(0)
  })
})

describe('findSalaryRow', () => {
  it('เลือกแถวที่ระบบดึงมาอัตโนมัติก่อน · เผื่อ label เดิม', () => {
    const auto = { label: '40(1) เงินเดือน/ค่าจ้าง/โบนัส', amount: '50000', auto: true }
    expect(findSalaryRow([{ label: 'อื่น', amount: '1' }, auto])).toBe(auto)
    expect(findSalaryRow([{ label: 'เงินเดือน', amount: '30000' }])?.amount).toBe('30000')
  })
  it('ไม่มีแถวเงินเดือน → undefined', () => {
    expect(findSalaryRow([{ label: '40(5) ค่าเช่า', amount: '1' }])).toBeUndefined()
    expect(findSalaryRow(null)).toBeUndefined()
  })
})

describe('INCOME_40 — หมวดเงินได้', () => {
  it('มีครบ 8 มาตรา เรียง 1–8', () => {
    expect(INCOME_40).toHaveLength(8)
    expect(INCOME_40.map(c => c.code)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })
  it('ทุก label ถอดรหัสมาตรากลับได้ตรงกัน', () => {
    for (const c of INCOME_40) expect(taxCodeOf(c.label)).toBe(c.code)
  })
})

describe('taxCodeOf', () => {
  it('ดึงเลขมาตราจาก label', () => {
    expect(taxCodeOf('40(4) ดอกเบี้ย/เงินปันผล')).toBe('4')
  })
  it('label ที่ไม่ใช่หมวด 40 → null', () => {
    expect(taxCodeOf('เงินเดือน')).toBeNull()
    expect(taxCodeOf('')).toBeNull()
    expect(taxCodeOf(undefined)).toBeNull()
  })
})

describe('migrateIncomeLabel — ข้อมูลเก่า → หมวด 40', () => {
  it('label ที่เป็นหมวด 40 อยู่แล้ว ไม่เปลี่ยน', () => {
    for (const l of INCOME_40_LABELS) expect(migrateIncomeLabel(l)).toBe(l)
  })
  it('แปลง label เดิมตามที่กำหนด', () => {
    expect(migrateIncomeLabel('เงินเดือน')).toBe(INCOME_40[0].label)
    expect(migrateIncomeLabel('โบนัส')).toBe(INCOME_40[0].label)
    expect(migrateIncomeLabel('เงินปันผล')).toBe(INCOME_40[3].label)
    expect(migrateIncomeLabel('รายได้จากการลงทุน')).toBe(INCOME_40[3].label)
    expect(migrateIncomeLabel('รายได้จากค่าเช่า')).toBe(INCOME_40[4].label)
    expect(migrateIncomeLabel('รายได้จากอาชีพเสริม')).toBe(INCOME_40[7].label)
  })
  it('label ที่ไม่รู้จัก/ว่าง → คืนค่าว่างให้ผู้ใช้เลือกเอง', () => {
    expect(migrateIncomeLabel('อื่นๆ')).toBe('')
    expect(migrateIncomeLabel(undefined)).toBe('')
  })
})

describe('isAnnualIncome', () => {
  it('freq ที่ระบุมีความสำคัญเหนือ label', () => {
    expect(isAnnualIncome({ freq: 'รายปี', label: 'อะไรก็ได้' })).toBe(true)
    expect(isAnnualIncome({ freq: 'รายเดือน', label: 'โบนัสประจำปี' })).toBe(false)
  })
  it('ไม่มี freq → default รายเดือน', () => {
    expect(isAnnualIncome({ label: '40(5) ค่าเช่าทรัพย์สิน' })).toBe(false)
    expect(isAnnualIncome({})).toBe(false)
  })
  it('ข้อมูลเก่า label "โบนัส" ที่ยังไม่มี freq → รายปี (backward-compat)', () => {
    expect(isAnnualIncome({ label: 'โบนัส' })).toBe(true)
  })
  // regression: label หมวด 40(1) มีคำว่า "โบนัส" อยู่ในตัว — ต้องไม่ถูกมองเป็นรายปี
  it('แถว 40(1) ที่ยังไม่มี freq = รายเดือน (ไม่สับสนกับคำว่า "โบนัส" ใน label)', () => {
    expect(isAnnualIncome({ label: INCOME_40[0].label })).toBe(false)
    expect(monthlyIncome({ label: INCOME_40[0].label, amount: '50000' })).toBe(50000)
  })
})

describe('monthlyIncome / annualIncome', () => {
  it('รายเดือน: monthly = amount, annual = amount*12', () => {
    const row = { freq: 'รายเดือน', label: '40(1)', amount: '50000' }
    expect(monthlyIncome(row)).toBe(50000)
    expect(annualIncome(row)).toBe(600000)
  })
  it('รายปี: monthly = amount/12, annual = amount', () => {
    const row = { freq: 'รายปี', label: '40(1)', amount: '120000' }
    expect(monthlyIncome(row)).toBe(10000)
    expect(annualIncome(row)).toBe(120000)
  })
  it('amount ว่าง/ไม่ใช่ตัวเลข → 0 ไม่ใช่ NaN', () => {
    for (const amount of ['', 'abc', undefined, null]) {
      expect(monthlyIncome({ amount })).toBe(0)
      expect(annualIncome({ amount })).toBe(0)
    }
  })
  it('รองรับ amount ที่เป็นตัวเลข (ไม่ใช่ string)', () => {
    expect(monthlyIncome({ amount: 1000 as any })).toBe(1000)
  })
  it('annual = monthly * 12 เสมอ ไม่ว่าจะกรอกแบบไหน', () => {
    for (const row of [
      { freq: 'รายเดือน', amount: '33333' },
      { freq: 'รายปี', amount: '400000' },
      { label: 'โบนัส', amount: '90000' },
    ]) expect(annualIncome(row)).toBeCloseTo(monthlyIncome(row) * 12, 6)
  })
})
