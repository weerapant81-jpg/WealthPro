import { describe, it, expect } from 'vitest'
import {
  registerSchema, loginSchema, emailOnlySchema, resetPasswordSchema,
  googleAuthSchema, refreshSchema, twoFactorEnableSchema, gameLeadSchema,
  checkoutSchema, setPlanSchema,
} from './schemas'

const ok = (s: any, v: any) => s.safeParse(v).success
const bad = (s: any, v: any) => !s.safeParse(v).success

// input แปลก ๆ ที่ใช้ยิงทุก field ที่เป็นข้อความ
const LONG = 'ก'.repeat(5000)
const EMOJI = '🙂🔥💰'
const SQLISH = "'; DROP TABLE users; --"
const XSSISH = '<script>alert(1)</script>'

describe('registerSchema — ทางเข้าที่คนนอกยิงได้', () => {
  const valid = { email: 'a@b.com', password: 'password123', name: 'วีรพันธ์ เต็มดวง', phone: '081-234-5678' }

  it('ข้อมูลถูกต้องผ่าน (รวมชื่อภาษาไทย)', () => {
    expect(ok(registerSchema, valid)).toBe(true)
  })
  it('อีเมลถูก trim + แปลงเป็นพิมพ์เล็ก', () => {
    const r = registerSchema.parse({ ...valid, email: '  A@B.COM  ' })
    expect(r.email).toBe('a@b.com')
  })
  it('ปฏิเสธอีเมลผิดรูป', () => {
    for (const email of ['', ' ', 'abc', 'a@', '@b.com', 'a b@c.com', EMOJI, SQLISH])
      expect(bad(registerSchema, { ...valid, email })).toBe(true)
  })
  it('ปฏิเสธรหัสผ่านสั้นเกินไปและยาวเกินไป', () => {
    expect(bad(registerSchema, { ...valid, password: '1234567' })).toBe(true)
    expect(bad(registerSchema, { ...valid, password: 'a'.repeat(201) })).toBe(true)
    expect(ok(registerSchema, { ...valid, password: '12345678' })).toBe(true)
  })
  it('ปฏิเสธชื่อว่างหรือมีแต่ช่องว่าง แต่ยอมรับ emoji ในชื่อ', () => {
    expect(bad(registerSchema, { ...valid, name: '' })).toBe(true)
    expect(bad(registerSchema, { ...valid, name: '     ' })).toBe(true)
    expect(ok(registerSchema, { ...valid, name: `สมชาย ${EMOJI}` })).toBe(true)
  })
  it('ปฏิเสธข้อความยาวเกินขอบเขต (กัน payload บวม)', () => {
    expect(bad(registerSchema, { ...valid, name: LONG })).toBe(true)
    expect(bad(registerSchema, { ...valid, email: LONG + '@x.com' })).toBe(true)
  })
  it('ปฏิเสธเบอร์โทรที่มีตัวอักษร แต่ยอมรับรูปแบบไทยทั่วไป', () => {
    for (const phone of ['0812345678', '081-234-5678', '+66 81 234 5678', '(02) 123-4567'])
      expect(ok(registerSchema, { ...valid, phone })).toBe(true)
    for (const phone of ['ไม่บอก', XSSISH, EMOJI, '', '123'])
      expect(bad(registerSchema, { ...valid, phone })).toBe(true)
  })
  it('ปฏิเสธชนิดข้อมูลผิด (ตัวเลข/array/object/null ส่งมาแทนข้อความ)', () => {
    for (const email of [123, [], {}, null, undefined, true])
      expect(bad(registerSchema, { ...valid, email })).toBe(true)
  })
  it('ปฏิเสธ body ว่างและ body ที่ไม่ใช่ object', () => {
    for (const body of [{}, null, undefined, 'abc', 42, []])
      expect(bad(registerSchema, body)).toBe(true)
  })
})

describe('loginSchema', () => {
  it('ล็อกอินปกติผ่าน · รหัส 2FA ใส่หรือไม่ใส่ก็ได้', () => {
    expect(ok(loginSchema, { email: 'a@b.com', password: 'x' })).toBe(true)
    expect(ok(loginSchema, { email: 'a@b.com', password: 'x', token: '123 456' })).toBe(true)
  })
  it('ตัดช่องว่างในรหัส 2FA ให้อัตโนมัติ', () => {
    expect(loginSchema.parse({ email: 'a@b.com', password: 'x', token: ' 12 34 56 ' }).token).toBe('123456')
  })
  it('ปฏิเสธเมื่อขาดรหัสผ่าน', () => {
    expect(bad(loginSchema, { email: 'a@b.com' })).toBe(true)
    expect(bad(loginSchema, { email: 'a@b.com', password: '' })).toBe(true)
  })
  it('ไม่จำกัดความยาวขั้นต่ำของรหัสผ่านตอนล็อกอิน (บัญชีเก่าอาจสั้นกว่าเกณฑ์ใหม่)', () => {
    expect(ok(loginSchema, { email: 'a@b.com', password: '123' })).toBe(true)
  })
})

describe('resetPasswordSchema / refreshSchema / googleAuthSchema — โทเคน', () => {
  it('ปฏิเสธโทเคนสั้นผิดปกติและยาวผิดปกติ', () => {
    expect(bad(resetPasswordSchema, { token: 'abc', password: 'password123' })).toBe(true)
    expect(bad(resetPasswordSchema, { token: 'a'.repeat(2001), password: 'password123' })).toBe(true)
    expect(ok(resetPasswordSchema, { token: 'a'.repeat(40), password: 'password123' })).toBe(true)
  })
  it('บังคับเกณฑ์รหัสผ่านใหม่ตอนรีเซ็ต', () => {
    expect(bad(resetPasswordSchema, { token: 'a'.repeat(40), password: 'sh0rt' })).toBe(true)
  })
  it('ปฏิเสธโทเคนที่ไม่ใช่ข้อความ', () => {
    for (const t of [null, 123, {}, []]) {
      expect(bad(refreshSchema, { refreshToken: t })).toBe(true)
      expect(bad(googleAuthSchema, { credential: t })).toBe(true)
    }
  })
})

describe('twoFactorEnableSchema', () => {
  it('รับรหัส 6 หลักและตัดช่องว่าง', () => {
    expect(twoFactorEnableSchema.parse({ token: '000 111' }).token).toBe('000111')
  })
  it('ปฏิเสธรหัสยาวผิดปกติ', () => {
    expect(bad(twoFactorEnableSchema, { token: '1'.repeat(41) })).toBe(true)
  })
})

describe('gameLeadSchema — ฟอร์มสาธารณะ ใครก็ยิงได้', () => {
  const valid = { name: 'สมชาย', contact: '0812345678' }
  it('ข้อมูลปกติผ่าน', () => expect(ok(gameLeadSchema, valid)).toBe(true))
  it('ปฏิเสธชื่อ/ช่องทางติดต่อที่ว่างหรือยาวเกิน', () => {
    expect(bad(gameLeadSchema, { ...valid, name: '' })).toBe(true)
    expect(bad(gameLeadSchema, { ...valid, name: LONG })).toBe(true)
    expect(bad(gameLeadSchema, { ...valid, contact: LONG })).toBe(true)
  })
  it('คะแนนต้องเป็นตัวเลขจำกัดค่า ไม่ใช่ NaN/Infinity/ข้อความ', () => {
    expect(ok(gameLeadSchema, { ...valid, score: 0 })).toBe(true)
    expect(ok(gameLeadSchema, { ...valid, score: -500 })).toBe(true)
    for (const score of [NaN, Infinity, -Infinity, '100', {}])
      expect(bad(gameLeadSchema, { ...valid, score })).toBe(true)
  })
  it('ผลการเล่นเกม (result) ต้องผ่านมาถึง controller ไม่ถูกตัดทิ้ง', () => {
    const parsed = gameLeadSchema.parse({ ...valid, result: { netWorth: 1_000_000, years: 30 } })
    expect(parsed.result).toEqual({ netWorth: 1_000_000, years: 30 })
  })
  it('เก็บข้อความอันตรายได้แต่ไม่ตีความ (React escape ตอนแสดงผล) — ขอแค่ไม่ยาวเกิน', () => {
    expect(ok(gameLeadSchema, { ...valid, name: XSSISH })).toBe(true)
    expect(ok(gameLeadSchema, { ...valid, contact: SQLISH })).toBe(true)
  })
})

describe('checkoutSchema / setPlanSchema — จุดที่กระทบเงินและสิทธิ์', () => {
  it('รับเฉพาะแพ็กเกจที่มีจริง', () => {
    expect(ok(checkoutSchema, { plan: 'pro' })).toBe(true)
    expect(ok(checkoutSchema, { plan: 'ai' })).toBe(true)
    for (const plan of ['free', 'enterprise', 'PRO', '', null, 1, {}])
      expect(bad(checkoutSchema, { plan })).toBe(true)
  })
  it('setPlan รับ free ได้ (ใช้ลดสิทธิ์) แต่ไม่รับค่ามั่ว', () => {
    expect(ok(setPlanSchema, { plan: 'free' })).toBe(true)
    expect(bad(setPlanSchema, { plan: 'superadmin' })).toBe(true)
  })
})
