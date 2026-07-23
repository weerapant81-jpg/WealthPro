import 'dotenv/config'   // ต้องมาก่อน import อื่น — controller/lib อ่าน process.env ตอนโหลดโมดูล (routes → controllers, mailer ฯลฯ)
import { Sentry, sentryEnabled } from './sentry'   // init Sentry (อ่าน SENTRY_DSN หลัง dotenv)
import app from './app'   // ตัวแอปอยู่ที่ app.ts — แยกไว้เพื่อให้เทสต์ import ได้โดยไม่เปิดพอร์ต
import { seedAdviceRules } from './lib/seedAdviceRules'
import { startAuditRetention } from './lib/auditRetention'

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
