import { api } from './api'

export interface User { id: string; email: string; name: string; role: string; plan?: string; planExpiresAt?: string | null; promoActive?: boolean; promoFreeUntil?: string | null }

export async function loginUser(email: string, password: string, token?: string): Promise<User | { twoFactorRequired: true }> {
  const { data } = await api.post('/auth/login', { email, password, token })
  if (data.twoFactorRequired) return { twoFactorRequired: true }
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  return data.user
}

export async function registerUser(
  name: string, email: string, password: string, phone?: string, birthDate?: string
): Promise<{ user: User; access?: string; refresh?: string; pending?: boolean }> {
  const { data } = await api.post('/auth/register', { name, email, password, phone, birthDate })
  // สมัครแล้วต้องรออนุมัติ — backend ไม่ส่ง token กลับมา
  if (data.access) {
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
  }
  return data
}

// เข้าสู่ระบบด้วย Google — ส่ง ID token (credential) จาก Google Identity Services ไปให้ backend ยืนยัน
export async function googleLogin(credential: string): Promise<User> {
  const { data } = await api.post('/auth/google', { credential })
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  return data.user
}

// เข้าสู่ระบบด้วย Apple — ส่ง id_token จาก Sign in with Apple (+ name เฉพาะครั้งแรก) ให้ backend ยืนยัน
export async function appleLogin(idToken: string, name?: string): Promise<User> {
  const { data } = await api.post('/auth/apple', { id_token: idToken, name })
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  return data.user
}

export async function forgotPassword(email: string): Promise<string> {
  const { data } = await api.post('/auth/forgot-password', { email })
  return data.message
}

export async function resetPassword(token: string, password: string): Promise<string> {
  const { data } = await api.post('/auth/reset-password', { token, password })
  return data.message
}

export async function resendVerify(email: string): Promise<string> {
  const { data } = await api.post('/auth/resend-verify', { email })
  return data.message
}

export function logout() {
  localStorage.clear()
  window.location.href = '/login'
}

export function isLoggedIn() {
  return !!localStorage.getItem('access_token')
}
