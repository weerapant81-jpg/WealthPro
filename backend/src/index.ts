import 'dotenv/config'   // ต้องมาก่อน import อื่น — controller/lib อ่าน process.env ตอนโหลดโมดูล (routes → controllers, mailer ฯลฯ)
import { Sentry, sentryEnabled } from './sentry'   // init Sentry (อ่าน SENTRY_DSN หลัง dotenv)
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import routes from './routes'
import { handleWebhook } from './controllers/billing.controller'
import { audit } from './middleware/audit'
import { seedAdviceRules } from './lib/seedAdviceRules'
import { startAuditRetention } from './lib/auditRetention'

const app = express()
app.set('trust proxy', true)   // อ่าน client IP จริงหลัง proxy (Render/Vercel) — ต้องมาก่อน rate-limit เพื่อ key ตาม IP จริง

// ── Security headers (helmet) ── API เสิร์ฟ JSON ล้วน จึงปิด CSP/CORP ที่ไม่จำเป็น คงไว้ HSTS/noSniff/frameguard ฯลฯ
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }))

// อนุญาต origin จาก FRONTEND_URL (คั่นด้วย , ได้หลายค่า) + localhost สำหรับ dev · ไม่มี Origin (same-origin/proxy) = ผ่าน
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }))

// ⚠️ Stripe webhook ต้องใช้ raw body (verify signature) — ต้องมาก่อน express.json()
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleWebhook)

app.use(express.json())

app.get('/health', (_, res) => res.json({ ok: true }))   // ก่อน rate-limit → keep-alive ping ไม่กินโควตา

// ── Rate limiting ──
// backstop กันยิงถล่มทั้ง API (ต่อ IP)
const apiLimiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false,
  message: { error: 'คำขอถี่เกินไป กรุณาลองใหม่ในอีกสักครู่' } })
// เข้มกับ endpoint ที่เสี่ยง brute-force — นับเฉพาะครั้งที่ล้มเหลว (login/register สำเร็จไม่โดนหัก)
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true, message: { error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' } })
// กัน abuse AI Copilot (Claude API = ค่าเงินจริง)
const copilotLimiter = rateLimit({ windowMs: 5 * 60_000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'ใช้ AI Copilot ถี่เกินไป กรุณารอสักครู่' } })
// กัน brute-force รหัส TOTP/รหัสผ่านตอนเปิด/ปิด 2FA
const twofaLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'พยายามยืนยันตัวตนบ่อยเกินไป กรุณารอสักครู่' } })

app.use('/api', apiLimiter)
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/apple',
  '/api/auth/forgot-password', '/api/auth/reset-password'], authLimiter)
app.use('/api/auth/2fa', twofaLimiter)
app.use('/api/copilot', copilotLimiter)

app.use('/api', audit, routes)   // audit ดักก่อน routes → บันทึกตอน response finish

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)   // รายละเอียดจริง log ฝั่งเซิร์ฟเวอร์/Sentry เท่านั้น
  if (sentryEnabled) Sentry.captureException(err)
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' })   // ไม่ส่ง err.message ดิบกลับ client (กันรั่วข้อมูลภายใน)
})

// จับ error ระดับ process ที่หลุดจาก middleware (กัน crash เงียบ)
if (sentryEnabled) {
  process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); Sentry.captureException(reason) })
  process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); Sentry.captureException(err) })
}

const PORT = process.env.PORT || 3001
app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  await seedAdviceRules()
  startAuditRetention()   // ลบ audit log เก่ากว่า 2 ปีอัตโนมัติ (PDPA retention)
})
