import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { effectivePlan, hasFeature, Feature } from '../lib/plan'

export interface AuthRequest extends Request {
  userId?: string
  effectiveUserId?: string  // overridden by ADMIN via X-Client-Id header
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'No token provided' })
    return
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId

    const clientId = req.headers['x-client-id'] as string | undefined
    if (clientId && clientId !== payload.userId) {
      const requester = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } })
      if (isAdvisorRole(requester?.role)) {
        // ⚠️ กัน IDOR ข้ามผู้ใช้: ยอมให้สวมเป็น "ลูกค้า" ได้เฉพาะ USER ที่ FA คนนี้เป็นผู้สร้างเท่านั้น
        // ถ้าไม่ใช่เจ้าของ → ตกกลับมาที่ตัวเอง (ไม่ให้เข้าถึงข้อมูลของ FA คนอื่น)
        const owns = await prisma.user.findFirst({
          where: { id: clientId, role: 'USER', createdById: payload.userId },
          select: { id: true },
        })
        req.effectiveUserId = owns ? clientId : payload.userId
      } else {
        req.effectiveUserId = payload.userId
      }
    } else {
      req.effectiveUserId = payload.userId
    }

    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// FA (ADMIN) และผู้ให้บริการ (SUPER_ADMIN) ถือเป็น "นักวางแผน" ที่มีสิทธิ์เต็ม
export const isAdvisorRole = (role?: string | null) => role === 'ADMIN' || role === 'SUPER_ADMIN'

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (!isAdvisorRole(user?.role)) {
    res.status(403).json({ error: 'Admin only' })
    return
  }
  next()
}

/** กั้น route ตามแพ็กเกจของ FA ที่ล็อกอิน (SUPER_ADMIN/USER ผ่านเสมอ) — ตอบ 403 PLAN_REQUIRED */
export function requirePlan(feature: Feature) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, plan: true, planExpiresAt: true },
    })
    const plan = effectivePlan(user)
    if (!hasFeature(plan, feature)) {
      res.status(403).json({ error: 'PLAN_REQUIRED', need: feature === 'copilot' ? 'ai' : 'pro' })
      return
    }
    next()
  }
}

export async function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } })
  if (user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Super admin only' })
    return
  }
  next()
}
