# การนำ WealthPro ขึ้น Production + ติดตั้งลง iPad (PWA)

สถาปัตยกรรม: **Frontend (Vercel)** + **Backend (Render)** + **PostgreSQL (Neon)** ภายใต้โดเมนเดียว

---

## 0. สิ่งที่โค้ดพร้อมแล้ว (ทำไว้ให้)
- ✅ CORS อ่านจาก `FRONTEND_URL` (`backend/src/index.ts`)
- ✅ PWA: `vite-plugin-pwa` + manifest + service worker (`frontend/vite.config.ts`) → build สร้าง `manifest.webmanifest` + `sw.js`
- ✅ meta สำหรับ iOS install (`frontend/index.html`)
- ✅ `frontend/vercel.json` (proxy `/api` + SPA fallback)

## ⚠️ ต้องเพิ่มเอง: ไฟล์ไอคอน (ผมสร้าง binary ให้ไม่ได้)
Export จากโลโก้ WealthPro แล้ววางใน `frontend/public/`:
| ไฟล์ | ขนาด | ใช้ทำ |
|---|---|---|
| `icon-192.png` | 192×192 | PWA (Android/desktop) |
| `icon-512.png` | 512×512 | PWA splash / maskable |
| `apple-touch-icon.png` | 180×180 | ไอคอนหน้าโฮม iPad/iPhone |
> พื้นหลังทึบ (ไม่โปร่งใส) สำหรับ apple-touch-icon เพราะ iOS ไม่รองรับ transparency

---

## 1. Database — Neon
1. สร้าง project ที่ neon.tech → คัดลอก connection string
2. ในเครื่อง: `cd backend && DATABASE_URL="<string>" npx prisma migrate deploy` (สร้าง schema บน DB จริง)

## 2. Backend — Render (New Web Service, root = `backend/`)
- **Build:** `npm install && npx prisma generate && npm run build`
- **Start:** `npm start`
> ⚠️ backend คอมไพล์โฟลเดอร์ `shared/` (โมดูลกลางสูตรการเงิน ที่อยู่นอก `backend/`) ไปด้วย
> ผลลัพธ์จึงเป็น `dist/backend/src/index.js` (ไม่ใช่ `dist/index.js`) — `npm start` ชี้ให้แล้ว
> ถ้า Render ตั้ง Start Command เป็น `node dist/index.js` ตรง ๆ ต้องแก้เป็น `npm start`
- **Env vars:**
  ```
  DATABASE_URL=<neon>
  JWT_SECRET=<สุ่มยาว>
  JWT_REFRESH_SECRET=<สุ่มยาว คนละตัว>
  FRONTEND_URL=https://wealthpro.cloud
  ANTHROPIC_API_KEY=<claude key>
  GOOGLE_CLIENT_ID=<...apps.googleusercontent.com>
  APPLE_CLIENT_ID=<Services ID เช่น com.wealthpro.web>
  SENDGRID_API_KEY=<ถ้าจะส่งอีเมลจริง>
  ```
- ได้ URL เช่น `https://wealthpro-api.onrender.com`

## 3. Frontend — Vercel (Import repo, root = `frontend/`)
> ⚠️ frontend import โมดูลกลาง `shared/` ผ่าน alias `@shared` ซึ่งอยู่นอก root directory
> ที่ Vercel → Settings → Build & Deployment ต้องเปิด **"Include files outside of the Root Directory"** (ค่าเริ่มต้นเปิดอยู่)
1. แก้ `frontend/vercel.json` → เปลี่ยน `REPLACE-WITH-BACKEND-URL` เป็น URL backend จริง
2. **Env vars:**
   ```
   VITE_GOOGLE_CLIENT_ID=<เดียวกับ backend>
   VITE_APPLE_CLIENT_ID=<Services ID เดียวกับ APPLE_CLIENT_ID>
   VITE_APPLE_REDIRECT_URI=https://wealthpro.cloud/login
   ```
3. ผูกโดเมน `wealthpro.cloud` (Vercel ออก HTTPS ให้อัตโนมัติ)

## 4. ตั้งค่า OAuth ปลายทาง
- **Google Cloud Console** → Authorized JavaScript origins เพิ่ม `https://wealthpro.cloud`
- **Apple Services ID** → Domains ใส่ `wealthpro.cloud`, Return URLs ใส่ `https://wealthpro.cloud/login`, ยืนยันโดเมน

## 5. บัญชีแรก
สร้าง SUPER_ADMIN (ผ่าน seed หรือแก้ `role` ใน DB) เพื่ออนุมัติ FA รายอื่น

---

## ติดตั้งลง iPad
เปิด `https://wealthpro.cloud` ใน **Safari** → ปุ่มแชร์ (􀈂) → **"เพิ่มลงในหน้าจอโฮม"** → เปิดแบบเต็มจอเหมือนแอป
(เข้าผ่านเบราว์เซอร์ปกติก็ยังใช้ได้ตามเดิม · Chrome/Edge บน desktop จะมีปุ่ม "ติดตั้ง" บน address bar)

## หมายเหตุ
- bundle ~1.6MB (gzip 416KB) — ถ้าอยากเร็วขึ้นภายหลังค่อยทำ code-splitting (dynamic import ราย route)
- service worker `autoUpdate` = ผู้ใช้ได้เวอร์ชันใหม่อัตโนมัติเมื่อ deploy (ไม่ต้องลบแอป)
