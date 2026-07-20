# WealthPro — คู่มือสมัคร & ตั้งค่า Stripe (Subscription รายเดือน)

โจทย์: รับเงินในนาม **นิติบุคคล** · **ตัดบัตรเครดิต/เดบิตอัตโนมัติทุกเดือน** · แพ็กเกจ Pro ฿590 / AI ฿890 (+ Enterprise เจรจารายกรณี)

> หมายเหตุ: PromptPay ตัดเงินอัตโนมัติรายเดือนไม่ได้ — subscription จึงใช้ **บัตรเครดิต/เดบิต** เท่านั้น

---

## ขั้นที่ 0 — เอกสารที่ต้องเตรียม (นิติบุคคล)
- [ ] **หนังสือรับรองบริษัท** อายุไม่เกิน 6 เดือน + เลขทะเบียนนิติบุคคล 13 หลัก
- [ ] **บัตรประชาชนกรรมการ** ผู้มีอำนาจลงนาม (ถ่ายรูปชัด)
- [ ] **บัญชีธนาคารบริษัท** (ชื่อบัญชี = ชื่อบริษัท) — เลขบัญชี + ธนาคาร สำหรับรับเงินโอนเข้า
- [ ] อีเมลบริษัท (info@wealthpro.cloud) + เบอร์ติดต่อ
- [ ] เว็บไซต์พร้อมรีวิว: landing (มี), `/terms` (มี), `/privacy` (มี), **`/refund` (เพิ่งเพิ่มให้)**

---

## ขั้นที่ 1 — สมัครบัญชี Stripe
1. ไปที่ https://dashboard.stripe.com/register → สมัครด้วยอีเมลบริษัท
2. ยืนยันอีเมล → เข้า Dashboard
3. เลือกประเทศ **Thailand** (สำคัญ: ตั้งครั้งเดียว เปลี่ยนทีหลังไม่ได้)
4. Activate account → กรอกข้อมูลธุรกิจ:
   - Business type: **Company / นิติบุคคล**
   - แนบเลขทะเบียน 13 หลัก + ข้อมูลกรรมการ
   - Business website: `https://wealthpro.cloud`
   - อธิบายสินค้า: "SaaS financial-planning software subscription for financial advisors"
   - ผูกบัญชีธนาคารบริษัทสำหรับ payout
5. รอ Stripe รีวิว (ปกติ 1–3 วันทำการ) — ระหว่างนี้ทำขั้นที่ 2 ด้วย **Test mode** ได้เลย

---

## ขั้นที่ 2 — สร้างสินค้า (Products) และราคา (Prices)
Dashboard → **Product catalog** → Add product (ทำ 2 ตัว)

**สินค้า 1: WealthPro Pro**
- Recurring · Monthly · **฿590 THB**
- คัดลอก Price ID (`price_xxxxxxxx`) → นี่คือ `STRIPE_PRICE_PRO`

**สินค้า 2: WealthPro AI**
- Recurring · Monthly · **฿890 THB**
- คัดลอก Price ID → `STRIPE_PRICE_AI`

> ทำใน **Test mode** ก่อน (มี toggle มุมขวาบน) จะได้ `price_...` แบบ test — พอ live ค่อยสร้างซ้ำใน Live mode แล้วเปลี่ยน env

---

## ขั้นที่ 3 — เก็บ API Keys
Dashboard → **Developers → API keys**
- **Secret key** (`sk_test_...` / `sk_live_...`) → `STRIPE_SECRET_KEY` (⚠️ ลับสุด — ใส่เฉพาะฝั่ง backend/Render เท่านั้น ห้าม commit)
- Publishable key — เราไม่ต้องใช้ (ใช้ Stripe Checkout แบบ redirect ไม่ต้องมี key ฝั่งหน้าเว็บ)

---

## ขั้นที่ 4 — ตั้ง Webhook (ให้ระบบอัปเดตแพ็กเกจอัตโนมัติ)
Dashboard → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://wealthpro-api.onrender.com/api/billing/webhook`
- Events ที่ต้องเลือก:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed` (แนะนำ — แจ้งเตือนตัดบัตรไม่ผ่าน)
- Save → คัดลอก **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`

---

## ขั้นที่ 5 — เปิด Customer Portal (ให้ลูกค้าจัดการเอง)
Dashboard → **Settings → Billing → Customer portal** → เปิดใช้งาน
- อนุญาต: ยกเลิก subscription, เปลี่ยนวิธีชำระเงิน, ดู/ดาวน์โหลดใบเสร็จ
- (ไม่ต้องเขียนโค้ดหน้าจัดการเอง — Stripe มีให้)

---

## ขั้นที่ 6 — ใส่ Environment Variables ที่ Render (backend)
Render → service `wealthpro-api` → Environment → เพิ่ม:

```
STRIPE_SECRET_KEY=sk_live_xxxxxxxx        # (test ก่อน: sk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
STRIPE_PRICE_PRO=price_xxxxxxxx           # ราคา Pro ฿590
STRIPE_PRICE_AI=price_xxxxxxxx            # ราคา AI ฿890
FRONTEND_URL=https://wealthpro.cloud
```

---

## ขั้นที่ 7 — ทดสอบ (Test mode) ก่อนเปิดจริง
- บัตรทดสอบ Stripe: **4242 4242 4242 4242**, วันหมดอายุอนาคตใดก็ได้, CVC อะไรก็ได้
- ทดสอบ flow: สมัคร Pro → จ่าย → กลับมาเว็บ → แพ็กเกจปลดล็อกอัตโนมัติ (ผ่าน webhook)
- ทดสอบยกเลิกใน Customer Portal → พอครบรอบแพ็กเกจตกกลับ Free
- Local: `stripe listen --forward-to localhost:5000/api/billing/webhook` (ต้องลง Stripe CLI)

---

## ขั้นที่ 8 — เปิด Live
1. Stripe อนุมัติบัญชีแล้ว → สร้าง Product/Price ซ้ำใน **Live mode**
2. เปลี่ยน env ทั้งหมดที่ Render เป็นค่า `_live_` / live price / live webhook secret
3. เพิ่ม webhook endpoint สำหรับ Live mode ด้วย (แยกจาก test)
4. ทดสอบด้วยบัตรจริงยอดน้อย 1 ครั้ง

---

## ⚠️ ความปลอดภัย
- `STRIPE_SECRET_KEY` และ `STRIPE_WEBHOOK_SECRET` = ความลับ → ใส่เฉพาะ Render env เท่านั้น **ห้าม** commit ลง git / ห้ามอยู่ฝั่ง frontend
- Webhook ต้อง verify signature ทุกครั้ง (โค้ดฝั่งเราจะทำให้) — กัน request ปลอม

---

## สิ่งที่ฝั่งโค้ดทำให้แล้ว/จะทำ
- ✅ **เฟส 1 (Entitlement):** ระบบล็อก/ปลดล็อกเมนูตามแพ็กเกจ + SUPER_ADMIN ตั้งแพ็กเกจให้ FA มือได้ — ใช้ขายได้แม้ยังไม่เชื่อมบัตร
- ⏳ **เฟส 2 (Stripe):** หน้า `/pricing` ปุ่มสมัคร → Stripe Checkout → webhook อัปเดตแพ็กเกจ + ปุ่ม "จัดการการชำระเงิน" → Customer Portal (ทำหลัง Stripe อนุมัติ + ได้ env ครบ)

> เมื่อได้ค่า env ทั้ง 5 ตัวจาก Stripe แล้ว แจ้งผมได้เลย เดี๋ยวลงมือเฟส 2 ต่อทันที
