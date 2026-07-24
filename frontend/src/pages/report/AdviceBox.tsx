// ── กล่องคำแนะนำของที่ปรึกษาบนหน้ารายงาน ──
// เดิมเป็น <textarea> ที่ผูกกับ state ของทั้งรายงานโดยตรง ทุกตัวอักษรที่พิมพ์จะสั่ง setState
// ระดับ ReportPage → ทุกหัวข้อ (18 ไฟล์ รวมกราฟทั้งหมด) วาดใหม่ → พิมพ์แล้วหน่วงจนใช้งานไม่ได้
// และบางกล่องยังถูกประกาศไว้ "ข้างใน" ฟังก์ชัน render ทำให้ React ถือว่าเป็นคอมโพเนนต์ชนิดใหม่
// ทุกครั้ง แล้ว unmount ของเดิมทิ้ง — โฟกัสหลุดทันทีที่พิมพ์ตัวแรก จึงพิมพ์ต่อไม่ได้เลย
//
// แก้โดยแยกการพิมพ์ออกไปไว้ใน dialog ที่ถือ state ของตัวเอง แล้วค่อยบันทึกกลับครั้งเดียวตอนกดบันทึก
// (แนวเดียวกับหน้านำเสนอ) — ระหว่างพิมพ์จึงไม่มีอะไรนอกกล่องวาดใหม่เลย
import { useRef, useState } from 'react'
import { X, Check, Pencil, Move, RotateCcw } from 'lucide-react'

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
export default function AdviceBox({ title, value, onSave, minHeight = 110, heading = true, placeholder = 'คลิกเพื่อพิมพ์ข้อเสนอแนะของนักวางแผนการเงิน...', pos, onMove }: {
  title: string
  value: string
  onSave: (v: string) => void
  minHeight?: number
  heading?: boolean
  placeholder?: string
  /** ตำแหน่งที่ผู้ใช้ลากย้ายไว้ (px จากตำแหน่งเดิมในหน้า) — ไม่ส่งมา = ล็อกอยู่กับที่ */
  pos?: { x: number; y: number }
  onMove?: (p: { x: number; y: number }) => void
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)
  const movable = !!onMove
  const at = pos ?? { x: 0, y: 0 }

  // ── ลากย้ายกล่อง ──
  // ระหว่างลากเราแก้ style ของ DOM ตรง ๆ (ไม่ setState) เพราะกล่องบางใบถูก render อยู่ในคอมโพเนนต์
  // ที่ประกาศไว้ข้างในฟังก์ชัน render ของหัวข้อ — ถ้าสั่ง state ของหน้าให้เปลี่ยนทุก pointermove
  // React จะ unmount/mount กล่องใหม่กลางคัน แล้ว pointer capture หลุด ลากไม่ติด
  // จึงบันทึกตำแหน่งกลับขึ้น state ครั้งเดียวตอนปล่อยนิ้ว
  const onPointerDown = (e: React.PointerEvent) => {
    if (!movable || e.button !== 0) return
    drag.current = { px: e.clientX, py: e.clientY, ox: at.x, oy: at.y, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.px, dy = e.clientY - d.py
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return   // ขยับไม่ถึง 4px = ยังถือว่าเป็นการคลิก
    d.moved = true
    if (boxRef.current) boxRef.current.style.transform = `translate(${d.ox + dx}px, ${d.oy + dy}px)`
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (d.moved) onMove!({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) })
    else setOpen(true)   // คลิกเฉย ๆ = เปิดกล่องพิมพ์ (เหมือนเดิม)
  }

  return (
    <>
      <div ref={boxRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null }}
        onClick={movable ? undefined : () => setOpen(true)}
        title={movable ? 'คลิกเพื่อแก้ไข · คลิกค้างแล้วลากเพื่อย้ายตำแหน่ง' : 'คลิกเพื่อแก้ไขข้อเสนอแนะ'}
        style={{
          border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column',
          minHeight, cursor: movable ? 'grab' : 'pointer', position: 'relative',
          transform: at.x || at.y ? `translate(${at.x}px, ${at.y}px)` : undefined,
          touchAction: movable ? 'none' : undefined,   // กันหน้าจอ iPad เลื่อนแทนการลากกล่อง
        }}>
        {heading && <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>ข้อเสนอแนะ</div>}
        <div style={{ flex: 1, fontSize: 12.5, color: value ? '#334155' : '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {value || placeholder}
        </div>
        {/* ไอคอนบอกสถานะ — แก้ไขได้ / ลากย้ายได้ / คืนตำแหน่งเดิม · ไม่พิมพ์ลงกระดาษ */}
        <div className="no-print" style={{ position: 'absolute', top: 9, right: 9, display: 'flex', gap: 5, alignItems: 'center', color: '#cbd5e1' }}>
          {movable && (at.x || at.y) ? (
            <span title="คืนตำแหน่งเดิม" style={{ display: 'flex', cursor: 'pointer' }}
              onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onMove!({ x: 0, y: 0 }) }}>
              <RotateCcw size={13} />
            </span>
          ) : null}
          {movable && <Move size={13} />}
          <Pencil size={13} />
        </div>
      </div>
      {open && <AdviceDialog title={title} value={value} onSave={onSave} onClose={() => setOpen(false)} />}
    </>
  )
}
