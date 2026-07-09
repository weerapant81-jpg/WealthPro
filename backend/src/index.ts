import 'dotenv/config'   // ต้องมาก่อน import อื่น — controller/lib อ่าน process.env ตอนโหลดโมดูล (routes → controllers, mailer ฯลฯ)
import express from 'express'
import cors from 'cors'
import routes from './routes'
import { audit } from './middleware/audit'
import { seedAdviceRules } from './lib/seedAdviceRules'

const app = express()
// อนุญาต origin จาก FRONTEND_URL (คั่นด้วย , ได้หลายค่า) + localhost สำหรับ dev · ไม่มี Origin (same-origin/proxy) = ผ่าน
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)) }))
app.use(express.json())
app.set('trust proxy', true)   // อ่าน client IP จริงหลัง proxy (Render/Vercel)
app.use('/api', audit, routes)   // audit ดักก่อน routes → บันทึกตอน response finish
app.get('/health', (_, res) => res.json({ ok: true }))

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err)
  res.status(500).json({ error: err.message ?? 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`)
  await seedAdviceRules()
})
