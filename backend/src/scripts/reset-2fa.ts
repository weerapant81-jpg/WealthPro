import 'dotenv/config'
import { prisma } from '../lib/prisma'

/**
 * ปิด 2FA ให้บัญชี (recovery กรณีล็อกเอาต์เพราะรหัส TOTP ใช้ไม่ได้)
 * ล้าง secret + backup codes ด้วย → ล็อกอินด้วยรหัสผ่านอย่างเดียว แล้วค่อยตั้ง 2FA ใหม่
 *
 * dry-run:  npx ts-node --transpile-only src/scripts/reset-2fa.ts
 * ทำจริง:   CONFIRM=yes npx ts-node --transpile-only src/scripts/reset-2fa.ts
 */
const EMAIL = 'weerapan.t81@gmail.com'
const DO = process.env.CONFIRM === 'yes'

async function main() {
  const u = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, email: true, twoFactorEnabled: true } })
  if (!u) { console.log(`ไม่พบบัญชี ${EMAIL}`); return }
  console.log(`บัญชี ${u.email} — 2FA ปัจจุบัน: ${u.twoFactorEnabled ? 'เปิดอยู่' : 'ปิดอยู่'}`)
  if (!DO) { console.log('(dry-run: จะปิด 2FA + ล้าง secret/backup · รันซ้ำด้วย CONFIRM=yes เพื่อทำจริง)'); return }
  await prisma.user.update({
    where: { id: u.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: undefined },
  })
  console.log('ปิด 2FA เรียบร้อย — ล็อกอินด้วยรหัสผ่านได้เลย แล้วตั้ง 2FA ใหม่ในหน้าตั้งค่าผู้ใช้')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
