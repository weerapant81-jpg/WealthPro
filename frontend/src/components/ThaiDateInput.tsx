import { type CSSProperties } from 'react'
import { sel } from '../styles/dark'

/* ช่องกรอกวันเกิดแบบ dropdown วัน / เดือน / ปี (พ.ศ.)
   — แทน <input type="date"> ที่บน iPad เปลี่ยนปีย้อนหลังหลายสิบปีได้ยาก
   value / onChange ใช้รูปแบบ ISO "YYYY-MM-DD" (ค.ศ.) เหมือนเดิม เพื่อไม่กระทบที่อื่น */

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const pad = (n: number) => String(n).padStart(2, '0')

export function ThaiDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
  const gy = m ? +m[1] : null          // ปี ค.ศ.
  const mm = m ? +m[2] : null          // เดือน 1-12
  const dd = m ? +m[3] : null          // วัน
  const beY = gy != null ? gy + 543 : null

  const nowBE = new Date().getFullYear() + 543
  const years: number[] = []
  for (let y = nowBE; y >= nowBE - 120; y--) years.push(y)   // ปี พ.ศ. ปัจจุบัน → ย้อน 120 ปี

  const daysInMonth = (g: number | null, mo: number | null) => (g && mo) ? new Date(g, mo, 0).getDate() : 31

  const emit = (nd: number | null, nm: number | null, nbe: number | null) => {
    if (nd && nm && nbe) {
      const g = nbe - 543
      const maxD = new Date(g, nm, 0).getDate()   // กันวันเกินเดือน (เช่น 31 ก.พ.)
      onChange(`${g}-${pad(nm)}-${pad(Math.min(nd, maxD))}`)
    }
  }

  const s: CSSProperties = { ...sel, minWidth: 0 }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select style={{ ...s, flex: '1 1 68px' }} value={dd ?? ''} onChange={e => emit(e.target.value ? +e.target.value : null, mm, beY)}>
        <option value="">วัน</option>
        {Array.from({ length: daysInMonth(gy, mm) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select style={{ ...s, flex: '2 1 130px' }} value={mm ?? ''} onChange={e => emit(dd, e.target.value ? +e.target.value : null, beY)}>
        <option value="">เดือน</option>
        {TH_MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>
      <select style={{ ...s, flex: '1 1 96px' }} value={beY ?? ''} onChange={e => emit(dd, mm, e.target.value ? +e.target.value : null)}>
        <option value="">ปี (พ.ศ.)</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
