import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

/**
 * ตรวจแหล่งวิดีโอจากลิงก์ที่วาง — รองรับ YouTube / Vimeo / ลิงก์ไฟล์วิดีโอตรง (mp4, HLS ฯลฯ)
 * คืน { provider, ref } · ref = id ของ YouTube/Vimeo หรือ URL เต็ม (กรณี file)
 */
function parseVideoSource(input: string): { provider: string; ref: string } | null {
  const s = String(input || '').trim()
  if (!s) return null
  // Bunny Stream: iframe.mediadelivery.net/embed/{libraryId}/{videoId} (หรือ /play/) → เก็บเป็น "lib/vid"
  const bn = s.match(/mediadelivery\.net\/(?:embed|play)\/(\d+)\/([A-Za-z0-9-]{8,})/i)
  if (bn) return { provider: 'bunny', ref: `${bn[1]}/${bn[2]}` }
  // HLS ยังเล่นไม่ได้บน <video> ปกติ (Chrome) → ให้ใช้ embed หรือ mp4 แทน
  if (/\.m3u8(\?|$)/i.test(s)) return null
  // Vimeo: vimeo.com/123456789 · player.vimeo.com/video/123456789
  const vm = s.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i)
  if (vm) return { provider: 'vimeo', ref: vm[1] }
  // YouTube: youtu.be/ID · watch?v=ID · /embed/ID · /shorts/ID
  const yt = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/)
  if (yt) return { provider: 'youtube', ref: yt[1] }
  // ลิงก์วิดีโอตรง (โฮสต์เอง / Cloudflare Stream / Bunny ฯลฯ)
  if (/^https?:\/\//i.test(s)) return { provider: 'file', ref: s }
  // ใส่ id ล้วน → ถือเป็น YouTube (เข้ากันได้กับของเดิม)
  if (/^[A-Za-z0-9_-]{6,}$/.test(s)) return { provider: 'youtube', ref: s }
  return null
}

/** ภาพปก: รับเฉพาะ URL http/https · อย่างอื่นถือว่าไม่ได้ตั้ง */
function cleanThumb(v: any): string {
  const s = String(v ?? '').trim()
  return /^https?:\/\//i.test(s) ? s : ''
}

// GET /tutorials — สาธารณะ (หน้าเรียนรู้เปิดให้ guest ดูได้)
export async function listTutorials(_req: Request, res: Response): Promise<void> {
  const videos = await prisma.tutorialVideo.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] })
  res.json(videos)
}

// POST /tutorials — SUPER_ADMIN เพิ่มคลิป
export async function createTutorial(req: AuthRequest, res: Response): Promise<void> {
  const { title, description, category, youtube, duration, order, thumbnail } = req.body
  const src = parseVideoSource(youtube ?? req.body.youtubeId)
  if (!title || !String(title).trim()) { res.status(400).json({ error: 'กรุณาระบุชื่อหัวข้อ' }); return }
  if (!src) { res.status(400).json({ error: 'ลิงก์วิดีโอไม่ถูกต้อง — รองรับ YouTube, Vimeo, Bunny (Embed URL) หรือลิงก์ไฟล์ .mp4 · หมายเหตุ: ลิงก์ HLS (.m3u8) ยังไม่รองรับ ให้ใช้ Embed URL หรือ .mp4 แทน' }); return }
  const video = await prisma.tutorialVideo.create({
    data: {
      title: String(title).trim(),
      description: String(description ?? '').trim(),
      category: String(category ?? 'เริ่มต้นใช้งาน').trim(),
      provider: src.provider,
      youtubeId: src.ref,
      thumbnail: cleanThumb(thumbnail),
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
  if (req.body.thumbnail !== undefined) data.thumbnail = cleanThumb(req.body.thumbnail)
  if (order !== undefined) data.order = Number.isFinite(+order) ? +order : 0
  if (youtube !== undefined || req.body.youtubeId !== undefined) {
    const src = parseVideoSource(youtube ?? req.body.youtubeId)
    if (!src) { res.status(400).json({ error: 'ลิงก์วิดีโอไม่ถูกต้อง — รองรับ YouTube, Vimeo, Bunny (Embed URL) หรือลิงก์ไฟล์ .mp4 · หมายเหตุ: ลิงก์ HLS (.m3u8) ยังไม่รองรับ ให้ใช้ Embed URL หรือ .mp4 แทน' }); return }
    data.provider = src.provider
    data.youtubeId = src.ref
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
