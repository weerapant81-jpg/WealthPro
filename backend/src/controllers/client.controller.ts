import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export async function getClientProfile(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.clientProfile.findUnique({
    where: { userId: req.effectiveUserId! },
    include: { children: true },
  })
  res.json(data)
}

export async function upsertClientProfile(req: AuthRequest, res: Response): Promise<void> {
  const { children, ...profileData } = req.body

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
  res.json(result)
}

