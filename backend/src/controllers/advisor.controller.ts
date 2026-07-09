import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

// ทั้งหมดผูกกับ "นักวางแผน" ที่ล็อกอิน (req.userId) ไม่ใช่ลูกค้า (effectiveUserId)

// ── Appointments ──
export async function getAppointments(req: AuthRequest, res: Response): Promise<void> {
  const upcoming = req.query.upcoming === '1'
  const where: any = { advisorId: req.userId! }
  if (upcoming) where.date = { gte: new Date() }
  const data = await prisma.appointment.findMany({ where, orderBy: { date: 'asc' }, take: upcoming ? 20 : 200 })
  res.json(data)
}
export async function createAppointment(req: AuthRequest, res: Response): Promise<void> {
  const { title, clientName, date, note } = req.body
  if (!title || !date) { res.status(400).json({ error: 'ต้องระบุหัวข้อและวันเวลา' }); return }
  const data = await prisma.appointment.create({
    data: { advisorId: req.userId!, title: String(title), clientName: clientName ? String(clientName) : null, date: new Date(date), note: note ? String(note) : null },
  })
  res.status(201).json(data)
}
export async function updateAppointment(req: AuthRequest, res: Response): Promise<void> {
  const { title, clientName, date, note } = req.body
  await prisma.appointment.updateMany({
    where: { id: String(req.params.id), advisorId: req.userId! },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(clientName !== undefined ? { clientName: clientName ? String(clientName) : null } : {}),
      ...(date !== undefined ? { date: new Date(date) } : {}),
      ...(note !== undefined ? { note: note ? String(note) : null } : {}),
    },
  })
  res.json({ ok: true })
}
export async function deleteAppointment(req: AuthRequest, res: Response): Promise<void> {
  await prisma.appointment.deleteMany({ where: { id: String(req.params.id), advisorId: req.userId! } })
  res.status(204).send()
}

// ── Tasks ──
export async function getTasks(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.task.findMany({ where: { advisorId: req.userId! }, orderBy: [{ done: 'asc' }, { createdAt: 'desc' }] })
  res.json(data)
}
export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  const { title, dueDate } = req.body
  if (!title || !String(title).trim()) { res.status(400).json({ error: 'ต้องระบุงาน' }); return }
  const data = await prisma.task.create({
    data: { advisorId: req.userId!, title: String(title).trim(), dueDate: dueDate ? new Date(dueDate) : null },
  })
  res.status(201).json(data)
}
export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  const { title, done, dueDate } = req.body
  await prisma.task.updateMany({
    where: { id: String(req.params.id), advisorId: req.userId! },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(done !== undefined ? { done: !!done } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
  })
  res.json({ ok: true })
}
export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  await prisma.task.deleteMany({ where: { id: String(req.params.id), advisorId: req.userId! } })
  res.status(204).send()
}
