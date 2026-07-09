// เข้ารหัสเลขบัตรประชาชนเดิม (self + คู่สมรส) ที่ยังเป็น plaintext — รันครั้งเดียวหลังตั้ง ENCRYPTION_KEY
// วิธีรัน:  cd backend && npx ts-node src/scripts/migrate-encrypt-nationalid.ts
import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { encryptField, isEncrypted } from '../lib/crypto'

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ต้องตั้ง ENCRYPTION_KEY ใน backend/.env ก่อน (สุ่ม 32 ไบต์ = hex 64 ตัว)')
    process.exit(1)
  }
  const profiles = await prisma.clientProfile.findMany({ select: { id: true, nationalId: true, spouseProfile: true } })
  let n = 0
  for (const p of profiles) {
    const data: any = {}
    if (p.nationalId && !isEncrypted(p.nationalId)) data.nationalId = encryptField(p.nationalId)
    const sp: any = p.spouseProfile
    if (sp && typeof sp === 'object' && sp.nationalId && !isEncrypted(sp.nationalId)) {
      data.spouseProfile = { ...sp, nationalId: encryptField(sp.nationalId) }
    }
    if (Object.keys(data).length) { await prisma.clientProfile.update({ where: { id: p.id }, data }); n++ }
  }
  console.log(`✅ เข้ารหัสเลขบัตรแล้ว ${n} โปรไฟล์ (จากทั้งหมด ${profiles.length})`)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
