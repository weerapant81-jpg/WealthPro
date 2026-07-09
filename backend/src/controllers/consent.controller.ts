import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export const CONSENT_VERSION = '1.0'
export const CONSENT_TEXT =
  'ข้าพเจ้ายินยอมให้ที่ปรึกษาการเงินและผู้ให้บริการแอปพลิเคชัน WealthPro เก็บรวบรวม ใช้ และประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้า ' +
  'เพื่อวัตถุประสงค์ในการวางแผนและให้คำปรึกษาทางการเงิน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ' +
  'โดยข้าพเจ้าสามารถถอนความยินยอมได้ทุกเมื่อ'

const SCOPE_ALL = ['collect', 'analyze', 'ai']  // เก็บข้อมูล · วิเคราะห์/วางแผน · ส่งให้ AI ช่วยวิเคราะห์

// ตรวจว่าลูกค้ารายนี้เป็นของ FA ที่เรียก
async function ownClient(req: AuthRequest, id: string): Promise<boolean> {
  const t = await prisma.user.findUnique({ where: { id }, select: { role: true, createdById: true } })
  return !!t && t.role === 'USER' && t.createdById === req.userId
}

// GET /clients/:id/consent
export async function getConsent(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  if (!(await ownClient(req, id))) { res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' }); return }
  const history = await prisma.consent.findMany({ where: { clientId: id }, orderBy: { grantedAt: 'desc' } })
  const active = history.find(c => !c.revokedAt) ?? null
  res.json({ version: CONSENT_VERSION, text: CONSENT_TEXT, scopesAll: SCOPE_ALL, active, history })
}

// POST /clients/:id/consent  body { scopes?, method?, note? }
export async function grantConsent(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  if (!(await ownClient(req, id))) { res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' }); return }
  // ปิดฉบับเดิมที่ยัง active (เก็บเป็นประวัติ)
  await prisma.consent.updateMany({ where: { clientId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  const consent = await prisma.consent.create({
    data: {
      clientId: id,
      version: CONSENT_VERSION,
      scopes: Array.isArray(req.body.scopes) && req.body.scopes.length ? req.body.scopes : SCOPE_ALL,
      method: req.body.method === 'client' ? 'client' : 'advisor',
      recordedById: req.userId!,
      note: req.body.note || null,
    },
  })
  res.json(consent)
}

// POST /clients/:id/consent/revoke — ถอนความยินยอม
export async function revokeConsent(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  if (!(await ownClient(req, id))) { res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' }); return }
  await prisma.consent.updateMany({ where: { clientId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  res.json({ revoked: true })
}
