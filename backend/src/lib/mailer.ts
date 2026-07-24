import sgMail from '@sendgrid/mail'

const API_KEY = process.env.SENDGRID_API_KEY
const FROM = process.env.SENDGRID_FROM_EMAIL || 'noreply@wealthpro.cloud'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'WealthPro'
// ผู้รับกด reply → ไปเข้ากล่องจริง (info@) ไม่ใช่ noreply
const REPLY_TO = process.env.SENDGRID_REPLY_TO || 'info@wealthpro.cloud'
const enabled = !!API_KEY && API_KEY.startsWith('SG.')

if (enabled) sgMail.setApiKey(API_KEY!)

// log สถานะตอนบูต — ช่วยตรวจบน Render ว่าอีเมลจะส่งจริงหรือแค่ log
console.log(enabled
  ? `[mailer] SendGrid เปิดใช้งาน · from=${FROM_NAME} <${FROM}> · reply-to=${REPLY_TO}`
  : '[mailer] SendGrid ปิด (ไม่มี SENDGRID_API_KEY ที่ขึ้นต้น SG.) — อีเมลจะถูก log ไม่ส่งจริง')

/**
 * ส่งอีเมล — ถ้าไม่ได้ตั้งค่า SendGrid (dev) จะ log ลิงก์ลง console แทน
 * เพื่อให้ flow ทดสอบได้โดยไม่ต้องส่งเมลจริง
 */
async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!enabled) {
    console.log(`\n[mailer:DEV] ส่งเมลถึง ${to}\n  หัวข้อ: ${subject}\n  ${text}\n`)
    return
  }
  try {
    await sgMail.send({ to, from: { email: FROM, name: FROM_NAME }, replyTo: REPLY_TO, subject, html, text })
  } catch (e: any) {
    console.error('[mailer] ส่งเมลไม่สำเร็จ:', e?.response?.body?.errors ?? e.message)
    throw e
  }
}

const wrap = (title: string, body: string, btnText: string, btnUrl: string) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0f172a;border-radius:16px;color:#e2e8f0">
    <div style="font-size:22px;font-weight:700;margin-bottom:8px"><span style="color:#f1f5f9">Wealth</span><span style="color:#22d3ee">Pro</span></div>
    <div style="font-size:12px;letter-spacing:2px;color:#64748b;margin-bottom:24px">ADVISOR PORTAL</div>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 12px">${title}</h2>
    <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">${body}</p>
    <a href="${btnUrl}" style="display:inline-block;background:#06b6d4;color:#04222a;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;font-size:14px">${btnText}</a>
    <p style="color:#475569;font-size:12px;margin:24px 0 0;line-height:1.5">หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้:<br><span style="color:#0891b2;word-break:break-all">${btnUrl}</span></p>
  </div>`

export async function sendVerifyEmail(to: string, name: string, url: string): Promise<void> {
  const html = wrap(
    'ยืนยันอีเมลของคุณ',
    `สวัสดีคุณ ${name}, ขอบคุณที่สมัครใช้งาน WealthPro กรุณายืนยันอีเมลของคุณเพื่อดำเนินการต่อ (ลิงก์มีอายุ 24 ชั่วโมง)`,
    'ยืนยันอีเมล', url,
  )
  await send(to, 'ยืนยันอีเมล — WealthPro', html, `ยืนยันอีเมลที่: ${url}`)
}

export async function sendResetPasswordEmail(to: string, name: string, url: string): Promise<void> {
  const html = wrap(
    'ตั้งรหัสผ่านใหม่',
    `สวัสดีคุณ ${name}, เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์มีอายุ 1 ชั่วโมง) หากคุณไม่ได้เป็นผู้ขอ กรุณาเพิกเฉยต่ออีเมลนี้`,
    'ตั้งรหัสผ่านใหม่', url,
  )
  await send(to, 'ตั้งรหัสผ่านใหม่ — WealthPro', html, `ตั้งรหัสผ่านใหม่ที่: ${url}`)
}

// เชิญลูกค้าเข้าใช้ client portal — ตั้งรหัสผ่านครั้งแรก
export async function sendClientInviteEmail(to: string, name: string, advisorName: string, url: string): Promise<void> {
  const html = wrap(
    'เชิญเข้าใช้งาน WealthPro',
    `สวัสดีคุณ ${name}, ${advisorName} เชิญคุณเข้าใช้งาน WealthPro เพื่อดูแผนการเงินของคุณได้ทุกที่ทุกเวลา กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านและเริ่มใช้งาน (ลิงก์มีอายุ 24 ชั่วโมง)`,
    'ตั้งรหัสผ่าน & เริ่มใช้งาน', url,
  )
  await send(to, 'เชิญเข้าใช้งาน WealthPro', html, `ตั้งรหัสผ่านที่: ${url}`)
}
