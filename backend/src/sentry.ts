import * as Sentry from '@sentry/node'

// เปิด Sentry เฉพาะเมื่อมี SENTRY_DSN (ไม่มี = ปิดเงียบ ไม่กระทบการทำงาน)
// ต้อง import หลัง 'dotenv/config' ใน index.ts เพื่อให้ process.env พร้อมแล้ว
const dsn = process.env.SENTRY_DSN
export const sentryEnabled = !!dsn

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0,   // เก็บเฉพาะ error ก่อน (ไม่เก็บ performance trace)
  })
  // eslint-disable-next-line no-console
  console.log('[Sentry] error monitoring enabled')
}

export { Sentry }
