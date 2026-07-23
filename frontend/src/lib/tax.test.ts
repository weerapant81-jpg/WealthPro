import { describe, it, expect } from 'vitest'
import { calcTax, marginalRate, expenseDefaults, expenseFor, defaultState, calc, EXPENSE_KEYS } from './tax'

describe('calcTax — ภาษีขั้นบันได', () => {
  it('เงินได้สุทธิ ≤ 150,000 ยกเว้นภาษี', () => {
    expect(calcTax(0)).toBe(0)
    expect(calcTax(150000)).toBe(0)
  })
  it('ค่าติดลบ/ศูนย์ ไม่ติดลบ', () => {
    expect(calcTax(-50000)).toBe(0)
  })
  it('ขั้น 5% คิดเฉพาะส่วนเกิน 150,000', () => {
    expect(calcTax(300000)).toBeCloseTo(7500, 6)      // 150k * 5%
    expect(calcTax(200000)).toBeCloseTo(2500, 6)      // 50k * 5%
  })
  it('ขั้น 10% สะสมต่อจากขั้นก่อนหน้า', () => {
    expect(calcTax(500000)).toBeCloseTo(27500, 6)     // 7,500 + 200k*10%
  })
  it('ครบทุกขั้นถึง 5,000,000', () => {
    expect(calcTax(750000)).toBeCloseTo(65000, 6)     // +250k*15%
    expect(calcTax(1000000)).toBeCloseTo(115000, 6)   // +250k*20%
    expect(calcTax(2000000)).toBeCloseTo(365000, 6)   // +1M*25%
    expect(calcTax(5000000)).toBeCloseTo(1265000, 6)  // +3M*30%
  })
  it('ขั้นสูงสุด 35% สำหรับส่วนเกิน 5,000,000', () => {
    expect(calcTax(6000000)).toBeCloseTo(1265000 + 350000, 6)
  })
  it('เป็นฟังก์ชันไม่ลด (เงินได้เพิ่ม ภาษีไม่ลด)', () => {
    let prev = -1
    for (let i = 0; i <= 6000000; i += 137000) {
      const t = calcTax(i)
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })
})

describe('marginalRate — อัตราภาษีขั้นสูงสุดที่โดน', () => {
  it('คืนเป็นเปอร์เซ็นต์', () => {
    expect(marginalRate(0)).toBe(0)
    expect(marginalRate(150000)).toBe(0)
    expect(marginalRate(150001)).toBe(5)
    expect(marginalRate(400000)).toBe(10)
    expect(marginalRate(600000)).toBe(15)
    expect(marginalRate(900000)).toBe(20)
    expect(marginalRate(1500000)).toBe(25)
    expect(marginalRate(3000000)).toBe(30)
    expect(marginalRate(9000000)).toBe(35)
  })
})

describe('expenseDefaults — ค่าใช้จ่ายมาตรฐานรายมาตรา', () => {
  const s = () => defaultState()

  it('40(1)-(3) หัก 50% เพดานรวม 100,000', () => {
    const a = s(); a.income40_1 = 100000
    expect(expenseDefaults(a).income40_1).toBeCloseTo(50000, 6)

    const b = s(); b.income40_1 = 1000000
    expect(expenseDefaults(b).income40_1).toBeCloseTo(100000, 6)
  })
  it('เพดาน 100,000 เฉลี่ยตามสัดส่วนของ 40(1)+(2)+(3)', () => {
    const a = s(); a.income40_1 = 600000; a.income40_2 = 400000
    const e = expenseDefaults(a)
    expect(e.income40_1 + e.income40_2).toBeCloseTo(100000, 6)
    expect(e.income40_1).toBeCloseTo(60000, 6)
    expect(e.income40_2).toBeCloseTo(40000, 6)
  })
  it('ไม่มีเงินได้ 40(1)-(3) → ไม่หารด้วยศูนย์', () => {
    const e = expenseDefaults(s())
    expect(e.income40_1).toBe(0)
    expect(Number.isNaN(e.income40_1)).toBe(false)
  })
  it('40(6) แพทย์หัก 60% วิชาชีพอื่นหัก 40%', () => {
    const doc = s(); doc.prof40_6 = 1000000; doc.prof40_6type = 'doctor'
    expect(expenseDefaults(doc).prof40_6).toBeCloseTo(600000, 6)
    const oth = s(); oth.prof40_6 = 1000000
    expect(expenseDefaults(oth).prof40_6).toBeCloseTo(400000, 6)
  })
  it('40(7) 60% · ค่าเช่า 30% · 40(8) 60%', () => {
    const a = s(); a.income40_7 = 100000; a.rental = 100000; a.other40 = 100000
    const e = expenseDefaults(a)
    expect(e.income40_7).toBeCloseTo(60000, 6)
    expect(e.rental).toBeCloseTo(30000, 6)
    expect(e.other40).toBeCloseTo(60000, 6)
  })
})

describe('expenseFor — override ของผู้ใช้', () => {
  it('ใช้ค่า override เมื่อกรอก', () => {
    const s = defaultState(); s.income40_1 = 1000000
    s.expenseOverride = { income40_1: 12345 }
    expect(expenseFor(s, 'income40_1')).toBe(12345)
  })
  it('override = 0 ต้องใช้ 0 (ไม่ตกกลับ default)', () => {
    const s = defaultState(); s.income40_1 = 1000000
    s.expenseOverride = { income40_1: 0 }
    expect(expenseFor(s, 'income40_1')).toBe(0)
  })
  it('override เป็น NaN → ตกกลับ default', () => {
    const s = defaultState(); s.income40_1 = 100000
    s.expenseOverride = { income40_1: NaN }
    expect(expenseFor(s, 'income40_1')).toBeCloseTo(50000, 6)
  })
})

describe('calc — คำนวณภาษีทั้งใบ', () => {
  it('ไม่มีเงินได้ → ภาษี 0 และไม่มี NaN', () => {
    const r = calc(defaultState())
    expect(r.tax).toBe(0)
    expect(r.ni).toBe(0)
    expect(r.eff).toBe(0)
    expect(Number.isNaN(r.netTax)).toBe(false)
  })

  it('มนุษย์เงินเดือน 600,000: หักค่าใช้จ่าย 100k + ส่วนตัว 60k → สุทธิ 440k', () => {
    const s = defaultState(); s.income40_1 = 600000
    const r = calc(s)
    expect(r.ti).toBe(600000)
    expect(r.ni).toBeCloseTo(440000, 6)
    expect(r.tax).toBeCloseTo(calcTax(440000), 6)
  })

  it('ลดหย่อนคู่สมรสเฉพาะเมื่อสมรสและคู่สมรสไม่มีเงินได้', () => {
    const base = defaultState(); base.income40_1 = 600000
    const married = { ...base, maritalStatus: 'married' as const }
    const marriedWorking = { ...married, spouseIncome: true }
    expect(calc(married).ni).toBeCloseTo(calc(base).ni - 60000, 6)
    expect(calc(marriedWorking).ni).toBeCloseTo(calc(base).ni, 6)
  })

  it('ลดหย่อนบุตรจำกัด 3 คน คนละ 30,000', () => {
    const a = defaultState(); a.income40_1 = 1000000; a.children = 3
    const b = { ...a, children: 5 }
    expect(calc(a).ni).toBeCloseTo(calc(b).ni, 6)
    const none = { ...a, children: 0 }
    expect(calc(none).ni - calc(a).ni).toBeCloseTo(90000, 6)
  })

  it('ประกันชีวิต+สุขภาพ รวมกันไม่เกิน 100,000', () => {
    const a = defaultState(); a.income40_1 = 1000000; a.lifeIns = 100000; a.healthIns = 25000
    const none = { ...a, lifeIns: 0, healthIns: 0 }
    expect(calc(none).ni - calc(a).ni).toBeCloseTo(100000, 6)
  })

  it('ประกันสังคมเพดาน 10,500', () => {
    const a = defaultState(); a.income40_1 = 1000000; a.socialSec = 30000
    const none = { ...a, socialSec: 0 }
    expect(calc(none).ni - calc(a).ni).toBeCloseTo(10500, 6)
  })

  it('กลุ่มเกษียณ (RMF+บำนาญ+PVD+กบข.+กอช.) รวมไม่เกิน 500,000', () => {
    const s = defaultState(); s.income40_1 = 5000000
    s.rmf = 500000; s.annuityIns = 200000; s.pvd = 500000; s.nsf = 30000
    const none = { ...s, rmf: 0, annuityIns: 0, pvd: 0, nsf: 0 }
    expect(calc(none).ni - calc(s).ni).toBeCloseTo(500000, 6)
  })

  it('RMF จำกัด 30% ของเงินได้หลังหักค่าใช้จ่าย', () => {
    const s = defaultState(); s.income40_1 = 500000; s.rmf = 500000
    const net1 = 500000 - 100000
    const none = { ...s, rmf: 0 }
    expect(calc(none).ni - calc(s).ni).toBeCloseTo(net1 * 0.3, 6)
  })

  it('ThaiESG จำกัด 30% ของเงินได้หลังหักค่าใช้จ่าย และไม่เกิน 300,000', () => {
    const s = defaultState(); s.income40_1 = 5000000; s.thaiesg = 500000
    const none = { ...s, thaiesg: 0 }
    expect(calc(none).ni - calc(s).ni).toBeCloseTo(300000, 6)
  })

  it('เงินบริจาคทั่วไปหักได้ 2 เท่า แต่ไม่เกิน 10% ของเงินได้หลังหักค่าใช้จ่าย', () => {
    const s = defaultState(); s.income40_1 = 1000000; s.donation = 10000
    const none = { ...s, donation: 0 }
    expect(calc(none).ni - calc(s).ni).toBeCloseTo(20000, 6)

    const big = { ...s, donation: 1000000 }
    const net1 = 1000000 - 100000
    expect(calc(none).ni - calc(big).ni).toBeCloseTo(net1 * 0.1, 6)
  })

  it('ภาษีหัก ณ ที่จ่าย (prepaid) หักออกจากภาษีที่ต้องชำระ ไม่ติดลบ', () => {
    const s = defaultState(); s.income40_1 = 600000
    const full = calc(s)
    const withPre = calc({ ...s, prepaid: full.tax })
    expect(withPre.netTax).toBe(0)
    const over = calc({ ...s, prepaid: full.tax + 999999 })
    expect(over.netTax).toBe(0)
  })

  it('ลดหย่อนเยอะกว่าเงินได้ → เงินได้สุทธิไม่ติดลบ', () => {
    const s = defaultState(); s.income40_1 = 100000; s.lifeIns = 100000; s.parents = 4
    expect(calc(s).ni).toBe(0)
    expect(calc(s).tax).toBe(0)
  })

  it('เงินได้รวม (ti) = ผลรวมทุกมาตรา', () => {
    const s = defaultState()
    Object.assign(s, {
      income40_1: 1, income40_2: 2, income40_3: 4, interest: 8, dividend: 16,
      prof40_6: 32, income40_7: 64, rental: 128, other40: 256,
    })
    expect(calc(s).ti).toBe(511)
  })

  it('ค่าใช้จ่ายรวมใน deducts = ผลรวม expenseFor ทุกมาตรา', () => {
    const s = defaultState(); s.income40_1 = 400000; s.rental = 200000
    const sum = EXPENSE_KEYS.reduce((a, k) => a + expenseFor(s, k), 0)
    expect(calc(s).deducts.find(d => d.l === 'ค่าใช้จ่าย')!.v).toBeCloseTo(sum, 6)
  })
})
