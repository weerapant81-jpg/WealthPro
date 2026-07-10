import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

// เปิด Sentry เฉพาะเมื่อมี VITE_SENTRY_DSN (ไม่มี = ปิดเงียบ) — จับ error ที่ผู้ใช้เจอในหน้าเว็บ
const dsn = import.meta.env.VITE_SENTRY_DSN
if (dsn) {
  Sentry.init({ dsn, environment: import.meta.env.MODE, tracesSampleRate: 0 })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
