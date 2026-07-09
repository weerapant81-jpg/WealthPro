import { Response } from 'express'
import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { genSecret, otpauthUrl, verifyTotp, genBackupCodes } from '../lib/twofa'

// GET /auth/2fa/status
export async function status2fa(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { twoFactorEnabled: true } })
  res.json({ enabled: !!user?.twoFactorEnabled })
}

// POST /auth/2fa/setup — สร้าง secret (ยังไม่เปิดใช้) + QR ให้สแกน
export async function setup2fa(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) { res.status(404).json({ error: 'ไม่พบผู้ใช้' }); return }
  const secret = genSecret()
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } })
  const url = otpauthUrl(user.email, secret)
  res.json({ qr: await QRCode.toDataURL(url), secret, otpauth: url })
}

// POST /auth/2fa/enable — ยืนยันรหัสจากแอป → เปิดใช้ + คืนรหัสสำรอง (ครั้งเดียว)
export async function enable2fa(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user?.twoFactorSecret) { res.status(400).json({ error: 'ยังไม่ได้เริ่มตั้งค่า 2FA' }); return }
  const token = String(req.body.token ?? '').replace(/\s/g, '')
  if (!verifyTotp(token, user.twoFactorSecret)) { res.status(400).json({ error: 'รหัสไม่ถูกต้อง กรุณาลองใหม่' }); return }
  const { codes, hashes } = await genBackupCodes()
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true, twoFactorBackupCodes: hashes } })
  res.json({ enabled: true, backupCodes: codes })
}

// POST /auth/2fa/disable — ยืนยันด้วยรหัส 2FA ปัจจุบัน หรือรหัสผ่าน
export async function disable2fa(req: AuthRequest, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) { res.status(404).json({ error: 'ไม่พบผู้ใช้' }); return }
  const token = String(req.body.token ?? '').replace(/\s/g, '')
  const okTotp = user.twoFactorSecret ? verifyTotp(token, user.twoFactorSecret) : false
  const okPwd = user.password && req.body.password ? await bcrypt.compare(req.body.password, user.password) : false
  if (!okTotp && !okPwd) { res.status(400).json({ error: 'ยืนยันตัวตนไม่สำเร็จ (ใส่รหัส 2FA หรือรหัสผ่าน)' }); return }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: undefined } })
  res.json({ enabled: false })
}
