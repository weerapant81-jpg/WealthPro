# เช็กลิสต์: เพิ่ม Sign in with Apple สำหรับ FA (WealthPro)

> โค้ดฝั่งแอปทำเสร็จแล้ว (`POST /auth/apple` verify id_token กับ Apple JWKS + ปุ่ม Apple จริงใน LoginPage)
> เหลือแค่ตั้งค่าใน Apple Developer + ใส่ env — **ไม่ต้องแก้โค้ดอีก**
>
> ⚠️ **ทดสอบบน localhost ไม่ได้** — Apple ต้องการโดเมน HTTPS จริงเป็น Return URL → ทำจริงได้เมื่อ deploy แล้ว
> ⚠️ ต้องมี **Apple Developer Program** ($99/ปี)

---

## เฟส 1 — Apple Developer (developer.apple.com → Certificates, IDs & Profiles)

- [ ] **App ID** (Identifiers → +) → เปิด capability **"Sign In with Apple"**
- [ ] **Services ID** (Identifiers → + → Services IDs) — ตัวนี้ = `client_id`
  - Identifier เช่น `com.wealthpro.web`
  - เปิด "Sign In with Apple" → Configure:
    - Primary App ID = App ID ข้างบน
    - **Domains and Subdomains** = โดเมน production (เช่น `wealthpro.com`)
    - **Return URLs** = `https://wealthpro.com/api/auth/apple/callback` (HTTPS เท่านั้น)
- [ ] **Key** (Keys → +) → เปิด "Sign In with Apple" → ดาวน์โหลด `.p8` (ครั้งเดียว!) → จด **Key ID** + **Team ID**

## เฟส 2 — ใส่ env แล้ว restart ทั้ง 2 server

```
# frontend/.env
VITE_APPLE_CLIENT_ID=com.wealthpro.web                                  # Services ID
VITE_APPLE_REDIRECT_URI=https://wealthpro.com/api/auth/apple/callback

# backend/.env  (verify id_token ใช้แค่ APPLE_CLIENT_ID; ที่เหลือเผื่ออนาคตถ้าทำ code-exchange)
APPLE_CLIENT_ID=com.wealthpro.web
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=YYYYYYYYYY
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

## จุดที่ต้องระวัง
- **ชื่อผู้ใช้มาครั้งแรกครั้งเดียว** — โค้ดเก็บ `name` ตอน create อยู่แล้ว ถ้าลบ user แล้ว sign in ใหม่ Apple จะไม่ส่งชื่อมาอีก (จะ fallback เป็น prefix อีเมล)
- **Private relay email** — ผู้ใช้อาจได้อีเมล `xxx@privaterelay.appleid.com` ถ้าเลือกซ่อน — ระบบรองรับ (ใช้เป็น unique email ปกติ)
- บัญชีใหม่ = ADMIN, isApproved=false → รอ SUPER_ADMIN อนุมัติ (เหมือน Google)
