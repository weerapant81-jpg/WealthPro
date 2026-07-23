// ── ตรวจรูปร่าง request body ก่อนเข้า controller ──
// เดิม controller อ่าน req.body ตรง ๆ แล้วแปลงชนิดเอง — ถ้า client ส่งอะไรแปลก ๆ มา
// พฤติกรรมจะขึ้นอยู่กับว่า controller นั้นระวังแค่ไหน ซึ่งไม่เท่ากันทุกตัว
// ชั้นนี้ทำให้ "ข้อมูลเข้าไม่ถูกรูป" ถูกปฏิเสธที่ประตูเดียวกันหมด ด้วยข้อความเดียวกัน
import type { Request, Response, NextFunction } from 'express'
import { z, type ZodType } from 'zod'

/** ปฏิเสธ payload ที่ผิดรูปด้วย 400 พร้อมบอกว่าฟิลด์ไหนผิด (ไม่หลุด stack trace ออกไป) */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 5).map(i => ({
        field: i.path.join('.') || '(body)',
        message: i.message,
      }))
      return res.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง', issues })
    }
    req.body = parsed.data   // ใช้ค่าที่ผ่าน trim/แปลงชนิดแล้ว
    next()
  }
}

// ── ชิ้นส่วนที่ใช้ซ้ำ ──
/** อีเมล: ตัดช่องว่าง + พิมพ์เล็ก · จำกัดความยาวกัน payload บวม */
export const zEmail = z.string().trim().toLowerCase().min(3).max(254).email('อีเมลไม่ถูกต้อง')

/** รหัสผ่าน: อย่างน้อย 8 ตัว · เพดาน 200 กัน DoS จาก bcrypt (bcrypt ช้าตามความยาว) */
export const zPassword = z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร').max(200)

/** ข้อความสั้นทั่วไป — trim แล้วต้องไม่ว่าง */
export const zName = z.string().trim().min(1, 'กรุณากรอกข้อมูล').max(200)

/** เบอร์โทรไทย: ตัวเลข เว้นวรรค ขีด วงเล็บ + นำหน้าได้ */
export const zPhone = z.string().trim().min(6).max(30).regex(/^[0-9+\-() ]+$/, 'เบอร์โทรไม่ถูกต้อง')

/** โทเคนที่ส่งมาในลิงก์/หัวข้อ — ยาวจำกัด กันยิงสตริงมหึมา */
export const zToken = z.string().trim().min(10).max(2000)

/** รหัส 2FA 6 หลัก (ยอมให้มีช่องว่างคั่นแล้วตัดออก) หรือ backup code */
export const zTwoFactorCode = z.string().trim().max(40).transform(s => s.replace(/\s/g, ''))

export { z }
