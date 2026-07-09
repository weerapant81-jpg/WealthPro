import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { encryptField, decryptField } from '../lib/crypto'

// ถอดรหัสเลขบัตร ปชช. (self + คู่สมรสใน JSON) ก่อนส่งให้ frontend
function decryptProfile<T extends { nationalId?: string | null; spouseProfile?: any } | null>(p: T): T {
  if (!p) return p
  if (p.nationalId) p.nationalId = decryptField(p.nationalId)
  if (p.spouseProfile && typeof p.spouseProfile === 'object' && p.spouseProfile.nationalId)
    p.spouseProfile.nationalId = decryptField(p.spouseProfile.nationalId)
  return p
}

export async function getClientProfile(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.clientProfile.findUnique({
    where: { userId: req.effectiveUserId! },
    include: { children: true },
  })
  res.json(decryptProfile(data))
}

export async function upsertClientProfile(req: AuthRequest, res: Response): Promise<void> {
  const { children, ...profileData } = req.body

  // เข้ารหัสเลขบัตร ปชช. ก่อนบันทึก (self + คู่สมรสใน JSON)
  if (profileData.nationalId !== undefined) profileData.nationalId = encryptField(profileData.nationalId)
  if (profileData.spouseProfile && typeof profileData.spouseProfile === 'object' && profileData.spouseProfile.nationalId)
    profileData.spouseProfile = { ...profileData.spouseProfile, nationalId: encryptField(profileData.spouseProfile.nationalId) }

  const profile = await prisma.clientProfile.upsert({
    where: { userId: req.effectiveUserId! },
    update: profileData,
    create: { ...profileData, userId: req.effectiveUserId! },
  })

  if (Array.isArray(children)) {
    await prisma.child.deleteMany({ where: { clientProfileId: profile.id } })
    if (children.length > 0) {
      await prisma.child.createMany({
        data: children.map((c: any) => ({ ...c, clientProfileId: profile.id })),
      })
    }
  }

  const result = await prisma.clientProfile.findUnique({
    where: { id: profile.id },
    include: { children: true },
  })
  res.json(decryptProfile(result))
}

