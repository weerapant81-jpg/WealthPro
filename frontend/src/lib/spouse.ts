// มีคู่สมรสหรือไม่ — ใช้ตัดสินการแสดงปุ่มสลับ "คู่สมรส" ทุกหน้า
// เกณฑ์: สถานภาพ "สมรส/แต่งงาน" หรือมีข้อมูลคู่สมรส (ชื่อ) อยู่แล้ว
export function hasSpouseInfo(cp: any): boolean {
  if (!cp) return false
  return /สมรส|แต่งงาน/.test(String(cp.maritalStatus || '')) || !!(cp.spouseProfile?.firstName || cp.spouseName)
}
