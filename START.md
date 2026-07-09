# วิธีเริ่มใช้งาน FinPlan

## ครั้งแรก (Setup)

### 1. เริ่ม Database (ต้องมี Docker)
```
docker-compose up -d
```

### 2. Setup Backend
```
cd backend
npm run db:migrate    # สร้าง tables ใน database
npm run dev           # เริ่ม backend ที่ port 3001
```

### 3. เริ่ม Frontend (terminal ใหม่)
```
cd frontend
npm run dev           # เริ่ม frontend ที่ port 5173
```

### 4. เปิดเบราว์เซอร์
ไปที่ http://localhost:5173

---

## ครั้งต่อไป
```
docker-compose up -d      # (ถ้ายัง)
cd backend && npm run dev
cd frontend && npm run dev
```

---

## ถ้าไม่มี Docker
แก้ไข `backend/.env` ให้ชี้ไปที่ PostgreSQL ของคุณ:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/finplan"
```
แล้วสร้าง database ชื่อ `finplan` ก่อน จากนั้นรัน `npm run db:migrate`
