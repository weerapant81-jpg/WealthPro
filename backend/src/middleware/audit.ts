import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth'

// endpoint ที่ "ไม่ใช่ข้อมูลลูกค้า" (ข้อมูล/ปฏิบัติการของ FA เอง หรือ global) → ไม่ต้องบันทึก
const SKIP = new Set([
  'auth', 'admin', 'clients', 'appointments', 'tasks', 'announcements',
  'advisor', 'advisor-profile', 'copilot', 'market-data', 'market-returns',
  'asset-return', 'settrade', 'audit-logs',
])

// GET ที่ถือเป็น "การเปิดดูข้อมูลลูกค้า" (endpoint หลักตอนเปิดโปรไฟล์ลูกค้า) — GET อื่นไม่บันทึกกันรก
const VIEW_GET = new Set(['client-profile'])

/**
 * PDPA audit trail — บันทึกอัตโนมัติว่า FA คนไหน ดู/แก้/ลบ ข้อมูลของลูกค้าคนไหน เมื่อไหร่
 * mount หลัง /api และก่อน routes; อ่าน req.userId/effectiveUserId ที่ authenticate เซ็ตไว้ตอน res 'finish'
 */
export function audit(req: AuthRequest, res: Response, next: NextFunction) {
  res.on('finish', () => {
    try {
      const actorId = req.userId
      if (!actorId) return                       // ไม่ได้ล็อกอิน
      if (res.statusCode >= 400) return           // ไม่สำเร็จ ไม่บันทึก
      const method = req.method
      const seg = (req.path || '').replace(/^\//, '').split('/')[0]
      if (!seg || SKIP.has(seg)) return
      const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
      const isView = method === 'GET' && VIEW_GET.has(seg)
      if (!isMutation && !isView) return
      const action = isView ? 'VIEW' : method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE'
      prisma.auditLog.create({
        data: {
          actorId,
          clientId: req.effectiveUserId ?? null,
          action,
          resource: seg,
          method,
          path: (req.originalUrl || req.url).split('?')[0],
          status: res.statusCode,
          ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null,
        },
      }).catch(() => {})   // fire-and-forget — ไม่ให้ audit ล้มแล้วกระทบ request หลัก
    } catch { /* ignore */ }
  })
  next()
}
