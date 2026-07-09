import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

// ข่าว/ประกาศจากผู้ให้บริการ (SUPER_ADMIN โพสต์ · FA อ่าน)
export async function getAnnouncements(_req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.announcement.findMany({ orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], take: 50 })
  res.json(data)
}
export async function createAnnouncement(req: AuthRequest, res: Response): Promise<void> {
  const { title, body, pinned } = req.body
  if (!title || !body) { res.status(400).json({ error: 'ต้องระบุหัวข้อและเนื้อหา' }); return }
  const data = await prisma.announcement.create({ data: { title: String(title), body: String(body), pinned: !!pinned } })
  res.status(201).json(data)
}
export async function updateAnnouncement(req: AuthRequest, res: Response): Promise<void> {
  const { title, body, pinned } = req.body
  const data = await prisma.announcement.update({
    where: { id: String(req.params.id) },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(body !== undefined ? { body: String(body) } : {}),
      ...(pinned !== undefined ? { pinned: !!pinned } : {}),
    },
  })
  res.json(data)
}
export async function deleteAnnouncement(req: AuthRequest, res: Response): Promise<void> {
  await prisma.announcement.deleteMany({ where: { id: String(req.params.id) } })
  res.status(204).send()
}
