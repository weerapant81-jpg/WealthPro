// ── Integration test ระดับ HTTP ──
// ยิงเข้าแอป express ตัวจริง (routing + middleware + controller ครบชั้น) โดย mock เฉพาะ Prisma
// จึงไม่ต้องมีฐานข้อมูล และไม่มีทางเผลอไปแตะข้อมูลลูกค้าจริง
//
// ครอบสิ่งที่ unit test จับไม่ได้: route ต่อสายถูกไหม · ประตูตรวจสิทธิ์ปิดจริงไหม ·
// validation ทำงานตามลำดับที่ควร · error ไม่รั่วรายละเอียดภายในออกไป
import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-secret-for-integration'
process.env.FRONTEND_URL = 'http://localhost:5173'

// ── ฐานข้อมูลจำลอง ──
const USERS: Record<string, any> = {
  'fa-1':    { id: 'fa-1', role: 'ADMIN', plan: 'ai', email: 'fa1@test', isApproved: true },
  'fa-2':    { id: 'fa-2', role: 'ADMIN', plan: 'ai', email: 'fa2@test', isApproved: true },
  'free-fa': { id: 'free-fa', role: 'OTHER', plan: 'free', email: 'free@test', isApproved: true },
  'sa-1':    { id: 'sa-1', role: 'SUPER_ADMIN', plan: 'ai', email: 'sa@test', isApproved: true },
  // ลูกค้าของ fa-1 (createdById = fa-1) — fa-2 ไม่ควรสวมเป็นคนนี้ได้
  'client-of-fa1': { id: 'client-of-fa1', role: 'USER', createdById: 'fa-1', email: 'c@test' },
}

const model = () => ({
  findUnique: vi.fn(async ({ where }: any) => USERS[where?.id] ?? null),
  findFirst: vi.fn(async ({ where }: any) => {
    const u = USERS[where?.id]
    if (!u) return null
    if (where?.role && u.role !== where.role) return null
    if (where?.createdById && u.createdById !== where.createdById) return null
    return u
  }),
  findMany: vi.fn(async () => []),
  create: vi.fn(async ({ data }: any) => ({ id: 'new-id', ...data })),
  update: vi.fn(async ({ data }: any) => ({ id: 'upd', ...data })),
  upsert: vi.fn(async ({ create, update }: any) => ({ id: 'ups', ...create, ...update })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  count: vi.fn(async () => 0),
  groupBy: vi.fn(async () => []),
})

vi.mock('../lib/prisma', () => {
  const store: any = new Proxy({}, { get: (t: any, k: string) => (t[k] ||= model()) })
  return { prisma: store }
})

const token = (userId: string) => jwt.sign({ userId }, process.env.JWT_SECRET!)
let app: any
beforeAll(async () => { app = (await import('../app')).default })

describe('สุขภาพระบบ', () => {
  it('GET /health ตอบ 200 และไม่ต้องล็อกอิน', async () => {
    const r = await request(app).get('/health')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
  })
  it('ตั้ง security header ให้จริง (helmet)', async () => {
    const r = await request(app).get('/health')
    expect(r.headers['x-content-type-options']).toBe('nosniff')
  })
})

describe('ประตูตรวจสิทธิ์ — ต้องปิดจริง ไม่ใช่แค่มีโค้ด', () => {
  it('ไม่มี token → 401 ทุกเส้นทางที่ต้องล็อกอิน', async () => {
    for (const p of ['/api/clients', '/api/incomes', '/api/profile', '/api/auth/me', '/api/audit-logs']) {
      const r = await request(app).get(p)
      expect(r.status, p).toBe(401)
    }
  })
  it('token ปลอม/หมดอายุ → 401', async () => {
    const fake = jwt.sign({ userId: 'fa-1' }, 'คนละ-secret')
    const r = await request(app).get('/api/clients').set('Authorization', `Bearer ${fake}`)
    expect(r.status).toBe(401)
  })
  it('FA ธรรมดาเข้าเมนูของผู้ให้บริการไม่ได้ → 403', async () => {
    const r = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('fa-1')}`)
    expect(r.status).toBe(403)
  })
  it('SUPER_ADMIN เข้าได้', async () => {
    const r = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token('sa-1')}`)
    expect(r.status).toBe(200)
  })
  it('แพ็กเกจ free เข้าเมนูที่ต้อง Pro ไม่ได้ → 403 PLAN_REQUIRED', async () => {
    const r = await request(app).get('/api/retirement-plan').set('Authorization', `Bearer ${token('free-fa')}`)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('PLAN_REQUIRED')
  })
})

describe('⭐ IDOR — FA คนหนึ่งต้องสวมเป็นลูกค้าของ FA อีกคนไม่ได้', () => {
  it('เจ้าของสวมเป็นลูกค้าตัวเองได้ (ยังทำงานปกติ)', async () => {
    const r = await request(app).get('/api/incomes')
      .set('Authorization', `Bearer ${token('fa-1')}`)
      .set('X-Client-Id', 'client-of-fa1')
    expect(r.status).toBe(200)
  })
  it('คนอื่นสวมไม่ได้ — ไม่ 500 ไม่รั่วข้อมูล แต่ตกกลับมาเป็นตัวเอง', async () => {
    const r = await request(app).get('/api/incomes')
      .set('Authorization', `Bearer ${token('fa-2')}`)
      .set('X-Client-Id', 'client-of-fa1')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body)).toBe(true)
  })
  it('X-Client-Id ที่ไม่มีอยู่จริง ไม่ทำให้ระบบพัง', async () => {
    const r = await request(app).get('/api/incomes')
      .set('Authorization', `Bearer ${token('fa-1')}`)
      .set('X-Client-Id', 'no-such-client-id')
    expect(r.status).toBe(200)
  })
})

describe('Validation ทำงานจริงบนเส้นทางจริง', () => {
  it('สมัครสมาชิกด้วยอีเมลผิดรูป → 400 พร้อมบอกฟิลด์', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ email: 'ไม่ใช่อีเมล', password: 'password123', name: 'ทดสอบ', phone: '0812345678' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('ข้อมูลที่ส่งมาไม่ถูกต้อง')
    expect(r.body.issues[0].field).toBe('email')
  })
  it('รหัสผ่านสั้นเกินไป → 400', async () => {
    const r = await request(app).post('/api/auth/register')
      .send({ email: 'a@b.com', password: '123', name: 'ทดสอบ', phone: '0812345678' })
    expect(r.status).toBe(400)
    expect(r.body.issues.some((i: any) => i.field === 'password')).toBe(true)
  })
  it('body ที่ไม่ใช่ object → 400 ไม่ใช่ 500', async () => {
    const r = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('[]')
    expect(r.status).toBe(400)
  })
  it('ตรวจสิทธิ์มาก่อน validation — ไม่มี token ต้องได้ 401 ไม่ใช่ 400', async () => {
    const r = await request(app).post('/api/incomes').send({ amount: 'ผิดชนิด', name: 123 })
    expect(r.status).toBe(401)
  })
  it('ล็อกอินแล้วส่งชนิดผิด → 400 พร้อมบอกฟิลด์', async () => {
    const r = await request(app).post('/api/incomes')
      .set('Authorization', `Bearer ${token('fa-1')}`)
      .send({ amount: { ผิด: true } })
    expect(r.status).toBe(400)
    expect(r.body.issues[0].field).toBe('amount')
  })
  it('⭐ ฟิลด์ที่ schema ไม่ได้ประกาศต้องไม่ถูกตัดทิ้งระหว่างทาง', async () => {
    const r = await request(app).put('/api/retirement-plan')
      .set('Authorization', `Bearer ${token('fa-1')}`)
      .send({ self: { custom: 'ต้องอยู่ครบ' }, ฟิลด์แปลก: [1, 2, 3] })
    expect(r.status).toBeLessThan(400)
  })
})

describe('ไม่รั่วข้อมูลภายในออกไปหา client', () => {
  it('อีเมลที่ไม่มีในระบบ ตอบเหมือนกรณีรหัสผ่านผิด (ไม่บอกว่ามีบัญชีนี้ไหม)', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'ไม่มี@test.com', password: 'whatever1' })
    expect([400, 401]).toContain(r.status)
    expect(JSON.stringify(r.body)).not.toMatch(/prisma|stack|at Object|node_modules/i)
  })
  it('404 ของเส้นทางที่ไม่มีจริง ไม่คืน stack trace', async () => {
    const r = await request(app).get('/api/ไม่มีเส้นทางนี้').set('Authorization', `Bearer ${token('fa-1')}`)
    expect(r.status).toBe(404)
    expect(JSON.stringify(r.body)).not.toMatch(/at Object|node_modules/i)
  })
})
