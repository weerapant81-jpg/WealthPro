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

## 2.5 Staging — ✅ ใช้งานได้แล้ว (ตั้งค่าเสร็จ 23 ก.ค. 2569)

| ส่วน | ค่าจริง |
|---|---|
| Git branch | `staging` |
| ฐานข้อมูล | Neon branch `staging` (แตกจาก production · direct connection) |
| Backend | `https://wealthpro-api-staging.onrender.com` (Render, branch `staging`, Free) |
| Frontend | `https://wealth-pro-git-staging-ultimatelife.vercel.app` (ล็อกด้วย Vercel SSO — เฉพาะสมาชิกทีม) |
| ตัวเชื่อม | `VITE_API_URL` ที่ Vercel **scope Preview เท่านั้น** |

**ตัวแปรที่เว้นว่างไว้บน staging โดยตั้งใจ:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (ไม่ทดสอบการจ่ายเงิน), `ANTHROPIC_API_KEY` (ไม่ให้เสียค่า AI)
**ตัวแปรที่ต้องต่างจาก production:** `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (แยก secret ไว้ไม่ให้ token ข้ามระบบกันได้)

### วิธีทำงานตั้งแต่นี้ไป
```bash
git switch staging      # แก้งานบน staging
# ... แก้ไข ... แล้ว push
git switch main; git merge staging; git push    # ผ่านแล้วค่อยขึ้น production
```

### วิธีดูว่ากำลังอยู่ระบบไหน
staging จะมี**ป้ายส้มกลางบนจอ** "ระบบทดสอบ · ข้อมูลในนี้ไม่ใช่ของลูกค้าจริง" (`frontend/src/components/EnvBadge.tsx`)
production ไม่ตั้ง `VITE_API_URL` ป้ายจึงไม่ขึ้น

> **Render Free จะหลับเมื่อไม่มีคนใช้** — เปิด staging ครั้งแรกหลังทิ้งไว้นานจะรอ 30–60 วินาที เป็นปกติ

### วิธีตรวจว่าแยกขาดจริง (ทำซ้ำได้ทุกครั้งที่สงสัย)
1. F12 → Network → คลิก request ใด ๆ → **Request URL** ต้องเป็น `wealthpro-api-staging.onrender.com`
2. สร้างลูกค้าทดสอบบน staging → เปิด `wealthpro.cloud` → ต้องไม่เห็น

---

<details>
<summary>ขั้นตอนที่ใช้ตอนตั้งค่าครั้งแรก (เก็บไว้อ้างอิง)</summary>


1. **สร้าง branch `staging`** — `git switch -c staging && git push -u origin staging`
   Vercel จะสร้าง preview deployment ให้อัตโนมัติที่ URL คงที่ เช่น
   `https://wealth-pro-git-staging-<team>.vercel.app`
2. **สร้างฐานข้อมูลแยก** — ที่ Neon กด **Branch** จาก production (ได้ข้อมูลชุดเดียวกันมาลองโดยไม่กระทบตัวจริง)
3. **สร้าง Render service ตัวที่สอง** — ตั้งค่าเหมือนตัวจริง แต่:
   - Branch = `staging`
   - `DATABASE_URL` = ของ Neon branch ที่เพิ่งสร้าง
   - `FRONTEND_URL` = URL preview ของ Vercel (ข้อ 1)
   - ใช้ Stripe **test mode** key ไม่ใช่ live
4. **ที่ Vercel → Settings → Environment Variables** เพิ่มเฉพาะ scope **Preview**:
   ```
   VITE_API_URL = https://<staging-api>.onrender.com
   ```
   > ⚠️ ข้อนี้สำคัญที่สุด — ถ้าไม่ตั้ง หน้า preview จะยิงเข้า **API ตัวจริง** เพราะ `vercel.json`
   > rewrite `/api` ไป production แบบตายตัว เท่ากับทดสอบบนข้อมูลลูกค้าจริง
   > (โค้ดฝั่งหน้าเว็บรองรับตัวแปรนี้แล้วที่ `frontend/src/lib/api.ts`)

**กับดักที่เจอจริงตอนตั้งค่า:**
- Vercel **ข้าม build เมื่อ commit SHA เคย deploy แล้ว** → branch ใหม่ที่ชี้ commit เดียวกับ main จะไม่เกิด preview ต้องมีการแก้ไฟล์ใน `frontend/` จริงก่อน (commit ว่างไม่พอ เพราะมีตัวเลือก "Skip deployments when there are no changes to the root directory" เปิดอยู่ด้วย)
- Render: **Language ต้องเป็น Node ไม่ใช่ Docker** (repo ไม่มี Dockerfile) และแก้ทีหลังไม่ได้ ต้องสร้าง service ใหม่
- `FRONTEND_URL` ต้องตรงกับโดเมน preview เป๊ะ ไม่งั้น CORS บล็อกและล็อกอินไม่ได้

</details>

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
