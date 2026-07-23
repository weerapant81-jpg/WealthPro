import { describe, it, expect } from 'vitest'
import { toNum, mulberry32, percentile, annualizedReturn, growAnnuityFactor } from './math'

describe('toNum', () => {
  it('รองรับตัวเลขที่มีลูกน้ำ และไม่คืน NaN', () => {
    expect(toNum('1,234,567')).toBe(1234567)
    expect(toNum(500)).toBe(500)
    expect(toNum('  1200  ')).toBe(1200)
    expect(toNum('-250')).toBe(-250)
    expect(toNum('')).toBe(0)
    expect(toNum(null)).toBe(0)
    expect(toNum(undefined)).toBe(0)
    expect(toNum('abc')).toBe(0)
    expect(toNum(NaN)).toBe(0)
  })
})

describe('mulberry32 — ตัวสุ่มแบบ seed', () => {
  it('seed เดียวกันได้ลำดับเดิมเสมอ (Monte Carlo ซ้ำผลได้)', () => {
    const a = mulberry32(42), b = mulberry32(42)
    for (let i = 0; i < 20; i++) expect(a()).toBe(b())
  })
  it('seed ต่างกันได้ลำดับต่างกัน', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
  it('ค่าอยู่ในช่วง [0, 1) เสมอ', () => {
    const r = mulberry32(12345)
    for (let i = 0; i < 500; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('percentile', () => {
  const s = [10, 20, 30, 40, 50]
  it('ขอบและกลาง', () => {
    expect(percentile(s, 0)).toBe(10)
    expect(percentile(s, 1)).toBe(50)
    expect(percentile(s, 0.5)).toBe(30)
  })
  it('ประมาณค่าเชิงเส้นระหว่างสองตำแหน่ง', () => {
    expect(percentile([0, 100], 0.25)).toBe(25)
    expect(percentile(s, 0.1)).toBeCloseTo(14, 10)
  })
  it('อาร์เรย์ว่าง → 0 · ค่าเดียว → ค่านั้น', () => {
    expect(percentile([], 0.5)).toBe(0)
    expect(percentile([7], 0.9)).toBe(7)
  })
  it('ไม่ลดลงเมื่อ p เพิ่ม', () => {
    let prev = -Infinity
    for (let p = 0; p <= 1; p += 0.05) {
      const v = percentile(s, p)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('annualizedReturn — ผลตอบแทนต่อปีแบบทบต้น', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  const yearsAgo = (y: number) => new Date(now - y * 365.25 * 24 * 3600 * 1000).toISOString()

  it('โต 2 เท่าใน 1 ปี = 100%', () => {
    expect(annualizedReturn(100, 200, yearsAgo(1), now)).toBeCloseTo(100, 6)
  })
  it('โต 2 เท่าใน 2 ปี ≈ 41.42% ต่อปี', () => {
    expect(annualizedReturn(100, 200, yearsAgo(2), now)).toBeCloseTo((Math.SQRT2 - 1) * 100, 6)
  })
  it('ขาดทุนได้ค่าติดลบ', () => {
    expect(annualizedReturn(100, 50, yearsAgo(1), now)).toBeCloseTo(-50, 6)
  })
  it('ข้อมูลไม่พอ → null (ไม่ใช่ 0 หรือ NaN)', () => {
    expect(annualizedReturn(0, 100, yearsAgo(1), now)).toBeNull()
    expect(annualizedReturn(100, 0, yearsAgo(1), now)).toBeNull()
    expect(annualizedReturn(100, 200, '', now)).toBeNull()
    expect(annualizedReturn(100, 200, 'ไม่ใช่วันที่', now)).toBeNull()
  })
  it('ลงทุนยังไม่ถึง 1 วัน → null (กันตัวเลขพุ่งเวอร์)', () => {
    expect(annualizedReturn(100, 200, new Date(now - 3600 * 1000).toISOString(), now)).toBeNull()
  })
})

describe('growAnnuityFactor — ตัวคูณเงินออมที่เพิ่มขึ้นทุกปี', () => {
  it('ไม่มีงวด → 0', () => {
    expect(growAnnuityFactor(0.04, 0.03, 0)).toBe(0)
    expect(growAnnuityFactor(0.04, 0.03, -1)).toBe(0)
  })
  it('ผลตอบแทน = อัตราโต → factor = m/(1+g)', () => {
    expect(growAnnuityFactor(0.05, 0.05, 10)).toBeCloseTo(10 / 1.05, 10)
  })
  it('ไม่โตเลย (g=0) = annuity ธรรมดา (1-(1+r)^-m)/r', () => {
    const r = 0.04, m = 10
    expect(growAnnuityFactor(r, 0, m)).toBeCloseTo((1 - Math.pow(1 + r, -m)) / r, 10)
  })
  it('ผลตอบแทน 0 และไม่โต → factor = จำนวนปี', () => {
    expect(growAnnuityFactor(0, 0, 12)).toBeCloseTo(12, 10)
  })
  it('เงินออมโตเร็วขึ้น → ต้องออมปีแรกน้อยลง (factor สูงขึ้น)', () => {
    expect(growAnnuityFactor(0.04, 0.05, 10)).toBeGreaterThan(growAnnuityFactor(0.04, 0, 10))
  })
  it('สอดคล้องกับนิยาม PV = Σ S(1+g)^(k-1)/(1+r)^k', () => {
    const r = 0.06, g = 0.03, m = 8
    let pv = 0
    for (let k = 1; k <= m; k++) pv += Math.pow(1 + g, k - 1) / Math.pow(1 + r, k)
    expect(growAnnuityFactor(r, g, m)).toBeCloseTo(pv, 10)
  })
})
