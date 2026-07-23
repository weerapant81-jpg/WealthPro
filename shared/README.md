# `shared/` — โมดูลกลางที่ frontend และ backend ใช้ร่วมกัน

กติกาการเงินใดที่ **ทั้งสองฝั่งต้องเห็นตรงกัน** ให้อยู่ที่นี่ที่เดียว
ห้ามคัดลอกไปเขียนซ้ำในฝั่ง frontend หรือ backend — ที่ผ่านมาการเขียนซ้ำทำให้ตัวเลขไม่ตรงกันจริง
(เช่น กติกา "รายปี/รายเดือน" ของแหล่งรายได้ เคยมี 3 ก๊อปปี้ และเพี้ยนไปคนละแบบ)

## มีอะไรบ้าง — `shared/finance/`
| ไฟล์ | เนื้อหา |
|---|---|
| `income.ts` | หมวดเงินได้ 40(1)–(8), ความถี่รายเดือน/รายปี, `toNum`, รวมรายได้ต่อเดือน |
| `frequency.ts` | แปลงหน่วยรายการในตาราง Income/Expense (`MONTHLY` ↔ ต่อปี) |
| `ratios.ts` | เกณฑ์อัตราส่วนทางการเงิน 8 ตัว + สถานะ good/warning/danger + คะแนนสุขภาพการเงิน |
| `debt.ts` | หมวดหนี้: จดจำนอง / ไม่จดจำนอง / ระยะสั้น |

## ใช้ยังไง
- **frontend** — `import { ... } from '@shared/finance'` (alias ตั้งไว้ที่ `frontend/vite.config.ts` + `tsconfig.app.json`)
- **backend** — `import { ... } from '../../../shared/finance'` (tsconfig ของ backend คอมไพล์โฟลเดอร์นี้ไปด้วย → `dist/shared/...`)

## ข้อจำกัด
โค้ดในนี้ต้องเป็น TypeScript ล้วน **ไม่พึ่ง dependency ใด ๆ** และห้ามใช้ API เฉพาะเบราว์เซอร์หรือเฉพาะ Node
เพราะถูกคอมไพล์ด้วยทั้ง Vite (ESM, เบราว์เซอร์) และ tsc (CommonJS, Node)

## ⚠️ ห้าม build ของ frontend พึ่ง node_modules ที่โฟลเดอร์ราก
Vercel ตั้ง Root Directory = `frontend/` จึงติดตั้งเฉพาะ `frontend/package.json`
ถ้าโค้ดใน `shared/` import แพ็กเกจที่มีอยู่แค่ที่ root **เครื่องเราจะ build ผ่านแต่ Vercel จะพัง**
(เคยเกิดจริง: ไฟล์เทสต์ import `vitest` → `tsc -b` พังบน Vercel · แก้โดย exclude ไฟล์เทสต์ใน `frontend/tsconfig.app.json`)

ตรวจก่อน push ได้ด้วยคำสั่งนี้ — ต้องไม่มีผลลัพธ์ออกมา:

```bash
cd frontend; npx tsc -p tsconfig.app.json --noEmit --listFiles | Select-String -SimpleMatch "Fin Program/node_modules"
```

## เทสต์
เทสต์ของโมดูลนี้อยู่ข้าง ๆ ไฟล์ต้นฉบับ และรันผ่านฝั่ง frontend:

```bash
cd frontend; npm test
```
