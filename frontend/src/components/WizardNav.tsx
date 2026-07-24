import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/* ลำดับขั้นการวางแผนการเงิน (ชุดเดียวใช้ร่วมกันทุกหน้า) — ต้องเรียงให้ตรงกับเมนูย่อยใน sidebar
   (Layout FINANCIAL_TABS) เป๊ะ เพื่อให้ปุ่ม "ก่อนหน้า/ถัดไป" เดินทีละเมนู ไม่ข้าม
   แต่ละขั้นมี `to` เป็น URL เต็ม → นำทางข้ามหน้าได้ (สมมติฐานอยู่ /settings, ที่เหลืออยู่ /financial-plan?tab=) */
export type PlanStep = { key: string; label: string; to: string }
export const PLANNING_STEPS: PlanStep[] = [
  { key: 'assumptions', label: 'สมมติฐาน', to: '/settings' },
  { key: 'investment', label: 'มูลค่าสินทรัพย์ลงทุน', to: '/financial-plan?tab=investment' },
  { key: 'social', label: 'กองทุนประกันสังคม', to: '/financial-plan?tab=social' },
  { key: 'pvd', label: 'กองทุนสำรองเลี้ยงชีพ', to: '/financial-plan?tab=pvd' },
  { key: 'severance', label: 'เงินชดเชยเกษียณอายุ', to: '/financial-plan?tab=severance' },
  { key: 'retirement', label: 'วางแผนเกษียณ', to: '/financial-plan?tab=retirement' },
  { key: 'education', label: 'ทุนการศึกษาบุตร', to: '/financial-plan?tab=education' },
  { key: 'insurance', label: 'วางแผนประกัน', to: '/financial-plan?tab=insurance' },
  { key: 'tax', label: 'วางแผนภาษี', to: '/financial-plan?tab=tax' },
  { key: 'estate', label: 'วางแผนมรดก', to: '/financial-plan?tab=estate' },
]

/* แถบนำทาง "ก่อนหน้า / ถัดไป" — รองรับ 2 โหมด:
   1) ขั้นข้ามหน้า: step มี `to` → นำทางด้วย URL ให้เอง (เช่น flow วางแผน PLANNING_STEPS)
   2) ขั้นในหน้าเดียว: step ไม่มี `to` → เรียก onGo(key) (เช่น แท็บกรอกข้อมูลลูกค้า) */
type NavStep = { key: string; label: string; to?: string }
export function WizardNav({ steps, current, onGo }: {
  steps: NavStep[]
  current: string
  onGo?: (key: string) => void
}) {
  const navigate = useNavigate()
  const idx = steps.findIndex(s => s.key === current)
  if (idx < 0) return null
  const prev = idx > 0 ? steps[idx - 1] : null
  const next = idx < steps.length - 1 ? steps[idx + 1] : null

  const go = (step: NavStep) => {
    if (step.to) { navigate(step.to); window.scrollTo({ top: 0, behavior: 'smooth' }) }
    else onGo?.(step.key)
  }

  const btn = (dir: 'prev' | 'next', step: NavStep) => (
    <button onClick={() => go(step)}
      title={step.label}
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
