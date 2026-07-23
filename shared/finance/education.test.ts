import { describe, it, expect } from 'vitest'
import { fundBalanceSeries } from './education'

const base = { fees: [], annualSaving: 12000, r: 0.05, g: 0, savingYears: 10, horizon: 10 }

describe('fundBalanceSeries — เดินยอดเงินกองทุนการศึกษา', () => {
  it('ไม่มีค่าเล่าเรียน ไม่มีผลตอบแทน ไม่โต → ยอดสะสมเป็นเส้นตรง', () => {
    const s = fundBalanceSeries({ ...base, r: 0, annualSaving: 100, savingYears: 5, horizon: 5 })
    expect(s).toEqual([100, 200, 300, 400, 500, 500])   // ปีที่ 5 หยุดออมแล้ว
  })

  it('ปีแรกยังไม่ได้ผลตอบแทน (ออมแล้วจบปี)', () => {
    expect(fundBalanceSeries({ ...base, annualSaving: 1000, horizon: 0 })[0]).toBe(1000)
  })

  it('ปีถัดมาได้ผลตอบแทนทบต้นก่อนเติมเงินออมใหม่', () => {
    const s = fundBalanceSeries({ ...base, annualSaving: 1000, r: 0.10, horizon: 2 })
    expect(s[0]).toBeCloseTo(1000, 9)
    expect(s[1]).toBeCloseTo(1000 * 1.1 + 1000, 9)
    expect(s[2]).toBeCloseTo((1000 * 1.1 + 1000) * 1.1 + 1000, 9)
  })

  it('เงินออมเพิ่มขึ้นปีละ g', () => {
    const s = fundBalanceSeries({ ...base, annualSaving: 1000, r: 0, g: 0.05, savingYears: 3, horizon: 2 })
    expect(s[2]).toBeCloseTo(1000 + 1000 * 1.05 + 1000 * 1.05 ** 2, 9)
  })

  it('หยุดเติมเงินเมื่อครบจำนวนปีที่ออม แต่ยอดยังโตต่อ', () => {
    const s = fundBalanceSeries({ ...base, annualSaving: 1000, r: 0.10, savingYears: 1, horizon: 2 })
    expect(s[0]).toBeCloseTo(1000, 9)
    expect(s[1]).toBeCloseTo(1100, 9)
    expect(s[2]).toBeCloseTo(1210, 9)
  })

  it('หักค่าเล่าเรียนของปีนั้นก่อนคิดผลตอบแทน', () => {
    const s = fundBalanceSeries({
      ...base, annualSaving: 1000, r: 0.10, savingYears: 10, horizon: 2,
      fees: [{ yfn: 1, amount: 500 }],
    })
    expect(s[1]).toBeCloseTo((1000 - 500) * 1.1 + 1000, 9)
  })

  it('ค่าเล่าเรียนหลายก้อนในปีเดียวกันถูกหักรวมกัน', () => {
    const one  = fundBalanceSeries({ ...base, r: 0, horizon: 1, fees: [{ yfn: 1, amount: 300 }] })
    const many = fundBalanceSeries({ ...base, r: 0, horizon: 1, fees: [{ yfn: 1, amount: 100 }, { yfn: 1, amount: 200 }] })
    expect(many[1]).toBeCloseTo(one[1], 9)
  })

  it('ค่าเล่าเรียนมากกว่าเงินกองทุน → ยอดติดลบ (ไม่ถูกตัดเป็นศูนย์)', () => {
    const s = fundBalanceSeries({ ...base, annualSaving: 0, r: 0, horizon: 1, fees: [{ yfn: 1, amount: 5000 }] })
    expect(s[1]).toBe(-5000)
  })

  it('คืนค่าครบทุกปีตั้งแต่ 0 ถึง horizon', () => {
    expect(fundBalanceSeries({ ...base, horizon: 7 })).toHaveLength(8)
  })

  it('ไม่ออมเลย ไม่มีค่าเล่าเรียน → ศูนย์ตลอด', () => {
    expect(fundBalanceSeries({ ...base, annualSaving: 0 }).every(v => v === 0)).toBe(true)
  })
})
