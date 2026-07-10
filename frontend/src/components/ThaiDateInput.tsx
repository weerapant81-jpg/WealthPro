import { useState, useEffect, type CSSProperties } from 'react'
import { sel } from '../styles/dark'

/* ช่องกรอกวันเกิดแบบ dropdown วัน / เดือน / ปี (พ.ศ.)
   — แทน <input type="date"> ที่บน iPad เปลี่ยนปีย้อนหลังหลายสิบปีได้ยาก
   value / onChange ใช้รูปแบบ ISO "YYYY-MM-DD" (ค.ศ.) เหมือนเดิม
   เก็บ state ของแต่ละช่องภายใน → เลือกทีละช่องได้ (emit เมื่อครบทั้งสาม) */

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const pad = (n: number) => String(n).padStart(2, '0')
const parseISO = (v: string) => /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '')

export function ThaiDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const init = parseISO(value)
  const [d, setD] = useState<string>(init ? String(+init[3]) : '')
  const [mo, setMo] = useState<string>(init ? String(+init[2]) : '')
  const [be, setBe] = useState<string>(init ? String(+init[1] + 543) : '')

  // sync จากค่าภายนอก (โหลดข้อมูล/ซ่อม mojibake) — เฉพาะเมื่อ value เป็นวันที่สมบูรณ์
  useEffect(() => {
    const p = parseISO(value)
    if (p) { setD(String(+p[3])); setMo(String(+p[2])); setBe(String(+p[1] + 543)) }
  }, [value])

  const nowBE = new Date().getFullYear() + 543
  const years: number[] = []
  for (let y = nowBE; y >= nowBE - 120; y--) years.push(y)

  const gYear = be ? +be - 543 : null
  const daysInMonth = (gY: number | null, m: string) => (gY && m) ? new Date(gY, +m, 0).getDate() : 31

  const commit = (nd: string, nmo: string, nbe: string) => {
    if (nd && nmo && nbe) {
      const g = +nbe - 543
      const maxD = new Date(g, +nmo, 0).getDate()   // กันวันเกินเดือน (เช่น 31 ก.พ.)
      onChange(`${g}-${pad(+nmo)}-${pad(Math.min(+nd, maxD))}`)
    }
  }

  const s: CSSProperties = { ...sel, minWidth: 0 }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select style={{ ...s, flex: '1 1 68px' }} value={d} onChange={e => { setD(e.target.value); commit(e.target.value, mo, be) }}>
        <option value="">วัน</option>
        {Array.from({ length: daysInMonth(gYear, mo) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select style={{ ...s, flex: '2 1 130px' }} value={mo} onChange={e => { setMo(e.target.value); commit(d, e.target.value, be) }}>
        <option value="">เดือน</option>
        {TH_MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>
      <select style={{ ...s, flex: '1 1 96px' }} value={be} onChange={e => { setBe(e.target.value); commit(d, mo, e.target.value) }}>
        <option value="">ปี (พ.ศ.)</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}
