import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'

/* ── Lead จากเกมเศรษฐี (/game — หน้า public ไม่ต้อง login) ── */

// throttle ง่ายๆ ใน memory: จำกัดต่อ IP 5 ครั้ง / 10 นาที (กัน spam ฟอร์ม public)
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function throttled(ip: string): boolean {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (list.length >= MAX_PER_WINDOW) { hits.set(ip, list); return true }
  list.push(now)
  hits.set(ip, list)
  // กัน map โตไม่จำกัด
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every(t => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return false
}

// POST /game/lead (public)  body { name, contact, career?, score?, grade?, result? }
export async function createGameLead(req: Request, res: Response): Promise<void> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (throttled(ip)) { res.status(429).json({ error: 'ส่งถี่เกินไป กรุณาลองใหม่ภายหลัง' }); return }

  const name = String(req.body?.name ?? '').trim().slice(0, 100)
  const contact = String(req.body?.contact ?? '').trim().slice(0, 100)
  if (!name || !contact) { res.status(400).json({ error: 'กรุณากรอกชื่อและช่องทางติดต่อ' }); return }

  const score = Number.isFinite(Number(req.body?.score)) ? Math.round(Number(req.body.score)) : null
  const grade = typeof req.body?.grade === 'string' ? req.body.grade.slice(0, 2) : null
  const career = typeof req.body?.career === 'string' ? req.body.career.slice(0, 50) : null
  // จำกัดขนาด result กันยัด payload ใหญ่
  let result: object | null = null
  if (req.body?.result && typeof req.body.result === 'object' && JSON.stringify(req.body.result).length <= 2000) {
    result = req.body.result
  }

  const lead = await prisma.gameLead.create({ data: { name, contact, career, score, grade, result: result ?? undefined } })
  res.json({ ok: true, id: lead.id })
}

// GET /game/leads (FA/admin)
export async function listGameLeads(_req: Request, res: Response): Promise<void> {
  const leads = await prisma.gameLead.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
  res.json(leads)
}

// PUT /game/leads/:id  body { contacted } — FA ติ๊กว่าติดต่อกลับแล้ว
export async function updateGameLead(req: Request, res: Response): Promise<void> {
  const lead = await prisma.gameLead.update({
    where: { id: req.params.id as string },
    data: { contacted: !!req.body?.contacted },
  })
  res.json(lead)
}
