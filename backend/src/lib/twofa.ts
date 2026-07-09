import { authenticator } from 'otplib'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from './prisma'

authenticator.options = { window: 1 }  // ยอมรับรหัสก่อน/หลัง 1 ช่วง (กันเวลาเครื่องเหลื่อม)

export const genSecret = () => authenticator.generateSecret()
export const otpauthUrl = (email: string, secret: string) => authenticator.keyuri(email, 'WealthPro', secret)
export function verifyTotp(token: string, secret: string): boolean {
  try { return authenticator.verify({ token, secret }) } catch { return false }
}

// สร้างรหัสสำรอง 8 ชุด (คืนค่า plain ครั้งเดียว + เก็บ hash)
export async function genBackupCodes(): Promise<{ codes: string[]; hashes: string[] }> {
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'))
  const hashes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)))
  return { codes, hashes }
}

// ยืนยัน 2FA: ลอง TOTP ก่อน · ถ้าไม่ผ่านลองรหัสสำรอง (ใช้แล้วตัดทิ้ง)
export async function verifyTwoFactor(user: { id: string; twoFactorSecret: string | null; twoFactorBackupCodes: unknown }, code: string): Promise<boolean> {
  if (user.twoFactorSecret && verifyTotp(code, user.twoFactorSecret)) return true
  const hashes: string[] = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes as string[] : []
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(code, hashes[i])) {
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorBackupCodes: hashes.filter((_, j) => j !== i) } })
      return true
    }
  }
  return false
}
