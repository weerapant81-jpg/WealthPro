import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '../lib/prisma'
import { sendVerifyEmail, sendResetPasswordEmail } from '../lib/mailer'
import { verifyTwoFactor } from '../lib/twofa'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'))
const genToken = () => crypto.randomBytes(32).toString('hex')

function generateTokens(userId: string) {
  const access = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '15m' })
  const refresh = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })
  return { access, refresh }
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, phone, birthDate } = req.body
  if (!email || !password || !name || !String(phone ?? '').trim()) {
    res.status(400).json({ error: 'email, password, name, phone are required' })
    return
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already in use' })
    return
  }
  const hashed = await bcrypt.hash(password, 12)
  const verifyToken = genToken()
  const user = await prisma.user.create({
    data: {
      email, password: hashed, name,
      phone: phone || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      role: 'ADMIN',      // ผู้สมัคร = นักวางแผน (FA); ลูกค้า (USER) สร้างโดย FA เท่านั้น
      isEmailVerified: false,  // ต้องยืนยันอีเมลก่อน
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 ชม.
      isApproved: false,  // จากนั้นรอผู้ให้บริการ (SUPER_ADMIN) อนุมัติ
    },
    select: { id: true, email: true, name: true, role: true }
  })
  const verifyUrl = `${FRONTEND_URL}/api/auth/verify-email?token=${verifyToken}`
  try {
    await sendVerifyEmail(email, name, verifyUrl)
  } catch (e: any) {
    // ยังให้สมัครสำเร็จ — ผู้ใช้ขอส่งใหม่ได้ภายหลัง · แต่ log สาเหตุไว้ตรวจบน Render
    console.error('[register] ส่งอีเมลยืนยันไม่สำเร็จ:', e?.response?.body?.errors ?? e?.message ?? e)
  }
  // ยังไม่ออก token — ต้องยืนยันอีเมล + รออนุมัติก่อน
  res.status(201).json({ pending: true, needVerify: true, user })
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const token = req.query.token as string | undefined
  const redirect = (status: string) => res.redirect(`${FRONTEND_URL}/login?verify=${status}`)
  if (!token) { redirect('invalid'); return }
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } })
  if (!user || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
    redirect('expired'); return
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
  })
  redirect('success')
}

// ส่งอีเมลยืนยันใหม่ (กรณีลิงก์หมดอายุ/ไม่ได้รับ)
export async function resendVerify(req: Request, res: Response): Promise<void> {
  const { email } = req.body
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  // ไม่เปิดเผยว่ามีบัญชีนี้หรือไม่
  if (user && !user.isEmailVerified) {
    const verifyToken = genToken()
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: verifyToken, emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })
    try {
      await sendVerifyEmail(user.email, user.name, `${FRONTEND_URL}/api/auth/verify-email?token=${verifyToken}`)
    } catch (e: any) {
      console.error('[resendVerify] ส่งอีเมลยืนยันไม่สำเร็จ:', e?.response?.body?.errors ?? e?.message ?? e)
    }
  }
  res.json({ message: 'หากอีเมลนี้มีอยู่ในระบบและยังไม่ยืนยัน เราได้ส่งลิงก์ยืนยันไปให้แล้ว' })
}

// ── ลืมรหัสผ่าน ──
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  // ตอบเหมือนกันเสมอเพื่อไม่เปิดเผยว่ามีบัญชีนี้หรือไม่ (เฉพาะ FA/ผู้ให้บริการเท่านั้นที่ตั้งรหัสได้)
  if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
    const resetToken = genToken()
    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetToken, resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000) }, // 1 ชม.
    })
    try {
      await sendResetPasswordEmail(user.email, user.name, `${FRONTEND_URL}/reset-password?token=${resetToken}`)
    } catch { /* ignore */ }
  }
  res.json({ message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว' })
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body
  if (!token || !password) {
    res.status(400).json({ error: 'token และรหัสผ่านใหม่จำเป็นต้องระบุ' })
    return
  }
  if (String(password).length < 6) {
    res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
    return
  }
  const user = await prisma.user.findFirst({ where: { resetPasswordToken: token } })
  if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
    res.status(400).json({ error: 'ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่' })
    return
  }
  const hashed = await bcrypt.hash(password, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetPasswordToken: null, resetPasswordExpires: null },
  })
  res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }
  // เฉพาะนักวางแผน (ADMIN) และผู้ให้บริการ (SUPER_ADMIN) เท่านั้น — ลูกค้า (USER) เป็นข้อมูลที่ FA ดูแล ไม่มีสิทธิ์ login
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน (สำหรับนักวางแผนการเงินเท่านั้น)' })
    return
  }
  // ต้องยืนยันอีเมลก่อน
  if (!user.isEmailVerified) {
    res.status(403).json({ error: 'กรุณายืนยันอีเมลของคุณก่อนเข้าใช้งาน (ตรวจสอบกล่องอีเมล)', needVerify: true })
    return
  }
  // บัญชีถูกนำออกจากรายการ (ลาออก/ไม่ชำระเงิน) — ข้อมูลยังอยู่ แต่เข้าใช้งานไม่ได้
  if (user.archivedAt) {
    res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ให้บริการ' })
    return
  }
  // ต้องได้รับอนุมัติจากผู้ให้บริการก่อน
  if (!user.isApproved) {
    res.status(403).json({ error: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ให้บริการ' })
    return
  }
  // ── 2FA — ถ้าเปิดใช้ ต้องใส่รหัส 6 หลัก (หรือรหัสสำรอง) ──
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const code = String(req.body.token ?? '').replace(/\s/g, '')
    if (!code) { res.json({ twoFactorRequired: true }); return }
    const ok = await verifyTwoFactor(user, code)
    if (!ok) { res.status(401).json({ error: 'รหัสยืนยันตัวตน (2FA) ไม่ถูกต้อง', twoFactorRequired: true }); return }
  }
  const tokens = generateTokens(user.id)
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens })
}

// ── เข้าสู่ระบบด้วย Google (Google Identity Services) ──
// รับ ID token (credential) จาก frontend → ยืนยันกับ Google → find/link/create บัญชี FA
export async function googleAuth(req: Request, res: Response): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า Google Sign-In (GOOGLE_CLIENT_ID)' })
    return
  }
  const { credential } = req.body
  if (!credential) {
    res.status(400).json({ error: 'ไม่พบข้อมูลยืนยันจาก Google' })
    return
  }
  let payload: import('google-auth-library').TokenPayload | undefined
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch {
    res.status(401).json({ error: 'ไม่สามารถยืนยันบัญชี Google ได้ กรุณาลองใหม่' })
    return
  }
  if (!payload?.email || !payload.sub || payload.email_verified === false) {
    res.status(401).json({ error: 'บัญชี Google ไม่สมบูรณ์หรืออีเมลยังไม่ได้ยืนยัน' })
    return
  }
  const email = payload.email.toLowerCase()
  const googleId = payload.sub
  const name = payload.name || email.split('@')[0]

  let user = await prisma.user.findFirst({ where: { OR: [{ googleId }, { email }] } })
  if (user) {
    // ผูก googleId ให้บัญชีอีเมลเดิม (สมัครด้วยอีเมลไว้ก่อน) ถ้ายังไม่ผูก
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId, isEmailVerified: true },
      })
    }
    // ลูกค้า (USER) เป็นข้อมูลที่ FA ดูแล ไม่มีสิทธิ์ login
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน (สำหรับนักวางแผนการเงินเท่านั้น)' })
      return
    }
  } else {
    // สมัครใหม่ผ่าน Google = นักวางแผน (ADMIN) · อีเมลถือว่ายืนยันแล้ว · แต่ยังต้องรออนุมัติ
    user = await prisma.user.create({
      data: { email, googleId, name, role: 'ADMIN', isEmailVerified: true, isApproved: false },
    })
  }
  // บัญชีถูกนำออกจากรายการ (ลาออก/ไม่ชำระเงิน)
  if (user.archivedAt) {
    res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ให้บริการ' })
    return
  }
  // ต้องได้รับอนุมัติจากผู้ให้บริการก่อน (เหมือนสมัครด้วยอีเมล)
  if (!user.isApproved) {
    res.status(403).json({ error: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ให้บริการ', pending: true })
    return
  }
  const tokens = generateTokens(user.id)
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens })
}

// ── เข้าสู่ระบบด้วย Apple (Sign in with Apple / JS SDK) ──
// รับ id_token (+ name เฉพาะครั้งแรก) → verify กับ Apple JWKS → find/link/create บัญชี FA
// หมายเหตุ: Apple ไม่รับ localhost เป็น return URL — ทดสอบจริงได้เมื่อมีโดเมน HTTPS แล้ว
export async function appleAuth(req: Request, res: Response): Promise<void> {
  if (!APPLE_CLIENT_ID) {
    res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่า Apple Sign-In (APPLE_CLIENT_ID)' })
    return
  }
  const { id_token, name } = req.body
  if (!id_token) {
    res.status(400).json({ error: 'ไม่พบข้อมูลยืนยันจาก Apple' })
    return
  }
  let payload: import('jose').JWTPayload
  try {
    const verified = await jwtVerify(id_token, appleJwks, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_CLIENT_ID,
    })
    payload = verified.payload
  } catch {
    res.status(401).json({ error: 'ไม่สามารถยืนยันบัญชี Apple ได้ กรุณาลองใหม่' })
    return
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined
  const appleId = payload.sub
  // email_verified อาจมาเป็น boolean true หรือสตริง "true" — ปฏิเสธเฉพาะที่ยืนยันว่าไม่ผ่าน
  const emailUnverified = payload.email_verified === false || payload.email_verified === 'false'
  if (!email || !appleId || emailUnverified) {
    res.status(401).json({ error: 'บัญชี Apple ไม่สมบูรณ์หรืออีเมลยังไม่ได้ยืนยัน' })
    return
  }
  const displayName = (name && String(name).trim()) || email.split('@')[0]

  let user = await prisma.user.findFirst({ where: { OR: [{ appleId }, { email }] } })
  if (user) {
    if (!user.appleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { appleId, isEmailVerified: true } })
    }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งาน (สำหรับนักวางแผนการเงินเท่านั้น)' })
      return
    }
  } else {
    user = await prisma.user.create({
      data: { email, appleId, name: displayName, role: 'ADMIN', isEmailVerified: true, isApproved: false },
    })
  }
  if (user.archivedAt) {
    res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ให้บริการ' })
    return
  }
  if (!user.isApproved) {
    res.status(403).json({ error: 'บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากผู้ให้บริการ', pending: true })
    return
  }
  const tokens = generateTokens(user.id)
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens })
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' })
    return
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string }
    const tokens = generateTokens(payload.userId)
    res.json(tokens)
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
}

export async function me(req: Request & { userId?: string }, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, role: true, profile: true }
  })
  res.json(user)
}

// ── Advisor (own) profile — always the logged-in user, not a selected client ──
export async function getAdvisorProfile(req: Request & { userId?: string }, res: Response): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { advisorProfile: true } })
  res.json(u?.advisorProfile ?? null)
}
export async function saveAdvisorProfile(req: Request & { userId?: string }, res: Response): Promise<void> {
  try {
    const u = await prisma.user.update({ where: { id: req.userId }, data: { advisorProfile: req.body } })
    res.json(u.advisorProfile)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
