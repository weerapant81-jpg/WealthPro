import { describe, it, expect } from 'vitest'
import * as S from './schemasAuth'

const ok = (s: any, v: any) => s.safeParse(v).success
const bad = (s: any, v: any) => !s.safeParse(v).success

// ทุก schema ในไฟล์นี้ (ใช้ตรวจกติกาที่ต้องจริงกับ "ทุกตัว" พร้อมกัน)
const ALL = Object.entries(S).filter(([, v]) => v && typeof (v as any).safeParse === 'function') as [string, any][]

describe('กติกาที่ต้องเป็นจริงกับทุก schema ของ endpoint ที่ต้องล็อกอิน', () => {
  it('มี schema ครบทุกตัวที่ export', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(18)
  })

  it('⭐ ห้ามตัดฟิลด์ที่ไม่ได้ประกาศทิ้ง — บทเรียนจากบั๊ก gameLead.result ที่ทำข้อมูลหาย', () => {
    const extra = { ฟิลด์ที่ไม่ได้ประกาศ: 'ต้องอยู่ครบ', nested: { deep: [1, 2, { x: true }] }, zz: null }
    for (const [name, schema] of ALL) {
      const parsed = schema.safeParse({ ...extra })
      expect(parsed.success, `${name} ต้องรับ object ที่มีแต่ฟิลด์แปลก ๆ ได้`).toBe(true)
      expect(parsed.data, `${name} ตัดฟิลด์ทิ้ง`).toMatchObject(extra)
    }
  })

  it('body ว่าง {} ผ่านได้ทุกตัว (client บางหน้าส่ง PATCH เฉพาะฟิลด์ที่แก้)', () => {
    for (const [name, schema] of ALL) expect(ok(schema, {}), name).toBe(true)
  })

  it('ปฏิเสธ body ที่ไม่ใช่ object — array/ข้อความ/ตัวเลข/null ทำให้ controller พังได้', () => {
    for (const [name, schema] of ALL)
      for (const body of [[], 'x', 42, null, true])
        expect(bad(schema, body), `${name} ควรปฏิเสธ ${JSON.stringify(body)}`).toBe(true)
  })
})

describe('รายรับ/รายจ่าย/สินทรัพย์/หนี้สิน', () => {
  it('รับตัวเลขที่ส่งมาเป็นข้อความได้ (ฟอร์มบางหน้าส่งแบบนั้น)', () => {
    expect(ok(S.incomeSchema, { name: 'เงินเดือน', amount: '50000', frequency: 'MONTHLY' })).toBe(true)
    expect(ok(S.assetSchema, { name: 'บ้าน', value: 3_500_000, returnRate: '2.5' })).toBe(true)
  })
  it('ปฏิเสธจำนวนเงินที่เป็น NaN/Infinity/object', () => {
    for (const amount of [NaN, Infinity, -Infinity, {}, []])
      expect(bad(S.incomeSchema, { amount })).toBe(true)
  })
  it('ปฏิเสธชื่อที่ยาวเกินขอบเขต', () => {
    expect(bad(S.expenseSchema, { name: 'ก'.repeat(201) })).toBe(true)
  })
  it('ยอดติดลบยังผ่าน (ใช้ปรับปรุงยอดได้)', () => {
    expect(ok(S.liabilitySchema, { balance: -1000 })).toBe(true)
  })
})

describe('profileSchema — สมมติฐานที่ผิดจะทำให้ทั้งแผนเพี้ยน', () => {
  it('ค่าปกติผ่าน', () => {
    expect(ok(S.profileSchema, { inflationRate: 2.8, preRetirementReturn: 8, retirementAgeSelf: 60 })).toBe(true)
  })
  it('อัตราติดลบผ่านได้ (เงินฝืดเกิดขึ้นจริง — CPI ไทยปี 2568 ติดลบ)', () => {
    expect(ok(S.profileSchema, { inflationRate: -0.13 })).toBe(true)
  })
  it('ปฏิเสธอัตราที่เป็นไปไม่ได้', () => {
    expect(bad(S.profileSchema, { inflationRate: 99999 })).toBe(true)
    expect(bad(S.profileSchema, { expectedReturn: -500 })).toBe(true)
  })
  it('ปฏิเสธอายุที่เป็นไปไม่ได้ แต่ยอมรับ 0 (ช่องกรอกที่ถูกลบจนว่างส่ง 0 มา)', () => {
    expect(ok(S.profileSchema, { retirementAgeSelf: 0 })).toBe(true)
    expect(ok(S.profileSchema, { retirementAgeSpouse: null })).toBe(true)
    expect(bad(S.profileSchema, { retirementAgeSelf: 200 })).toBe(true)
    expect(bad(S.profileSchema, { lifeExpectancySelf: -5 })).toBe(true)
  })
})

describe('copilotChatSchema — คุมต้นทุน AI', () => {
  it('ข้อความปกติผ่าน', () => {
    expect(ok(S.copilotChatSchema, { message: 'สรุปสถานะการเงินลูกค้าให้หน่อย' })).toBe(true)
  })
  it('ปฏิเสธข้อความยาวเกิน 20,000 ตัว (กันยิงข้อความมหึมาเข้าโมเดล)', () => {
    expect(bad(S.copilotChatSchema, { message: 'ก'.repeat(20001) })).toBe(true)
  })
  it('ปฏิเสธประวัติแชทที่ยาวเกิน 100 ข้อความ', () => {
    expect(bad(S.copilotChatSchema, { messages: Array.from({ length: 101 }, () => ({ role: 'user' })) })).toBe(true)
    expect(ok(S.copilotChatSchema, { messages: Array.from({ length: 100 }, () => ({ role: 'user' })) })).toBe(true)
  })
})

describe('jsonBlobSchema — ก้อนแผนที่โครงสร้างอิสระ', () => {
  it('รับโครงสร้างซ้อนลึกได้ครบ ไม่แตะต้องอะไรเลย', () => {
    const plan = { self: { rows: [{ age: 60, amount: 1e6 }], note: 'ทดสอบ' }, spouse: null, v: 3 }
    expect(S.jsonBlobSchema.parse(plan)).toEqual(plan)
  })
})

describe('actionItemSchema / lifeInsuranceSchema', () => {
  it('รับ null ในฟิลด์ที่เป็น optional ได้ (client ส่ง null มาเคลียร์ค่า)', () => {
    expect(ok(S.actionItemSchema, { note: null, dueDate: null, target: null })).toBe(true)
    expect(ok(S.lifeInsuranceSchema, { policyNumber: null, sumAssured: null })).toBe(true)
  })
  it('รับวันที่ทั้งแบบข้อความและ Date object', () => {
    expect(ok(S.actionItemSchema, { dueDate: '2026-12-31' })).toBe(true)
    expect(ok(S.actionItemSchema, { dueDate: new Date() })).toBe(true)
  })
})
