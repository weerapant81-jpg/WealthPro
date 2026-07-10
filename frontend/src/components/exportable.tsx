import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Download, X, Sheet } from 'lucide-react'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx'

/* ── WealthPro export/zoom kit ──────────────────────────────────────────
   ChartFrame  — ห่อกราฟ recharts: คลิกที่กราฟเพื่อขยาย (modal) + ปุ่มโหลด PNG
   ExcelButton — ปุ่ม export ข้อมูลตารางเป็น .xlsx (รับ data ตรง ไม่ scrape DOM)

   การใช้กราฟ: children ต้องเป็น <ResponsiveContainer width="100%" height="100%">
   <ChartFrame title="โครงสร้างสินทรัพย์" filename="asset-structure" height={260}>
     <ResponsiveContainer width="100%" height="100%">...</ResponsiveContainer>
   </ChartFrame>
------------------------------------------------------------------------- */

// อ่านสีพื้นการ์ดจาก CSS var (html2canvas ต้องการพื้นทึบ ไม่งั้นได้ภาพโปร่งใส/ดำ)
function cardBg(): string {
  const s = getComputedStyle(document.documentElement)
  return (s.getPropertyValue('--card-bg') || s.getPropertyValue('--navy-900') || '#0f1729').trim() || '#0f1729'
}

async function nodeToPng(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, { backgroundColor: cardBg(), scale: 2, logging: false, useCORS: true })
  const url = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.png`
  document.body.appendChild(a); a.click(); a.remove()
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 8, cursor: 'pointer',
  background: 'var(--navy-900, rgba(0,0,0,0.35))', border: '1px solid var(--card-border)',
  color: 'var(--text-secondary)', transition: 'color .15s, border-color .15s',
}

export function ChartFrame({ title, filename, height = 280, children, actions }: {
  title?: string
  filename?: string
  height?: number
  children: ReactNode
  actions?: ReactNode   // ปุ่มเสริม (เช่น ExcelButton ของตารางคู่กราฟ)
}) {
  const [zoom, setZoom] = useState(false)
  const inlineRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const name = filename || title || 'chart'

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [zoom])

  const savePng = async (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current || busy) return
    setBusy(true)
    try { await nodeToPng(ref.current, name) } finally { setBusy(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* toolbar มุมขวาบน */}
      <div className="cf-tools" style={{ position: 'absolute', top: 4, right: 4, zIndex: 3, display: 'flex', gap: 6 }}>
        {actions}
        <button title="ดาวน์โหลดรูปภาพ (PNG)" style={iconBtn} onClick={() => savePng(inlineRef)}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
          <Download size={15} />
        </button>
        <button title="ขยายกราฟ" style={iconBtn} onClick={() => setZoom(true)}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
          <Maximize2 size={15} />
        </button>
      </div>

      {/* กราฟ inline — คลิกที่ตัวกราฟเพื่อขยาย */}
      <div ref={inlineRef} onClick={() => setZoom(true)} style={{ height, cursor: 'zoom-in' }}>
        {children}
      </div>

      {zoom && createPortal(
        <div onClick={() => setZoom(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(3,7,18,0.82)',
            backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)', maxHeight: '92vh', background: 'var(--card-bg)',
              border: '1px solid var(--card-border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
              borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title || 'กราฟ'}</div>
              <button title="ดาวน์โหลดรูปภาพ (PNG)" style={iconBtn} onClick={() => savePng(modalRef)}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--cyan)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                <Download size={16} />
              </button>
              <button title="ปิด" style={iconBtn} onClick={() => setZoom(false)}
                onMouseEnter={e => (e.currentTarget.style.color = '#f43f5e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                <X size={16} />
              </button>
            </div>
            <div ref={modalRef} style={{ flex: 1, minHeight: 0, padding: 20, background: 'var(--card-bg)' }}>
              <div style={{ height: 'min(64vh, 620px)' }}>{children}</div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/* ── Excel export ─────────────────────────────────────────────────────── */

export type ExcelSheet = {
  name: string
  // แถวแรก = หัวตาราง; ที่เหลือ = ข้อมูล
  rows: (string | number | null | undefined)[][]
}

export function exportToExcel(filename: string, sheets: ExcelSheet | ExcelSheet[]) {
  const list = Array.isArray(sheets) ? sheets : [sheets]
  const wb = XLSX.utils.book_new()
  for (const sh of list) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows)
    // ปรับความกว้างคอลัมน์ตามเนื้อหา (คร่าวๆ)
    const nCols = sh.rows.reduce((m, r) => Math.max(m, r.length), 0)
    ws['!cols'] = Array.from({ length: nCols }, (_, c) => {
      const w = sh.rows.reduce((m, r) => Math.max(m, String(r[c] ?? '').length), 8)
      return { wch: Math.min(w + 2, 48) }
    })
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31))
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** ห่อ <table> จริง — เพิ่มปุ่ม export Excel ที่ scrape ตารางจาก DOM (ไม่ต้อง hand-code แถว)
    วาง <table> ไว้ข้างใน; ปุ่มลอยมุมขวาบน */
export function TableFrame({ title, filename, children, style }: {
  title?: string
  filename: string
  children: ReactNode
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onExport = () => {
    const table = ref.current?.querySelector('table')
    if (!table) return
    try {
      const wb = XLSX.utils.table_to_book(table, { sheet: (title || 'ตาราง').slice(0, 31), raw: false })
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } catch (e) { console.error('export table failed', e) }
  }
  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ position: 'absolute', top: -2, right: 0, zIndex: 3 }}>
        <ExcelButtonInner onClick={onExport} compact />
      </div>
      <div ref={ref}>{children}</div>
    </div>
  )
}

/** ปุ่ม Excel ที่ "หาตารางเอง" — วางไว้ใกล้ <table> (พี่น้อง/ในการ์ดเดียวกัน) แก้จุดเดียว ไม่ต้องห่อ
    onClick: ไต่ parent ขึ้นไปจนเจอ element ที่มี <table> แล้ว export ตารางนั้น */
export function TableExcelButton({ filename, title, style }: {
  filename: string
  title?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const onClick = () => {
    let el: HTMLElement | null = ref.current?.parentElement ?? null
    let table: HTMLTableElement | null = null
    while (el && !table) { table = el.querySelector('table'); el = el.parentElement }
    if (!table) { console.warn('ไม่พบตารางสำหรับ export'); return }
    try {
      const wb = XLSX.utils.table_to_book(table, { sheet: (title || 'ตาราง').slice(0, 31), raw: false })
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } catch (e) { console.error('export table failed', e) }
  }
  return (
    <button ref={ref} title="ดาวน์โหลด Excel" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8,
        cursor: 'pointer', fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e', ...style }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}>
      <Sheet size={13} /> Excel
    </button>
  )
}

function ExcelButtonInner({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  if (compact) return (
    <button title="ดาวน์โหลด Excel" style={iconBtn} onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
      <Sheet size={15} />
    </button>
  )
  return (
    <button onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9,
        cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e' }}>
      <Sheet size={14} /> Excel
    </button>
  )
}

/** ปุ่มเล็กสำหรับ export ตารางเป็น Excel — ส่ง getSheets แบบ lazy (คำนวณตอนคลิก) */
export function ExcelButton({ filename, getSheets, label = 'Excel', compact }: {
  filename: string
  getSheets: () => ExcelSheet | ExcelSheet[]
  label?: string
  compact?: boolean
}) {
  const onClick = () => {
    try { exportToExcel(filename, getSheets()) } catch (e) { console.error('export excel failed', e) }
  }
  if (compact) {
    return (
      <button title="ดาวน์โหลด Excel" style={iconBtn} onClick={onClick}
        onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
        <Sheet size={15} />
      </button>
    )
  }
  return (
    <button onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9,
        cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.35)', color: '#22c55e' }}>
      <Sheet size={14} /> {label}
    </button>
  )
}
