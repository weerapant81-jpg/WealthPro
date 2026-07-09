import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest, isAdvisorRole } from '../middleware/auth'

const RESOURCE_LABEL: Record<string, string> = {
  'client-profile': 'ข้อมูลส่วนบุคคล', 'incomes': 'รายได้', 'expenses': 'รายจ่าย',
  'assets': 'สินทรัพย์', 'liabilities': 'หนี้สิน', 'goals': 'เป้าหมาย', 'profile': 'สมมติฐาน',
  'retirement-plan': 'แผนเกษียณ', 'insurance-plan': 'แผนประกัน', 'education-plan': 'แผนการศึกษา',
  'tax-plan': 'แผนภาษี', 'estate-plan': 'แผนมรดก', 'cashflow-plan': 'งบล่วงหน้า',
  'investment-profile': 'พอร์ตลงทุน', 'life-insurances': 'ประกันชีวิต', 'riders': 'สัญญาเพิ่มเติม',
  'beneficiaries': 'ผู้รับผลประโยชน์', 'property-insurances': 'ประกันทรัพย์สิน',
  'action-items': 'แผนปฏิบัติการ', 'report-plan': 'รายงาน', 'pvd-plan': 'กองทุนสำรองเลี้ยงชีพ',
  'sso-plan': 'ประกันสังคม', 'severance-plan': 'เงินชดเชย', 'plan-review-date': 'วันทบทวนแผน',
  'all-riders': 'สัญญาเพิ่มเติม',
}

// GET /audit-logs?clientId=&limit=&offset=
export async function listAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } })
  if (!isAdvisorRole(me?.role)) { res.status(403).json({ error: 'ไม่มีสิทธิ์' }); return }
  const isSuper = me?.role === 'SUPER_ADMIN'

  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const clientId = (req.query.clientId as string) || undefined

  // FA เห็นเฉพาะการกระทำของตัวเอง · SUPER_ADMIN เห็นทั้งหมด
  const where: any = {}
  if (!isSuper) where.actorId = req.userId
  if (clientId) where.clientId = clientId

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.auditLog.count({ where }),
  ])

  // resolve ชื่อ FA + ลูกค้า (denormalize ตอนอ่าน)
  const actorIds = [...new Set(logs.map(l => l.actorId))]
  const clientIds = [...new Set(logs.map(l => l.clientId).filter(Boolean) as string[])]
  const [actors, profiles] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }),
    prisma.clientProfile.findMany({ where: { userId: { in: clientIds } }, select: { userId: true, firstName: true, lastName: true } }),
  ])
  const actorMap = new Map(actors.map(a => [a.id, a]))
  const profMap = new Map(profiles.map(p => [p.userId, p]))

  res.json({
    total,
    logs: logs.map(l => {
      const a = actorMap.get(l.actorId)
      const p = l.clientId ? profMap.get(l.clientId) : undefined
      return {
        id: l.id,
        actorName: a?.name || a?.email || l.actorId.slice(0, 8),
        clientName: p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'ลูกค้า' : (l.clientId === l.actorId ? 'ตนเอง' : '—'),
        action: l.action,
        resource: l.resource,
        resourceLabel: RESOURCE_LABEL[l.resource] || l.resource,
        ip: l.ip,
        createdAt: l.createdAt,
      }
    }),
  })
}
