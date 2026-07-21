import 'dotenv/config'
import { prisma } from '../lib/prisma'

/**
 * ลบบัญชีทดสอบ (FA) + ลูกค้าที่บัญชีนั้นสร้าง + ข้อมูลที่เกี่ยวข้อง เพื่อสมัครใหม่ได้
 *
 * ความปลอดภัย: ค่าเริ่มต้นเป็น DRY-RUN (แค่แสดงว่าจะลบอะไร ไม่ลบจริง)
 * จะลบจริงต่อเมื่อรันด้วย  CONFIRM=yes
 *
 * รัน (dry-run ก่อน):   npx ts-node --transpile-only src/scripts/clear-test-users.ts
 * รันลบจริง:            CONFIRM=yes npx ts-node --transpile-only src/scripts/clear-test-users.ts
 */

const TARGET_EMAILS = ['jidapa_pfa@hotmail.com', 'wee_iesut@hotmail.com']
const DO_DELETE = process.env.CONFIRM === 'yes'

async function main() {
  console.log(`\n=== เคลียร์บัญชีทดสอบ (${DO_DELETE ? '⚠️  ลบจริง' : 'DRY-RUN — แสดงอย่างเดียว'}) ===\n`)

  for (const raw of TARGET_EMAILS) {
    const email = raw.trim().toLowerCase()
    const fa = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, name: true } })
    if (!fa) { console.log(`• ${email} — ไม่พบบัญชีนี้ (ข้าม)\n`); continue }

    const clients = await prisma.user.findMany({ where: { role: 'USER', createdById: fa.id }, select: { id: true, email: true, name: true } })
    const clientIds = clients.map(c => c.id)
    const idsAll = [fa.id, ...clientIds]

    console.log(`• ${fa.email}  [role=${fa.role}, name="${fa.name}"]`)
    console.log(`  - ลูกค้าที่บัญชีนี้สร้าง: ${clients.length} ราย${clients.length ? ' → ' + clients.map(c => c.name || c.email).join(', ') : ''}`)

    if (!DO_DELETE) { console.log(`  (dry-run: จะลบบัญชี FA นี้ + ลูกค้า ${clients.length} ราย + audit/consent ที่เกี่ยวข้อง)\n`); continue }

    // 1) ลบ audit log + consent ที่อ้างถึงบัญชีเหล่านี้ (ไม่มี FK จึงไม่ cascade)
    const al = await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: idsAll } }, { clientId: { in: idsAll } }] } })
    const cs = await prisma.consent.deleteMany({ where: { OR: [{ clientId: { in: idsAll } }, { recordedById: { in: idsAll } }] } })
    // 2) ลบลูกค้าที่ FA สร้าง (cascade ข้อมูลการเงินของลูกค้าแต่ละราย)
    const dc = clientIds.length ? await prisma.user.deleteMany({ where: { id: { in: clientIds } } }) : { count: 0 }
    // 3) ลบบัญชี FA (cascade ข้อมูลของตัวเอง)
    await prisma.user.delete({ where: { id: fa.id } })

    console.log(`  ✓ ลบแล้ว: FA 1 บัญชี · ลูกค้า ${dc.count} ราย · audit ${al.count} · consent ${cs.count}\n`)
  }

  console.log(DO_DELETE ? '=== เสร็จสิ้น — อีเมลเหล่านี้พร้อมสมัครใหม่ ===\n' : '=== DRY-RUN จบ · ตรวจแล้วรันซ้ำด้วย CONFIRM=yes เพื่อลบจริง ===\n')
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
