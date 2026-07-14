import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

// ---- Action items (รายการปฏิบัติตามแผน) ----
export async function listActionItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const person = req.query.person === 'spouse' ? 'spouse' : 'self'
    const items = await prisma.actionItem.findMany({
      where: { userId: req.effectiveUserId!, person },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })
    const profile = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { planReviewDate: true, actionPlanAdvice: true },
    })
    const advice = (profile?.actionPlanAdvice as any)?.[person] ?? {}
    res.json({ items, planReviewDate: profile?.planReviewDate ?? null, advice })
  } catch (err) { next(err) }
}

// คำแนะนำนักวางแผน รายด้าน (เก็บใน Profile.actionPlanAdvice เป็น JSON แยกตามคน)
export async function setActionPlanAdvice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const person = req.body?.person === 'spouse' ? 'spouse' : 'self'
    const section = String(req.body?.section || '').trim()
    if (!section) { res.status(400).json({ error: 'ต้องระบุ section' }); return }
    const text = typeof req.body?.text === 'string' ? req.body.text : ''
    const existing = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! }, select: { actionPlanAdvice: true } })
    const all: any = (existing?.actionPlanAdvice as any) ?? {}
    const forPerson = { ...(all[person] ?? {}), [section]: text }
    const next2 = { ...all, [person]: forPerson }
    await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { actionPlanAdvice: next2 },
      create: { userId: req.effectiveUserId!, actionPlanAdvice: next2 },
    })
    res.json({ advice: forPerson })
  } catch (err) { next(err) }
}

export async function createActionItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body || {}
    const person = b.person === 'spouse' ? 'spouse' : 'self'
    // กันเพิ่มซ้ำจากคำแนะนำอัตโนมัติเดียวกัน (แยกตามคน)
    if (b.autoKey) {
      const dup = await prisma.actionItem.findFirst({ where: { userId: req.effectiveUserId!, person, autoKey: b.autoKey } })
      if (dup) { res.json(dup); return }
    }
    const item = await prisma.actionItem.create({
      data: {
        userId: req.effectiveUserId!,
        person,
        title: b.title || 'รายการใหม่',
        category: b.category || 'other',
        status: b.status || 'todo',
        owner: b.owner || 'client',
        priority: b.priority || 'medium',
        dueDate: b.dueDate ? new Date(b.dueDate) : null,
        note: b.note ?? null,
        metricKey: b.metricKey ?? null,
        baseline: b.baseline ?? null,
        current: b.current ?? null,
        target: b.target ?? null,
        source: b.source || 'manual',
        autoKey: b.autoKey ?? null,
      },
    })
    res.json(item)
  } catch (err) { next(err) }
}

export async function updateActionItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id)
    const existing = await prisma.actionItem.findFirst({ where: { id, userId: req.effectiveUserId! } })
    if (!existing) { res.status(404).json({ error: 'ไม่พบรายการ' }); return }
    const b = req.body || {}
    const data: any = {}
    for (const k of ['title', 'category', 'status', 'owner', 'priority', 'note', 'metricKey'] as const) {
      if (b[k] !== undefined) data[k] = b[k]
    }
    for (const k of ['baseline', 'current', 'target'] as const) {
      if (b[k] !== undefined) data[k] = b[k]
    }
    if (b.subPlan !== undefined) data.subPlan = b.subPlan
    if (b.dueDate !== undefined) data.dueDate = b.dueDate ? new Date(b.dueDate) : null
    if (b.status !== undefined) data.completedAt = b.status === 'done' ? (existing.completedAt || new Date()) : null
    const item = await prisma.actionItem.update({ where: { id }, data })
    res.json(item)
  } catch (err) { next(err) }
}

export async function deleteActionItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id)
    const existing = await prisma.actionItem.findFirst({ where: { id, userId: req.effectiveUserId! } })
    if (!existing) { res.status(404).json({ error: 'ไม่พบรายการ' }); return }
    await prisma.actionItem.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function setPlanReviewDate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const d = req.body?.planReviewDate ? new Date(req.body.planReviewDate) : null
    await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { planReviewDate: d },
      create: { userId: req.effectiveUserId!, planReviewDate: d },
    })
    res.json({ planReviewDate: d })
  } catch (err) { next(err) }
}
