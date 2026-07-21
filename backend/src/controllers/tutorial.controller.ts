import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

/** ดึง videoId จาก URL YouTube ทุกรูปแบบ หรือรับ id ตรง ๆ */
function parseYoutubeId(input: string): string {
  const s = String(input || '').trim()
  if (!s) return ''
  // youtu.be/ID · youtube.com/watch?v=ID · /embed/ID · /shorts/ID
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/)
  if (m) return m[1]
  // ถ้าไม่ใช่ URL แต่เป็น id ล้วน (ไม่มี / หรือ .) → ใช้เลย
  if (/^[A-Za-z0-9_-]{6,}$/.test(s)) return s
  return ''
}

// GET /tutorials — สาธารณะ (หน้าเรียนรู้เปิดให้ guest ดูได้)
export async function listTutorials(_req: Request, res: Response): Promise<void> {
  const videos = await prisma.tutorialVideo.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  res.json(videos)
}

// POST /tutorials — SUPER_ADMIN เพิ่มคลิป
export async function createTutorial(req: AuthRequest, res: Response): Promise<void> {
  const { title, description, category, youtube, duration, order } = req.body
  const youtubeId = parseYoutubeId(youtube ?? req.body.youtubeId)
  if (!title || !String(title).trim()) { res.status(400).json({ error: 'กรุณาระบุชื่อหัวข้อ' }); return }
  if (!youtubeId) { res.status(400).json({ error: 'ลิงก์ YouTube ไม่ถูกต้อง' }); return }
  const video = await prisma.tutorialVideo.create({
    data: {
      title: String(title).trim(),
      description: String(description ?? '').trim(),
      category: String(category ?? 'เริ่มต้นใช้งาน').trim(),
      youtubeId,
      duration: String(duration ?? '').trim(),
      order: Number.isFinite(+order) ? +order : 0,
    },
  })
  res.status(201).json(video)
}

// PATCH /tutorials/:id — SUPER_ADMIN แก้ไข
export async function updateTutorial(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  const { title, description, category, youtube, duration, order } = req.body
  const data: any = {}
  if (title !== undefined) data.title = String(title).trim()
  if (description !== undefined) data.description = String(description).trim()
  if (category !== undefined) data.category = String(category).trim()
  if (duration !== undefined) data.duration = String(duration).trim()
  if (order !== undefined) data.order = Number.isFinite(+order) ? +order : 0
  if (youtube !== undefined || req.body.youtubeId !== undefined) {
    const yid = parseYoutubeId(youtube ?? req.body.youtubeId)
    if (!yid) { res.status(400).json({ error: 'ลิงก์ YouTube ไม่ถูกต้อง' }); return }
    data.youtubeId = yid
  }
  try {
    const video = await prisma.tutorialVideo.update({ where: { id }, data })
    res.json(video)
  } catch {
    res.status(404).json({ error: 'ไม่พบวิดีโอนี้' })
  }
}

// DELETE /tutorials/:id — SUPER_ADMIN ลบ
export async function deleteTutorial(req: AuthRequest, res: Response): Promise<void> {
  const id = req.params.id as string
  try {
    await prisma.tutorialVideo.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'ไม่พบวิดีโอนี้' })
  }
}
