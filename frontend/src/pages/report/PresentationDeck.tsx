import { useMemo, useState, useRef, useLayoutEffect, createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useRetirementReadiness } from '../../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../../hooks/useEducationReadiness'
import { useInsuranceCoverage } from '../../components/InsuranceCoverageSummary'
import { buildEduChart, type ChildSetting } from '../EducationPlanPage'
import { calc, calcTax, defaultState, type TaxState } from '../../lib/tax'
import { annualIncome as incAnnual, isAnnualIncome as isAnnualInc } from '../../lib/income'
import { lineAt, sumAt, buildTaxState, type CashflowData, type Line as CfLine } from '../ForwardCashflowTab'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../../lib/portfolioReturns'
import { annualizedReturn, mulberry32, percentile, toNum } from '@shared/finance/math'
import {
  ShieldCheck, TrendingUp, PiggyBank, GraduationCap, Landmark, ClipboardCheck,
  Activity, Pencil, X, Check, User, Users, GripVertical, EyeOff, Plus,
  Wallet, Scale, Receipt, Baby, Target, HeartPulse, Banknote, CalendarClock, Briefcase,
  Type as TypeIcon, ImagePlus, Trash2, ArrowUp, ArrowDown, Bold, AlignLeft, AlignCenter, AlignRight, FilePlus2,
  RotateCcw, RotateCw, BringToFront, SendToBack, Grid3x3, ScrollText
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ComposedChart, Area, Line, CartesianGrid, ReferenceLine, ReferenceDot,
} from 'recharts'

/* ══════════════════════════════════════════════════════════════════════════
   PresentationDeck — เด็คนำเสนอแผนการเงิน ฉบับครอบครัว (ลูกค้า + คู่สมรส คู่กัน)
   สไลด์ A4 แนวนอน ธีมสว่าง · ดึงตัวเลข/กราฟจาก hook/endpoint เดิม (กัน drift)
   ══════════════════════════════════════════════════════════════════════════ */

const fmt = (n: number) => (isFinite(n) ? Math.round(n) : 0).toLocaleString('th-TH')
const fmtM = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`
const toMonthly = (a: number, f: string) => f === 'QUARTERLY' ? a / 3 : f === 'ANNUALLY' ? a / 12 : a
const pct = (part: number, whole: number) => whole > 0 ? Math.round((part / whole) * 100) : 0

// light palette — refined financial editorial (private-bank)
const INK = '#0f172a', SUB = '#4b5a6b', MUTED = '#93a1b0', LINE = '#e9eef4'
const PAPER = '#f7fafd'            // พื้นการ์ดโทนเย็นบางๆ
const HAIR = '#eef2f7'             // เส้นคั่นบางมาก
// สีหลัก = teal เดียวกับรายงานฉบับเต็ม (ใช้เฉด 600 เพื่อ contrast บนพื้นขาว)
const CY = '#0d9488', GR = '#10b981', AM = '#f59e0b', RD = '#f43f5e', VI = '#8b5cf6'
// categorical — ลำดับคงที่ (validated CVD-safe, light mode) ห้ามสลับ/วนสี
const PIE_COLORS = ['#0d9488', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#0ea5e9', '#14b8a6', '#f97316']

/* คอลัมน์ของ sub-plan (แผนดำเนินการ) ต่อด้าน — ตรงกับ SUBPLAN_CONFIG ใน ActionPlanPage */
const SUBPLAN_COLS: Record<string, { key: string; label: string; type: 'text' | 'money' | 'date' }[]> = {
  liquidity: [{ key: 'method', label: 'วิธีการ', type: 'text' }, { key: 'tool', label: 'เครื่องมือ', type: 'text' }, { key: 'amount', label: 'จำนวนเงิน/เดือน', type: 'money' }, { key: 'schedule', label: 'กำหนดการ', type: 'date' }],
  insurance: [{ key: 'desc', label: 'แผนปฏิบัติการ', type: 'text' }, { key: 'sumInsured', label: 'ทุนประกัน', type: 'money' }, { key: 'premium', label: 'เบี้ยประกัน', type: 'money' }, { key: 'schedule', label: 'กำหนดการ', type: 'date' }],
  retirement: [{ key: 'desc', label: 'แผนปฏิบัติการ', type: 'text' }, { key: 'assetType', label: 'ประเภทสินทรัพย์', type: 'text' }, { key: 'amount', label: 'จำนวนเงิน', type: 'money' }, { key: 'schedule', label: 'กำหนดการ', type: 'date' }],
  education: [{ key: 'desc', label: 'แผนปฏิบัติการ', type: 'text' }, { key: 'assetType', label: 'ประเภทสินทรัพย์', type: 'text' }, { key: 'amount', label: 'จำนวนเงิน', type: 'money' }, { key: 'schedule', label: 'กำหนดการ', type: 'date' }],
  estate: [{ key: 'who', label: 'ใคร', type: 'text' }, { key: 'desc', label: 'ทำอะไร', type: 'text' }, { key: 'schedule', label: 'เมื่อไหร่', type: 'date' }],
}
const SUBPLAN_ACCENT: Record<string, string> = { liquidity: '#06b6d4', insurance: '#3b82f6', retirement: '#00cfc1', education: '#f59e0b', estate: '#8b5cf6' }

type Person = 'self' | 'spouse'

/* ══════════════════════════ Slide editor: types + context ══════════════════════════ */
export type SlideEl =
  | { id: string; type: 'text'; x: number; y: number; w: number; text: string; size: number; color: string; weight: number; align: 'left' | 'center' | 'right' }
  | { id: string; type: 'image'; x: number; y: number; w: number; h: number; src: string; rot?: number }
export type CustomSlide = { id: string; bg?: string }

// รายการสไลด์ทั้งหมด (เรียงตามลำดับจริง) — ใช้ทำเมนูเลือกหน้าในหน้ารายงาน
export const DECK_SLIDES: { id: string; label: string }[] = [
  { id: 'cover', label: 'หน้าปก' },
  { id: 'process', label: 'กระบวนการวางแผนการเงิน' },
  { id: 'family', label: 'ข้อมูลครอบครัว' },
  { id: 'work', label: 'ข้อมูลการทำงานและสวัสดิการ' },
  { id: 'goals', label: 'เป้าหมายการเงิน' },
  { id: 'insgoals', label: 'เป้าหมายด้านการประกัน' },
  { id: 'balance', label: 'งบดุล' },
  { id: 'cashflow', label: 'งบกระแสเงินสด' },
  { id: 'ratios', label: 'อัตราส่วน/สุขภาพการเงิน' },
  { id: 'education', label: 'ทุนการศึกษาบุตร' },
  { id: 'insurance', label: 'ความเสี่ยง & ประกัน' },
  { id: 'investment', label: 'การลงทุน' },
  { id: 'retirement', label: 'แผนเกษียณ' },
  { id: 'retire2', label: 'กราฟเกษียณ' },
  { id: 'tax', label: 'ภาษีเงินได้' },
  { id: 'estate', label: 'การจัดการมรดก' },
  { id: 'advheader', label: 'หน้าคั่น: คำแนะนำนักวางแผน' },
  { id: 'liquidity', label: 'การบริหารสภาพคล่อง/หนี้สิน' },
  { id: 'rebalance', label: 'การปรับสัดส่วนการลงทุน' },
  { id: 'edu2', label: 'การออมเพื่อทุนการศึกษา' },
  { id: 'insneed', label: 'การบริหารความเสี่ยง/การประกัน' },
  { id: 'retiresave', label: 'การออมเพื่อการเกษียณ' },
  { id: 'taxplan2', label: 'การวางแผนภาษี (ก่อน/หลัง)' },
  { id: 'estateplan2', label: 'การวางแผนมรดก' },
  { id: 'action', label: 'แผนปฏิบัติการ' },
  { id: 'holistic', label: 'ไทม์ไลน์แผนดำเนินการ' },
  { id: 'forward', label: 'งบการเงินล่วงหน้า (ถึงเกษียณ)' },
  { id: 'thankyou', label: 'หน้าขอบคุณ' },
]

type EditorCtx = {
  editMode: boolean
  snap: boolean
  overlays: Record<string, SlideEl[]>
  setEls: (slideId: string, els: SlideEl[]) => void
  advisorName?: string
  advisorPhone?: string
}
export const SlideEditor = createContext<EditorCtx>({ editMode: false, snap: false, overlays: {}, setEls: () => {} })
const SNAP = 2   // % grid

const uid = () => `el${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/* อ่านไฟล์รูป → ย่อด้วย canvas → base64 (แพทเทิร์นเดียวกับ UserProfilePage.onPhoto) */
function downscaleImage(file: File, max = 1400): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > max) { height = height * max / width; width = max }
        else if (height > max) { width = width * max / height; height = max }
        const cv = document.createElement('canvas')
        cv.width = width; cv.height = height
        cv.getContext('2d')!.drawImage(img, 0, 0, width, height)
        const png = /png/i.test(file.type)
        resolve({ src: cv.toDataURL(png ? 'image/png' : 'image/jpeg', png ? undefined : 0.85), w: width, h: height })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── Monte Carlo (สูตรเดียวกับ InvestmentMonteCarloChart) ─── */

/* ══════════════════════════ ส่วนประกอบพื้นฐาน ══════════════════════════ */

/* จัดเนื้อหาให้พอดี 1 หน้าเสมอ — ถ้าเนื้อหาสูงเกินพื้นที่ (เช่นเปิดบน iPad จอแคบ) ย่อสัดส่วนลงให้พอดี
 * โดยไม่แตะกล่องคำแนะนำ/footer (อยู่นอกตัวย่อ) */
function AutoFit({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    // วัดจาก layout (scrollHeight/clientHeight ไม่นับ transform → ไม่เกิด loop)
    const measure = () => {
      const avail = box.clientHeight
      const need = box.scrollHeight
      if (avail <= 0 || need <= 0) return
      const s = need > avail + 1 ? Math.max(0.5, avail / need) : 1
      setScale(prev => Math.abs(prev - s) > 0.004 ? s : prev)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [children])
  // ชั้นนอกครอบ+ตัดส่วนเกิน · ชั้นในเป็น flex column เต็มความสูง (children ที่ใช้ flex:1 ทำงานเหมือนเดิม) แล้วย่อทั้งก้อนเมื่อเนื้อหาล้น
  // เนื้อหาสั้น (ตาราง/การ์ด) → จัดกึ่งกลางแนวตั้งให้พื้นที่ว่างสมดุลบน-ล่าง · เนื้อหาที่ใช้ flex:1 (กราฟ) เต็มพื้นที่อยู่แล้วจึงไม่ขยับ
  // เมื่อเนื้อหาล้น (scale<1) กลับไปชิดบนเพื่อให้การวัด/ย่อแม่นยำ
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: scale < 1 ? 'flex-start' : 'center', transformOrigin: 'top center', transform: scale < 1 ? `scale(${scale})` : undefined }}>
        {children}
      </div>
    </div>
  )
}

function Slide({ children, footer, pad = 40, slideId, noFooter, fit = true }: { children?: React.ReactNode; footer?: React.ReactNode; pad?: number; slideId?: string; noFooter?: boolean; fit?: boolean }) {
  const { advisorName, advisorPhone } = useContext(SlideEditor)
  return (
    <div className="pd-slide" data-slide={slideId} style={{
      width: '100%', maxWidth: 1120, aspectRatio: '297 / 210', background: '#fff', color: INK,
      boxShadow: '0 1px 2px rgba(12,32,53,0.04), 0 18px 50px -12px rgba(12,32,53,0.22)', borderRadius: 14,
      padding: `${pad}px 56px ${pad - 12}px`,
      display: 'flex', flexDirection: 'column', fontFamily: "'Sarabun', sans-serif", position: 'relative', overflow: 'hidden',
    }}>
      {fit && !noFooter ? <AutoFit>{children}</AutoFit> : children}
      {footer}
      {/* footer แบรนด์ + ที่ปรึกษา (ทุกสไลด์ ยกเว้นหน้าปก) */}
      {!noFooter && (
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${HAIR}`, paddingTop: 6, fontSize: 10, color: MUTED, letterSpacing: '0.01em' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, letterSpacing: '0.22em', color: INK }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: CY }} />WEALTHPRO
          </span>
          <span style={{ fontWeight: 500 }}>{[advisorName, advisorPhone].filter(Boolean).join('  ·  ')}</span>
        </div>
      )}
      {slideId && <OverlayLayer slideId={slideId} />}
    </div>
  )
}

/* ══════════════════════════ OverlayLayer + ElementBox ══════════════════════════ */
export function OverlayLayer({ slideId }: { slideId: string }) {
  const { editMode, snap, overlays, setEls } = useContext(SlideEditor)
  const [sel, setSel] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const els = overlays[slideId] ?? []
  // NOTE: hooks ทั้งหมดต้องอยู่เหนือ early-return นี้ (กัน "rendered more hooks")
  if (els.length === 0 && !editMode) return null

  const rect = () => boxRef.current?.getBoundingClientRect()
  const snapv = (v: number) => snap ? Math.round(v / SNAP) * SNAP : v
  const update = (id: string, patch: any) => setEls(slideId, els.map(e => e.id === id ? { ...e, ...patch } as SlideEl : e))
  const remove = (id: string) => { setEls(slideId, els.filter(e => e.id !== id)); setSel(null); setEditing(null) }
  // z-order: สลับลำดับใน array (ลำดับ = ลำดับการวาด)
  const reorder = (id: string, dir: -1 | 1) => {
    const i = els.findIndex(e => e.id === id); if (i < 0) return
    const j = i + dir; if (j < 0 || j >= els.length) return
    const a = [...els];[a[i], a[j]] = [a[j], a[i]]; setEls(slideId, a)
  }

  const addText = () => {
    const id = uid()
    setEls(slideId, [...els, { id, type: 'text', x: 32, y: 44, w: 36, text: 'ข้อความใหม่', size: 24, color: '#0f2a43', weight: 700, align: 'left' }])
    setSel(id)
  }
  const addImage = async (file?: File) => {
    if (!file) return
    try {
      const { src, w, h } = await downscaleImage(file)
      const r = rect(); const boxW = r?.width || 1120, boxH = r?.height || 630
      const wPct = Math.min(40, (w / boxW) * 100)
      const hPct = wPct * (h / w) * (boxW / boxH)   // รักษาอัตราส่วนภาพในพิกัด %
      const id = uid()
      setEls(slideId, [...els, { id, type: 'image', x: 30, y: 28, w: wPct, h: hPct, src }])
      setSel(id)
    } catch { /* ignore */ }
  }

  // ลาก
  const startDrag = (e: React.MouseEvent, el: SlideEl) => {
    if (!editMode) return
    e.stopPropagation(); setSel(el.id)
    const r = rect(); if (!r) return
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y
    const move = (ev: MouseEvent) => {
      update(el.id, { x: snapv(Math.max(0, Math.min(98, ox + ((ev.clientX - sx) / r.width) * 100))), y: snapv(Math.max(0, Math.min(98, oy + ((ev.clientY - sy) / r.height) * 100))) })
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  // ปรับขนาด (มุมขวาล่าง)
  const startResize = (e: React.MouseEvent, el: SlideEl) => {
    e.stopPropagation(); setSel(el.id)
    const r = rect(); if (!r) return
    const sx = e.clientX, sy = e.clientY, ow = el.w, oh = (el as any).h ?? 0
    const move = (ev: MouseEvent) => {
      const nw = snapv(Math.max(6, Math.min(100, ow + ((ev.clientX - sx) / r.width) * 100)))
      const patch: any = { w: nw }
      if (el.type === 'image') patch.h = Math.max(4, oh + ((ev.clientY - sy) / r.height) * 100)
      update(el.id, patch)
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const addBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: 'none', background: 'rgba(15,42,67,0.86)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }

  return (
    <div ref={boxRef} className={editMode ? '' : 'pd-overlay-static'} onMouseDown={() => { setSel(null); setEditing(null) }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
      {editMode && snap && (
        <div className="no-print" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(2,132,199,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(2,132,199,0.07) 1px, transparent 1px)`, backgroundSize: `${SNAP}% ${SNAP}%` }} />
      )}
      {editMode && (
        <div className="no-print" onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, pointerEvents: 'auto', zIndex: 40 }}>
          <button style={addBtn} onClick={addText}><TypeIcon size={13} /> ข้อความ</button>
          <button style={addBtn} onClick={() => fileRef.current?.click()}><ImagePlus size={13} /> รูปภาพ</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { addImage(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      )}
      {els.map(el => {
        const selected = editMode && sel === el.id
        const common: React.CSSProperties = {
          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`,
          pointerEvents: editMode ? 'auto' : 'none', cursor: editMode ? 'move' : 'default',
          outline: selected ? `2px solid ${CY}` : editMode ? '1px dashed rgba(2,132,199,0.4)' : 'none', outlineOffset: 2,
        }
        const isEditing = editMode && editing === el.id
        return (
          <div key={el.id} style={common} onMouseDown={e => { if (!isEditing) startDrag(e, el) }}
            onDoubleClick={e => { if (el.type === 'text') { e.stopPropagation(); setSel(el.id); setEditing(el.id) } }}>
            {el.type === 'text' ? (
              isEditing ? (
                <textarea value={el.text} onChange={e => update(el.id, { text: e.target.value })} onMouseDown={e => e.stopPropagation()} onBlur={() => setEditing(null)} onDragStart={e => e.preventDefault()} autoFocus
                  rows={Math.max(1, el.text.split('\n').length)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(2,132,199,0.06)', border: 'none', resize: 'none', outline: 'none', overflow: 'hidden',
                    fontFamily: 'inherit', fontSize: el.size, fontWeight: el.weight, color: el.color, textAlign: el.align, lineHeight: 1.3, cursor: 'text' }} />
              ) : (
                <div style={{ fontSize: el.size, fontWeight: el.weight, color: el.color, textAlign: el.align, lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{el.text || ' '}</div>
              )
            ) : (
              <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4, userSelect: 'none', transform: el.rot ? `rotate(${el.rot}deg)` : undefined }} />
            )}
            {selected && (
              <>
                {/* handle ย้าย */}
                <div onMouseDown={e => { e.stopPropagation(); setEditing(null); startDrag(e, el) }} title="ลากเพื่อย้าย"
                  style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 999, background: CY, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move' }}>
                  <GripVertical size={11} color="#fff" />
                </div>
                {/* handle ปรับขนาด */}
                <div onMouseDown={e => { e.stopPropagation(); startResize(e, el) }}
                  style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 3, background: CY, border: '2px solid #fff', cursor: 'nwse-resize' }} />
                <ElementToolbar el={el} onChange={p => update(el.id, p)} onRemove={() => remove(el.id)} onReorder={dir => reorder(el.id, dir)} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ElementToolbar({ el, onChange, onRemove, onReorder }: { el: SlideEl; onChange: (p: any) => void; onRemove: () => void; onReorder: (dir: -1 | 1) => void }) {
  const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer' }
  const sep = <span style={{ width: 1, background: 'var(--card-border)', margin: '2px 2px' }} />
  return (
    <div className="no-print" onMouseDown={e => e.stopPropagation()}
      style={{ position: 'absolute', left: 0, top: -40, display: 'flex', gap: 4, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 9, padding: 4, boxShadow: 'var(--shadow)', zIndex: 30, whiteSpace: 'nowrap' }}>
      {el.type === 'text' && (
        <>
          <button style={btn} title="เล็กลง" onClick={() => onChange({ size: Math.max(9, el.size - 2) })}>−</button>
          <span style={{ display: 'flex', alignItems: 'center', minWidth: 26, justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{el.size}</span>
          <button style={btn} title="ใหญ่ขึ้น" onClick={() => onChange({ size: Math.min(96, el.size + 2) })}>+</button>
          <button style={{ ...btn, color: el.weight >= 700 ? 'var(--cyan)' : 'var(--text-secondary)' }} title="ตัวหนา" onClick={() => onChange({ weight: el.weight >= 700 ? 400 : 800 })}><Bold size={14} /></button>
          {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Ic]) => (
            <button key={a} style={{ ...btn, color: el.align === a ? 'var(--cyan)' : 'var(--text-secondary)' }} onClick={() => onChange({ align: a })}><Ic size={14} /></button>
          ))}
          <input type="color" value={el.color} onChange={e => onChange({ color: e.target.value })} title="สี" style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--card-border)', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
        </>
      )}
      {el.type === 'image' && (
        <>
          <button style={btn} title="หมุนซ้าย" onClick={() => onChange({ rot: ((el.rot ?? 0) - 90) })}><RotateCcw size={14} /></button>
          <button style={btn} title="หมุนขวา" onClick={() => onChange({ rot: ((el.rot ?? 0) + 90) })}><RotateCw size={14} /></button>
        </>
      )}
      {sep}
      <button style={btn} title="ขึ้นหน้า (นำมาไว้ข้างหน้า)" onClick={() => onReorder(1)}><BringToFront size={14} /></button>
      <button style={btn} title="ลงหลัง (ส่งไว้ข้างหลัง)" onClick={() => onReorder(-1)}><SendToBack size={14} /></button>
      {sep}
      <button style={{ ...btn, color: '#f43f5e' }} title="ลบ" onClick={onRemove}><Trash2 size={14} /></button>
    </div>
  )
}

function SlideHead({ icon: Icon, kicker, title, accent = CY }: { icon: any; kicker: string; title: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, marginBottom: 22, flexShrink: 0 }}>
      {/* แถบ accent แนวตั้ง (editorial) */}
      <div style={{ width: 3.5, borderRadius: 3, background: accent, flexShrink: 0 }} />
      <div style={{ paddingTop: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={16} style={{ color: accent }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.22em', color: accent, textTransform: 'uppercase' }}>{kicker}</span>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: INK, margin: '4px 0 0', lineHeight: 1.12, letterSpacing: '-0.015em' }}>{title}</h2>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, color = INK }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '15px 18px', flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 13, bottom: 13, width: 2.5, borderRadius: 2, background: color, opacity: 0.9 }} />
      <div style={{ fontSize: 12.5, color: SUB, marginBottom: 6, fontWeight: 500, letterSpacing: '0.01em', paddingLeft: 9 }}>{label}</div>
      <div style={{ fontSize: 25, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1.05, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', paddingLeft: 9 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 4, paddingLeft: 9 }}>{sub}</div>}
    </div>
  )
}

/* หัวคอลัมน์รายคน */
function PersonHead({ name, tint = CY }: { name: string; tint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${HAIR}` }}>
      <span style={{ width: 30, height: 30, borderRadius: 999, background: `${tint}16`, color: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13.5, flexShrink: 0, boxShadow: `inset 0 0 0 1px ${tint}33` }}>{name.replace(/^คุณ/, '').charAt(0)}</span>
      <span style={{ fontSize: 17, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>{name}</span>
    </div>
  )
}

function FamilyRow({ label, value, color = INK }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, lineHeight: 1.45 }}>
      <span style={{ color: SUB, flexShrink: 0, minWidth: 62 }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function GoalTable({ title, rows, totalColor, pad = 9, fz = 14.5 }: { title: string; rows: { name: string; when: string; amount: number; cat: string }[]; totalColor: string; pad?: number; fz?: number }) {
  const total = rows.reduce((s, g) => s + g.amount, 0)
  const catColor: Record<string, string> = { retire: CY, edu: AM, ins: VI, manual: GR }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fz }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${LINE}` }}>
          <th style={{ textAlign: 'left', padding: `${pad}px 7px`, color: INK, fontWeight: 800, fontSize: fz + 1.5 }}>{title}</th>
          <th style={{ textAlign: 'left', padding: `${pad}px 7px`, color: SUB, fontWeight: 700, width: 220 }}>ระยะเวลาที่ต้องการ</th>
          <th style={{ textAlign: 'right', padding: `${pad}px 7px`, color: SUB, fontWeight: 700, width: 180 }}>จำนวนเงิน (บาท)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
            <td style={{ padding: `${pad}px 7px`, color: INK }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: catColor[g.cat] ?? GR, marginRight: 8 }} />{g.name}</td>
            <td style={{ padding: `${pad}px 7px`, color: SUB }}>{g.when}</td>
            <td style={{ padding: `${pad}px 7px`, textAlign: 'right', fontFamily: 'monospace', color: INK, fontWeight: 700 }}>{fmt(g.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ borderTop: `2px solid ${LINE}` }}>
          <td colSpan={2} style={{ padding: `${pad + 1}px 7px`, fontWeight: 800, color: INK }}>รวม</td>
          <td style={{ padding: `${pad + 1}px 7px`, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: totalColor }}>{fmt(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

/* ระยะห่างบรรทัดตารางเป้าหมายแบบยืดหยุ่น — ยิ่งแถวเยอะ ยิ่งบีบให้พอดี 1 หน้า
 * (นับหัวตาราง + แถวรวม ของแต่ละตารางเป็น +2 แถวต่อตาราง) */
function goalDensity(totalRows: number): { pad: number; fz: number } {
  if (totalRows <= 11) return { pad: 9, fz: 14.5 }
  if (totalRows <= 14) return { pad: 6, fz: 13 }
  if (totalRows <= 18) return { pad: 4, fz: 12 }
  return { pad: 2.5, fz: 11 }
}

function TwoCol({ children, grow = false }: { children: React.ReactNode; grow?: boolean }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start', ...(grow ? { flex: 1, minHeight: 0 } : {}) }}>{children}</div>
}

/* กล่องคำแนะนำของที่ปรึกษา + ปุ่มแก้ไข/ซ่อน */
function AdvisorComment({ slideKey, label, comment, hidden, onEdit, onToggleHide }: {
  slideKey: string; label: string; comment?: string; hidden?: boolean
  onEdit: (k: string) => void; onToggleHide: (k: string) => void
}) {
  if (hidden) return (
    <div className="no-print" style={{ marginTop: 16, paddingTop: 10, flexShrink: 0 }}>
      <button onClick={() => onToggleHide(slideKey)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'none', border: `1px dashed ${MUTED}`, borderRadius: 999, color: MUTED, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        <Plus size={12} /> แสดงคำแนะนำที่ปรึกษา
      </button>
    </div>
  )
  return (
    <div style={{ marginTop: 16, paddingTop: 12, flexShrink: 0, borderTop: `1px solid ${HAIR}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: SUB, textTransform: 'uppercase' }}><span style={{ width: 12, height: 2, borderRadius: 2, background: CY }} />คำแนะนำของที่ปรึกษา</div>
        <div className="no-print" style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(slideKey)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', background: '#f0fdfa', border: `1px solid ${CY}`, borderRadius: 999, color: CY, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Pencil size={12} /> {comment ? 'แก้ไข' : 'เขียน'}
          </button>
          <button onClick={() => onToggleHide(slideKey)} title="ซ่อนคำแนะนำหน้านี้"
            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'none', border: `1px solid ${LINE}`, borderRadius: 999, color: MUTED, cursor: 'pointer' }}>
            <EyeOff size={13} />
          </button>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: comment ? INK : MUTED, lineHeight: 1.55, whiteSpace: 'pre-wrap', minHeight: 62, background: PAPER, border: `1px solid ${LINE}`, borderLeft: `3px solid ${comment ? CY : LINE}`, borderRadius: 10, padding: '9px 14px', transition: 'border-color .15s' }}>
        {comment || `บันทึกคำแนะนำสำหรับ${label}...`}
      </div>
    </div>
  )
}

function CommentDialog({ title, value, onSave, onClose }: { title: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [text, setText] = useState(value)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const draggingRef = useRef(false)   // true ระหว่าง/ทันทีหลังลาก — กัน backdrop onClick ปิดกล่องหลังลาก
  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const start = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }
    draggingRef.current = false
    const move = (ev: PointerEvent) => {
      draggingRef.current = true
      setPos({ x: start.ox + (ev.clientX - start.sx), y: start.oy + (ev.clientY - start.sy) })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setTimeout(() => { draggingRef.current = false }, 0)   // เคลียร์หลัง click event ผ่านไปแล้ว
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  return (
    <div className="no-print" onClick={() => { if (!draggingRef.current) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 784, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transform: `translate(${pos.x}px, ${pos.y}px)`, boxShadow: 'var(--shadow)' }}>
        <div onPointerDown={onDragStart} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'move', userSelect: 'none', touchAction: 'none' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><GripVertical size={16} style={{ color: 'var(--text-muted)' }} />คำแนะนำ · {title}</h3>
          <button onClick={onClose} onMouseDown={e => e.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} autoFocus rows={10}
          placeholder="เขียนคำแนะนำ/ข้อสังเกตของแผนด้านนี้..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 9, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
          <button onClick={() => { onSave(text); onClose() }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 9, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Check size={15} /> บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

/* เกจครึ่งวงกลม (Health Score) */
function HealthGauge({ score, label, size = 200 }: { score: number; label: string; size?: number }) {
  const p = Math.max(0, Math.min(100, score)) / 100
  const r = 90, cx = 110, cy = 110
  const a0 = Math.PI, a1 = Math.PI * (1 - p)
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
  const large = p > 0.5 ? 1 : 0
  const col = score >= 75 ? GR : score >= 50 ? CY : score >= 30 ? AM : RD
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size * 0.62} viewBox="0 0 220 130">
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#eef2f6" strokeWidth={18} strokeLinecap="round" />
        <path d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={col} strokeWidth={18} strokeLinecap="round" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={40} fontWeight={800} fill={col} fontFamily="monospace">{Math.round(score)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={13} fill={SUB}>/ 100</text>
      </svg>
      <div style={{ fontSize: 15, fontWeight: 800, color: col, marginTop: -4 }}>{label}</div>
    </div>
  )
}

function GoalBar({ rows, height = 210 }: { rows: { name: string; needed: number; have: number }[]; height?: number }) {
  if (rows.length === 0) return <Empty text="ยังไม่มีข้อมูลเพียงพอ" />
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.map(r => ({ name: r.name, 'ต้องการ': Math.round(r.needed), 'มีอยู่': Math.round(r.have) }))} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={HAIR} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: SUB }} axisLine={{ stroke: LINE }} tickLine={false} />
          <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 11, fill: MUTED }} width={44} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar isAnimationActive={false} dataKey="ต้องการ" fill="#f59e0b" radius={[5, 5, 0, 0]} maxBarSize={90} />
          <Bar isAnimationActive={false} dataKey="มีอยู่" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={90} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ReadyPill({ pct: p }: { pct: number }) {
  const col = p >= 100 ? GR : p >= 60 ? CY : p >= 30 ? AM : RD
  return <span style={{ fontSize: 13, fontWeight: 800, color: col, background: `${col}14`, border: `1px solid ${col}55`, borderRadius: 999, padding: '3px 12px' }}>ความพร้อม {p}%</span>
}

function Empty({ text }: { text: string }) {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 14, textAlign: 'center', padding: 20 }}>{text}</div>
}

/* พาย + legend (light) */
function MiniPie({ data, height = 190, radius = [44, 74] }: { data: { name: string; value: number }[]; height?: number; radius?: [number, number] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total <= 0) return <Empty text="ไม่มีข้อมูล" />
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={radius[0]} outerRadius={radius[1]} paddingAngle={1.5} stroke="#fff" strokeWidth={2} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`} labelLine={false}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', justifyContent: 'center', marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SUB }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />{d.name} <b style={{ color: INK }}>{pct(d.value, total)}%</b>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════ Deck ══════════════════════════ */

export default function PresentationDeck({ title, pres, onComment, onToggleHide,
  editMode, overlays, onOverlayChange, customSlides, thankYouPhoto, onThankYouPhoto, advisorBio, onAddSlide, onDelSlide, onMoveSlide }: {
  title: string
  pres: Record<string, { comment?: string; hidden?: boolean; off?: boolean }>
  onComment: (key: string, text: string) => void
  onToggleHide: (key: string) => void
  editMode: boolean
  overlays: Record<string, SlideEl[]>
  onOverlayChange: (slideId: string, els: SlideEl[]) => void
  customSlides: CustomSlide[]
  thankYouPhoto?: string
  onThankYouPhoto?: (src: string) => void
  advisorBio?: string
  onAddSlide: () => void
  onDelSlide: (id: string) => void
  onMoveSlide: (id: string, dir: -1 | 1) => void
}) {
  const thankPhotoRef = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<{ key: string; title: string } | null>(null)
  const [snap, setSnap] = useState(true)

  const { data: client } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: advisor } = useQuery({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const { data: rSelf } = useQuery({ queryKey: ['financial-ratios', 'client'], queryFn: () => api.get('/financial-ratios', { params: { person: 'client' } }).then(r => r.data), retry: false })
  const { data: rSpouse } = useQuery({ queryKey: ['financial-ratios', 'spouse'], queryFn: () => api.get('/financial-ratios', { params: { person: 'spouse' } }).then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: marketData } = useQuery({ queryKey: ['market-data'], queryFn: () => api.get('/market-data').then(r => r.data), staleTime: 5 * 60 * 1000, retry: 1 })
  const { data: rebalQ } = useQuery({ queryKey: ['rebalance-plan'], queryFn: () => api.get('/rebalance-plan').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: estatePlan } = useQuery({ queryKey: ['estate-plan'], queryFn: () => api.get('/estate-plan').then(r => r.data), retry: false })
  const { data: cfPlan } = useQuery({ queryKey: ['cashflow-plan'], queryFn: () => api.get('/cashflow-plan').then(r => r.data), retry: false })
  const { data: actionItems = [] } = useQuery<any[]>({ queryKey: ['action-items'], queryFn: () => api.get('/action-items').then(r => Array.isArray(r.data) ? r.data : (r.data?.items ?? [])), retry: false })
  const { data: expenses = [] } = useQuery<any[]>({ queryKey: ['expenses'], queryFn: () => api.get('/expenses').then(r => r.data), retry: false })
  const { data: taxPlan } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: eduPlan } = useQuery<any[]>({ queryKey: ['education-plan'], queryFn: () => api.get('/education-plan').then(r => r.data), retry: false })

  const retSelf = useRetirementReadiness('client')
  const retSpouse = useRetirementReadiness('spouse')
  const insSelf = useInsuranceReadiness('client')
  const insSpouse = useInsuranceReadiness('spouse')
  const covSelf = useInsuranceCoverage('self')
  const covSpouse = useInsuranceCoverage('spouse')
  const edu = useEducationReadiness()

  // ── แผนปฏิบัติการ: แบ่งหน้าอัตโนมัติ (เว้นที่ให้คอมเมนต์) ──
  const PER_PAGE_ACTION = 13
  // รวมแผนดำเนินการจากทุกด้าน (sub-plan rows) → บรรทัด: แผน · จำนวนเงิน · กำหนดการ · ผู้รับผิดชอบ
  const ACTION_CAT_COLOR: Record<string, string> = { liquidity: '#06b6d4', savings: '#10b981', debt: '#ef4444', investment: '#10b981', education: '#ffb800', insurance: '#3b82f6', retirement: '#00cfc1', tax: '#0ea5e9', estate: '#8b5cf6', other: '#8b9198' }
  const actionLines = useMemo(() => {
    const its: any[] = Array.isArray(actionItems) ? actionItems : ((actionItems as any)?.items ?? [])
    const ownerTh = (o: string) => o === 'client' ? 'ลูกค้า' : o === 'advisor' ? 'ที่ปรึกษา' : o === 'spouse' ? 'คู่สมรส' : (o || '—')
    const out: { plan: string; amount: number; schedule: string; owner: string; color: string; done: boolean }[] = []
    for (const it of its) {
      const rows = Array.isArray(it.subPlan) ? it.subPlan : []
      const color = ACTION_CAT_COLOR[it.category] || ACTION_CAT_COLOR.other
      const done = it.status === 'done' || !!it.completedAt
      if (!rows.length) { out.push({ plan: it.title, amount: toNum(it.target), schedule: it.dueDate || '', owner: ownerTh(it.owner), color, done }); continue }
      for (const r of rows) {
        const plan = String(r?.desc || r?.method || r?.who || '').trim()
        const amount = toNum(r?.amount ?? r?.premium)
        if (!plan && amount <= 0 && !r?.schedule) continue
        out.push({ plan: plan || it.title, amount, schedule: r?.schedule || '', owner: String(r?.owner || '').trim() || ownerTh(it.owner), color, done: !!r?.done || done })
      }
    }
    return out
  }, [actionItems])
  const actionPages = useMemo(() => {
    if (actionLines.length === 0) return [[]] as typeof actionLines[]
    const out: typeof actionLines[] = []
    for (let i = 0; i < actionLines.length; i += PER_PAGE_ACTION) out.push(actionLines.slice(i, i + PER_PAGE_ACTION))
    return out
  }, [actionLines])
  const actionIds = actionPages.map((_, k) => (k === 0 ? 'action' : `action-${k + 1}`))

  // ── ไทม์ไลน์แผนดำเนินการ: รวมทุก sub-plan ที่มี "กำหนดการ" เรียงตามวันที่ ──
  const timelineItems = useMemo(() => {
    const its: any[] = Array.isArray(actionItems) ? actionItems : ((actionItems as any)?.items ?? [])
    const out: { date: Date; title: string; desc: string; amount: number; category: string; accent: string }[] = []
    its.forEach((a: any) => {
      if (!SUBPLAN_COLS[a.category]) return
      const rows = Array.isArray(a.subPlan) ? a.subPlan : []
      rows.forEach((r: any) => {
        if (!r?.schedule) return
        const d = new Date(r.schedule); if (isNaN(d.getTime())) return
        out.push({
          date: d, title: a.title,
          desc: r.desc || r.method || r.who || '',
          amount: toNum(r.amount ?? r.premium ?? r.sumInsured ?? 0),
          category: a.category, accent: SUBPLAN_ACCENT[a.category] ?? GR,
        })
      })
    })
    out.sort((x, y) => x.date.getTime() - y.date.getTime())
    return out
  }, [actionItems])

  const clientFull = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || 'ลูกค้า'
  const spouseFull = [client?.spouseProfile?.firstName, client?.spouseProfile?.lastName].filter(Boolean).join(' ')
  const selfName = `คุณ${client?.firstName || clientFull}`
  const spouseName = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
  const hasSpouse = !!client?.spouseProfile?.firstName || !!spouseFull
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  const selfAge = client?.birthDate ? new Date().getFullYear() - new Date(client.birthDate).getFullYear() : null

  // สรุปสุขภาพจาก healthInfo (smoke/alcohol + โรคประจำตัว/ร้ายแรง)
  const healthSummary = (hi: any): string => {
    if (!hi) return ''
    const cond: string[] = []
    if (hi.chronic?.has) cond.push(`โรคประจำตัว${hi.chronic.detail ? ': ' + hi.chronic.detail : ''}`)
    if (hi.severeIllness?.has) cond.push(`โรคร้ายแรง${hi.severeIllness.detail ? ': ' + hi.severeIllness.detail : ''}`)
    const base = cond.length ? cond.join(' · ') : 'สุขภาพแข็งแรง ไม่มีโรคประจำตัว'
    return [base, [hi.smoke, hi.alcohol].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')
  }
  // รายได้ทุกประเภทจาก incomeSources: amount = รายเดือน ยกเว้น "โบนัส" = รายปี (หลายแถวได้: เงินเดือนหลัก/ที่ปรึกษา/ลงทุน/ค่าเช่า/ปันผล ฯลฯ)
  const incomeList = (sources: any, fallbackSalary = 0): { label: string; amount: number; yearly: number; isBonus: boolean }[] => {
    const arr = (Array.isArray(sources) ? sources : []).map((r: any) => {
      const amt = toNum(r?.amount)
      const isBonus = isAnnualInc(r)
      const label = r?.source ? `${r.label} · ${r.source}` : (r?.label || 'รายได้')
      return { label, amount: amt, yearly: incAnnual(r), isBonus }
    }).filter((r: any) => r.amount > 0)
    if (arr.length === 0 && fallbackSalary > 0) arr.push({ label: 'เงินเดือน', amount: fallbackSalary, yearly: fallbackSalary * 12, isBonus: false })
    return arr
  }
  const hobbyOf = (hi: any): string => hi?.hobby?.has ? (hi.hobby.detail?.trim() || 'มี') : ''
  const familyCards = [
    { name: selfName, age: selfAge, status: client?.maritalStatus, occ: client?.occupation || client?.jobTitle, incomes: incomeList(client?.incomeSources, toNum(client?.salary)), health: healthSummary(client?.healthInfo), hobby: hobbyOf(client?.healthInfo), tint: CY },
    ...(hasSpouse ? [{ name: spouseName, age: client?.spouseAge, status: client?.maritalStatus, occ: client?.spouseProfile?.occupation || client?.spouseOccupation || client?.spouseProfile?.jobTitle, incomes: incomeList(client?.spouseIncomeSources, toNum(client?.spouseJobs?.[0]?.salary) || toNum(client?.spouseIncome)), health: healthSummary(client?.spouseProfile?.healthInfo), hobby: hobbyOf(client?.spouseProfile?.healthInfo), tint: VI }] : []),
  ].map(p => ({ ...p, totalYear: p.incomes.reduce((s, r) => s + r.yearly, 0) }))

  // บิดา/มารดา (ผู้อยู่ในอุปการะ) จาก parentsInfo + fatherAge/motherAge ของแต่ละคน
  const parentHealth = (h: string | undefined, ch: any) => [h, ch?.has ? `โรคประจำตัว${ch.detail ? ': ' + ch.detail : ''}` : ''].filter(Boolean).join(' · ')
  const mkParents = (src: any, owner: string) => {
    const pi = src?.parentsInfo || {}
    return [
      { rel: 'บิดา', name: pi.fatherName, age: src?.fatherAge, health: parentHealth(pi.fatherHealth, pi.fatherChronic), owner },
      { rel: 'มารดา', name: pi.motherName, age: src?.motherAge, health: parentHealth(pi.motherHealth, pi.motherChronic), owner },
    ].filter(p => toNum(p.age) > 0 || (p.name && p.name.trim()))
  }
  const dependents = [
    ...mkParents(client, selfName),
    ...(hasSpouse ? mkParents(client?.spouseProfile, spouseName) : []),
  ]
  const careExpense = toNum(client?.parentCareExpense) + (hasSpouse ? toNum(client?.spouseProfile?.parentCareExpense) : 0)

  // รายการ person สำหรับ layout คู่กัน
  const people = [
    { key: 'self' as Person, name: selfName, ratios: rSelf, ret: retSelf, ins: insSelf, cov: covSelf, tint: CY },
    ...(hasSpouse ? [{ key: 'spouse' as Person, name: spouseName, ratios: rSpouse, ret: retSpouse, ins: insSpouse, cov: covSpouse, tint: VI }] : []),
  ]

  // สไลด์ลงทุน — สัดส่วนพอร์ต + มูลค่า ณ เกษียณ 3 สมมุติฐาน (Monte Carlo P10/P50/P90) ต่อคน
  const invPeople = useMemo(() => {
    const build = (isSelf: boolean) => {
      const key = isSelf ? 'self' : 'spouse'
      const src: any = isSelf ? invProfile : (invProfile?.spouseData ?? {})
      const assets: any[] = src?.investmentAssets ?? []
      const groups: Record<string, number> = {}
      assets.forEach(a => { const v = toNum(a.currentValue); if (v > 0) groups[a.assetClass || 'อื่นๆ'] = (groups[a.assetClass || 'อื่นๆ'] || 0) + v })
      const allocation = Object.entries(groups).map(([name, value]) => ({ name, value }))
      const total = allocation.reduce((s, a) => s + a.value, 0)
      const currentAge = isSelf ? selfAge : (client?.spouseAge ?? null)
      const retirementAge = (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? retPlan?.[key]?.retirementAge ?? 60
      const assetReturn = (a: any): number | null => {
        let r = annualizedReturn(toNum(a.investAmount), toNum(a.currentValue), a.investDate)
        if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
        return r
      }
      let wr = 0, cv = 0
      assets.forEach(a => { const v = toNum(a.currentValue), r = assetReturn(a); if (r !== null && v > 0) { cv += v; wr += r * v } })
      const portfolioReturn = cv > 0 ? wr / cv : null
      const riskSrc = isSelf ? profile : profile?.spouseRisk
      const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
      const tier: 'low' | 'mid' | 'high' = /สูง/.test(riskLabel) ? 'high' : /กลาง|ปานกลาง/.test(riskLabel) ? 'mid' : /ต่ำ/.test(riskLabel) ? 'low' : ((portfolioReturn ?? 0) >= 8 ? 'high' : (portfolioReturn ?? 0) >= 4 ? 'mid' : 'low')
      const sigma = { low: 6, mid: 11, high: 16 }[tier]
      let atRet: { p10: number; p50: number; p90: number } | null = null
      if (currentAge !== null && portfolioReturn !== null && total > 0 && retirementAge > currentAge) {
        const mu = portfolioReturn / 100, sd = sigma / 100, years = retirementAge - currentAge
        const rng = mulberry32((Math.round(total) ^ (Math.round(portfolioReturn * 100) << 3) ^ (sigma << 1) ^ 0x9e3779b9) >>> 0)
        const finals: number[] = []
        for (let p = 0; p < 1000; p++) {
          let v = total
          for (let y = 1; y <= years; y++) {
            let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
            v *= Math.exp((mu - (sd * sd) / 2) + sd * z)
          }
          finals.push(v)
        }
        const srt = finals.sort((a, b) => a - b)
        atRet = { p10: percentile(srt, 0.10), p50: percentile(srt, 0.50), p90: percentile(srt, 0.90) }
      }
      return { key, allocation, total, retirementAge, portfolioReturn, atRet }
    }
    return {
      self: build(true),
      spouse: hasSpouse ? build(false) : null,
    }
  }, [client, profile, invProfile, selfAge, retPlan, hasSpouse])

  // โครงสร้างกระแสเงินสด/ภาษี ต่อคน
  const expAnnual = (prefix: string, pkey: Person, exclude?: string) => {
    const ek = pkey === 'self' ? 'client' : 'spouse'
    return (expenses ?? []).filter(e => String(e.category).startsWith(prefix) && e.category !== exclude && (e.person === ek || e.person === 'shared'))
      .reduce((s, e) => { const m = toMonthly(toNum(e.amount), e.frequency) * 12; return s + (e.person === 'shared' ? m / 2 : m) }, 0)
  }
  // ── มรดก (ลูกค้าหลัก) ──
  // ── งบการเงินล่วงหน้า (ลูกค้าหลัก) — อายุปัจจุบัน → อายุเกษียณ (บีบลง 1 สไลด์) ──
  const forward = useMemo(() => {
    const data: CashflowData | null = cfPlan?.self ?? null
    const curAge = selfAge
    const retAge = profile?.retirementAgeSelf ?? 60
    if (!data || curAge == null || retAge <= curAge) return null
    // ไม่รวมปีที่เกษียณ (ทุกรายการสิ้นสุดที่อายุเกษียณ − 1 คอลัมน์ปีเกษียณจึงว่างทั้งคอลัมน์)
    const ages: number[] = []
    for (let a = curAge; a < retAge; a++) ages.push(a)
    const lineRows = (lines: CfLine[] | undefined) => (lines ?? [])
      .map(l => ({ label: l.label || '—', vals: ages.map(a => lineAt(l, a, retAge)) }))
      .filter(r => r.vals.some(v => v > 0))
    const sumRow = (lines: CfLine[] | undefined) => ages.map(a => sumAt(lines ?? [], a, retAge))
    const income = [...(data.incomeWork ?? []), ...(data.incomeAsset ?? [])]
    const tax = ages.map(a => { try {
      const tb = calc(buildTaxState(data, a, client, retAge, (taxPlan?.self as TaxState) ?? null))
      const ov = data.taxOv?.[String(a)]
      if (ov && (ov.exp != null || ov.ded != null)) {
        const expD = ov.exp ?? tb.expD
        const ded = ov.ded ?? (tb.allD - tb.expD)
        return calcTax(Math.max(0, tb.ti - expD - ded))
      }
      return tb.netTax
    } catch { return 0 } })
    return {
      ages,
      incomeLines: lineRows(income), incomeTotal: sumRow(income),
      fixedLines: lineRows(data.expFixed), fixedTotal: sumRow(data.expFixed),
      varLines: lineRows(data.expVar), varTotal: sumRow(data.expVar),
      savLines: lineRows(data.expSaving), savTotal: sumRow(data.expSaving),
      goalLines: lineRows([...(data.goalInsurance ?? []), ...(data.goalEducation ?? []), ...(data.goalRetire ?? [])]),
      goalTotal: sumRow([...(data.goalInsurance ?? []), ...(data.goalEducation ?? []), ...(data.goalRetire ?? [])]),
      tax,
    }
  }, [cfPlan, selfAge, profile, client, taxPlan])

  // การปรับสัดส่วนการลงทุน — พอร์ตที่เลือก + จำลองเปรียบเทียบ (ตรรกะเดียวกับแท็บปรับสัดส่วน)
  const rebalance = useMemo(() => {
    const assetsMk = applyMarketData(DEFAULT_ASSETS, marketData)
    const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
    const ports = PORTFOLIO_SETS.map(set => {
      const results = set.options.map(o => computePortfolio(o.weights, assetsMk, matrix))
      const bi = results.reduce((b, r, i) => r.sharpe > results[b].sharpe ? i : b, 0)
      return { id: set.id, label: set.label, color: set.color, weights: set.options[bi].weights, ...results[bi] }
    })
    const pct = (arr: number[], q: number) => { const idx = (arr.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo) }
    const build = (who: 'self' | 'spouse') => {
      const invSrc: any = who === 'self' ? (invProfile ?? {}) : (invProfile?.spouseData ?? {})
      const assets: any[] = invSrc?.investmentAssets ?? []
      const totalValue = assets.reduce((x: number, a: any) => x + toNum(a.currentValue), 0)
      const sel = ports.find(p2 => p2.id === rebalQ?.[who]?.tier) ?? null
      if (!sel || totalValue <= 0) return null
      let wr = 0, cv = 0
      assets.forEach((a: any) => {
        const val = toNum(a.currentValue)
        let r: number | null = null
        const cost = toNum(a.investAmount)
        if (cost > 0 && val > 0 && a.investDate) {
          const st = new Date(a.investDate)
          if (!isNaN(st.getTime())) { const yrs = (Date.now() - st.getTime()) / (365.25 * 24 * 3600 * 1000); if (yrs >= 1 / 365.25) r = (Math.pow(val / cost, 1 / yrs) - 1) * 100 }
        }
        if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
        if (r !== null && val > 0) { cv += val; wr += r * val }
      })
      const curReturn = cv > 0 ? wr / cv : 0
      const riskSrc = who === 'self' ? profile : profile?.spouseRisk
      const rl = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
      const curSd = /สูง/.test(rl) ? 16 : /กลาง|ปานกลาง/.test(rl) ? 11 : /ต่ำ/.test(rl) ? 6 : (curReturn >= 8 ? 16 : curReturn >= 4 ? 11 : 6)
      const curAge = (who === 'self' ? selfAge : client?.spouseAge) ?? 45
      const lifeExp = (who === 'self' ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? 85
      const retAge = (who === 'self' ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
      const years = Math.max(1, lifeExp - curAge)
      const sim = (mu0: number, sd0: number, seed: number) => {
        const mu = mu0 / 100, sd = sd0 / 100
        const rng = mulberry32(seed >>> 0 || 1)
        const byYear: number[][] = Array.from({ length: years + 1 }, () => [])
        for (let k = 0; k < 600; k++) {
          let v = totalValue
          byYear[0].push(v)
          for (let y = 1; y <= years; y++) {
            let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
            const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
            v *= Math.exp((mu - sd * sd / 2) + sd * z)
            byYear[y].push(v)
          }
        }
        return byYear.map(arr => { const so = arr.slice().sort((a, b) => a - b); return { p10: pct(so, 0.1), p50: pct(so, 0.5), p90: pct(so, 0.9) } })
      }
      const seedB = (Math.round(totalValue) ^ (years << 4)) >>> 0
      const cur = sim(curReturn, curSd, seedB ^ 0x1111)
      const nw = sim(sel.ret, sel.sigma, seedB ^ 0x2222)
      const rows = cur.map((c, i) => ({ age: curAge + i, พอร์ตเดิม: Math.round(c.p50), พอร์ตใหม่: Math.round(nw[i].p50), band: [Math.round(nw[i].p10), Math.round(nw[i].p90)] as [number, number] }))
      const rIdx = Math.min(Math.max(0, retAge - curAge), years)
      return { sel, totalValue, curReturn, curSd, retAge, rows, curAt: cur[rIdx].p50, newAt: nw[rIdx].p50 }
    }
    return { self: build('self'), spouse: hasSpouse ? build('spouse') : null }
  }, [invProfile, marketData, rebalQ, profile, client, selfAge, hasSpouse])

  // มรดก 2 กรณี: ลูกค้าเสียชีวิต / คู่สมรสเสียชีวิต (สูตรเดียวกัน สลับกองมรดก+ผู้รอดชีวิต)
  const estate = useMemo(() => {
    const build = (who: 'self' | 'spouse') => {
      const inputs: any = estatePlan?.[who] ?? {}
      const netWorth = toNum((who === 'self' ? rSelf : rSpouse)?.summary?.netWorth)
      const married = /สมรส/.test(String(client?.maritalStatus ?? '')) || hasSpouse
      const survivorName = who === 'self' ? spouseName : selfName
      const spouseIsHeir = !!inputs.spouseAlive && married
      const spouseHalf = spouseIsHeir ? netWorth * (toNum(inputs.maritalAssetPct ?? 100) / 100) / 2 : 0
      const estateVal = Math.max(0, netWorth - spouseHalf)
      const children: any[] = client?.children ?? []
      const parentsAlive = (inputs.fatherAlive ? 1 : 0) + (inputs.motherAlive ? 1 : 0)
      const wishes: any[] = inputs.wishes ?? []
      const wishTotal = wishes.reduce((s, w) => s + (Number(w.pct) || 0), 0)
      const useWill = !!inputs.hasWill && wishes.length > 0 && wishTotal > 0
      const THRESH = 100_000_000
      const heirTax = (share: number, rel: string) => rel === 'spouse' ? 0 : Math.max(0, share - THRESH) * (rel === 'lineal' ? 0.05 : 0.10)
      let taxHeirs: { name: string; share: number; rel: string }[]
      if (useWill) {
        taxHeirs = wishes.filter(w => (Number(w.pct) || 0) > 0).map(w => ({ name: w.name || 'ผู้รับ', share: estateVal * (Number(w.pct) || 0) / 100, rel: w.rel || 'lineal' }))
      } else {
        const shares = children.length + (spouseIsHeir ? 1 : 0) + parentsAlive
        const each = shares > 0 ? estateVal / shares : estateVal
        taxHeirs = []
        children.forEach((c, i) => taxHeirs.push({ name: c.name || `บุตรคนที่ ${i + 1}`, share: each, rel: 'lineal' }))
        if (inputs.fatherAlive) taxHeirs.push({ name: 'บิดา', share: each, rel: 'lineal' })
        if (inputs.motherAlive) taxHeirs.push({ name: 'มารดา', share: each, rel: 'lineal' })
        if (spouseIsHeir) taxHeirs.push({ name: survivorName, share: each, rel: 'spouse' })
      }
      const totalTax = taxHeirs.reduce((s, h) => s + heirTax(h.share, h.rel), 0)
      return { estateVal, useWill, taxHeirs, totalTax, hasWill: !!inputs.hasWill, willType: inputs.willType }
    }
    return { self: build('self'), spouse: hasSpouse ? build('spouse') : null }
  }, [estatePlan, rSelf, rSpouse, client, hasSpouse, selfName, spouseName])

  // มูลค่ากองทุนเกษียณตามอายุ (สะสม→ถอน) ต่อคน จาก projectionRows
  const retChart = useMemo(() => {
    const val = (r: any) => Math.round(r.phase === 'accumulation' ? (r.totalAccum ?? 0) : (r.closeBalance ?? 0))
    const map = new Map<number, any>()
    const add = (rows: any[] | undefined, key: string) => (rows ?? []).forEach((r: any) => { const o = map.get(r.age) || { age: r.age }; o[key] = val(r); map.set(r.age, o) })
    // เส้นประ (ไม่ออมเพิ่ม): ตัดเส้นที่ 0 เมื่อเงินหมด แล้วคืน "อายุที่เงินหมด"
    const addDeplete = (rows: any[] | undefined, key: string): number | null => {
      let dep: number | null = null
      ;(rows ?? []).forEach((r: any) => {
        const o = map.get(r.age) || { age: r.age }
        if (dep == null) {
          const v = val(r)
          if (r.phase === 'retirement' && v <= 0) { o[key] = 0; dep = r.age }   // จุดเงินหมด = 0 แล้วหยุด (ปีถัดไปเว้นว่าง)
          else o[key] = Math.max(0, v)
        }
        map.set(r.age, o)
      })
      return dep
    }
    add(retSelf?.projectionRows, 'self')
    const depSelf = addDeplete(retSelf?.projectionRowsNoSave, 'selfNo')
    let depSpouse: number | null = null
    if (hasSpouse) { add(retSpouse?.projectionRows, 'spouse'); depSpouse = addDeplete(retSpouse?.projectionRowsNoSave, 'spouseNo') }
    return { data: [...map.values()].sort((a, b) => a.age - b.age), depSelf, depSpouse }
  }, [retSelf, retSpouse, hasSpouse])

  // กราฟเงินออมสะสมทุนการศึกษา 3 สถาบัน (บุตรคนแรก) — reuse buildEduChart
  const eduChart = useMemo(() => {
    const children: any[] = client?.children ?? []
    if (children.length === 0) return null
    const c0 = children[0]
    const age = toNum(c0.age)
    const setting: ChildSetting = (Array.isArray(eduPlan) && eduPlan[0]) ? eduPlan[0] : { type: 'private', savingYears: 10, includeMaster: false, excludedLevels: [] }
    const res = buildEduChart({ age, setting, eduCosts: profile?.educationCosts ?? {}, inflationPct: toNum(profile?.educationInflation ?? 5), ratePct: toNum(profile?.educationFundReturn ?? 4), incomeGrowthPct: toNum(client?.salaryIncreaseRate) })
    return { ...res, childName: c0.name || 'บุตร', childCount: children.length, savingYears: Math.max(1, setting.savingYears) }
  }, [client, eduPlan, profile])

  // เป้าหมายทางการเงินทั้งหมด: กรอกเอง (financialGoals) + เกษียณ + ทุนการศึกษาบุตร
  const goalItems = useMemo(() => {
    const items: { name: string; when: string; amount: number; cat: string; owner?: string }[] = []
    // กลุ่มเป้าหมายที่กรอกเอง: 3 ด้าน (ประกัน/การศึกษา/เกษียณ) + 3 ระยะเวลา
    const groups: { k: string; fallback: string }[] = [
      { k: 'insurance', fallback: 'ความเสี่ยง & ประกัน' },
      { k: 'education', fallback: 'ทุนการศึกษาบุตร' },
      { k: 'retirement', fallback: 'การเกษียณ' },
      { k: 'short', fallback: 'ระยะสั้น (≤3 ปี)' },
      { k: 'medium', fallback: 'ระยะกลาง (3–7 ปี)' },
      { k: 'long', fallback: 'ระยะยาว (>7 ปี)' },
    ]
    const pushGoals = (g: any, owner: string) => groups.forEach(grp => (g?.[grp.k] ?? []).forEach((r: any) => {
      if (!r?.name?.trim()) return
      const td = r.targetDate ? String(r.targetDate).trim() : ''
      const when = td ? (/^\d+$/.test(td) ? `ภายใน ${td} ปี` : td) : grp.fallback
      items.push({ name: r.name, when, amount: toNum(r.targetAmount), cat: 'manual', owner })
    }))
    const fg = client?.financialGoals || {}
    if (fg.self || fg.spouse) { pushGoals(fg.self, 'self'); pushGoals(fg.spouse, 'spouse') } else pushGoals(fg, 'self')
    // เกษียณ (ต่อคน)
    people.forEach(p => {
      if (p.ret && p.ret.needed > 0) {
        const ra = (p.key === 'self' ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? retPlan?.[p.key]?.retirementAge
        items.push({ name: `เกษียณอายุ · ${p.name}`, when: ra ? `เมื่ออายุ ${ra} ปี` : 'ตามแผนเกษียณ', amount: p.ret.needed, cat: 'retire' })
      }
    })
    // ทุนการศึกษาบุตร
    if (edu && edu.totalNominal > 0) items.push({ name: `ทุนการศึกษาบุตร (${edu.childCount} คน)`, when: 'ตามช่วงวัยการศึกษา', amount: edu.totalNominal, cat: 'edu' })
    // ประกัน (ต่อคน): ชีวิตตามวิธีที่เลือก · ทุพพลภาพ · สุขภาพขั้นต่ำ 5 ล้าน · โรคร้ายแรงขั้นต่ำ 3 ล้าน (เสนอส่วนที่ขาด)
    people.forEach(p => {
      const methodName = p.ins?.method === 'hlv' ? 'Human Life Value' : 'Needs-Based'
      if (p.ins && p.ins.need > 0) items.push({ name: `ทุนประกันชีวิต (${methodName}) · ${p.name}`, when: 'คุ้มครองครอบครัว', amount: p.ins.need, cat: 'ins', owner: p.key })
      if (p.ins && (p.ins as any).disNeed > 0) items.push({ name: `ทุนประกันทุพพลภาพ · ${p.name}`, when: 'คุ้มครองรายได้กรณีทุพพลภาพ', amount: (p.ins as any).disNeed, cat: 'ins', owner: p.key })
      // สุขภาพ (IPD) ขั้นต่ำ 5,000,000
      const ipdRec = p.cov?.radarData?.find((d: any) => d.key === 'ipd')?.recommended ?? 0
      items.push({ name: `ความคุ้มครองสุขภาพ · ${p.name}`, when: 'ค่ารักษาพยาบาล (ขั้นต่ำ 5 ล้าน)', amount: Math.max(ipdRec, 5_000_000), cat: 'ins', owner: p.key })
      // โรคร้ายแรงลุกลาม — หากมีความคุ้มครองน้อยกว่า 3,000,000 เสนอเพิ่มส่วนที่ขาด
      const ciHave = toNum(p.cov?.radarData?.find((d: any) => d.key === 'criticalH')?.amount)
      if (ciHave < 3_000_000) items.push({ name: `ประกันโรคร้ายแรง (เพิ่มส่วนที่ขาด) · ${p.name}`, when: `มีแล้ว ${fmt(ciHave)} · เกณฑ์ 3 ล้าน`, amount: 3_000_000 - ciHave, cat: 'ins', owner: p.key })
    })
    return items
  }, [client, people, retPlan, edu])
  // สไลด์เป้าหมาย: เฉพาะที่ลูกค้ากรอกในหน้าเป้าหมายทางการเงิน (ไม่รวมยอดที่คำนวณจากแผนเกษียณ/การศึกษา)
  const mainGoals = goalItems.filter(g => g.cat === 'manual')
  const insGoals = goalItems.filter(g => g.cat === 'ins')

  const cOf = (k: string) => pres[k]?.comment || ''
  const hidOf = (k: string) => !!pres[k]?.hidden
  const SLIDE_LABEL: Record<string, string> = {
    family: 'ข้อมูลครอบครัว', work: 'ข้อมูลการทำงานและสวัสดิการ', goals: 'เป้าหมายการเงิน', insgoals: 'เป้าหมายด้านการประกัน', balance: 'งบดุล', cashflow: 'งบกระแสเงินสด',
    ratios: 'อัตราส่วน/สุขภาพการเงิน', liquidity: 'การบริหารสภาพคล่อง/หนี้สิน', rebalance: 'การปรับสัดส่วนการลงทุน', insneed: 'การบริหารความเสี่ยง/การประกัน', retiresave: 'การออมเพื่อการเกษียณ', taxplan2: 'การวางแผนภาษี', estateplan2: 'การวางแผนมรดก',
    insurance: 'ความเสี่ยง & ประกัน', investment: 'การลงทุน', retirement: 'แผนเกษียณ',
    education: 'ทุนการศึกษาบุตร', edu2: 'การออมเพื่อทุนการศึกษา', tax: 'ภาษีเงินได้', estate: 'การจัดการมรดก', action: 'แผนปฏิบัติการ', retire2: 'กราฟเกษียณ', holistic: 'ไทม์ไลน์แผนดำเนินการ', forward: 'งบการเงินล่วงหน้า (ถึงเกษียณ)',
  }
  const labelOf = (key: string) => {
    const m = /^action-(\d+)$/.exec(key)
    if (m) return `แผนปฏิบัติการ (หน้า ${m[1]})`
    return SLIDE_LABEL[key] ?? key
  }
  const openDialog = (key: string) => setDialog({ key, title: labelOf(key) })
  const commentFooter = (key: string) => <AdvisorComment slideKey={key} label={labelOf(key)} comment={cOf(key)} hidden={hidOf(key)} onEdit={openDialog} onToggleHide={onToggleHide} />

  const RATIO_META: Record<string, { name: string; std: string; unit: string }> = {
    ratio1: { name: 'สภาพคล่อง', std: '> 1 เท่า', unit: 'times' },
    ratio2: { name: 'เงินสำรองฉุกเฉิน', std: '3–6 เดือน', unit: 'months' },
    ratio3: { name: 'สภาพคล่อง/ความมั่งคั่ง', std: '> 15%', unit: 'pct' },
    ratio4: { name: 'หนี้สินต่อสินทรัพย์', std: '< 50%', unit: 'pct' },
    ratio5: { name: 'ชำระหนี้ต่อรายได้', std: '< 35–45%', unit: 'pct' },
    ratio6: { name: 'หนี้ไม่จดจำนอง', std: '< 15–20%', unit: 'pct' },
    ratio7: { name: 'การออม', std: '≥ 10%', unit: 'pct' },
    ratio8: { name: 'การลงทุน', std: '≥ 50%', unit: 'pct' },
  }
  const stateCol: Record<string, string> = { good: GR, warning: AM, danger: RD, nodata: MUTED }
  const fmtRatio = (v: number | null, unit: string) => v === null ? '—' : unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(0)}%`

  // งบดุล/งบกระแส ต่อคน
  const balanceRows = (r: any) => {
    const sm = r?.summary ?? {}
    const liquid = toNum(sm.liquidAssets), invest = toNum(sm.investAssets), total = toNum(sm.totalAssets)
    const personal = Math.max(0, total - liquid - invest)
    return { liquid, invest, personal, total, debt: toNum(sm.totalDebtBalance), net: toNum(sm.netWorth) }
  }

  return (
    <SlideEditor.Provider value={{ editMode, snap, overlays, setEls: onOverlayChange, advisorName: advisor?.fullName, advisorPhone: advisor?.phone }}>
      {/* ซ่อนสไลด์ที่ผู้ใช้ไม่เลือก (pres[key].off) — ครอบคลุมหน้าแยกอัตโนมัติ เช่น action-2 */}
      <style>{Object.keys(pres).filter(k => (pres as any)[k]?.off)
        .map(k => `.pd-slide[data-slide="${k}"], .pd-slide[data-slide^="${k}-"]{display:none !important;}`).join('\n')}</style>
      {/* เลขหน้าอัตโนมัติทุกสไลด์ (CSS counter — ข้ามสไลด์ที่ถูกซ่อน) */}
      <style>{`
        #report-paper { counter-reset: pdslide; }
        .pd-slide { counter-increment: pdslide; }
        .pd-slide::after { content: "หน้า " counter(pdslide); position: absolute; bottom: 11px; left: 50%; transform: translateX(-50%); font-size: 9.5px; color: #94a3b8; letter-spacing: 0.06em; }
      `}</style>
      {/* แถบเครื่องมือแก้ไข */}
      {editMode && (
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, padding: '8px 14px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10 }}>
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 700 }}>โหมดแก้ไขสไลด์</span>
          <button onClick={() => setSnap(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: snap ? 'var(--cyan)' : 'transparent', color: snap ? '#00201d' : 'var(--text-secondary)', border: `1px solid ${snap ? 'var(--cyan)' : 'var(--card-border)'}` }}>
            <Grid3x3 size={14} /> จัดเข้ากริด {snap ? 'เปิด' : 'ปิด'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· มุมขวาบนของแต่ละสไลด์ = เพิ่มข้อความ/รูป · ดับเบิลคลิกข้อความเพื่อแก้ · เพิ่มหน้าใหม่ท้ายสุด</span>
        </div>
      )}

      <div id="report-paper" style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>

        {/* ── 1. ปก (ธีมเดียวกับหน้าปกรายงานฉบับเต็ม) ── */}
        <Slide slideId="cover" noFooter>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* brand row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                <span style={{ color: '#0f172a' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
                <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: 3, color: MUTED, marginTop: 2 }}>FINANCIAL PLANNING</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: MUTED, textTransform: 'uppercase' }}>Confidential Financial Document</div>
              </div>
            </div>
            {/* title */}
            <div style={{ margin: '20px 0 16px' }}>
              <h1 style={{ fontSize: 34, fontWeight: 800, color: '#0f172a', borderLeft: '8px solid #00cfc1', paddingLeft: 20, lineHeight: 1.3, margin: 0 }}>{title}</h1>
              <div style={{ height: 4, width: 110, background: '#00cfc1', opacity: .45, marginTop: 10, marginLeft: 28 }} />
            </div>
            {/* hero band — จัดเนื้อหากึ่งกลางแนวตั้ง ให้เต็มพื้นที่ ไม่โล่งด้านบน */}
            <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 48px' }}>
              <div style={{ position: 'absolute', right: -70, top: -70, width: 240, height: 240, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
              <div style={{ position: 'absolute', right: 60, bottom: -90, width: 200, height: 200, borderRadius: '50%', background: 'rgba(254,183,0,0.10)' }} />
              <div style={{ position: 'absolute', left: -40, bottom: -60, width: 180, height: 180, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.10)' }} />
              <div style={{ position: 'absolute', right: -30, top: 40, width: 150, height: 150, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'relative', maxWidth: 660 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, color: 'rgba(255,255,255,0.6)' }}>HOLISTIC FINANCIAL PLANNING</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1.28, marginTop: 12, letterSpacing: '-0.01em' }}>แผนการเงินแบบองค์รวม 6 ด้าน</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                  {['สภาพคล่อง', 'การลงทุน', 'ประกัน & ความเสี่ยง', 'เกษียณอายุ', 'ภาษี', 'มรดก'].map(t => (
                    <span key={t} style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '5px 13px' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* prepared for / advisor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, padding: '18px 0 0', borderTop: `1px solid ${HAIR}`, marginTop: 18 }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>จัดทำเพื่อ</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a' }}>คุณ{clientFull}{hasSpouse && spouseFull ? ` · คุณ${spouseFull}` : ''}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>เอกสารเฉพาะบุคคล · ห้ามเผยแพร่ · วันที่จัดทำ {today}</div>
              </div>
              <div style={{ display: 'flex', gap: 13, alignItems: 'center', justifyContent: 'flex-end' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2, color: MUTED, textTransform: 'uppercase', marginBottom: 5 }}>นักวางแผนการเงิน</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{advisor?.fullName || 'ที่ปรึกษาการเงิน'}</div>
                  <div style={{ fontSize: 11.5, color: SUB }}>{[advisor?.position, advisor?.phone, advisor?.email].filter(Boolean).join(' · ')}</div>
                </div>
                {advisor?.photo
                  ? <img src={advisor.photo} alt="" style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', border: '2px solid #00cfc1', flexShrink: 0 }} />
                  : <div style={{ width: 54, height: 54, borderRadius: '50%', background: LINE, flexShrink: 0 }} />}
              </div>
            </div>
          </div>
        </Slide>



        {/* ── 3. กระบวนการวางแผน 6 ขั้น ── */}
        <Slide slideId="process">
          <SlideHead icon={Target} kicker="Process" title="กระบวนการวางแผนการเงิน 6 ขั้นตอน" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flex: 1, alignContent: 'center' }}>
            {[
              { s: 'Step 1', t: 'ข้อมูลส่วนบุคคล & สถานะการเงินปัจจุบัน', ic: User, c: CY },
              { s: 'Step 2', t: 'ความเสี่ยงและการประกันภัย', ic: ShieldCheck, c: VI },
              { s: 'Step 3', t: 'การออมและลงทุนเพื่อเป้าหมาย', ic: PiggyBank, c: GR },
              { s: 'Step 4', t: 'การเกษียณอายุ', ic: Wallet, c: AM },
              { s: 'Step 5', t: 'ภาษีและมรดก', ic: Receipt, c: '#0d9488' },
              { s: 'Step 6', t: 'การวางแผนการเงินแบบองค์รวม', ic: Target, c: RD },
            ].map((x, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: `${x.c}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `inset 0 0 0 1px ${x.c}30` }}><x.ic size={23} color={x.c} /></div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: x.c, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{x.s}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.25, marginTop: 1, letterSpacing: '-0.005em' }}>{x.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── 4. ข้อมูลพื้นฐานครอบครัว ── */}
        <Slide slideId="family">
          <SlideHead icon={Users} kicker="Family" title="ข้อมูลพื้นฐานครอบครัว" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
            {/* แถวบน: ลูกค้า | คู่สมรส */}
            <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 16 }}>
              {familyCards.map((p, i) => (
                <div key={i} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 999, background: `${p.tint}18`, color: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={21} /></span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: SUB }}>อายุ {p.age ?? '—'} ปี{p.status ? ` · ${p.status}` : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5 }}>
                    {p.occ && <FamilyRow label="อาชีพ" value={p.occ} />}
                    {p.incomes.map((inc, j) => (
                      <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, lineHeight: 1.45 }}>
                        <span style={{ color: SUB }}>{inc.label}</span>
                        <span style={{ color: GR, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(inc.amount)} /{inc.isBonus ? 'ปี' : 'เดือน'}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 4, marginTop: 1 }}>
                      <span style={{ color: INK, fontWeight: 700 }}>รายได้รวม/ปี</span>
                      <span style={{ color: INK, fontWeight: 800, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{fmt(p.totalYear)} บาท</span>
                    </div>
                    {p.health && <FamilyRow label="สุขภาพ" value={p.health} />}
                    {p.hobby && <FamilyRow label="งานอดิเรก" value={p.hobby} />}
                  </div>
                </div>
              ))}
            </div>

            {/* แถวล่าง: บุตร | บิดา-มารดา (คู่กันเพื่อประหยัดพื้นที่) */}
            {((client?.children ?? []).length > 0 || dependents.length > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: ((client?.children ?? []).length > 0 && dependents.length > 0) ? '1fr 1fr' : '1fr', gap: 16 }}>
                {(client?.children ?? []).length > 0 && (
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Baby size={19} color={AM} /><span style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>บุตร</span></div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(client?.children ?? []).map((c: any, i: number) => (
                        <div key={i} style={{ flex: '1 1 130px', minWidth: 120, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 14px' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: INK, display: 'block' }}>{c.name || `บุตรคนที่ ${i + 1}`}</span>
                          <span style={{ fontSize: 12, color: SUB }}>อายุ {toNum(c.age)} ปี{c.school ? ` · ${c.school}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dependents.length > 0 && (
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HeartPulse size={19} color={RD} /><span style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>บิดา / มารดา (ในอุปการะ)</span></div>
                      {careExpense > 0 && <span style={{ fontSize: 12, color: SUB }}>ค่าดูแล <b style={{ color: AM }}>{fmt(careExpense)}</b>/เดือน</span>}
                    </div>
                    {/* grid 2 คอลัมน์ — บิดา/มารดา จับคู่กันทุกแถว ขนาดเท่ากัน */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {dependents.map((d, i) => (
                        <div key={i} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '9px 14px', minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.rel}{d.name ? ` · ${d.name}` : ''}</div>
                          {hasSpouse && <div style={{ fontSize: 11, color: MUTED, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>(ของ{d.owner})</div>}
                          <div style={{ fontSize: 12, color: SUB }}>อายุ {toNum(d.age) || '—'} ปี{d.health ? ` · ${d.health}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Slide>

        {/* ── 4b. ข้อมูลการทำงานและสวัสดิการ ── */}
        <Slide slideId="work" footer={commentFooter('work')}>
          <SlideHead icon={Briefcase} kicker="Work & Benefits" title="ข้อมูลการทำงานและสวัสดิการ" accent={CY} />
          <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 16, flex: 1, alignContent: 'start' }}>
            {([
              { name: selfName, tint: CY, job: { occupation: client?.occupation, jobTitle: client?.jobTitle, company: client?.company, workYears: client?.workYears, salary: client?.salary, rate: client?.salaryIncreaseRate }, wf: client },
              ...(hasSpouse ? [{ name: spouseName, tint: VI, job: (() => { const j = Array.isArray(client?.spouseJobs) ? client.spouseJobs[0] : null; return { occupation: j?.occupation || client?.spouseProfile?.occupation, jobTitle: j?.jobTitle, company: j?.company, workYears: j?.workYears, salary: j?.salary ?? client?.spouseIncome, rate: j?.salaryIncreaseRate } })(), wf: client?.spouseProfile }] : []),
            ] as any[]).map(p => {
              const WRow = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5 }}>
                  <span style={{ color: SUB }}>{l}</span>
                  <span style={{ fontWeight: strong ? 800 : 700, color: INK, textAlign: 'right' }}>{v}</span>
                </div>
              )
              const Benefit = ({ label, on, detail }: { label: string; on: boolean; detail?: string }) => (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${HAIR}` }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? `${GR}1f` : '#f1f5f9', color: on ? GR : MUTED, fontSize: 11, fontWeight: 800 }}>{on ? '✓' : '–'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? INK : MUTED }}>{label}</div>
                    {on && detail && <div style={{ fontSize: 11, color: SUB, marginTop: 1 }}>{detail}</div>}
                  </div>
                </div>
              )
              const salaryM = toNum(p.job.salary)
              return (
                <div key={p.name} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
                  <PersonHead name={p.name} tint={p.tint} />
                  {/* งาน & รายได้ */}
                  <WRow l="อาชีพ / ตำแหน่ง" v={[p.job.occupation, p.job.jobTitle].filter(Boolean).join(' · ') || '—'} />
                  {p.job.company && <WRow l="สถานที่ทำงาน" v={String(p.job.company)} />}
                  {toNum(p.job.workYears) > 0 && <WRow l="อายุงาน" v={`${toNum(p.job.workYears)} ปี`} />}
                  <WRow l="เงินเดือน" v={salaryM > 0 ? `${fmt(salaryM)} บาท/เดือน` : '—'} strong />
                  <WRow l="อัตราการเพิ่มขึ้นของรายได้" v={p.job.rate != null && p.job.rate !== '' ? `${toNum(p.job.rate)}% ต่อปี` : '—'} />
                  {/* สวัสดิการ */}
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase', margin: '12px 0 2px' }}>สวัสดิการที่มี</div>
                  <Benefit label="ประกันสังคม" on={!!p.wf?.hasSocialSecurity}
                    detail={[toNum(p.wf?.socialSecurityYears) > 0 ? `สมทบมาแล้ว ${toNum(p.wf?.socialSecurityYears)} ปี` : '', toNum(p.wf?.socialSecurityValue) > 0 ? `มูลค่ากองทุน ${fmt(toNum(p.wf?.socialSecurityValue))} บาท` : ''].filter(Boolean).join(' · ')} />
                  <Benefit label="ประกันกลุ่ม" on={!!p.wf?.hasGroupInsurance}
                    detail={[toNum(p.wf?.giRoomLimit) > 0 ? `ค่าห้อง ${fmt(toNum(p.wf?.giRoomLimit))}` : '', toNum(p.wf?.giMedicalLimit) > 0 ? `ค่ารักษา ${fmt(toNum(p.wf?.giMedicalLimit))}` : '', toNum(p.wf?.giOpdLimit) > 0 ? `OPD ${fmt(toNum(p.wf?.giOpdLimit))}` : ''].filter(Boolean).join(' · ')} />
                  <Benefit label="กองทุนสำรองเลี้ยงชีพ (PVD)" on={!!p.wf?.hasPVD}
                    detail={[toNum(p.wf?.pvdEmployeeRate) > 0 ? `สะสม ${toNum(p.wf?.pvdEmployeeRate)}%` : '', toNum(p.wf?.pvdEmployerRate) > 0 ? `นายจ้างสมทบ ${toNum(p.wf?.pvdEmployerRate)}%` : '', toNum(p.wf?.pvdCurrentValue) > 0 ? `มูลค่าปัจจุบัน ${fmt(toNum(p.wf?.pvdCurrentValue))} บาท` : ''].filter(Boolean).join(' · ')} />
                </div>
              )
            })}
          </div>
        </Slide>

        {/* ── 5. เป้าหมายทางการเงิน (เฉพาะที่กรอกในหน้าเป้าหมาย · มีคู่สมรส → แยกตารางรายคน) ── */}
        <Slide slideId="goals" footer={commentFooter('goals')}>
          <SlideHead icon={Target} kicker="Goals" title="เป้าหมายทางการเงิน" accent={GR} />
          {mainGoals.length > 0 ? (() => {
            const selfGoals = mainGoals.filter(g => g.owner !== 'spouse')
            const spouseGoals = mainGoals.filter(g => g.owner === 'spouse')
            if (!hasSpouse || spouseGoals.length === 0) {
              const d = goalDensity(mainGoals.length + 2)
              return <GoalTable title="เป้าหมายทางการเงิน" rows={mainGoals} totalColor={GR} pad={d.pad} fz={d.fz} />
            }
            // 2 ตาราง → นับแถว + หัว/รวม ของทั้งคู่ แล้วบีบระยะห่างให้พอ 1 หน้า
            const d = goalDensity(selfGoals.length + spouseGoals.length + (selfGoals.length > 0 ? 2 : 0) + 2)
            return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: d.pad + 4, overflow: 'hidden' }}>
                {selfGoals.length > 0 && <GoalTable title={`เป้าหมายทางการเงิน · ${selfName}`} rows={selfGoals} totalColor={GR} pad={d.pad} fz={d.fz} />}
                <GoalTable title={`เป้าหมายทางการเงิน · ${spouseName}`} rows={spouseGoals} totalColor={VI} pad={d.pad} fz={d.fz} />
              </div>
            )
          })() : <Empty text="ยังไม่มีเป้าหมายทางการเงิน — กรอกที่หน้าเป้าหมายทางการเงินก่อน" />}
        </Slide>

        {/* ── 5b. เป้าหมายด้านการประกัน (มีคู่สมรส → แยกตารางรายคน) ── */}
        <Slide slideId="insgoals" footer={commentFooter('insgoals')}>
          <SlideHead icon={ShieldCheck} kicker="Protection Goals" title="เป้าหมายด้านการประกัน" accent={VI} />
          {insGoals.length > 0 ? (() => {
            const selfIns = insGoals.filter(g => g.owner !== 'spouse')
            const spouseIns = insGoals.filter(g => g.owner === 'spouse')
            if (!hasSpouse || spouseIns.length === 0) {
              const d = goalDensity(insGoals.length + 2)
              return <GoalTable title="เป้าหมายด้านการประกัน" rows={insGoals} totalColor={VI} pad={d.pad} fz={d.fz} />
            }
            const d = goalDensity(selfIns.length + spouseIns.length + (selfIns.length > 0 ? 2 : 0) + 2)
            return (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: d.pad + 4, overflow: 'hidden' }}>
                {selfIns.length > 0 && <GoalTable title={`เป้าหมายด้านการประกัน · ${selfName}`} rows={selfIns} totalColor={GR} pad={d.pad} fz={d.fz} />}
                <GoalTable title={`เป้าหมายด้านการประกัน · ${spouseName}`} rows={spouseIns} totalColor={VI} pad={d.pad} fz={d.fz} />
              </div>
            )
          })() : <Empty text="ยังไม่มีข้อมูลความต้องการประกัน — กรอกที่หน้าวางแผนประกัน" />}
        </Slide>

        {/* ── 6. งบดุล ── */}
        <Slide slideId="balance" footer={commentFooter('balance')}>
          <SlideHead icon={Scale} kicker="Balance Sheet" title="งบดุล (ณ ปัจจุบัน)" />
          <TwoCol>
            {people.map(p => {
              const b = balanceRows(p.ratios)
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <tbody>
                      {[['สินทรัพย์สภาพคล่อง', b.liquid, CY], ['สินทรัพย์ลงทุน', b.invest, GR], ['สินทรัพย์ส่วนตัว', b.personal, AM], ['รวมสินทรัพย์', b.total, INK], ['หนี้สินรวม', b.debt, RD], ['ความมั่งคั่งสุทธิ', b.net, b.net >= 0 ? GR : RD]].map(([l, v, c]: any, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${LINE}`, fontWeight: (l === 'รวมสินทรัพย์' || l === 'ความมั่งคั่งสุทธิ') ? 800 : 400 }}>
                          <td style={{ padding: '9px 4px', color: SUB }}>{l}</td>
                          <td style={{ padding: '9px 4px', textAlign: 'right', fontFamily: 'monospace', color: c, fontWeight: 700 }}>{fmt(v)}</td>
                          <td style={{ padding: '9px 4px', textAlign: 'right', color: MUTED, width: 52 }}>{['สินทรัพย์สภาพคล่อง', 'สินทรัพย์ลงทุน', 'สินทรัพย์ส่วนตัว'].includes(l) ? `${pct(v, b.total)}%` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── 7. งบกระแสเงินสด ── */}
        <Slide slideId="cashflow" footer={commentFooter('cashflow')}>
          <SlideHead icon={Banknote} kicker="Cash Flow" title="งบกระแสเงินสด (ต่อปี)" accent={GR} />
          <TwoCol>
            {people.map(p => {
              const sm = p.ratios?.summary ?? {}
              const income = toNum(sm.totalAnnualIncome)
              const fixed = expAnnual('fixed_', p.key)
              const variable = expAnnual('var_', p.key)
              const saving = expAnnual('saving_', p.key) || toNum(sm.annualSavings)
              const totalExp = fixed + variable + saving
              const net = income - totalExp
              const rows: [string, number, string, boolean?][] = [
                ['กระแสเงินสดรับ', income, GR],
                ['ค่าใช้จ่ายคงที่', fixed, AM],
                ['ค่าใช้จ่ายผันแปร', variable, RD],
                ['ค่าใช้จ่ายเพื่อการออม/ลงทุน', saving, VI],
                ['ค่าใช้จ่ายรวม', totalExp, RD, true],
                ['กระแสเงินสดสุทธิ', net, net >= 0 ? CY : RD, true],
              ]
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <tbody>
                      {rows.map(([l, v, c, strong], i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${LINE}`, fontWeight: strong ? 800 : 400 }}>
                          <td style={{ padding: '9px 4px', color: strong ? INK : SUB }}>{l}</td>
                          <td style={{ padding: '9px 4px', textAlign: 'right', fontFamily: 'monospace', color: c, fontWeight: 700 }}>{fmt(v)}</td>
                          <td style={{ padding: '9px 4px', textAlign: 'right', color: MUTED, width: 52 }}>{income > 0 ? `${pct(v, income)}%` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── 10. อัตราส่วน + Health Score ── */}
        <Slide slideId="ratios" footer={commentFooter('ratios')}>
          <SlideHead icon={Activity} kicker="Financial Health" title="สถานะสุขภาพทางการเงิน" />
          <TwoCol>
            {people.map(p => (
              <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <PersonHead name={p.name} tint={p.tint} />
                <div style={{ display: 'flex', gap: 14, flex: 1 }}>
                  <div style={{ width: 150, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                    {p.ratios?.healthScore != null ? <HealthGauge score={p.ratios.healthScore} label={p.ratios.healthLabel || ''} size={160} /> : <Empty text="—" />}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(p.ratios?.ratios ?? []).map((e: any) => {
                      const m = RATIO_META[e.key]; if (!m) return null
                      const col = stateCol[e.state] ?? MUTED
                      return (
                        <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: col, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12.5, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: col }}>{fmtRatio(e.value, m.unit)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </TwoCol>
        </Slide>

        {/* ── 14. ทุนการศึกษาบุตร ── */}
        <Slide slideId="education" footer={commentFooter('education')}>
          <SlideHead icon={GraduationCap} kicker="Education" title="เป้าหมายและแผนการศึกษาบุตร" accent={AM} />
          {edu ? (
            <div style={{ display: 'flex', gap: 22, marginTop: 24, marginBottom: 24 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Stat label="จำนวนบุตร" value={`${edu.childCount}`} sub="คน" />
                  <Stat label="ค่าเล่าเรียนรวม (อนาคต)" value={fmt(edu.totalNominal)} sub="บาท" color={AM} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Stat label="เงินก้อนวันนี้ (PV)" value={fmt(edu.totalPV)} sub="บาท" color={CY} />
                  <Stat label="ต้องออม/เดือน" value={fmt(edu.monthlySaving)} sub="บาท" color={GR} />
                </div>
              </div>
              <div style={{ width: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <GoalBar rows={[{ name: 'ทุนการศึกษา', needed: edu.totalNominal, have: edu.totalPV }]} />
                <div style={{ fontSize: 11.5, color: MUTED, textAlign: 'center', marginTop: 4 }}>เทียบค่าเล่าเรียนรวมในอนาคต กับเงินก้อนที่ต้องเตรียมวันนี้</div>
              </div>
            </div>
          ) : <Empty text="ยังไม่มีข้อมูลบุตร/ค่าเล่าเรียน" />}
        </Slide>
        {/* ── 11. ความเสี่ยง & ประกัน ── */}
        <Slide slideId="insurance" footer={commentFooter('insurance')}>
          <SlideHead icon={ShieldCheck} kicker="Risk & Protection" title="ความเสี่ยงและความคุ้มครอง" accent={VI} />
          <TwoCol>
            {people.map(p => (
              <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                <PersonHead name={p.name} tint={p.tint} />
                <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                  <div style={{ flex: 1, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, minHeight: 200 }}>
                    {p.cov.hasPolicies ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={p.cov.radarData} outerRadius="70%">
                          <PolarGrid stroke={HAIR} />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9.5, fill: SUB }} />
                          {/* เกณฑ์ = ขอบนอก 100% — พล็อตเฉพาะความคุ้มครองที่มี */}
                          <Radar isAnimationActive={false} name="ความคุ้มครองที่มี" dataKey="actual" stroke={p.tint} strokeWidth={2} fill={p.tint} fillOpacity={0.28} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : <Empty text="ยังไม่มีกรมธรรม์" />}
                  </div>
                  <div style={{ width: 150, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '10px 8px' }}>
                      <div style={{ fontSize: 11.5, color: SUB }}>คะแนนคุ้มครอง</div>
                      <div style={{ fontSize: 30, fontWeight: 800, color: p.cov.avg >= 70 ? GR : p.cov.avg >= 40 ? AM : RD, fontFamily: 'monospace' }}>{p.cov.avg}</div>
                    </div>
                    {p.ins && <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {([['ทุนที่ควรมี', p.ins.need, AM], ['มีอยู่', p.ins.have, GR], ['ยังขาด', p.ins.gap, p.ins.gap > 0 ? RD : GR]] as const).map(([lbl, val, col]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 11, color: SUB }}>{lbl}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: col, lineHeight: 1.1 }}>{fmt(val)} <span style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>บาท</span></div>
                        </div>
                      ))}
                    </div>}
                  </div>
                </div>
                {/* ความคุ้มครองที่มี แยกตามประเภท (จากกรมธรรม์+สัญญาเพิ่มเติม) */}
                <div style={{ marginTop: 10, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>ความคุ้มครองที่มี (แยกประเภท)</div>
                  {(p.cov?.radarData ?? []).filter((d: any) => toNum(d.amount) > 0).length === 0
                    ? <div style={{ fontSize: 12, color: MUTED, padding: '4px 0' }}>ยังไม่มีความคุ้มครอง</div>
                    : (p.cov.radarData as any[]).filter(d => toNum(d.amount) > 0).map(d => (
                      <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5 }}>
                        <span style={{ color: SUB }}>{d.subject}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: INK }}>{fmt(toNum(d.amount))} <span style={{ fontSize: 10.5, fontWeight: 400, color: MUTED }}>บาท</span></span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </TwoCol>
        </Slide>

        {/* ── 12. การลงทุนปัจจุบัน — พอร์ต + มูลค่า ณ เกษียณ 3 สมมุติฐาน (ทั้งคู่) ── */}
        <Slide slideId="investment" footer={commentFooter('investment')}>
          <SlideHead icon={TrendingUp} kicker="Investment" title="สถานะการลงทุน" accent={GR} />
          <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 16, flex: 1, alignContent: 'start' }}>
            {([['self', selfName, CY, invPeople.self], ...(hasSpouse && invPeople.spouse ? [['spouse', spouseName, VI, invPeople.spouse]] : [])] as any[]).map(([key, name, tint, iv]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                <PersonHead name={name} tint={tint} />
                <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '10px 12px 6px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase' }}>สัดส่วนสินทรัพย์ลงทุน</div>
                  {iv.total > 0 ? <MiniPie data={iv.allocation} height={165} radius={[36, 62]} /> : <Empty text="ยังไม่มีข้อมูลสินทรัพย์ลงทุน" />}
                  {iv.total > 0 && <div style={{ fontSize: 12.5, fontWeight: 800, color: INK, textAlign: 'center', margin: '4px 0 6px' }}>รวม {fmt(iv.total)} บาท{iv.portfolioReturn != null ? <span style={{ fontWeight: 400, color: SUB }}> · ผลตอบแทน ~{iv.portfolioReturn.toFixed(1)}%/ปี</span> : ''}</div>}
                </div>
                {/* มูลค่า ณ เกษียณ 3 สมมุติฐาน */}
                <div style={{ marginTop: 10, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>มูลค่า ณ เกษียณ (อายุ {iv.retirementAge} ปี) · Monte Carlo</div>
                  {iv.atRet ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {([['ดี (P90)', iv.atRet.p90, GR], ['ค่ากลาง (P50)', iv.atRet.p50, INK], ['แย่ (P10)', iv.atRet.p10, RD]] as const).map(([lbl, val, col]) => (
                        <div key={lbl} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10.5, color: SUB }}>{lbl}</div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, fontFamily: 'monospace', color: col, marginTop: 2 }}>{fmt(val)}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: 12, color: MUTED, padding: '4px 0' }}>ยังไม่มีข้อมูลเพียงพอ (ต้องมีสินทรัพย์ลงทุน + อายุ)</div>}
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── 13. เป้าหมาย & แผนเกษียณ ── */}
        <Slide slideId="retirement" footer={commentFooter('retirement')}>
          <SlideHead icon={PiggyBank} kicker="Retirement" title="เป้าหมายและแผนเกษียณ" accent={CY} />
          <div style={{ display: 'flex', gap: 22, flex: 1, minHeight: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={people.map(p => ({ name: p.name, สินทรัพย์: Math.round(p.ret?.sources.asset ?? 0), ปกส: Math.round(p.ret?.sources.sso ?? 0), PVD: Math.round(p.ret?.sources.pvd ?? 0), ชดเชย: Math.round(p.ret?.sources.severance ?? 0), ต้องการ: Math.round(p.ret?.needed ?? 0) }))} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={HAIR} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: SUB }} axisLine={{ stroke: LINE }} tickLine={false} />
                  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: MUTED }} width={44} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {/* แท่งซ้าย = เงินที่ต้องการ · แท่งขวา = เงินที่มี (ซ้อนย่อยตามแหล่งเงิน) — สี categorical + คั่น 2px */}
                  <Bar isAnimationActive={false} dataKey="ต้องการ" fill="#f59e0b" radius={[4, 4, 0, 0]} name="เงินที่ต้องการ" maxBarSize={64} />
                  <Bar isAnimationActive={false} dataKey="สินทรัพย์" stackId="have" fill="#10b981" stroke="#fff" strokeWidth={1} maxBarSize={64} />
                  <Bar isAnimationActive={false} dataKey="ปกส" stackId="have" fill="#0d9488" stroke="#fff" strokeWidth={1} maxBarSize={64} />
                  <Bar isAnimationActive={false} dataKey="PVD" stackId="have" fill="#8b5cf6" stroke="#fff" strokeWidth={1} maxBarSize={64} />
                  <Bar isAnimationActive={false} dataKey="ชดเชย" stackId="have" fill="#f43f5e" stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={64} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
              {people.map(p => (
                <div key={p.key} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{p.name}</span>
                    {p.ret && <ReadyPill pct={p.ret.readinessPct} />}
                  </div>
                  {p.ret ? (
                    <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.6 }}>
                      <div>ต้องการ: <b style={{ color: AM }}>{fmt(p.ret.needed)}</b></div>
                      <div>มีแล้ว: <b style={{ color: GR }}>{fmt(p.ret.have)}</b> · ขาด: <b style={{ color: p.ret.gap > 0 ? RD : GR }}>{fmt(p.ret.gap)}</b></div>
                      <div>ต้องออม/เดือน: <b style={{ color: CY }}>{fmt((p.ret.annualSavings || 0) / 12)}</b></div>
                    </div>
                  ) : <div style={{ fontSize: 12.5, color: MUTED }}>ยังไม่มีข้อมูลแผนเกษียณ</div>}
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── 13b. คาดการณ์มูลค่ากองทุนเกษียณ ── */}
        <Slide slideId="retire2" footer={commentFooter('retire2')}>
          <SlideHead icon={PiggyBank} kicker="Retirement Projection" title="คาดการณ์มูลค่ากองทุนเกษียณ" accent={CY} />
          {retChart.data.length > 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>กรณีไม่ออมเพิ่ม — สะสมช่วงทำงาน → ใช้จ่ายหลังเกษียณ (ตัดที่จุดเงินหมด)</div>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={retChart.data} margin={{ top: 26, right: 16, left: 6, bottom: 6 }}>
                  <defs><linearGradient id="pdRetSelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CY} stopOpacity={0.22} /><stop offset="100%" stopColor={CY} stopOpacity={0.04} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={HAIR} vertical={false} />
                  <XAxis dataKey="age" tick={{ fontSize: 10, fill: MUTED }} interval={4} axisLine={{ stroke: LINE }} tickLine={false} />
                  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: MUTED }} width={46} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} labelFormatter={a => `อายุ ${a} ปี`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {retSelf?.retireAge != null && <ReferenceLine x={retSelf.retireAge} stroke={AM} strokeDasharray="4 4" label={{ value: `เกษียณ ${retSelf.retireAge}`, position: 'insideTopRight', fill: AM, fontSize: 10 }} />}
                  {/* เส้นบอก "อายุที่เงินหมด" (กรณีไม่ออมเพิ่ม) ต่อคน */}
                  {retChart.depSelf != null && <ReferenceLine x={retChart.depSelf} stroke={CY} strokeDasharray="2 3" label={{ value: `เงินหมด ${retChart.depSelf}`, position: 'insideTopLeft', fill: CY, fontSize: 10, fontWeight: 700 }} />}
                  {hasSpouse && retChart.depSpouse != null && <ReferenceLine x={retChart.depSpouse} stroke={VI} strokeDasharray="2 3" label={{ value: `เงินหมด ${retChart.depSpouse}`, position: 'insideTopRight', fill: VI, fontSize: 10, fontWeight: 700 }} />}
                  {/* เฉพาะกรณี "ไม่ออมเพิ่ม" — ตัดเส้นที่จุดเงินหมด */}
                  <Area isAnimationActive={false} type="monotone" dataKey="selfNo" name={`${selfName} (ไม่ออมเพิ่ม)`} stroke={CY} strokeWidth={2.4} fill="url(#pdRetSelf)" dot={false} />
                  {hasSpouse && <Line isAnimationActive={false} type="monotone" dataKey="spouseNo" name={`${spouseName} (ไม่ออมเพิ่ม)`} stroke={VI} strokeWidth={2.2} dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty text="ยังไม่มีข้อมูลแผนเกษียณเพียงพอ — กรอกที่หน้าแผนเกษียณ" />}
        </Slide>


        {/* ── 15. ภาษีเงินได้ ── */}
        <Slide slideId="tax" footer={commentFooter('tax')}>
          <SlideHead icon={Receipt} kicker="Income Tax" title="ภาษีเงินได้" accent={CY} />
          <TwoCol>
            {people.map(p => {
              const st = taxPlan?.[p.key]
              const r = st ? (() => { try { return calc({ ...defaultState(), ...(st as TaxState) }) } catch { return null } })() : null
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  {r ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Stat label="ภาษีที่ต้องชำระ" value={fmt(r.netTax)} sub="บาท/ปี" color={AM} />
                        <Stat label="อัตราภาษีเฉลี่ย" value={`${r.eff.toFixed(1)}%`} color={INK} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Stat label="เงินได้สุทธิ" value={fmt(r.ni)} color={INK} />
                        <Stat label="ค่าลดหย่อนรวม" value={fmt(r.allD)} color={GR} />
                      </div>
                    </div>
                  ) : <Empty text="ยังไม่มีข้อมูลแผนภาษี" />}
                </div>
              )
            })}
          </TwoCol>
        </Slide>
        {/* ── 16. การจัดการมรดก ── */}
        <Slide slideId="estate" footer={commentFooter('estate')}>
          <SlideHead icon={Landmark} kicker="Estate" title="เป้าหมายและการจัดการมรดก" accent={VI} />
          <div style={{ display: 'grid', gridTemplateColumns: estate.spouse ? '1fr 1fr' : '1fr', gap: 16, flex: 1, alignContent: 'start' }}>
            {([['self', `กรณี${selfName}เสียชีวิต`, CY, estate.self], ...(estate.spouse ? [['spouse', `กรณี${spouseName}เสียชีวิต`, VI, estate.spouse]] : [])] as any[]).map(([key, caption, tint, es]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, borderBottom: `2px solid ${tint}33`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{caption}</span>
                  <span style={{ fontSize: 12, color: SUB }}>กองมรดกสุทธิ <b style={{ color: tint, fontFamily: 'monospace', fontSize: 14 }}>{fmt(es.estateVal)}</b> บาท</span>
                </div>
                <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, marginBottom: 6 }}>การกระจายมรดก · {es.useWill ? 'ตามพินัยกรรม' : 'ตามกฎหมาย'}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead><tr style={{ borderBottom: `1px solid #cbd5e1` }}><th style={{ textAlign: 'left', padding: '5px 4px', color: SUB }}>ผู้รับมรดก</th><th style={{ textAlign: 'right', padding: '5px 4px', color: SUB }}>ส่วนแบ่ง</th><th style={{ textAlign: 'right', padding: '5px 4px', color: SUB }}>ภาษี</th></tr></thead>
                    <tbody>
                      {es.taxHeirs.length === 0 ? <tr><td colSpan={3} style={{ padding: 12, textAlign: 'center', color: MUTED }}>ยังไม่มีข้อมูลทายาท</td></tr>
                        : es.taxHeirs.map((h: any, i: number) => {
                          const tax = h.rel === 'spouse' ? 0 : Math.max(0, h.share - 100_000_000) * (h.rel === 'lineal' ? 0.05 : 0.10)
                          return <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                            <td style={{ padding: '6px 4px', color: INK }}>{h.name}{h.rel === 'spouse' && <span style={{ fontSize: 10.5, color: MUTED }}> (ยกเว้น)</span>}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: INK }}>{fmt(h.share)}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: tax > 0 ? AM : GR }}>{fmt(tax)}</td>
                          </tr>
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Slide>
        {/* ── หน้าคั่น: คำแนะนำนักวางแผน ── */}
        <Slide slideId="advheader" noFooter pad={0}>
          <div style={{ position: 'absolute', inset: 0, background: '#ffffff', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ width: '100%', padding: '54px 0', background: 'linear-gradient(90deg, #0d9488 0%, #14b8a6 55%, #22c55e 130%)', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.35em', color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>PLANNER'S RECOMMENDATIONS</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>คำแนะนำนักวางแผน</div>
            </div>
          </div>
        </Slide>

        {/* ── คำแนะนำ: การบริหารสภาพคล่อง/หนี้สิน — อัตราส่วนที่ไม่ผ่านเกณฑ์ ── */}
        <Slide slideId="liquidity" footer={commentFooter('liquidity')}>
          <SlideHead icon={Wallet} kicker="Liquidity & Debt" title="การบริหารสภาพคล่อง/หนี้สิน" accent={CY} />
          <TwoCol>
            {people.map(p => {
              const fails = (p.ratios?.ratios ?? []).filter((e: any) => e.state !== 'good' && e.state !== 'nodata' && e.value != null && RATIO_META[e.key])
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  {fails.length === 0
                    ? <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px', fontSize: 14, color: GR, fontWeight: 700 }}>✓ ทุกอัตราส่วนผ่านเกณฑ์มาตรฐาน</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {fails.map((e: any) => {
                          const m = RATIO_META[e.key]
                          const col = stateCol[e.state] ?? MUTED
                          return (
                            <div key={e.key} style={{ background: PAPER, border: `1px solid ${LINE}`, borderLeft: `4px solid ${col}`, borderRadius: 12, padding: '11px 16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{m.name}</span>
                                <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: col, whiteSpace: 'nowrap' }}>{fmtRatio(e.value, m.unit)}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: SUB, marginTop: 2 }}>เกณฑ์มาตรฐาน {m.std} · <span style={{ color: col, fontWeight: 700 }}>{e.state === 'danger' ? 'ต่ำกว่าเกณฑ์มาก ควรเร่งปรับปรุง' : 'ยังไม่ผ่านเกณฑ์ ควรปรับปรุง'}</span></div>
                            </div>
                          )
                        })}
                      </div>}
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── คำแนะนำ: การปรับสัดส่วนการลงทุน ── */}
        <Slide slideId="rebalance" footer={commentFooter('rebalance')}>
          <SlideHead icon={TrendingUp} kicker="Rebalancing" title="การปรับสัดส่วนการลงทุน" accent={GR} />
          <TwoCol>
            {people.map(p => {
              const rb = (rebalance as any)[p.key === 'self' ? 'self' : 'spouse']
              if (!rb) return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <Empty text="ยังไม่ได้เลือกพอร์ตเป้าหมาย — เลือกที่เมนู มูลค่าสินทรัพย์ลงทุน → การปรับสัดส่วนลงทุน" />
                </div>
              )
              const diff = rb.newAt - rb.curAt
              return (
                <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <PersonHead name={p.name} tint={p.tint} />
                  {/* พอร์ตที่เลือก + สัดส่วน */}
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '9px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: rb.sel.color }}>พอร์ตที่เลือก: {rb.sel.label}</span>
                      <span style={{ fontSize: 10.5, color: SUB, fontFamily: 'monospace' }}>E(Rp) +{rb.sel.ret.toFixed(2)}% · σ {rb.sel.sigma.toFixed(2)}%</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                      {rb.sel.weights.map((w: number, i2: number) => (
                        <div key={i2} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 8, color: MUTED, whiteSpace: 'nowrap' }}>{['ตราสารหนี้', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ'][i2]}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{w}%</div>
                          <div style={{ fontSize: 9.5, fontFamily: 'monospace', color: SUB }}>{fmt(rb.totalValue * w / 100)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* เทียบ ณ เกษียณ */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                    {([['พอร์ตเดิม ณ เกษียณ', fmt(rb.curAt), AM], ['พอร์ตใหม่ ณ เกษียณ', fmt(rb.newAt), rb.sel.color], ['ส่วนต่างค่ากลาง', `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff))}`, diff >= 0 ? GR : RD]] as const).map(([l, v, c]) => (
                      <div key={l} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8.5, color: MUTED }}>{l}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {/* กราฟเทียบ */}
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '6px 8px 0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase' }}>Monte Carlo เปรียบเทียบมูลค่าอนาคต</div>
                    <ResponsiveContainer width="100%" height={185}>
                      <ComposedChart data={rb.rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                        <XAxis dataKey="age" tick={{ fontSize: 8.5, fill: MUTED }} interval={4} />
                        <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 8.5, fill: MUTED }} width={30} />
                        <Tooltip formatter={(v: any) => Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                        <Legend wrapperStyle={{ fontSize: 9.5 }} />
                        <ReferenceLine x={rb.retAge} stroke={AM} strokeDasharray="4 3" />
                        <Area isAnimationActive={false} dataKey="band" name="ช่วง 80% (พอร์ตใหม่)" stroke="none" fill={rb.sel.color} fillOpacity={0.13} />
                        <Line isAnimationActive={false} dataKey="พอร์ตเดิม" stroke={AM} strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
                        <Line isAnimationActive={false} dataKey="พอร์ตใหม่" stroke={rb.sel.color} strokeWidth={2.2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── 14b. กราฟเงินออมสะสมทุนการศึกษา (3 สถาบัน) ── */}
        <Slide slideId="edu2" footer={commentFooter('edu2')}>
          <SlideHead icon={GraduationCap} kicker="Education Projection" title="การออมเพื่อทุนการศึกษา" accent={AM} />
          {eduChart && eduChart.hasData ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>{eduChart.childName} · ออม {eduChart.savingYears} ปี · มูลค่ากองทุนสะสมรายปี แยกตามประเภทสถาบัน{eduChart.childCount > 1 ? ` (แสดงบุตรคนที่ 1 จาก ${eduChart.childCount})` : ''}</div>
              <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={eduChart.chartData} margin={{ top: 34, right: 16, left: 6, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={HAIR} vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: LINE }} tickLine={false} />
                  <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: MUTED }} width={46} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} labelFormatter={y => `ปี พ.ศ. ${y}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {eduChart.types.map(t => <Line isAnimationActive={false} key={t.key} type="monotone" dataKey={t.key} name={`สถาบัน${t.label}`} stroke={t.color} strokeWidth={2.2} dot={false} connectNulls />)}
                  {/* เส้นประ + ป้ายมูลค่ากองทุน (เต็มจำนวน) ณ ปีสุดท้ายที่ออม */}
                  {(() => {
                    const lastSaveYear = eduChart.chartData.length ? eduChart.chartData[0].year + eduChart.savingYears - 1 : null
                    const row: any = lastSaveYear != null ? eduChart.chartData.find((r: any) => r.year === lastSaveYear) : null
                    if (!row) return null
                    return <>
                      <ReferenceLine x={row.year} stroke={MUTED} strokeDasharray="4 4" label={{ value: `ปีสุดท้ายที่ออม ${row.year}`, position: 'insideBottomLeft', fill: SUB, fontSize: 10, fontWeight: 700 }} />
                      {eduChart.types.map(t => toNum(row[t.key]) > 0 && (
                        <ReferenceDot key={`peak-${t.key}`} x={row.year} y={row[t.key]} r={4} fill={t.color} stroke="#fff" strokeWidth={1.5}
                          label={{ value: fmt(row[t.key]), position: 'top', fill: t.color, fontSize: 11, fontWeight: 800 }} />
                      ))}
                    </>
                  })()}
                </ComposedChart>
              </ResponsiveContainer>
              </div>
              {eduChart.byLevel.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginTop: 10, flexShrink: 0 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                      <th style={{ textAlign: 'left', padding: '5px 6px', color: SUB, fontWeight: 700 }}>ค่าใช้จ่ายต่อระดับชั้น (มูลค่าอนาคต)</th>
                      {eduChart.types.map(t => <th key={t.key} style={{ textAlign: 'right', padding: '5px 6px', color: t.color, fontWeight: 700 }}>{`สถาบัน${t.label}`}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {eduChart.byLevel.map((lv: any) => (
                      <tr key={lv.key} style={{ borderBottom: `1px solid ${HAIR}` }}>
                        <td style={{ padding: '4px 6px', color: INK }}>{lv.label}</td>
                        {eduChart.types.map(t => <td key={t.key} style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', color: lv[t.key] > 0 ? INK : MUTED }}>{lv[t.key] > 0 ? fmt(lv[t.key]) : '—'}</td>)}
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${LINE}` }}>
                      <td style={{ padding: '5px 6px', fontWeight: 800, color: INK }}>รวมทั้งหมด</td>
                      {eduChart.types.map(t => {
                        const tot = eduChart.byLevel.reduce((s: number, lv: any) => s + (lv[t.key] || 0), 0)
                        return <td key={t.key} style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: t.color }}>{fmt(tot)}</td>
                      })}
                    </tr>
                    <tr style={{ borderTop: `1px solid ${HAIR}`, background: PAPER }}>
                      <td style={{ padding: '5px 6px', fontWeight: 700, color: SUB }}>เงินออมต่อปี (เพื่อให้ครบทุน)</td>
                      {eduChart.types.map(t => {
                        const annual = eduChart.plans.find((p: any) => p.key === t.key)?.annual ?? 0
                        return <td key={t.key} style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: t.color }}>{fmt(annual)}<span style={{ fontSize: 9.5, color: MUTED, fontWeight: 500 }}> /ปี</span></td>
                      })}
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ) : <Empty text="ยังไม่มีข้อมูลบุตร/ค่าเล่าเรียน — กรอกที่หน้าทุนการศึกษา" />}
        </Slide>

        {/* ── คำแนะนำ: การบริหารความเสี่ยง/การประกัน ── */}
        <Slide slideId="insneed" footer={commentFooter('insneed')}>
          <SlideHead icon={ShieldCheck} kicker="Risk Management" title="การบริหารความเสี่ยง/การประกัน" accent={VI} />
          <TwoCol>
            {people.map(p => {
              if (!p.ins) return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <Empty text="ยังไม่มีข้อมูลแผนประกัน — กรอกที่หน้าวางแผนประกัน" />
                </div>
              )
              const rows = [
                { l: 'ทุนประกันที่ควรมี · Human Life Value', need: p.ins.hlvNeed, have: p.ins.have, gap: p.ins.hlvGap, sel: p.ins.method === 'hlv', short: 'HLV' },
                { l: 'ทุนประกันที่ควรมี · Need Base Analysis', need: p.ins.needsNeed, have: p.ins.have, gap: p.ins.needsGap, sel: p.ins.method !== 'hlv', short: 'Needs-Based' },
                { l: 'ทุนประกัน · กรณีทุพพลภาพ', need: p.ins.disNeed, have: p.ins.disHave, gap: p.ins.disGap, sel: false, short: 'ทุพพลภาพ' },
              ]
              const chart = rows.map(r => ({ name: r.short, มีแล้ว: Math.max(0, Math.round(r.have)), ส่วนที่ขาด: Math.max(0, Math.round(r.gap)) }))
              return (
                <div key={p.key} style={{ display: 'flex', flexDirection: 'column' }}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 8 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                        {['วิธีคำนวณทุนประกัน', 'ทุนที่ควรมี', 'มีแล้ว', 'ทำเพิ่ม'].map((h, i2) => (
                          <th key={h} style={{ padding: '4px 6px', fontSize: 9.5, fontWeight: 800, color: MUTED, textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>{rows.map(r => (
                      <tr key={r.l} style={{ borderBottom: `1px solid ${HAIR}`, background: r.sel ? `${p.tint}0d` : 'transparent' }}>
                        <td style={{ padding: '6px 6px', color: r.sel ? INK : SUB, fontWeight: r.sel ? 800 : 500 }}>{r.sel ? '☑ ' : ''}{r.l}{r.sel ? ' (วิธีที่เลือก)' : ''}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: INK }}>{fmt(r.need)}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: GR }}>{fmt(r.have)}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: r.gap > 0 ? AM : GR }}>{r.gap > 0 ? fmt(r.gap) : 'เพียงพอ'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '8px 8px 0' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase', marginBottom: 2 }}>เปรียบเทียบทุนประกัน — ความสูงแท่ง = ทุนที่ต้องการ</div>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: SUB }} />
                        <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9, fill: MUTED }} width={30} />
                        <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar isAnimationActive={false} dataKey="มีแล้ว" stackId="a" fill={GR} maxBarSize={44} />
                        <Bar isAnimationActive={false} dataKey="ส่วนที่ขาด" stackId="a" fill={AM} maxBarSize={44} radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── คำแนะนำ: การออมเพื่อการเกษียณ ── */}
        <Slide slideId="retiresave" footer={commentFooter('retiresave')}>
          <SlideHead icon={PiggyBank} kicker="Retirement Saving" title="การออมเพื่อการเกษียณ" accent={CY} />
          <TwoCol>
            {people.map(p => {
              const R = p.ret as any
              if (!R) return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <Empty text="ยังไม่มีข้อมูลแผนเกษียณ — กรอกที่หน้าวางแผนเกษียณ" />
                </div>
              )
              const chart = (R.projectionRows ?? []).map((row: any) => ({
                age: row.age,
                มูลค่ารวม: Math.round(row.phase === 'accumulation' ? (row.totalAccum ?? 0) : (row.closeBalance ?? 0)),
                ค่าใช้จ่าย: row.phase === 'retirement' ? Math.round((row.withdrawalLiving ?? 0) + (row.withdrawalGoals ?? 0)) : 0,
              }))
              const growth = R.savingsGrowthRate ?? 0
              const Card = ({ l, v, sub, c }: { l: string; v: string; sub?: string; c: string }) => (
                <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderLeft: `3px solid ${c}`, borderRadius: 10, padding: '6px 9px' }}>
                  <div style={{ fontSize: 8.5, color: MUTED, whiteSpace: 'nowrap' }}>{l}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: c, whiteSpace: 'nowrap' }}>{v}</div>
                  {sub && <div style={{ fontSize: 8.5, color: SUB, fontFamily: 'monospace' }}>{sub}</div>}
                </div>
              )
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                    <Card l="เงินเกษียณที่ต้องการ" v={fmt(R.needed)} c={INK} />
                    <Card l="มูลค่าสินทรัพย์ที่มี" v={fmt(R.have)} c={GR} />
                    <Card l="ส่วนที่ยังขาด" v={fmt(R.gap)} c={R.gap > 0 ? RD : GR} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                    <Card l="ต้องออมเพิ่ม (เท่ากันทุกปี)" v={`${fmt(R.annualSavings)} /ปี`} sub={`≈ ${fmt(R.annualSavings / 12)} /เดือน`} c="#0284c7" />
                    <Card l={`ออมเพิ่มขึ้นทุกปี${growth > 0 ? ` (+${growth}%/ปี)` : ''} — ปีแรก`} v={`${fmt(R.gradFirst)} /ปี`} sub={`≈ ${fmt(R.gradFirst / 12)} /เดือน`} c={VI} />
                  </div>
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '6px 8px 0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, textTransform: 'uppercase' }}>การคาดการณ์มูลค่าเงินในอนาคต (สะสม → ใช้เงินหลังเกษียณ)</div>
                    <ResponsiveContainer width="100%" height={185}>
                      <ComposedChart data={chart} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                        <XAxis dataKey="age" tick={{ fontSize: 8.5, fill: MUTED }} interval={4} />
                        <YAxis tickFormatter={(v: any) => fmtM(v)} tick={{ fontSize: 8.5, fill: MUTED }} width={34} />
                        <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                        <Legend wrapperStyle={{ fontSize: 9.5 }} />
                        {R.retireAge != null && <ReferenceLine x={R.retireAge} stroke={AM} strokeDasharray="4 3" />}
                        <Bar isAnimationActive={false} dataKey="ค่าใช้จ่าย" barSize={3} fill={`${AM}b0`} />
                        <Line isAnimationActive={false} dataKey="มูลค่ารวม" stroke={p.tint} strokeWidth={2.2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── คำแนะนำ: การวางแผนภาษี (ก่อน/หลังวางแผน) ── */}
        <Slide slideId="taxplan2" footer={commentFooter('taxplan2')}>
          <SlideHead icon={Receipt} kicker="Tax Planning" title="การวางแผนภาษี" accent={'#0ea5e9'} />
          <TwoCol>
            {people.map(p => {
              const st0 = taxPlan?.[p.key]
              if (!st0) return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <Empty text="ยังไม่มีข้อมูลแผนภาษี — กรอกที่หน้าวางแผนภาษี" />
                </div>
              )
              const st = { ...defaultState(), ...(st0 as TaxState) }
              const planned: Record<string, number> = (st0 as any).planned ?? {}
              const hasPlan = Object.keys(planned).length > 0
              const c0 = calc(st)
              const c1 = calc({ ...st, ...planned } as TaxState)
              const rows: [string, string, string, boolean?][] = [
                ['เงินได้พึงประเมินรวม', fmt(c0.ti), fmt(c1.ti)],
                ['หักค่าใช้จ่าย', `−${fmt(c0.expD)}`, `−${fmt(c1.expD)}`],
                ['หักค่าลดหย่อนรวม', `−${fmt(c0.allD - c0.expD)}`, `−${fmt(c1.allD - c1.expD)}`],
                ['เงินได้สุทธิ (ฐานภาษี)', fmt(c0.ni), fmt(c1.ni), true],
                ['ภาษีที่ต้องชำระ', fmt(c0.netTax), fmt(c1.netTax), true],
                ['อัตราภาษีขั้นสูงสุด', `${c0.mr}%`, `${c1.mr}%`],
                ['อัตราภาษีเฉลี่ย', `${c0.eff.toFixed(2)}%`, `${c1.eff.toFixed(2)}%`],
              ]
              const saved = c0.netTax - c1.netTax
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                        <th style={{ padding: '5px 6px', fontSize: 10, fontWeight: 800, color: MUTED, textAlign: 'left' }}>รายการ</th>
                        <th style={{ padding: '5px 6px', fontSize: 10, fontWeight: 800, color: MUTED, textAlign: 'right' }}>ปัจจุบัน</th>
                        <th style={{ padding: '5px 6px', fontSize: 10, fontWeight: 800, color: hasPlan ? GR : MUTED, textAlign: 'right' }}>หลังวางแผน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([l, cur, plan, strong]) => (
                        <tr key={l} style={{ borderBottom: `1px solid ${HAIR}`, fontWeight: strong ? 800 : 400 }}>
                          <td style={{ padding: '7px 6px', color: strong ? INK : SUB }}>{l}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: INK }}>{cur}</td>
                          <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: hasPlan && plan !== cur ? GR : MUTED }}>{hasPlan ? plan : '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: `1.5px solid ${LINE}` }}>
                        <td style={{ padding: '8px 6px', fontWeight: 800, color: INK }}>ประหยัดภาษีได้</td>
                        <td colSpan={2} style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: hasPlan && saved > 0 ? GR : MUTED, fontSize: 14 }}>
                          {hasPlan && saved > 0 ? `${fmt(saved)} บาท/ปี` : hasPlan ? '—' : 'ยังไม่ได้วางแผนเพิ่ม'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            })}
          </TwoCol>
        </Slide>

        {/* ── คำแนะนำ: การวางแผนมรดก ── */}
        <Slide slideId="estateplan2" footer={commentFooter('estateplan2')}>
          <SlideHead icon={ScrollText} kicker="Estate Planning" title="การวางแผนมรดก" accent={VI} />
          <TwoCol>
            {people.map(p => {
              const e = (estate as any)[p.key === 'self' ? 'self' : 'spouse']
              const b = balanceRows(p.ratios)
              if (!e) return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  <Empty text="ยังไม่มีข้อมูลแผนมรดก — กรอกที่หน้าวางแผนมรดก" />
                </div>
              )
              return (
                <div key={p.key}>
                  <PersonHead name={p.name} tint={p.tint} />
                  {/* สถานะพินัยกรรม */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: e.hasWill ? GR : AM, background: e.hasWill ? `${GR}14` : `${AM}14`, border: `1px solid ${e.hasWill ? GR : AM}44`, borderRadius: 999, padding: '3px 12px' }}>
                      {e.hasWill ? `✓ ทำพินัยกรรมไว้แล้ว${e.willType ? ` · ${e.willType}` : ''}` : '⚠ ยังไม่ได้ทำพินัยกรรม — แนะนำให้จัดทำ'}
                    </span>
                  </div>
                  {/* สรุปสินทรัพย์ */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginBottom: 8 }}>
                    <tbody>
                      {([['สินทรัพย์สภาพคล่อง', b.liquid, CY], ['สินทรัพย์ลงทุน', b.invest, GR], ['สินทรัพย์ส่วนตัว', b.personal, AM], ['รวมสินทรัพย์', b.total, INK], ['หนี้สินรวม', -b.debt, RD], ['ความมั่งคั่งสุทธิ (กองมรดกโดยประมาณ)', b.net, b.net >= 0 ? VI : RD]] as any[]).map(([l, v, c], i2) => (
                        <tr key={i2} style={{ borderBottom: `1px solid ${HAIR}`, fontWeight: (l as string).startsWith('รวม') || (l as string).startsWith('ความมั่งคั่ง') ? 800 : 400 }}>
                          <td style={{ padding: '5px 6px', color: SUB }}>{l}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: c }}>{fmt(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* การส่งต่อมรดกตามกฎหมาย */}
                  <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>
                      การส่งต่อมรดก{e.useWill ? 'ตามพินัยกรรม' : 'ตามกฎหมาย (ทายาทโดยธรรม ม.1629, 1635)'} · กองมรดกสุทธิ {fmt(e.estateVal)} บาท
                    </div>
                    {e.taxHeirs.length === 0
                      ? <div style={{ fontSize: 11.5, color: MUTED, padding: '4px 0' }}>— ยังไม่มีข้อมูลทายาท —</div>
                      : e.taxHeirs.map((h: any, i2: number) => {
                          const pctSh = e.estateVal > 0 ? h.share / e.estateVal * 100 : 0
                          return (
                            <div key={i2} style={{ padding: '4px 0', borderBottom: `1px solid ${HAIR}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{h.name} <span style={{ fontSize: 10, fontWeight: 400, color: MUTED }}>· {h.rel === 'spouse' ? 'คู่สมรส' : h.rel === 'lineal' ? 'บุพการี/ผู้สืบสันดาน' : 'อื่น ๆ'}</span></span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: p.tint, whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(h.share)} <span style={{ fontSize: 9.5, color: MUTED, fontWeight: 400 }}>({pctSh.toFixed(1)}%)</span></span>
                              </div>
                              <div style={{ height: 4, borderRadius: 999, background: '#eef2f6', marginTop: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.max(2, pctSh)}%`, borderRadius: 999, background: p.tint }} />
                              </div>
                            </div>
                          )
                        })}
                    {e.totalTax > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>
                        <span style={{ color: INK }}>ภาษีมรดกรวม</span>
                        <span style={{ fontFamily: 'monospace', color: RD }}>{fmt(e.totalTax)} บาท</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </TwoCol>
        </Slide>



        {/* ── 17. แผนปฏิบัติการ (แบ่งหลายหน้าอัตโนมัติ) ── */}
        {actionPages.map((pageItems, k) => (
          <Slide key={actionIds[k]} slideId={actionIds[k]} footer={commentFooter(actionIds[k])}>
            <SlideHead icon={ClipboardCheck} kicker="Action Plan" title={`แผนปฏิบัติการที่แนะนำ${actionPages.length > 1 ? ` (${k + 1}/${actionPages.length})` : ''}`} accent={GR} />
            {actionLines.length > 0 ? (
              <div style={{ flex: 1, minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ textAlign: 'left', padding: '7px 4px', color: SUB, fontWeight: 700 }}>แผนดำเนินการ</th>
                      <th style={{ textAlign: 'right', padding: '7px 4px', color: SUB, fontWeight: 700, width: 130 }}>จำนวนเงิน</th>
                      <th style={{ textAlign: 'left', padding: '7px 14px', color: SUB, fontWeight: 700, width: 130 }}>กำหนดการ</th>
                      <th style={{ textAlign: 'left', padding: '7px 4px', color: SUB, fontWeight: 700, width: 110 }}>ผู้รับผิดชอบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((l: any, i: number) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: '8px 4px', color: l.done ? MUTED : INK, textDecoration: l.done ? 'line-through' : 'none' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: l.color, marginRight: 8 }} />{l.plan}
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: l.amount > 0 ? INK : MUTED }}>{l.amount > 0 ? fmt(l.amount) : '—'}</td>
                        <td style={{ padding: '8px 14px', color: SUB }}>{l.schedule ? new Date(l.schedule).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                        <td style={{ padding: '8px 4px', color: SUB }}>{l.owner}</td>
                      </tr>
                    ))}
                    {/* แถวรวม (หน้าสุดท้าย) */}
                    {k === actionPages.length - 1 && (
                      <tr style={{ borderTop: '2px solid #cbd5e1' }}>
                        <td style={{ padding: '9px 4px', fontWeight: 800, color: INK }}>รวมเงินสำหรับทุกแผน</td>
                        <td style={{ padding: '9px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: CY }}>{fmt(actionLines.reduce((s, l) => s + l.amount, 0))}</td>
                        <td /><td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : <Empty text="ยังไม่มีแผนปฏิบัติการ — สร้างที่หน้าแผนปฏิบัติการ" />}
          </Slide>
        ))}

        {/* ── 18. ไทม์ไลน์แผนดำเนินการ ── */}
        <Slide slideId="holistic" footer={commentFooter('holistic')}>
          <SlideHead icon={CalendarClock} kicker="Timeline" title="ไทม์ไลน์แผนดำเนินการ" accent={VI} />
          {timelineItems.length > 0 ? (() => {
            const catLabel: Record<string, string> = { liquidity: 'สภาพคล่อง', insurance: 'ประกัน', retirement: 'เกษียณ', education: 'การศึกษา', estate: 'มรดก' }
            const n = timelineItems.length
            const cols = `repeat(${n}, 1fr)`
            return (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {/* แถบไล่สี + จุดวันที่ */}
                <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'linear-gradient(90deg, #7c3aed 0%, #2563eb 55%, #059669 100%)', borderRadius: 10, padding: '12px 4px' }}>
                  {timelineItems.map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#fff', padding: '0 4px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 999, background: '#fff', border: `3px solid rgba(255,255,255,0.55)`, flexShrink: 0 }} />
                      <div style={{ lineHeight: 1.05 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.date.toLocaleDateString('th-TH', { month: 'short' })}</div>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{t.date.toLocaleDateString('th-TH', { year: 'numeric' }).replace('พ.ศ. ', '')}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* เส้นประหย่อนลง */}
                <div style={{ display: 'grid', gridTemplateColumns: cols, height: 22 }}>
                  {timelineItems.map((_, i) => <div key={i} style={{ display: 'flex', justifyContent: 'center' }}><div style={{ borderLeft: `2px dotted #cbd5e1`, height: '100%' }} /></div>)}
                </div>
                {/* การ์ดข้อความ */}
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, alignItems: 'start' }}>
                  {timelineItems.map((t, i) => (
                    <div key={i} style={{ background: PAPER, border: `1px solid ${LINE}`, borderTop: `3px solid ${t.accent}`, borderRadius: 10, padding: '11px 12px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{catLabel[t.category] ?? t.category}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{t.title}</div>
                      {t.amount > 0 && <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: t.accent }}>{fmt(t.amount)} บาท</div>}
                      {t.desc && <div style={{ fontSize: 11, color: SUB, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{t.desc}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })() : <Empty text="ยังไม่มีกำหนดการในแผนดำเนินการ — กรอก 'กำหนดการ' ในหน้าแผนปฏิบัติการ" />}
        </Slide>

        {/* ── 19. งบการเงินล่วงหน้า (อายุปัจจุบัน → เกษียณ · แถวเกิน 1 หน้า → แบ่งหลายสไลด์อัตโนมัติ) ── */}
        {!forward ? (
          <Slide slideId="forward">
            <SlideHead icon={Banknote} kicker="Forward Cashflow" title={`งบการเงินล่วงหน้า · ${selfName}`} accent={CY} />
            <Empty text="ยังไม่มีข้อมูลงบการเงินล่วงหน้า — เปิดหน้างบการเงินล่วงหน้าเพื่อสร้างข้อมูลก่อน" />
          </Slide>
        ) : (() => {
            const f = forward
            const expTotal = f.ages.map((_, i) => f.fixedTotal[i] + f.varTotal[i] + f.savTotal[i] + f.tax[i])
            const net = f.ages.map((_, i) => f.incomeTotal[i] - expTotal[i])
            const remain = net.map((v, i) => v - f.goalTotal[i])
            // ฟอนต์คงที่ 10px — ถ้าจำนวนปีทำให้คอลัมน์แคบเกิน แบ่ง "ช่วงอายุ" ออกหลายสไลด์แทนการบีบฟอนต์
            const fz = 8
            const maxVal = Math.max(...f.incomeTotal, ...expTotal, ...net.map(Math.abs), ...remain.map(Math.abs), 1)
            const maxChars = fmt(Math.round(maxVal)).length + 1
            // คอลัมน์ชื่อรายการแคบลง (120px) + เผื่อความกว้างตัวอักษร monospace จริง (~0.62em) กันตัวเลขล้นขอบ
            const labelW = 120
            const colNeedPx = maxChars * 0.62 * fz + 7
            const maxCols = Math.max(4, Math.floor((1008 - labelW) / colNeedPx))
            const padY = 3
            // ความสูงแถวจริง (ฟอนต์ + padding บนล่าง + เส้นคั่น) เทียบพื้นที่ตารางจริงในสไลด์
            // (สูง ~792 − padding บน 40 − หัวสไลด์ ~70 − footer/เลขหน้า ~45 − แถวหัวตาราง ~20 ≈ 560px)
            // เผื่อขอบล่างเพิ่ม — แถวใดแสดงไม่เต็มบรรทัดให้ตกไปหน้าใหม่ ไม่ให้โดนตัดที่ขอบสไลด์
            const rowPx = Math.ceil(fz * 1.25 + padY * 2 + 1)
            const rowsPerPage = Math.max(10, Math.floor(500 / rowPx))
            // แบ่งช่วงอายุ (คอลัมน์) เป็นก้อน ๆ ละไม่เกิน maxCols ปี
            const ageChunks: { s: number; e: number }[] = []
            for (let s = 0; s < f.ages.length; s += maxCols) ageChunks.push({ s, e: Math.min(s + maxCols, f.ages.length) })
            const num = (v: number, c?: string, b?: boolean): React.CSSProperties => ({ padding: `${padY}px 3px`, textAlign: 'right', fontFamily: 'monospace', fontSize: fz, lineHeight: 1.2, color: c ?? (v > 0 ? INK : '#c3ccd6'), fontWeight: b ? 800 : 400, whiteSpace: 'nowrap' })
            const lbl = (indent = false, b = false, c?: string): React.CSSProperties => ({ padding: `${padY}px 3px ${padY}px ${indent ? 10 : 3}px`, textAlign: 'left', fontSize: fz, lineHeight: 1.2, color: c ?? (b ? INK : SUB), fontWeight: b ? 800 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 })
            const SecRow = ({ title, color, cols }: { title: string; color: string; cols: number }) => (
              <tr><td colSpan={cols + 1} style={{ padding: `${padY + 1}px 3px ${padY}px`, fontSize: fz + 0.5, lineHeight: 1.2, fontWeight: 800, color, borderBottom: `1px solid ${LINE}` }}>{title}</td></tr>
            )
            const LineRow = ({ r }: { r: { label: string; vals: number[] } }) => (
              <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={lbl(true)}>{r.label}</td>
                {r.vals.map((v, i) => <td key={i} style={num(v)}>{v > 0 ? fmt(v) : '–'}</td>)}
              </tr>
            )
            const TotalRow = ({ label, vals, color }: { label: string; vals: number[]; color: string }) => (
              <tr style={{ borderBottom: `1px solid ${LINE}`, background: PAPER }}>
                <td style={lbl(false, true, color)}>{label}</td>
                {vals.map((v, i) => <td key={i} style={num(v, color, true)}>{fmt(v)}</td>)}
              </tr>
            )
            // สร้างหน้า: ต่อ 1 ช่วงอายุ → แถวทั้งหมด (ลำดับเดียวกับหน้างบการเงินล่วงหน้า) ตัดแบ่งหน้า ๆ ละ rowsPerPage แถว
            const pages: { ages: number[]; rows: React.ReactNode[] }[] = []
            for (const ch of ageChunks) {
              const sl = (arr: number[]) => arr.slice(ch.s, ch.e)
              const cols = ch.e - ch.s
              const rows: React.ReactNode[] = [
                <SecRow key="sec-in" title="กระแสเงินสดรับ" color={GR} cols={cols} />,
                ...f.incomeLines.map((r, i) => <LineRow key={`in${i}`} r={{ label: r.label, vals: sl(r.vals) }} />),
                <TotalRow key="t-in" label="รวมรายรับ" vals={sl(f.incomeTotal)} color={GR} />,
                <SecRow key="sec-fx" title="ค่าใช้จ่ายคงที่" color={AM} cols={cols} />,
                ...f.fixedLines.map((r, i) => <LineRow key={`fx${i}`} r={{ label: r.label, vals: sl(r.vals) }} />),
                <TotalRow key="t-fx" label="รวมค่าใช้จ่ายคงที่" vals={sl(f.fixedTotal)} color={AM} />,
                <SecRow key="sec-vr" title="ค่าใช้จ่ายผันแปร + ภาษี" color={RD} cols={cols} />,
                ...f.varLines.map((r, i) => <LineRow key={`vr${i}`} r={{ label: r.label, vals: sl(r.vals) }} />),
                <LineRow key="tax" r={{ label: 'ภาษีเงินได้', vals: sl(f.tax) }} />,
                <TotalRow key="t-vr" label="รวมผันแปร (รวมภาษี)" vals={sl(f.ages.map((_, i) => f.varTotal[i] + f.tax[i]))} color={RD} />,
                <SecRow key="sec-sv" title="เงินออม/ลงทุน" color={VI} cols={cols} />,
                ...f.savLines.map((r, i) => <LineRow key={`sv${i}`} r={{ label: r.label, vals: sl(r.vals) }} />),
                <TotalRow key="t-sv" label="รวมออม/ลงทุน" vals={sl(f.savTotal)} color={VI} />,
                <TotalRow key="t-exp" label="รวมกระแสเงินสดจ่าย" vals={sl(expTotal)} color={RD} />,
                <tr key="net" style={{ borderTop: '1.5px solid #cbd5e1' }}>
                  <td style={lbl(false, true)}>กระแสเงินสดสุทธิ</td>
                  {sl(net).map((v, i) => <td key={i} style={num(v, v >= 0 ? CY : RD, true)}>{fmt(v)}</td>)}
                </tr>,
                <SecRow key="sec-gl" title="ค่าใช้จ่ายเพื่อเป้าหมายทางการเงิน" color={CY} cols={cols} />,
                ...f.goalLines.map((r, i) => <LineRow key={`gl${i}`} r={{ label: r.label, vals: sl(r.vals) }} />),
                <TotalRow key="t-gl" label="รวมรายจ่ายเพื่อเป้าหมาย" vals={sl(f.goalTotal)} color={CY} />,
                <tr key="remain" style={{ borderTop: '1.5px solid #cbd5e1' }}>
                  <td style={lbl(false, true)}>กระแสเงินสดคงเหลือ</td>
                  {sl(remain).map((v, i) => <td key={i} style={num(v, v >= 0 ? CY : RD, true)}>{fmt(v)}</td>)}
                </tr>,
              ]
              for (let i = 0; i < rows.length; i += rowsPerPage)
                pages.push({ ages: sl(f.ages), rows: rows.slice(i, i + rowsPerPage) })
            }
            return pages.map((pg, pi) => (
              <Slide slideId="forward" key={`fwd-${pi}`}>
                <SlideHead icon={Banknote} kicker="Forward Cashflow"
                  title={`งบการเงินล่วงหน้า · ${selfName} (อายุ ${pg.ages[0]}–${pg.ages[pg.ages.length - 1]})${pages.length > 1 ? ` · ${pi + 1}/${pages.length}` : ''}`} accent={CY} />
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                        <th style={{ ...lbl(false, true), width: 120 }}>อายุ / ปี</th>
                        {pg.ages.map(a => <th key={a} style={{ ...num(1, SUB, true) }}>{a}</th>)}
                      </tr>
                    </thead>
                    <tbody>{pg.rows}</tbody>
                  </table>
                </div>
              </Slide>
            ))
          })()}

        {/* ── หน้าที่ผู้ใช้เพิ่มเอง (custom slides) ── */}
        {customSlides.map((cs, i) => (
          <div key={cs.id} style={{ position: 'relative', width: '100%', maxWidth: 1120, display: 'flex', justifyContent: 'center' }}>
            <Slide slideId={cs.id} />
            {editMode && (
              <div className="no-print" style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, zIndex: 45 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: 'rgba(15,42,67,0.86)', borderRadius: 6, padding: '4px 9px' }}>หน้าใหม่ {i + 1}</span>
                <button onClick={() => onMoveSlide(cs.id, -1)} title="เลื่อนขึ้น" style={customBtn}><ArrowUp size={13} /></button>
                <button onClick={() => onMoveSlide(cs.id, 1)} title="เลื่อนลง" style={customBtn}><ArrowDown size={13} /></button>
                <button onClick={() => onDelSlide(cs.id)} title="ลบหน้า" style={{ ...customBtn, color: '#fecaca' }}><Trash2 size={13} /></button>
              </div>
            )}
          </div>
        ))}

        {/* ── หน้าขอบคุณ (ท้ายสุดเสมอ — หลัง custom slides) ── */}
        <Slide slideId="thankyou" noFooter pad={0}>
          {(() => {
            const bio = advisorBio ?? advisor?.bio ?? ''
            const addr = advisor?.address || [advisor?.addrHouseNo, advisor?.addrSubdistrict && `ต.${advisor.addrSubdistrict}`, advisor?.addrDistrict && `อ.${advisor.addrDistrict}`, advisor?.addrProvince && `จ.${advisor.addrProvince}`, advisor?.addrZipcode].filter(Boolean).join(' ')
            const creds = [
              advisor?.licenseCFP && `คุณวุฒินักวางแผนการเงิน CFP เลขที่ ${advisor.licenseCFP}`,
              advisor?.licenseFChFP && `คุณวุฒิที่ปรึกษาการเงินมืออาชีพ (FChFP) เลขที่ ${advisor.licenseFChFP}`,
              advisor?.licenseAFPT && `คุณวุฒิที่ปรึกษาการเงิน AFPT เลขที่ ${advisor.licenseAFPT}`,
              advisor?.licenseInsurance && `ใบอนุญาตตัวแทน/นายหน้าประกันชีวิต เลขที่ ${advisor.licenseInsurance}`,
            ].filter(Boolean) as string[]
            const Contact = ({ icon, text }: { icon: string; text: string }) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, background: CY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{icon}</div>
                <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.5 }}>{text}</div>
              </div>
            )
            return (
              <div style={{ position: 'absolute', inset: 0, background: '#ffffff', color: INK, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '22px 30px' }}>
                {/* แถบ hero บน */}
                <div style={{ position: 'relative', height: 92, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', right: -50, top: -50, width: 170, height: 170, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
                  <div style={{ position: 'absolute', left: 24, bottom: 16 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>YOUR FINANCIAL PLANNER</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginTop: 2 }}>นักวางแผนการเงินของคุณ</div>
                  </div>
                  <div style={{ position: 'absolute', right: 22, bottom: 16, fontSize: 14, fontWeight: 800 }}>
                    <span style={{ color: '#fff' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
                  </div>
                </div>

                {/* เนื้อหา 2 คอลัมน์ */}
                <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 28, padding: '16px 4px 8px' }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {bio && <div style={{ fontSize: 12.5, color: '#1e293b', lineHeight: 1.85, fontStyle: 'italic', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>{bio}</div>}
                    {creds.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {creds.map(c2 => (
                          <div key={c2} style={{ display: 'flex', gap: 7, fontSize: 11.5, color: SUB, lineHeight: 1.8 }}>
                            <span style={{ color: CY, fontWeight: 800 }}>✓</span>{c2}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                      <div style={{ width: 150, height: 3.5, background: INK, marginBottom: 10 }} />
                      <div style={{ fontSize: 21, fontWeight: 800, color: INK }}>{advisor?.fullName || 'นักวางแผนการเงิน'}{advisor?.licenseCFP ? ', CFP' : ''}</div>
                      {advisor?.position && <div style={{ fontSize: 13, color: SUB, marginTop: 2 }}>{advisor.position}</div>}
                      {advisor?.company && <div style={{ fontSize: 12, color: MUTED }}>{advisor.company}</div>}
                      <div style={{ marginTop: 12 }}>
                        {advisor?.phone && <Contact icon="✆" text={advisor.phone} />}
                        {advisor?.email && <Contact icon="✉" text={advisor.email} />}
                        {addr && <Contact icon="⌂" text={addr} />}
                      </div>
                    </div>
                  </div>
                  {/* รูป */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: 300, height: '100%', display: 'flex', alignItems: 'center' }}>
                      {(thankYouPhoto || advisor?.photo)
                        ? <img src={thankYouPhoto || advisor?.photo} alt="" style={{ width: '100%', maxHeight: '100%', objectFit: 'cover', borderRadius: 12, border: `1.5px solid ${CY}55`, boxShadow: '0 12px 36px rgba(15,42,67,0.18)' }} />
                        : <div style={{ width: '100%', aspectRatio: '3 / 4', maxHeight: '100%', borderRadius: 12, background: PAPER, border: `1.5px dashed ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={56} color={MUTED} /></div>}
                      {editMode && (
                        <>
                          <button className="no-print" onClick={() => thankPhotoRef.current?.click()}
                            style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(15,42,67,0.86)', color: '#fff', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <ImagePlus size={13} /> เปลี่ยนรูป
                          </button>
                          <input ref={thankPhotoRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={async e => { const f = e.target.files?.[0]; if (f) { try { const { src } = await downscaleImage(f); onThankYouPhoto?.(src) } catch { /* */ } } e.target.value = '' }} />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* แถบปิดท้าย */}
                <div style={{ height: 34, borderRadius: 10, background: 'linear-gradient(90deg, #0f172a 0%, #134e4a 60%, #00cfc1 140%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.85)' }}>WEALTHPRO · FINANCIAL PLANNING</span>
                </div>
              </div>
            )
          })()}
        </Slide>

        {/* ปุ่มเพิ่มหน้า (edit mode) */}
        {editMode && (
          <button className="no-print" onClick={onAddSlide}
            style={{ width: '100%', maxWidth: 1120, aspectRatio: '297 / 210', border: `2px dashed ${MUTED}`, borderRadius: 10, background: '#fff', color: SUB, fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <FilePlus2 size={26} /> เพิ่มหน้าใหม่
          </button>
        )}
      </div>

      {dialog && <CommentDialog title={dialog.title} value={cOf(dialog.key)} onSave={t => onComment(dialog.key, t)} onClose={() => setDialog(null)} />}
    </SlideEditor.Provider>
  )
}

const customBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: 'none', background: 'rgba(15,42,67,0.86)', color: '#fff', cursor: 'pointer' }

/* ── แผนผังเป้าหมาย: รวม self+spouse แยก ระยะสั้น/กลาง/ยาว ── */
