// ── ป้ายบอกว่ากำลังใช้ระบบทดสอบอยู่ ──
// แสดงเฉพาะเมื่อ build นั้นถูกตั้ง VITE_API_URL ให้ชี้ไป backend คนละตัว (staging/preview)
// production ไม่ได้ตั้งค่านี้ จึงไม่มีป้ายโผล่ — หน้าตาเว็บจริงไม่เปลี่ยน
//
// มีไว้กันความผิดพลาดที่แพงที่สุดของการมี staging: เผลอคิดว่ากำลังดูข้อมูลจริงทั้งที่เป็นข้อมูลทดสอบ
// (หรือกลับกัน — เผลอแก้ข้อมูลลูกค้าจริงเพราะนึกว่าอยู่บน staging)
const STAGING = Boolean(import.meta.env.VITE_API_URL)

export default function EnvBadge() {
  if (!STAGING) return null
  return (
    <div
      title={`ระบบทดสอบ — เชื่อมกับ ${import.meta.env.VITE_API_URL}`}
      style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10000, pointerEvents: 'none',
        background: '#f59e0b', color: '#1c1917',
        padding: '2px 14px', borderRadius: '0 0 8px 8px',
        fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', whiteSpace: 'nowrap',
      }}>
      ระบบทดสอบ · ข้อมูลในนี้ไม่ใช่ของลูกค้าจริง
    </div>
  )
}
