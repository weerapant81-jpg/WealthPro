// ── รูปร่าง request body ของ endpoint ที่เสี่ยงที่สุด ──
// เริ่มจากกลุ่มที่ "ยิงได้โดยไม่ต้องล็อกอิน" (auth ทั้งชุด + game lead) เพราะเป็นพื้นที่โจมตีจริง
// แล้วต่อด้วยกลุ่มที่กระทบเงินและสิทธิ์ (billing, plan)
// ทุกตัวใช้ .strict() ไม่ได้ — client บางหน้าส่งฟิลด์เกินมา — จึงปล่อยฟิลด์เกินผ่าน แต่คุมฟิลด์ที่ใช้จริงให้ครบ
import { z, zEmail, zPassword, zName, zPhone, zToken, zTwoFactorCode } from './validate'

// ── auth (สาธารณะ) ──
export const registerSchema = z.object({
  email: zEmail,
  password: zPassword,
  name: zName,
  phone: zPhone,
  birthDate: z.string().trim().max(40).optional().nullable(),
})

export const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(200),
  token: zTwoFactorCode.optional(),   // รหัส 2FA (ส่งมาเฉพาะรอบที่สอง)
})

export const emailOnlySchema = z.object({ email: zEmail })

export const resetPasswordSchema = z.object({
  token: zToken,
  password: zPassword,
})

export const googleAuthSchema = z.object({ credential: zToken })
export const appleAuthSchema = z.object({
  id_token: zToken,
  name: z.string().trim().max(200).optional().nullable(),
})
export const refreshSchema = z.object({ refreshToken: zToken })

// ── 2FA (ต้องล็อกอินแล้ว แต่กระทบความปลอดภัยบัญชีโดยตรง) ──
export const twoFactorEnableSchema = z.object({ token: zTwoFactorCode })
export const twoFactorDisableSchema = z.object({
  token: zTwoFactorCode.optional(),
  password: z.string().max(200).optional(),
})

// ── game lead (สาธารณะ — ใครก็ยิงได้) ──
export const gameLeadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  contact: z.string().trim().min(1).max(100),
  score: z.number().finite().optional().nullable(),
  grade: z.string().trim().max(2).optional().nullable(),
  career: z.string().trim().max(50).optional().nullable(),
  // ผลการเล่นแบบละเอียด (controller จำกัดขนาด JSON ที่ 2000 ตัวอักษรอีกชั้น)
  // ต้องประกาศไว้ ไม่งั้น zod จะตัดทิ้งแล้วผลเกมหายเงียบ ๆ
  result: z.record(z.string(), z.unknown()).optional().nullable(),
})

// ── billing / plan (กระทบเงินและสิทธิ์) ──
export const checkoutSchema = z.object({ plan: z.enum(['pro', 'ai']) })
export const setPlanSchema = z.object({
  plan: z.enum(['free', 'pro', 'ai']),
  planExpiresAt: z.string().trim().max(40).optional().nullable(),
})
