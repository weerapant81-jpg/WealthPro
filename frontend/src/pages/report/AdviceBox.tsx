// ── กล่องคำแนะนำของที่ปรึกษาบนหน้ารายงาน ──
// เดิมเป็น <textarea> ที่ผูกกับ state ของทั้งรายงานโดยตรง ทุกตัวอักษรที่พิมพ์จะสั่ง setState
// ระดับ ReportPage → ทุกหัวข้อ (18 ไฟล์ รวมกราฟทั้งหมด) วาดใหม่ → พิมพ์แล้วหน่วงจนใช้งานไม่ได้
// และบางกล่องยังถูกประกาศไว้ "ข้างใน" ฟังก์ชัน render ทำให้ React ถือว่าเป็นคอมโพเนนต์ชนิดใหม่
// ทุกครั้ง แล้ว unmount ของเดิมทิ้ง — โฟกัสหลุดทันทีที่พิมพ์ตัวแรก จึงพิมพ์ต่อไม่ได้เลย
//
// แก้โดยแยกการพิมพ์ออกไปไว้ใน dialog ที่ถือ state ของตัวเอง แล้วค่อยบันทึกกลับครั้งเดียวตอนกดบันทึก
// (แนวเดียวกับหน้านำเสนอ) — ระหว่างพิมพ์จึงไม่มีอะไรนอกกล่องวาดใหม่เลย
import { useState } from 'react'
import { X, Check, Pencil } from 'lucide-react'

function AdviceDialog({ title, value, onSave, onClose }: {
  title: string; value: string; onSave: (v: string) => void; onClose: () => void
}) {
  const [text, setText] = useState(value)
  return (
    <div className="no-print" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 784, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>คำแนะนำ · {title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} autoFocus rows={10}
          placeholder="เขียนคำแนะนำ/ข้อสังเกตของที่ปรึกษา..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={() => { onSave(text); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 9, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Check size={15} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * กล่องคำแนะนำบนหน้ากระดาษ — คลิกแล้วเปิด dialog ให้พิมพ์
 * heading  แสดงหัวข้อ "ข้อเสนอแนะ" ด้านบนกล่อง (ปิดได้สำหรับกล่องที่มีหัวข้ออยู่แล้ว)
 */
export default function AdviceBox({ title, value, onSave, minHeight = 110, heading = true, placeholder = 'คลิกเพื่อพิมพ์ข้อเสนอแนะของนักวางแผนการเงิน...' }: {
  title: string
  value: string
  onSave: (v: string) => void
  minHeight?: number
  heading?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div onClick={() => setOpen(true)} title="คลิกเพื่อแก้ไขข้อเสนอแนะ"
        style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', minHeight, cursor: 'pointer', position: 'relative' }}>
        {heading && <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>ข้อเสนอแนะ</div>}
        <div style={{ flex: 1, fontSize: 12.5, color: value ? '#334155' : '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {value || placeholder}
        </div>
        {/* ไอคอนดินสอ — บอกว่ากล่องนี้แก้ไขได้ · ไม่พิมพ์ลงกระดาษ */}
        <Pencil className="no-print" size={13} style={{ position: 'absolute', top: 9, right: 9, color: '#cbd5e1' }} />
      </div>
      {open && <AdviceDialog title={title} value={value} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  )
}
