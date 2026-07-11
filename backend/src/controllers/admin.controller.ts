import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { decryptField } from '../lib/crypto'

// FA/Admin: สร้าง "ลูกค้า" (User role USER) — เป็น data record ที่ FA ดูแล ไม่ต้อง login เอง
export async function createClient(req: AuthRequest, res: Response): Promise<void> {
  const { name, firstName, lastName, email, phone, birthDate } = req.body
  if (!name || !String(name).trim()) {
    res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' })
    return
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400).json({ error: 'กรุณาระบุอีเมลให้ถูกต้อง' })
    return
  }
  if (!phone || !String(phone).trim()) {
    res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' })
    return
  }
  const finalEmail = String(email).trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email: finalEmail } })
  if (existing) {
    res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' })
    return
  }
  const randomPass = await bcrypt.hash(`${Math.random()}${Date.now()}`, 12)
  const client = await prisma.user.create({
    data: {
      name: String(name).trim(), email: finalEmail, password: randomPass,
      phone: phone ? String(phone) : null,
      birthDate: birthDate ? new Date(birthDate) : null,
      role: 'USER', isApproved: true, isEmailVerified: true,
      createdById: req.userId,
    },
    select: { id: true, name: true, email: true, phone: true },
  })
  // สร้างโปรไฟล์ลูกค้าพร้อมข้อมูลที่กรอกไว้ → หน้า "ข้อมูลส่วนบุคคล" ดึงมาแสดงอัตโนมัติ
  const parts = String(name).trim().split(/\s+/)
  await prisma.clientProfile.create({
    data: {
      userId: client.id,
      firstName: (firstName && String(firstName).trim()) || parts[0] || '',
      lastName: (lastName && String(lastName).trim()) || parts.slice(1).join(' ') || '',
      phone: String(phone).trim(),
      contactEmail: finalEmail,
    },
  })
  res.status(201).json(client)
}

// FA/Admin: แก้ไขข้อมูลลูกค้า (ชื่อ/อีเมล/เบอร์) — อัปเดตทั้ง User และ ClientProfile
export async function updateClient(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const { name, firstName, lastName, email, phone } = req.body
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.role !== 'USER' || target.createdById !== req.userId) {
    res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' })
    return
  }
  if (!name || !String(name).trim()) { res.status(400).json({ error: 'กรุณาระบุชื่อลูกค้า' }); return }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) { res.status(400).json({ error: 'กรุณาระบุอีเมลให้ถูกต้อง' }); return }
  if (!phone || !String(phone).trim()) { res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' }); return }
  const finalEmail = String(email).trim().toLowerCase()
  if (finalEmail !== target.email) {
    const dup = await prisma.user.findUnique({ where: { email: finalEmail } })
    if (dup) { res.status(409).json({ error: 'อีเมลนี้ถูกใช้แล้ว' }); return }
  }
  const parts = String(name).trim().split(/\s+/)
  const fn = (firstName && String(firstName).trim()) || parts[0] || ''
  const ln = (lastName && String(lastName).trim()) || parts.slice(1).join(' ') || ''
  const client = await prisma.user.update({
    where: { id },
    data: { name: String(name).trim(), email: finalEmail, phone: String(phone).trim() },
    select: { id: true, name: true, email: true, phone: true },
  })
  // อัปเดตหน้า "ข้อมูลส่วนบุคคล" ให้ตรงกัน
  await prisma.clientProfile.upsert({
    where: { userId: id },
    update: { firstName: fn, lastName: ln, phone: String(phone).trim(), contactEmail: finalEmail },
    create: { userId: id, firstName: fn, lastName: ln, phone: String(phone).trim(), contactEmail: finalEmail },
  })
  res.json(client)
}

// FA/Admin: ลบลูกค้า (cascade ลบข้อมูลทั้งหมดของลูกค้า)
export async function deleteClient(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.role !== 'USER' || target.createdById !== req.userId) {
    res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' })
    return
  }
  // PDPA right to erasure — บันทึกหลักฐานการลบก่อน (AuditLog ไม่มี FK จึงคงอยู่หลังลบ)
  await prisma.auditLog.create({
    data: { actorId: req.userId!, clientId: id, action: 'DELETE', resource: 'client-erasure',
      method: 'DELETE', path: `/clients/${id}`, status: 200, ip: req.ip ?? null },
  }).catch(() => {})
  // ลบ User → cascade ลบข้อมูลทุกตารางที่เกี่ยวข้อง (onDelete: Cascade ครบทุก relation)
  await prisma.user.delete({ where: { id } })
  res.json({ message: 'ลบลูกค้าและข้อมูลทั้งหมดเรียบร้อย (สิทธิ์ในการลบข้อมูลตาม PDPA)' })
}

// PDPA right to access/portability — ดาวน์โหลดข้อมูลลูกค้าทั้งหมดเป็น JSON
export async function exportClient(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target || target.role !== 'USER' || target.createdById !== req.userId) {
    res.status(404).json({ error: 'ไม่พบลูกค้ารายนี้' })
    return
  }
  const [profile, clientProfile, investmentProfile, incomes, expenses, assets, liabilities, goals, policies, propertyInsurances, actionItems, consents] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: id } }),
    prisma.clientProfile.findUnique({ where: { userId: id } }),
    prisma.investmentProfile.findUnique({ where: { userId: id } }),
    prisma.income.findMany({ where: { userId: id } }),
    prisma.expense.findMany({ where: { userId: id } }),
    prisma.asset.findMany({ where: { userId: id } }),
    prisma.liability.findMany({ where: { userId: id } }),
    prisma.goal.findMany({ where: { userId: id } }),
    prisma.lifeInsurancePolicy.findMany({ where: { userId: id } }),
    prisma.propertyInsurance.findMany({ where: { userId: id } }),
    prisma.actionItem.findMany({ where: { userId: id } }),
    prisma.consent.findMany({ where: { clientId: id }, orderBy: { grantedAt: 'desc' } }),
  ])
  const policyIds = policies.map(p => p.id)
  const [riders, beneficiaries] = await Promise.all([
    policyIds.length ? prisma.lifeInsuranceRider.findMany({ where: { policyId: { in: policyIds } } }) : Promise.resolve([]),
    policyIds.length ? prisma.lifeInsuranceBeneficiary.findMany({ where: { policyId: { in: policyIds } } }) : Promise.resolve([]),
  ])
  // audit การ export
  await prisma.auditLog.create({
    data: { actorId: req.userId!, clientId: id, action: 'VIEW', resource: 'client-export',
      method: 'GET', path: `/clients/${id}/export`, status: 200, ip: req.ip ?? null },
  }).catch(() => {})

  // ถอดรหัสเลขบัตร ปชช. (self + คู่สมรส) ให้ export เป็นค่าจริง
  if (clientProfile?.nationalId) clientProfile.nationalId = decryptField(clientProfile.nationalId)
  const sp = clientProfile?.spouseProfile as any
  if (sp && typeof sp === 'object' && sp.nationalId) sp.nationalId = decryptField(sp.nationalId)

  const data = {
    exportedAt: new Date().toISOString(),
    note: 'ข้อมูลส่วนบุคคลตามสิทธิ์เข้าถึง/พกพา (PDPA)',
    account: { id: target.id, email: target.email, name: target.name, phone: target.phone, createdAt: target.createdAt },
    profile, clientProfile, investmentProfile, incomes, expenses, assets, liabilities, goals,
    lifeInsurances: policies, riders, beneficiaries, propertyInsurances, actionItems, consents,
  }
  const fname = `client-data-${(clientProfile?.firstName || 'export')}-${id.slice(0, 6)}.json`
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.send(JSON.stringify(data, null, 2))
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  const status = req.query.status as string | undefined
  // เฉพาะบัญชีนักวางแผน (FA = ADMIN) — ไม่รวมลูกค้า (USER) และผู้ให้บริการ (SUPER_ADMIN)
  const where: any = { role: 'ADMIN' }
  if (status === 'archived') where.archivedAt = { not: null }   // นักวางแผนที่ถูกนำออกจากรายการ
  else {
    where.archivedAt = null   // รายการปกติไม่รวมคนที่นำออกแล้ว
    if (status === 'pending') where.isApproved = false
    else if (status === 'approved') where.isApproved = true
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, email: true, name: true, phone: true, birthDate: true,
      role: true, isEmailVerified: true, isApproved: true, archivedAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(users)
}

// นำนักวางแผนออกจากรายการ (ลาออก/ไม่ชำระเงิน) — บล็อกล็อกอินแต่ยังเก็บข้อมูลไว้
export async function archiveUser(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const user = await prisma.user.update({
    where: { id },
    data: { archivedAt: new Date() },
    select: { id: true, email: true, name: true, archivedAt: true },
  })
  res.json(user)
}

// กู้คืนนักวางแผนกลับเข้ารายการ
export async function unarchiveUser(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const user = await prisma.user.update({
    where: { id },
    data: { archivedAt: null },
    select: { id: true, email: true, name: true, archivedAt: true },
  })
  res.json(user)
}

// FA/Admin: list approved clients for client-switching
export async function listClients(req: AuthRequest, res: Response): Promise<void> {
  const q = (req.query.q as string ?? '').trim()
  // แต่ละ FA เห็นเฉพาะลูกค้าที่ตัวเองสร้าง (SUPER_ADMIN ก็เห็นเฉพาะของตัวเอง)
  const where: any = { role: 'USER', isApproved: true, createdById: req.userId }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  const clients = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true, phone: true, createdAt: true },
    orderBy: { name: 'asc' },
    take: 50,
  })
  res.json(clients)
}

// FA/Admin: practice overview — รวมยอดข้ามลูกค้าทุกราย (AUM/Net Worth/แผน active)
export async function getAdvisorSummary(req: AuthRequest, res: Response): Promise<void> {
  const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
  const clients = await prisma.user.findMany({
    where: { role: 'USER', isApproved: true, createdById: req.userId },
    select: { id: true, name: true, email: true },
  })
  const ids = clients.map(c => c.id)
  if (ids.length === 0) {
    res.json({ clientCount: 0, activePlans: 0, totalAUM: 0, totalNetWorth: 0, totalDebt: 0, byStructure: { liquid: 0, invest: 0, personal: 0 }, topClients: [] })
    return
  }

  const [invProfiles, assets, liabs, profiles] = await Promise.all([
    prisma.investmentProfile.findMany({ where: { userId: { in: ids } } }),
    prisma.asset.findMany({ where: { userId: { in: ids } } }),
    prisma.liability.findMany({ where: { userId: { in: ids } } }),
    prisma.profile.findMany({ where: { userId: { in: ids } }, select: { userId: true, retirementPlan: true, insurancePlan: true, educationPlan: true } }),
  ])

  const invByUser = new Map(invProfiles.map(p => [p.userId, p as any]))
  const assetsByUser = new Map<string, any[]>()
  for (const a of assets) { const arr = assetsByUser.get(a.userId) ?? []; arr.push(a); assetsByUser.set(a.userId, arr) }
  const liabByUser = new Map<string, any[]>()
  for (const l of liabs) { const arr = liabByUser.get(l.userId) ?? []; arr.push(l); liabByUser.set(l.userId, arr) }

  let liquid = 0, invest = 0, personal = 0, debt = 0
  const perClient = clients.map(c => {
    const ip: any = invByUser.get(c.id) ?? {}
    const sv = (ip.savingsAccounts ?? []).reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
    const iv = (ip.investmentAssets ?? []).reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
    const pa = (ip.personalAssets ?? []).reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
    const manualInv = (assetsByUser.get(c.id) ?? []).filter(a => String(a.category).startsWith('invest_')).reduce((s, a) => s + (a.value || 0), 0)
    const profLiab = (ip.liabilities ?? []).reduce((s: number, l: any) => s + toNum(l.currentBalance), 0)
    const shortLiab = (liabByUser.get(c.id) ?? []).filter(l => String(l.category).startsWith('short_')).reduce((s, l) => s + (l.balance || 0), 0)
    const totalAssets = sv + iv + pa + manualInv
    const totalDebt = profLiab + shortLiab
    liquid += sv; invest += iv + manualInv; personal += pa; debt += totalDebt
    return { id: c.id, name: c.name, email: c.email, aum: totalAssets, netWorth: totalAssets - totalDebt }
  })

  const totalAUM = liquid + invest + personal
  const activePlans = profiles.filter(p => p.retirementPlan || p.insurancePlan || p.educationPlan).length
  const topClients = [...perClient].sort((a, b) => b.aum - a.aum).slice(0, 8)

  res.json({
    clientCount: clients.length,
    activePlans,
    totalAUM,
    totalNetWorth: totalAUM - debt,
    totalDebt: debt,
    byStructure: { liquid, invest, personal },
    topClients,
  })
}

export async function approveUser(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const user = await prisma.user.update({
    where: { id },
    data: { isApproved: true },
    select: { id: true, email: true, name: true, isApproved: true },
  })
  res.json(user)
}

export async function rejectUser(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  await prisma.user.delete({ where: { id } })
  res.json({ message: 'User removed' })
}
