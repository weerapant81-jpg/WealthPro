import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '')

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@finplan.app'

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`

  if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'SG.YOUR_API_KEY_HERE') {
    console.log(`[DEV] Verification email for ${to}: ${verifyUrl}`)
    return
  }

  await sgMail.send({
    to,
    from: FROM_EMAIL,
    subject: 'ยืนยันอีเมลของคุณ - WealthPro',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #0ea5e9;">ยืนยันอีเมลของคุณ</h2>
        <p>สวัสดี ${name},</p>
        <p>กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมล ลิงก์จะหมดอายุใน 24 ชั่วโมง</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;border-radius:8px;text-decoration:none;margin:16px 0;">
          ยืนยันอีเมล
        </a>
        <p style="color:#888;font-size:12px;">หากคุณไม่ได้สมัครสมาชิก โปรดเพิกเฉยต่ออีเมลนี้</p>
      </div>
    `,
  })
}
