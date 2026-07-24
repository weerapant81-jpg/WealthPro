import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

const CATEGORIES = ['job', 'income', 'marital', 'child', 'home', 'review', 'other']

// ── ฝั่งลูกค้า (client portal) ──

// ลูกค้าส่งคำแจ้งถึง FA เจ้าของ (resolve advisorId จาก createdById ของตัวเอง)
export async function createClientRequest(req: AuthRequest, res: Response): Promise<void> {
  const clientId = req.effectiveUserId!
  const category = String(req.body?.category ?? '')
  const message = req.body?.message != null ? String(req.body.message).slice(0, 2000) : null
  if (!CATEGORIES.includes(category)) { res.status(400).json({ error: 'ประเภทคำแจ้งไม่ถูกต้อง' }); return }

  const me = await prisma.user.findUnique({ where: { id: clientId }, select: { role: true, createdById: true } })
  if (!me || me.role !== 'USER' || !me.createdById) {
    res.status(403).json({ error: 'บัญชีนี้ไม่สามารถส่งคำแจ้งได้' })
    return
  }
  const reqRow = await prisma.clientRequest.create({
    data: { clientId, advisorId: me.createdById, category, message, status: 'new' },
  })
  res.status(201).json(reqRow)
}

// ลูกค้าดูประวัติคำแจ้งของตัวเอง
export async function listMyRequests(req: AuthRequest, res: Response): Promise<void> {
  const clientId = req.effectiveUserId!
  const rows = await prisma.clientRequest.findMany({
    where: { clientId }, orderBy: { createdAt: 'desc' }, take: 50,
  })
  res.json(rows)
}

// ── ฝั่ง FA ──

// FA ดูคำแจ้งจากลูกค้าทุกคนในความดูแล (advisorId = ตัวเอง)
export async function listAdvisorRequests(req: AuthRequest, res: Response): Promise<void> {
  const status = req.query.status as string | undefined
  const where: any = { advisorId: req.userId }
  if (status && ['new', 'seen', 'resolved'].includes(status)) where.status = status
  const rows = await prisma.clientRequest.findMany({
    where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100,
    include: { client: { select: { id: true, name: true } } },
  })
  res.json(rows)
}

// FA อัปเดตสถานะคำแจ้ง (seen/resolved) — เฉพาะคำแจ้งของตัวเอง
export async function updateAdvisorRequest(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const status = String(req.body?.status ?? '')
  if (!['seen', 'resolved'].includes(status)) { res.status(400).json({ error: 'สถานะไม่ถูกต้อง' }); return }
  const row = await prisma.clientRequest.findFirst({ where: { id, advisorId: req.userId } })
  if (!row) { res.status(404).json({ error: 'ไม่พบคำแจ้งนี้' }); return }
  const updated = await prisma.clientRequest.update({
    where: { id },
    data: { status, ...(status === 'seen' ? { seenAt: new Date() } : { resolvedAt: new Date() }) },
  })
  res.json(updated)
}
