import { describe, it, expect } from 'vitest'
import {
  RATIO_RULES, RATIO_CATEGORIES, ratioState, ratioTarget, ratioTargetMax,
  scoreOfState, categoryScore, type RatioKey,
} from './ratios'

const KEYS = Object.keys(RATIO_RULES) as RatioKey[]

describe('RATIO_RULES', () => {
  it('มีครบ 8 อัตราส่วน', () => {
    expect(KEYS).toEqual(['ratio1', 'ratio2', 'ratio3', 'ratio4', 'ratio5', 'ratio6', 'ratio7', 'ratio8'])
  })
  it('ทุกอัตราส่วนถูกจัดอยู่ในหมวดใดหมวดหนึ่ง ไม่ซ้ำ ไม่ตกหล่น', () => {
    const inCats = [...RATIO_CATEGORIES.liquidity, ...RATIO_CATEGORIES.debt, ...RATIO_CATEGORIES.savings]
    expect([...inCats].sort()).toEqual([...KEYS].sort())
  })
  it('เกณฑ์ warning อยู่ฝั่งที่แย่กว่าเกณฑ์ good เสมอ', () => {
    for (const k of KEYS) {
      const r = RATIO_RULES[k]
      if (r.dir === 'min') expect(r.warning).toBeLessThan(r.good)
      if (r.dir === 'max') expect(r.warning).toBeGreaterThan(r.good)
      if (r.dir === 'band') expect(r.goodMax).toBeGreaterThan(r.good)
    }
  })
})

describe('ratioState — ตรงกับเกณฑ์ CFP ที่ใช้อยู่', () => {
  it('ratio1 สภาพคล่อง: ≥1 ดี · ≥0.5 ระวัง · ต่ำกว่านั้นอันตราย', () => {
    expect(ratioState('ratio1', 1)).toBe('good')
    expect(ratioState('ratio1', 2.05)).toBe('good')
    expect(ratioState('ratio1', 0.99)).toBe('warning')
    expect(ratioState('ratio1', 0.5)).toBe('warning')
    expect(ratioState('ratio1', 0.49)).toBe('danger')
  })
  it('ratio2 เงินสำรองฉุกเฉิน: ดีเมื่ออยู่ในช่วง 3–6 เดือน · ต่ำกว่า = ระวัง · สูงกว่า = เก็บสดเกินจำเป็น', () => {
    expect(ratioState('ratio2', 3)).toBe('good')
    expect(ratioState('ratio2', 6)).toBe('good')
    expect(ratioState('ratio2', 2.99)).toBe('warning')
    expect(ratioState('ratio2', 6.01)).toBe('danger')
  })
  it('อัตราส่วนแบบ "ยิ่งมากยิ่งดี" ที่จุดตัดพอดี = ผ่านเกณฑ์', () => {
    expect(ratioState('ratio3', 15)).toBe('good')
    expect(ratioState('ratio7', 10)).toBe('good')
    expect(ratioState('ratio8', 50)).toBe('good')
    expect(ratioState('ratio3', 10)).toBe('warning')
    expect(ratioState('ratio7', 4.9)).toBe('danger')
    expect(ratioState('ratio8', 24.9)).toBe('danger')
  })
  it('อัตราส่วนแบบ "ยิ่งน้อยยิ่งดี" ที่จุดตัดพอดี = ยังไม่ผ่าน', () => {
    expect(ratioState('ratio4', 49.9)).toBe('good')
    expect(ratioState('ratio4', 50)).toBe('warning')
    expect(ratioState('ratio4', 70)).toBe('danger')
    expect(ratioState('ratio5', 35)).toBe('warning')
    expect(ratioState('ratio6', 15)).toBe('warning')
    expect(ratioState('ratio6', 20)).toBe('danger')
  })
  it('ไม่มีข้อมูล/ค่าเสีย/คีย์ไม่รู้จัก → nodata', () => {
    expect(ratioState('ratio1', null)).toBe('nodata')
    expect(ratioState('ratio1', undefined)).toBe('nodata')
    expect(ratioState('ratio1', NaN)).toBe('nodata')
    expect(ratioState('ratio99', 1)).toBe('nodata')
  })
  it('ทุกอัตราส่วนคืนสถานะที่ถูกต้องเสมอ ไม่ว่าค่าจะเป็นเท่าไหร่', () => {
    for (const k of KEYS) for (const v of [0, 0.5, 5, 15, 35, 60, 200]) {
      expect(['good', 'warning', 'danger']).toContain(ratioState(k, v))
    }
  })
})

describe('ratioTarget — เป้าหมายที่ frontend ใช้คำนวณคำแนะนำ', () => {
  it('เป้าหมาย = จุดที่ ratioState เริ่มเป็น good', () => {
    for (const k of KEYS) {
      const t = ratioTarget(k)
      expect(RATIO_RULES[k].dir === 'max' ? ratioState(k, t - 0.001) : ratioState(k, t)).toBe('good')
    }
  })
  it('ขอบบนของช่วงมีเฉพาะ ratio2 (เงินสำรอง 3–6 เดือน)', () => {
    expect(ratioTargetMax('ratio2')).toBe(6)
    expect(ratioTargetMax('ratio1')).toBeNull()
  })
})

describe('categoryScore — คะแนนสุขภาพการเงิน', () => {
  it('แปลงสถานะเป็นคะแนน', () => {
    expect(scoreOfState('good')).toBe(100)
    expect(scoreOfState('warning')).toBe(60)
    expect(scoreOfState('danger')).toBe(20)
    expect(scoreOfState('nodata')).toBeNull()
  })
  it('เฉลี่ยเฉพาะอัตราส่วนที่มีข้อมูล', () => {
    expect(categoryScore(RATIO_CATEGORIES.liquidity, () => 'good')).toBe(100)
    expect(categoryScore(RATIO_CATEGORIES.liquidity, k => k === 'ratio1' ? 'good' : 'nodata')).toBe(100)
    expect(categoryScore(RATIO_CATEGORIES.savings, k => k === 'ratio7' ? 'good' : 'danger')).toBe(60)
  })
  it('ไม่มีข้อมูลเลย → null (ไม่ใช่ 0)', () => {
    expect(categoryScore(RATIO_CATEGORIES.debt, () => 'nodata')).toBeNull()
  })
})
