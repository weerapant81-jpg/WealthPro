# เช็กลิสต์: เพิ่ม Google Sign-In สำหรับ FA (WealthPro)

> สแตกจริง: Backend = Express 5 + Prisma 5 + JWT (`generateTokens` ใน `auth.controller.ts`) ·
> Frontend = React 19 + Vite + axios (`frontend/src/lib/api.ts`) · โมเดล auth: FA = `ADMIN`,
> สมัครแล้ว `isApproved:false` รอ SUPER_ADMIN อนุมัติ, ลูกค้า = `USER` (ไม่ล็อกอิน)
>
> แนวทาง: **verify ID token** (frontend ขอ token จาก Google → backend ตรวจ → ออก JWT ของเราเอง)
> — เหมาะกับ SPA, ไม่ต้องทำ redirect flow

---

## เฟส 0 — เตรียมก่อนเริ่ม (นอกโค้ด)
- [ ] มี **โดเมน + HTTPS** สำหรับ production (localhost ใช้ dev ได้)
- [ ] มีหน้า **Privacy Policy + Terms** (ต้องใส่ URL ใน consent screen)
- [ ] มีบัญชี Google → เข้า https://console.cloud.google.com

## เฟส 1 — ตั้งค่า Google Cloud Console
- [ ] สร้าง **Project** ใหม่ (เช่น "WealthPro")
- [ ] **APIs & Services → OAuth consent screen**
  - User type: **External**
  - App name / support email / logo
  - **App domain + Privacy Policy URL + Terms URL**
  - Scopes: `email`, `profile`, `openid` (พอ)
  - Test users: ใส่อีเมลตัวเองระหว่างพัฒนา (ตอน publishing = Testing)
- [ ] **APIs & Services → Credentials → Create Credentials → OAuth client ID**
  - Application type: **Web application**
  - **Authorized JavaScript origins**: `http://localhost:5173` (+ โดเมน prod)
  - (redirect URI ไม่จำเป็นถ้าใช้ Google Identity Services แบบ ID token)
  - เก็บ **Client ID** (รูปแบบ `xxxx.apps.googleusercontent.com`) — Client Secret ไม่ต้องใช้ในแนวทาง ID token

## เฟส 2 — Backend: dependency + env
- [ ] `cd backend && npm i google-auth-library`
- [ ] `backend/.env` เพิ่ม: `GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com` (อย่า commit)

## เฟส 3 — Prisma schema (`backend/prisma/schema.prisma`)
- [ ] `User.password` → optional: `password String?`
- [ ] เพิ่มฟิลด์ provider:
  ```prisma
  provider    String?   // "local" | "google" | "apple"
  providerId  String?   // sub จาก Google
  avatarUrl   String?
  @@unique([provider, providerId])
  ```
- [ ] `kill node` (EPERM) → `npx prisma db push && npx prisma generate`

## เฟส 4 — Backend: endpoint `POST /auth/google`
ไฟล์ `backend/src/controllers/auth.controller.ts` (เพิ่มฟังก์ชัน):
- [ ] verify ID token + upsert user + ออก JWT (ใช้ `generateTokens` เดิม)
  ```ts
  import { OAuth2Client } from 'google-auth-library'
  const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

  export async function googleAuth(req, res) {
    const { credential } = req.body            // ID token จาก frontend
    if (!credential) { res.status(400).json({ error: 'no credential' }); return }
    let payload
    try {
      const ticket = await gClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID })
      payload = ticket.getPayload()            // { sub, email, email_verified, name, picture }
    } catch { res.status(401).json({ error: 'invalid Google token' }); return }
    if (!payload?.email || !payload.email_verified) { res.status(401).json({ error: 'email not verified' }); return }

    // หา user เดิมจาก providerId หรืออีเมล (account linking)
    let user = await prisma.user.findFirst({ where: { OR: [{ provider: 'google', providerId: payload.sub }, { email: payload.email }] } })
    if (!user) {
      // สมัครใหม่ = FA (ADMIN) รออนุมัติ เหมือน register ปกติ
      user = await prisma.user.create({ data: {
        email: payload.email, name: payload.name ?? payload.email, password: null,
        provider: 'google', providerId: payload.sub, avatarUrl: payload.picture,
        role: 'ADMIN', isEmailVerified: true, isApproved: false,
      } })
    } else if (!user.providerId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { provider: 'google', providerId: payload.sub, avatarUrl: payload.picture } })
    }

    // gate เดียวกับ login ปกติ
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าใช้งาน' }); return }
    if (!user.isApproved) { res.status(403).json({ pending: true, error: 'บัญชีรออนุมัติจากผู้ให้บริการ' }); return }

    const tokens = generateTokens(user.id)
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, ...tokens })
  }
  ```
- [ ] **หมายเหตุ:** ถ้า user ใหม่ (pending) — ตอบ 403 `{pending:true}` ให้ frontend โชว์ "รออนุมัติ"

## เฟส 5 — Backend: route
ไฟล์ `backend/src/routes/index.ts`:
- [ ] `r.post('/auth/google', googleAuth)` (ไม่ต้อง authenticate)

## เฟส 6 — Frontend: dependency + env
- [ ] `cd frontend && npm i @react-oauth/google`
- [ ] `frontend/.env` เพิ่ม: `VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com`
- [ ] ครอบ `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>` รอบ `<App/>` ใน `main.tsx`

## เฟส 7 — Frontend: ปุ่ม + lib
- [ ] `frontend/src/lib/auth.ts` เพิ่ม:
  ```ts
  export async function googleLogin(credential: string): Promise<{ user: User; access?: string; pending?: boolean }> {
    const { data } = await api.post('/auth/google', { credential })
    if (data.access) { localStorage.setItem('access_token', data.access); localStorage.setItem('refresh_token', data.refresh) }
    return data
  }
  ```
- [ ] `LoginPage.tsx` เพิ่มปุ่ม:
  ```tsx
  import { GoogleLogin } from '@react-oauth/google'
  <GoogleLogin
    onSuccess={async (cr) => {
      try { const r = await googleLogin(cr.credential!); if (r.access) { setUser(r.user); navigate('/') } }
      catch (e:any) { if (e.response?.data?.pending) setInfo('บัญชีรออนุมัติ...'); else setError(e.response?.data?.error) }
    }}
    onError={() => setError('เข้าสู่ระบบด้วย Google ไม่สำเร็จ')}
  />
  ```

## เฟส 8 — Edge cases / กันพลาด
- [ ] **Account linking**: อีเมลเดียวกับบัญชี email/password เดิม → ผูก providerId เข้าบัญชีเดิม (โค้ดข้างบนทำแล้ว)
- [ ] user ที่ login ด้วย Google อย่างเดียวจะ **ไม่มี password** → หน้า "เปลี่ยนรหัสผ่าน"/login ปกติต้องเช็ค `password != null`
- [ ] token ของ Google หมดอายุเร็ว — เราออก **JWT ของเราเอง** ใช้ต่อ (refresh flow เดิมใช้ได้)
- [ ] `pending` (รออนุมัติ) — social sign-up ก็ต้องผ่าน SUPER_ADMIN เหมือนกัน

## เฟส 9 — ทดสอบ
- [ ] กด "Sign in with Google" ครั้งแรก → บัญชีใหม่ pending → ขึ้น "รออนุมัติ"
- [ ] SUPER_ADMIN อนุมัติ → กด Google อีกครั้ง → เข้าได้
- [ ] อีเมล Google ตรงกับบัญชีเดิม → login แล้วผูกบัญชี (ไม่สร้างซ้ำ)
- [ ] `npm run typecheck` (frontend, `tsconfig.app.json`) + `npx tsc --noEmit` (backend) ผ่าน

## Production checklist
- [ ] เพิ่มโดเมน prod ใน Authorized JavaScript origins
- [ ] OAuth consent screen: **Publish** (ออกจาก Testing) — อาจต้อง verification ถ้า scope sensitive (เราใช้แค่ email/profile = ไม่ต้อง)
- [ ] `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` ตั้งใน env ของ prod
