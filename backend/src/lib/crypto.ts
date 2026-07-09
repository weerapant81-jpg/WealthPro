import crypto from 'crypto'

// Field-level encryption สำหรับข้อมูลอ่อนไหว (เลขบัตรประชาชน) — AES-256-GCM
// รูปแบบที่เก็บ: enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
const PREFIX = 'enc:v1:'
let warned = false

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) return null
  // รองรับ hex 64 ตัว (32 ไบต์) หรือ base64
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  const b = Buffer.from(raw, 'base64')
  return b.length === 32 ? b : crypto.createHash('sha256').update(raw).digest()  // fallback: hash ให้ได้ 32 ไบต์
}

export function isEncrypted(v: unknown): boolean {
  return typeof v === 'string' && v.startsWith(PREFIX)
}

// เข้ารหัส — ถ้าไม่มีคีย์ (ยังไม่ตั้ง env) คืนค่าเดิม (ไม่ทำให้แอปพัง) · ถ้าเข้ารหัสอยู่แล้วคืนเดิม (idempotent)
export function encryptField(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return (plain as any) ?? null
  if (isEncrypted(plain)) return plain
  const key = getKey()
  if (!key) {
    if (!warned) { console.warn('[crypto] ENCRYPTION_KEY ไม่ได้ตั้ง — เก็บ nationalId แบบไม่เข้ารหัสชั่วคราว'); warned = true }
    return plain
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

// ถอดรหัส — ถ้าเป็น plaintext (ยังไม่ migrate) คืนค่าเดิม · ถอดไม่ได้คืนเดิม (กันพัง)
export function decryptField(val: string | null | undefined): string | null {
  if (val == null || val === '') return (val as any) ?? null
  if (!isEncrypted(val)) return val
  const key = getKey()
  if (!key) return val
  try {
    const [, , ivB, tagB, ctB] = val.split(':')
    const iv = Buffer.from(ivB, 'base64'), tag = Buffer.from(tagB, 'base64'), ct = Buffer.from(ctB, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch { return val }
}
