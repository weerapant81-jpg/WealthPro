import { prisma } from './prisma'

// เก็บ audit log ย้อนหลังกี่วัน (default 730 = 2 ปี) — ปรับได้ผ่าน env AUDIT_RETENTION_DAYS
const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS) || 730

/** ลบ audit log ที่เก่ากว่าระยะเวลาที่กำหนด (ใช้ index createdAt) */
export async function purgeOldAuditLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000)
  try {
    const r = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    if (r.count > 0) console.log(`[audit-retention] ลบ audit log เก่ากว่า ${RETENTION_DAYS} วัน: ${r.count} รายการ`)
    return r.count
  } catch (e) {
    console.error('[audit-retention] error:', e)
    return 0
  }
}

/** เริ่ม scheduler — รันตอน boot 1 ครั้ง แล้วทุก 24 ชั่วโมง */
export function startAuditRetention(): void {
  purgeOldAuditLogs()
  const iv = setInterval(purgeOldAuditLogs, 24 * 3600 * 1000)
  iv.unref?.()   // ไม่กันไม่ให้ process ปิด
}
