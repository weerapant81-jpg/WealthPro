import { ChevronLeft, ChevronRight } from 'lucide-react'

/* แถบนำทาง "ก่อนหน้า / ถัดไป" สำหรับหน้าที่กรอกข้อมูลเป็นแท็บทีละหน้า
   ใช้ร่วมได้ทุกหน้าที่ขับแท็บด้วย ?tab= — ส่ง steps + current + onGo เข้ามา */
export function WizardNav({ steps, current, onGo }: {
  steps: { key: string; label: string }[]
  current: string
  onGo: (key: string) => void
}) {
  const idx = steps.findIndex(s => s.key === current)
  if (idx < 0) return null
  const prev = idx > 0 ? steps[idx - 1] : null
  const next = idx < steps.length - 1 ? steps[idx + 1] : null

  const btn = (dir: 'prev' | 'next', step: { key: string; label: string }) => (
    <button onClick={() => onGo(step.key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10,
        cursor: 'pointer', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
        background: dir === 'next' ? 'var(--cyan)' : 'var(--card-bg)',
        color: dir === 'next' ? '#00201d' : 'var(--text-secondary)',
        border: dir === 'next' ? 'none' : '1px solid var(--card-border)',
        flexDirection: dir === 'prev' ? 'row' : 'row-reverse',
      }}>
      {dir === 'prev' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
      {dir === 'prev' ? 'ก่อนหน้า' : 'ถัดไป'}
    </button>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--card-border)',
      // เว้นระยะล่าง + ขวา ให้พ้นปุ่มลอย AI (fixed right:22 bottom:22 · 56px) ไม่ทับปุ่มถัดไป
      marginBottom: 20, paddingBottom: 66, paddingRight: 4,
    }}>
      <div style={{ flex: '0 0 auto', minWidth: 0 }}>{prev ? btn('prev', prev) : <span />}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {idx + 1} / {steps.length}
      </div>
      <div style={{ flex: '0 0 auto', minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>{next ? btn('next', next) : <span />}</div>
    </div>
  )
}
