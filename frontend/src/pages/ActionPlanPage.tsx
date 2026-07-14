import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import {
  ClipboardCheck, Plus, Trash2, CalendarClock, Target, ShieldCheck,
  GraduationCap, Wallet, Landmark, Receipt, ScrollText, Sparkles, Flag, User, Users, Check,
  ChevronDown, ListChecks, TrendingUp,
} from 'lucide-react'

const fmt = (n: number) => Math.round(n || 0).toLocaleString('th-TH')
const baht = (n: number) => `${fmt(n)} บาท`

type Item = {
  id: string; title: string; category: string; status: string; owner: string
  priority: string; dueDate: string | null; note: string | null
  metricKey: string | null; baseline: number | null; current: number | null; target: number | null
  source: string; autoKey: string | null; completedAt: string | null; subPlan: SubRow[] | null
}
type SubRow = Record<string, any>
type SubCol = { key: string; label: string; type: 'text' | 'money' | 'date' | 'select'; placeholder?: string; flex?: boolean; options?: string[] }
type SubConfig = { title: string; accent: string; cols: SubCol[] }
const OWNER_OPTIONS = ['ลูกค้า', 'คู่สมรส', 'ที่ปรึกษา', 'ร่วม']
const ownerCol: SubCol = { key: 'owner', label: 'ผู้รับผิดชอบ', type: 'select', options: OWNER_OPTIONS }
const SUBPLAN_CONFIG: Record<string, SubConfig> = {
  liquidity: {
    title: 'แผนบริหารสภาพคล่อง', accent: '#06b6d4',
    cols: [
      { key: 'method', label: 'วิธีการ', type: 'text', placeholder: 'เช่น กันเงินอัตโนมัติทุกเดือน · ลดค่าใช้จ่ายฟุ่มเฟือย', flex: true },
      { key: 'tool', label: 'เครื่องมือ', type: 'text', placeholder: 'เช่น บัญชีดอกเบี้ยสูง · กองทุนตลาดเงิน' },
      { key: 'amount', label: 'จำนวนเงิน/เดือน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
  savings: {
    title: 'แผนดำเนินการเพื่อการออม', accent: '#10b981',
    cols: [
      { key: 'desc', label: 'แผนปฏิบัติการ', type: 'text', placeholder: 'เช่น หักบัญชีออมอัตโนมัติทุกเดือน · ลดค่าใช้จ่ายฟุ่มเฟือย', flex: true },
      { key: 'tool', label: 'เครื่องมือ', type: 'text', placeholder: 'เช่น บัญชีออมทรัพย์ดอกเบี้ยสูง · กองทุนรวม' },
      { key: 'amount', label: 'จำนวนเงิน/เดือน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
  insurance: {
    title: 'แผนดำเนินการเรื่องการประกัน', accent: '#3b82f6',
    cols: [
      { key: 'desc', label: 'แผนปฏิบัติการ', type: 'text', placeholder: 'เช่น ซื้อประกันชีวิตแบบ 20 pay life', flex: true },
      { key: 'sumInsured', label: 'ทุนประกัน', type: 'money' },
      { key: 'premium', label: 'เบี้ยประกัน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
  retirement: {
    title: 'แผนดำเนินการเพื่อการเกษียณ', accent: '#00cfc1',
    cols: [
      { key: 'desc', label: 'แผนปฏิบัติการ', type: 'text', placeholder: 'เช่น ลงทุนในกองทุนรวม', flex: true },
      { key: 'assetType', label: 'ประเภทสินทรัพย์', type: 'text', placeholder: 'RMF / SSF / หุ้น' },
      { key: 'amount', label: 'จำนวนเงิน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
  education: {
    title: 'แผนดำเนินการเพื่อทุนการศึกษาบุตร', accent: '#ffb800',
    cols: [
      { key: 'desc', label: 'แผนปฏิบัติการ', type: 'text', placeholder: 'เช่น ทยอยลงทุนเพื่อการศึกษา', flex: true },
      { key: 'assetType', label: 'ประเภทสินทรัพย์', type: 'text', placeholder: 'กองทุนรวม / สลาก / ประกันสะสมทรัพย์' },
      { key: 'amount', label: 'จำนวนเงิน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
  estate: {
    title: 'แผนดำเนินการเรื่องมรดก', accent: '#a78bfa',
    cols: [
      { key: 'who', label: 'ใคร', type: 'text', placeholder: 'เช่น ลูกค้า / ทนายความ' },
      { key: 'desc', label: 'ทำอะไร', type: 'text', placeholder: 'เช่น จัดทำพินัยกรรม · ระบุผู้รับผลประโยชน์', flex: true },
      ownerCol,
      { key: 'schedule', label: 'เมื่อไหร่', type: 'date' },
    ],
  },
  tax: {
    title: 'แผนดำเนินการด้านภาษี', accent: '#0ea5e9',
    cols: [
      { key: 'desc', label: 'แผนปฏิบัติการ', type: 'text', placeholder: 'เช่น ซื้อ RMF/SSF เพิ่ม · ทำประกันชีวิตลดหย่อน', flex: true },
      { key: 'tool', label: 'เครื่องมือ/สิทธิ', type: 'text', placeholder: 'RMF / SSF / ThaiESG / ประกันชีวิต' },
      { key: 'amount', label: 'จำนวนเงิน', type: 'money' },
      ownerCol,
      { key: 'schedule', label: 'กำหนดการ', type: 'date' },
    ],
  },
}
const emptySub = (cfg: SubConfig): SubRow => Object.fromEntries(cfg.cols.map(c => [c.key, c.type === 'money' ? null : '']))

const CAT: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  liquidity: { label: 'สภาพคล่อง', icon: Wallet, color: '#06b6d4' },
  debt: { label: 'หนี้สิน', icon: Landmark, color: '#ef4444' },
  savings: { label: 'การออม', icon: Wallet, color: '#10b981' },
  insurance: { label: 'ประกัน', icon: ShieldCheck, color: '#3b82f6' },
  retirement: { label: 'เกษียณ', icon: Target, color: '#00cfc1' },
  education: { label: 'การศึกษา', icon: GraduationCap, color: '#ffb800' },
  tax: { label: 'ภาษี', icon: Receipt, color: '#f59e0b' },
  estate: { label: 'มรดก', icon: ScrollText, color: '#a78bfa' },
  other: { label: 'อื่นๆ', icon: Flag, color: '#8b9198' },
}
const catOf = (c: string) => CAT[c] || CAT.other

const STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: 'ยังไม่เริ่ม', color: '#8b9198' },
  doing: { label: 'กำลังทำ', color: '#3b82f6' },
  done: { label: 'เสร็จแล้ว', color: '#10b981' },
  deferred: { label: 'เลื่อนออกไป', color: '#f59e0b' },
}
const PRIORITY: Record<string, { label: string; color: string }> = {
  high: { label: 'สูง', color: '#ef4444' }, medium: { label: 'กลาง', color: '#f59e0b' }, low: { label: 'ต่ำ', color: '#8b9198' },
}

// ค่าปัจจุบันของ metric (คำนวณสด) + ทิศทางเป้าหมาย
type MetricCtx = { emergencyMonths: number; insHave: number; retHave: number; debtToAsset: number; savingsRate: number; eduTotal: number; liquidAssets: number; sixMonthReserve: number }
const METRICS: Record<string, { unit: string; dir: 'up' | 'down'; live: (m: MetricCtx) => number; fmt: (v: number) => string }> = {
  emergencyMonths: { unit: 'เดือน', dir: 'up', live: m => m.emergencyMonths, fmt: v => `${v.toFixed(1)} เดือน` },
  insuranceCoverage: { unit: 'บาท', dir: 'up', live: m => m.insHave, fmt: baht },
  retirementAssets: { unit: 'บาท', dir: 'up', live: m => m.retHave, fmt: baht },
  debtToAsset: { unit: '%', dir: 'down', live: m => m.debtToAsset, fmt: v => `${v.toFixed(0)}%` },
  savingsRate: { unit: '%', dir: 'up', live: m => m.savingsRate, fmt: v => `${v.toFixed(0)}%` },
  liquidAssets: { unit: 'บาท', dir: 'down', live: m => m.liquidAssets, fmt: baht },
}
// map autoKey → metricKey (ให้รายการเก่าที่ยังไม่มี metricKey ดึงค่าได้ย้อนหลัง)
const AUTO_METRIC: Record<string, string> = {
  'emergency-fund': 'emergencyMonths',
  'emergency-excess': 'liquidAssets',
  'reduce-debt': 'debtToAsset',
  'raise-savings': 'savingsRate',
  'insurance-gap': 'insuranceCoverage',
  'retirement-gap': 'retirementAssets',
}

type Progress = {
  pct: number; conf: (typeof METRICS)[string] | null
  liveVal: number | null   // ค่าปัจจุบันจากระบบ (ถ้ามี metric)
  curVal: number | null     // ค่าที่ใช้จริง (กรอกเอง > ระบบ)
  target: number | null     // เป้าหมายที่ใช้จริง (กรอกเอง > ระบบ)
  sysTarget: number | null  // เป้าหมายจากระบบ (เช่น ค่าเล่าเรียนรวม)
  targetFromSystem: boolean
  usingManual: boolean; hasTarget: boolean; unit: string
}
// เป้าหมายที่ดึงจากระบบตาม autoKey (การศึกษา → ค่าเล่าเรียนรวมอนาคต)
function systemTargetOf(item: Item, m: MetricCtx): number | null {
  if (item.autoKey === 'education-fund') return m.eduTotal > 0 ? m.eduTotal : null
  if (item.autoKey === 'emergency-excess') return m.sixMonthReserve > 0 ? m.sixMonthReserve : null
  return null
}
function progressOf(item: Item, m: MetricCtx): Progress {
  const metricKey = item.metricKey ?? (item.autoKey ? AUTO_METRIC[item.autoKey] : undefined)
  const conf = metricKey ? METRICS[metricKey] : null
  const dir = conf?.dir ?? 'up'
  const unit = conf?.unit ?? 'บาท'
  const liveVal = conf ? conf.live(m) : null
  const usingManual = item.current != null
  const curVal = usingManual ? item.current! : liveVal
  const sysTarget = systemTargetOf(item, m)
  const target = item.target != null ? item.target : sysTarget
  const targetFromSystem = item.target == null && sysTarget != null
  if (target == null || curVal == null) {
    const pct = item.status === 'done' ? 100 : item.status === 'doing' ? 50 : 0
    return { pct, conf, liveVal, curVal, target, sysTarget, targetFromSystem, usingManual, hasTarget: target != null, unit }
  }
  let pct: number
  if (item.baseline == null) {
    // ไม่มีจุดตั้งต้น → วัดเทียบเป้าโดยตรง
    if (dir === 'up') pct = target > 0 ? (curVal / target) * 100 : 0
    else pct = curVal <= target ? 100 : (target / curVal) * 100
  } else {
    const base = item.baseline
    if (dir === 'up') pct = target <= base ? (curVal >= target ? 100 : 0) : ((curVal - base) / (target - base)) * 100
    else pct = base <= target ? (curVal <= target ? 100 : 0) : ((base - curVal) / (base - target)) * 100
  }
  return { pct: Math.max(0, Math.min(100, pct)), conf, liveVal, curVal, target, sysTarget, targetFromSystem, usingManual, hasTarget: true, unit }
}
const fmtVal = (conf: (typeof METRICS)[string] | null, v: number) => conf ? conf.fmt(v) : baht(v)

// ช่องกรอกตัวเลข: คั่นหลักพัน · เว้นว่าง = null · commit ตอน blur (กันยิง API ทุกคีย์)
function NumBox({ value, onChange, placeholder, width = 108 }: {
  value: number | null; onChange: (n: number | null) => void; placeholder?: string; width?: number
}) {
  const disp = (v: number | null) => (v == null ? '' : v.toLocaleString('en-US', { maximumFractionDigits: 2 }))
  const [text, setText] = useState<string>(disp(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(disp(value)) }, [value, focused])
  const commit = () => {
    setFocused(false)
    const r = text.replace(/,/g, '').trim()
    if (r === '') onChange(null)
    else if (!isNaN(Number(r))) onChange(Number(r))
  }
  return (
    <input type="text" inputMode="decimal" value={text} placeholder={placeholder}
      onFocus={() => { setFocused(true); setText(value == null ? '' : String(value)) }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onChange={e => setText(e.target.value)}
      style={{ width, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--navy-800)', color: 'var(--text-primary)', fontSize: 12, textAlign: 'right', fontFamily: 'monospace' }} />
  )
}

// ตารางแผนดำเนินการย่อย (config ตามหมวด) — เพิ่ม/ลบแถว + บรรทัดรวม
function SubPlanTable({ value, config, onSave, hideHeader }: { value: SubRow[] | null; config: SubConfig; onSave: (rows: SubRow[]) => void; hideHeader?: boolean }) {
  const [rows, setRows] = useState<SubRow[]>(() => (value && value.length ? value : [emptySub(config)]))
  const rowsRef = useRef(rows)
  useEffect(() => { rowsRef.current = rows }, [rows])
  const commit = () => onSave(rowsRef.current)
  const setCell = (i: number, k: string, v: any) => setRows(r => r.map((row, j) => j === i ? { ...row, [k]: v } : row))
  const setSave = (i: number, k: string, v: any) => { setCell(i, k, v); onSave(rowsRef.current.map((r, j) => j === i ? { ...r, [k]: v } : r)) }
  const addRow = () => setRows(r => { const n = [...r, emptySub(config)]; onSave(n); return n })
  const delRow = (i: number) => setRows(r => { const n = r.filter((_, j) => j !== i); const nn = n.length ? n : [emptySub(config)]; onSave(nn); return nn })

  const cellStyle: React.CSSProperties = { padding: '5px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--navy-800)', color: 'var(--text-primary)', fontSize: 12, width: '100%' }
  const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 8px' }
  const widthOf = (c: SubCol) => c.flex ? 'minmax(160px,1fr)' : c.type === 'money' ? '128px' : c.type === 'date' ? '120px' : c.type === 'select' ? '116px' : '130px'
  const gridCols = config.cols.map(widthOf).join(' ') + ' 28px'
  const sumOf = (key: string) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0)

  const addBtn = (
    <button onClick={addRow} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, border: `1px solid ${config.accent}`, background: `${config.accent}18`, color: config.accent, cursor: 'pointer' }}>
      <Plus size={12} /> เพิ่มแถว
    </button>
  )
  return (
    <div style={hideHeader ? undefined : { marginTop: 12, border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--navy-800)', borderBottom: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{config.title}</span>
          {addBtn}
        </div>
      )}
      <div style={{ padding: hideHeader ? '4px 0 0' : 10, overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          {/* หัวตาราง */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center' }}>
            {config.cols.map(col => <div key={col.key} style={{ ...th, textAlign: col.type === 'money' ? 'right' : 'left' }}>{col.label}</div>)}
            <div />
          </div>
          {/* แถวข้อมูล */}
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center', marginTop: 6 }}>
              {config.cols.map(col => col.type === 'money'
                ? <NumBox key={col.key} value={row[col.key] ?? null} width={124} onChange={v => setSave(i, col.key, v)} />
                : col.type === 'date'
                  ? <input key={col.key} type="date" value={row[col.key] || ''} onChange={e => setSave(i, col.key, e.target.value)} style={cellStyle} />
                  : col.type === 'select'
                    ? <select key={col.key} value={row[col.key] || ''} onChange={e => setSave(i, col.key, e.target.value)} style={cellStyle}>
                        <option value="">— เลือก —</option>
                        {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    : <input key={col.key} value={row[col.key] || ''} placeholder={col.placeholder} onChange={e => setCell(i, col.key, e.target.value)} onBlur={commit} style={cellStyle} />)}
              <button onClick={() => delRow(i)} title="ลบแถว" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>
            </div>
          ))}
          {/* บรรทัดรวม — เฉพาะตารางที่มีคอลัมน์เงิน */}
          {config.cols.some(c => c.type === 'money') && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
              {config.cols.map((col, ci) => ci === 0
                ? <div key={col.key} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>รวม</div>
                : col.type === 'money'
                  ? <div key={col.key} style={{ fontSize: 12.5, fontWeight: 700, color: config.accent, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(sumOf(col.key))}</div>
                  : <div key={col.key} />)}
              <div />
            </div>
          )}
        </div>
        {hideHeader && <div style={{ marginTop: 8 }}>{addBtn}</div>}
      </div>
    </div>
  )
}

// สรุปสิทธิลดหย่อนภาษี — ดึงยอดจากตารางแผน (subPlan) ของเป้าหมายอื่น
const DEDUCTS: { key: string; label: string; cap: number; match: (s: string) => boolean }[] = [
  { key: 'pension', label: 'ประกันบำนาญ', cap: 200000, match: s => /บำนาญ/.test(s) },
  { key: 'health', label: 'ประกันสุขภาพ', cap: 25000, match: s => /สุขภาพ/.test(s) },
  { key: 'life', label: 'ประกันชีวิต', cap: 100000, match: s => /ชีวิต|สะสมทรัพย์|pay ?life/i.test(s) },
  { key: 'rmf', label: 'กองทุน RMF', cap: 500000, match: s => /\brmf\b/i.test(s) },
  { key: 'ssf', label: 'กองทุน SSF', cap: 200000, match: s => /\bssf\b/i.test(s) },
  { key: 'esg', label: 'กองทุน Thai ESG', cap: 300000, match: s => /thai ?esg|thaiesg|\besg\b/i.test(s) },
]
function classify(text: string): string | null {
  for (const d of DEDUCTS) if (d.match(text)) return d.key
  return null
}
function TaxDeductionSummary({ items, hideHeader }: { items: Item[]; hideHeader?: boolean }) {
  const buckets: Record<string, number> = {}
  let unclassified = 0
  for (const it of items) {
    if (it.category === 'tax' || !Array.isArray(it.subPlan)) continue
    for (const row of it.subPlan) {
      const amt = Number(row?.premium ?? row?.amount ?? 0) || 0
      if (amt <= 0) continue
      const key = classify(`${row?.desc || ''} ${row?.assetType || ''}`)
      if (key) buckets[key] = (buckets[key] || 0) + amt
      else unclassified += amt
    }
  }
  const val = (k: string) => buckets[k] || 0
  // ใช้สิทธิ (ประมาณ) ตามเพดานเดี่ยว + เพดานรวม
  const life = Math.min(val('life'), 100000)
  const health = Math.min(val('health'), 25000)
  const lifeHealth = Math.min(life + health, 100000)          // ชีวิต+สุขภาพ รวม ≤ 100,000
  const pension = Math.min(val('pension'), 200000)
  const rmf = Math.min(val('rmf'), 500000)
  const ssf = Math.min(val('ssf'), 200000)
  const retireGroup = Math.min(pension + rmf + ssf, 500000)   // กลุ่มเกษียณรวม ≤ 500,000
  const esg = Math.min(val('esg'), 300000)
  const totalUsed = lifeHealth + retireGroup + esg
  const totalPlanned = DEDUCTS.reduce((a, d) => a + val(d.key), 0)
  const has = totalPlanned > 0

  const th: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '4px 8px' }
  const gridCols = 'minmax(140px,1fr) 120px 120px'
  const money = (n: number): React.CSSProperties => ({ fontSize: 12.5, textAlign: 'right', fontFamily: 'monospace', color: n > 0 ? 'var(--text-primary)' : 'var(--text-muted)' })

  return (
    <div style={hideHeader ? undefined : { marginTop: 12, border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
      {!hideHeader && (
        <div style={{ padding: '8px 12px', background: 'var(--navy-800)', borderBottom: '1px solid var(--card-border)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>สรุปสิทธิลดหย่อน (ดึงจากแผนเป้าหมายอื่น)</span>
        </div>
      )}
      <div style={{ padding: hideHeader ? '4px 0 0' : 10, overflowX: 'auto' }}>
        {!has
          ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 4px' }}>ยังไม่มีข้อมูล — เพิ่มเบี้ยประกัน/เงินลงทุนกองทุน (RMF/SSF/Thai ESG) ในตารางแผนของเป้าหมายประกัน · เกษียณ · การศึกษา แล้วยอดจะมาสรุปที่นี่อัตโนมัติ</div>
          : <div style={{ minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6 }}>
              <div style={th}>ประเภทลดหย่อน</div>
              <div style={{ ...th, textAlign: 'right' }}>ตามแผน</div>
              <div style={{ ...th, textAlign: 'right' }}>เพดาน</div>
            </div>
            {DEDUCTS.filter(d => val(d.key) > 0).map(d => (
              <div key={d.key} style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center', marginTop: 6 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{d.label}</div>
                <div style={money(val(d.key))}>{fmt(val(d.key))}</div>
                <div style={{ ...money(0), color: 'var(--text-muted)' }}>{fmt(d.cap)}</div>
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 6, alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>รวมสิทธิลดหย่อน (ประมาณ)</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>{fmt(totalUsed)}</div>
              <div />
            </div>
            {unclassified > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>* มีรายการที่ระบุประเภทไม่ได้ {fmt(unclassified)} บาท (ใส่คำว่า ชีวิต/สุขภาพ/บำนาญ/RMF/SSF/ESG ในช่องแผนหรือประเภทสินทรัพย์)</div>
            )}
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              ประมาณการตามเพดาน: ชีวิต+สุขภาพ รวม ≤ 100,000 · กลุ่มเกษียณ (บำนาญ+RMF+SSF) รวม ≤ 500,000 · Thai ESG ≤ 300,000 · เพดานบางรายการอิง % ของเงินได้ ควรตรวจสอบก่อนยื่นจริง
            </div>
          </div>}
      </div>
    </div>
  )
}

// slider เลื่อนความคืบหน้า 0→100% (ซ้าย=ค่าเดิม, ขวา=เป้าหมาย) · commit ตอนปล่อย
function ProgressSlider({ pct, color, onCommit }: { pct: number; color: string; onCommit: (pct: number) => void }) {
  const [val, setVal] = useState(Math.round(pct))
  const [drag, setDrag] = useState(false)
  useEffect(() => { if (!drag) setVal(Math.round(pct)) }, [pct, drag])
  const commit = () => { if (drag) { setDrag(false); onCommit(val) } }
  return (
    <input type="range" min={0} max={100} value={val}
      onChange={e => { setDrag(true); setVal(Number(e.target.value)) }}
      onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} onBlur={commit}
      style={{ flex: 1, accentColor: color, cursor: 'pointer', height: 4 }} />
  )
}

// เกจครึ่งวงกลมแสดงความคืบหน้า
function Gauge({ pct, color, caption }: { pct: number; color: string; caption?: string }) {
  const r = 44, cx = 56, cy = 50, sw = 9
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <svg width={112} height={62} viewBox="0 0 112 62" style={{ display: 'block' }}>
        <path d={d} fill="none" stroke="var(--navy-700)" strokeWidth={sw} strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          pathLength={100} strokeDasharray="100" strokeDashoffset={100 - clamped}
          style={{ transition: 'stroke-dashoffset .5s ease' }} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="800" fill={color}>{Math.round(clamped)}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--text-muted)">%</text>
      </svg>
      {caption && <div style={{ fontSize: 10, color: clamped >= 100 ? '#10b981' : 'var(--text-muted)', marginTop: -2, fontWeight: 600 }}>{caption}</div>}
    </div>
  )
}

const apKeyframes = `@keyframes apItemIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`

// การ์ดรายการเดียว — แยกโซน: identity / ติดตามผล / แผนดำเนินการ (พับได้)
function ItemCard({ it, index, metricCtx, items, onPatch, onRemove }: {
  it: Item; index: number; metricCtx: MetricCtx; items: Item[]
  onPatch: (id: string, body: any) => void; onRemove: (id: string) => void
}) {
  const c = catOf(it.category)
  const st = STATUS[it.status] || STATUS.todo
  const pr = PRIORITY[it.priority] || PRIORITY.medium
  const p = progressOf(it, metricCtx)
  const prog = Math.round(p.pct)
  const done = it.status === 'done'
  const showTracking = it.category !== 'estate'
  const hasSubTable = !!SUBPLAN_CONFIG[it.category]
  const isTax = it.category === 'tax'
  const hasTable = hasSubTable || isTax
  const rowCount = Array.isArray(it.subPlan) ? it.subPlan.length : 0
  const [open, setOpen] = useState(false)
  const gaugeColor = prog >= 100 ? '#10b981' : c.color
  const microLabel: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--text-muted)' }
  const chip: React.CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }
  const numField = (label: string, node: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{node}<span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.unit}</span></div>
    </label>
  )

  return (
    <div style={{ position: 'relative', borderRadius: 14, background: 'var(--card-bg)', border: `1px solid ${done ? '#10b98140' : 'var(--card-border)'}`, overflow: 'hidden', opacity: it.status === 'deferred' ? 0.72 : 1, animation: 'apItemIn .4s ease both', animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: gaugeColor }} />
      <div style={{ padding: '14px 16px 14px 19px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* identity */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <button onClick={() => onPatch(it.id, { status: done ? 'todo' : 'done' })} title="ทำเครื่องหมายเสร็จ"
            style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 3, cursor: 'pointer', border: `2px solid ${done ? '#10b981' : 'var(--navy-500)'}`, background: done ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {done && <Check size={14} color="#fff" />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 27, height: 27, borderRadius: 8, background: `${c.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <c.icon size={14} style={{ color: c.color }} />
              </div>
              <input value={it.title} onChange={e => onPatch(it.id, { title: e.target.value })}
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: 14.5, fontWeight: 600, textDecoration: done ? 'line-through' : 'none', padding: 0 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
              <select value={it.status} onChange={e => onPatch(it.id, { status: e.target.value })} style={{ ...chip, border: `1px solid ${st.color}55`, background: `${st.color}14`, color: st.color }}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={it.priority} onChange={e => onPatch(it.id, { priority: e.target.value })} style={{ ...chip, border: `1px solid ${pr.color}55`, background: `${pr.color}14`, color: pr.color }}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>ความสำคัญ {v.label}</option>)}
              </select>
            </div>
          </div>
          {showTracking && <Gauge pct={p.pct} color={gaugeColor} caption={p.hasTarget && p.curVal != null ? (prog >= 100 ? 'สำเร็จ ✓' : 'คืบหน้า') : undefined} />}
          <button onClick={() => onRemove(it.id)} title="ลบ" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, padding: 2, marginTop: 2 }}>
            <Trash2 size={15} />
          </button>
        </div>

        {/* ติดตามผล */}
        {showTracking && (
          <div style={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 11, padding: '12px 14px' }}>
            <div style={{ ...microLabel, marginBottom: 10 }}>ติดตามผล</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px 20px' }}>
              {numField('ปัจจุบัน', <NumBox value={it.current} placeholder={p.liveVal != null ? Math.round(p.liveVal).toLocaleString('en-US') : '0'} onChange={v => onPatch(it.id, { current: v })} />)}
              {numField('เป้าหมาย', <NumBox value={it.target} placeholder={p.sysTarget != null ? Math.round(p.sysTarget).toLocaleString('en-US') : undefined} onChange={v => onPatch(it.id, { target: v })} />)}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 3 }}>
                {it.autoKey === 'emergency-excess'
                  ? (p.curVal != null && p.target != null && (() => { const ex = p.curVal - p.target; const over = ex >= 0; return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 7, background: over ? '#10b98118' : '#ef444418', color: over ? '#10b981' : '#ef4444' }}>
                      {over ? 'สภาพคล่องส่วนเกิน' : 'สภาพคล่องขาด'} {fmt(Math.abs(ex))} บาท
                    </span>) })())
                  : <>
                    {p.liveVal != null && !p.usingManual && <span style={{ fontSize: 10.5, color: 'var(--cyan)' }}>ปัจจุบันใช้ค่าจากระบบ ({fmtVal(p.conf, p.liveVal)})</span>}
                    {p.targetFromSystem && <span style={{ fontSize: 10.5, color: '#ffb800' }}>{it.autoKey === 'education-fund' ? 'เป้าหมายจากแผนการศึกษา' : 'เป้าหมายจากระบบ'} ({fmtVal(p.conf, p.sysTarget!)})</span>}
                  </>}
                {p.usingManual && p.liveVal != null && <button onClick={() => onPatch(it.id, { current: null })} style={{ fontSize: 10.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>ใช้ค่าจากระบบแทน</button>}
              </div>
            </div>
            {p.target != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ค่าเดิม {fmtVal(p.conf, it.baseline ?? 0)}</span>
                <ProgressSlider pct={p.pct} color={gaugeColor} onCommit={pctv => { const base = it.baseline ?? 0; const cur = base + (p.target! - base) * (pctv / 100); onPatch(it.id, { current: Math.round(cur * 100) / 100 }) }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>เป้าหมาย {fmtVal(p.conf, p.target)}</span>
              </div>
            )}
          </div>
        )}

        {/* แผนดำเนินการ (พับได้) */}
        {hasTable && (
          <div style={{ border: '1px solid var(--card-border)', borderRadius: 11, overflow: 'hidden' }}>
            <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', background: open ? 'var(--navy-800)' : 'var(--navy-900)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <ListChecks size={15} style={{ color: c.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{hasSubTable ? SUBPLAN_CONFIG[it.category].title : 'สรุปสิทธิลดหย่อนภาษี'}</span>
              {hasSubTable && rowCount > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {rowCount} รายการ</span>}
              <ChevronDown size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />
            </button>
            <div style={{ maxHeight: open ? 2400 : 0, overflow: 'hidden', transition: 'max-height .35s ease' }}>
              <div style={{ padding: '2px 13px 13px' }}>
                {hasSubTable && <SubPlanTable value={it.subPlan} config={SUBPLAN_CONFIG[it.category]} hideHeader onSave={rows => onPatch(it.id, { subPlan: rows })} />}
                {isTax && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>สรุปสิทธิลดหย่อนภาษี</div>
                    <TaxDeductionSummary items={items} hideHeader />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 6 ด้านหลัก CFP (Holistic Financial Planning) ──
const PLAN_SECTIONS: { key: string; title: string; sub: string; icon: React.ElementType; color: string; cats: string[] }[] = [
  { key: 'liquidity', title: 'การบริหารสภาพคล่อง/หนี้สิน', sub: 'สภาพคล่อง · หนี้สิน · การออม/ลงทุน', icon: Wallet, color: '#06b6d4', cats: ['liquidity', 'savings', 'debt'] },
  { key: 'investment', title: 'การวางแผนการลงทุน', sub: 'จัดพอร์ตให้สอดคล้องเป้าหมาย ผลตอบแทน และความเสี่ยง', icon: TrendingUp, color: '#10b981', cats: ['investment', 'education', 'other'] },
  { key: 'insurance', title: 'การวางแผนประกัน & ความเสี่ยง', sub: 'ป้องกันความเสี่ยงไม่ให้เป้าหมายทางการเงินสะดุด', icon: ShieldCheck, color: '#3b82f6', cats: ['insurance'] },
  { key: 'retirement', title: 'การวางแผนเกษียณอายุ', sub: 'เงินก้อนหลังเกษียณ & แผนสะสมเงิน', icon: Target, color: '#00cfc1', cats: ['retirement'] },
  { key: 'tax', title: 'การวางแผนภาษี', sub: 'ใช้สิทธิลดหย่อนอย่างคุ้มค่า ถูกต้องตามกฎหมาย', icon: Receipt, color: '#0ea5e9', cats: ['tax'] },
  { key: 'estate', title: 'การวางแผนส่งมอบมรดก', sub: 'ส่งต่อทรัพย์สินราบรื่น เป็นธรรม ประหยัดภาษี', icon: ScrollText, color: '#a78bfa', cats: ['estate'] },
]


// กล่องคำแนะนำนักวางแผน — บันทึกตอน blur
function AdviceBox({ value, color, onSave }: { value: string; color: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  const savedRef = useRef(value)
  useEffect(() => { setText(value); savedRef.current = value }, [value])
  const commit = () => { if (text !== savedRef.current) { savedRef.current = text; onSave(text) } }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Sparkles size={13} style={{ color }} /> คำแนะนำนักวางแผน
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} onBlur={commit}
        placeholder="บันทึกคำแนะนำ/ข้อสังเกตของนักวางแผนสำหรับด้านนี้..."
        style={{ width: '100%', minHeight: 62, resize: 'vertical', padding: '9px 11px', borderRadius: 9, border: '1px solid var(--card-border)', background: 'var(--navy-950)', color: 'var(--text-primary)', fontSize: 12.5, lineHeight: 1.5, outline: 'none', boxSizing: 'border-box' }} />
    </div>
  )
}

const money = (n: number) => n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : `฿${fmt(n)}`

// อัตราส่วนทางการเงิน + เกณฑ์มาตรฐาน (ตรงกับหน้าอัตราส่วนทางการเงิน) — ใช้แสดงตัวที่ไม่ผ่านเกณฑ์
const RATIO_INFO: Record<string, { name: string; standard: string; unit: 'times' | 'months' | 'pct'; group: string }> = {
  ratio1: { name: 'สภาพคล่อง', standard: '> 1 เท่า', unit: 'times', group: 'สภาพคล่อง' },
  ratio2: { name: 'สภาพคล่องพื้นฐาน', standard: '3–6 เดือน', unit: 'months', group: 'สภาพคล่อง' },
  ratio3: { name: 'สินทรัพย์สภาพคล่องต่อความมั่งคั่งสุทธิ', standard: '> 15%', unit: 'pct', group: 'สภาพคล่อง' },
  ratio4: { name: 'หนี้สินต่อสินทรัพย์', standard: '< 50%', unit: 'pct', group: 'หนี้สิน' },
  ratio5: { name: 'ภาระผ่อนหนี้ต่อรายได้', standard: '< 35–45%', unit: 'pct', group: 'หนี้สิน' },
  ratio6: { name: 'หนี้ไม่จดจำนองต่อรายได้', standard: '< 15–20%', unit: 'pct', group: 'หนี้สิน' },
  ratio7: { name: 'การออม', standard: '≥ 10%', unit: 'pct', group: 'ออม/ลงทุน' },
  ratio8: { name: 'การลงทุน', standard: '≥ 50%', unit: 'pct', group: 'ออม/ลงทุน' },
}
const fmtRatio = (v: number, unit: string) => unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(0)}%`

// แถบความคืบหน้า (label + ค่า + %)
function MetricBar({ label, valueText, pct, color }: { label: string; valueText: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-muted)', letterSpacing: .4, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{valueText}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--navy-700)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999, transition: 'width .5s' }} />
      </div>
    </div>
  )
}
function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--navy-950)', padding: '9px 11px', borderRadius: 10, border: '1px solid var(--card-border)' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color ?? 'var(--text-primary)', marginTop: 2, fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}
const StatRow = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>{children}</div>
)

export default function ActionPlanPage() {
  const qc = useQueryClient()
  const [person, setPerson] = useState<'self' | 'spouse'>('self')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const ratioPerson = person === 'spouse' ? 'spouse' : 'client'
  const { data: cp } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data) })
  const clientName = cp?.firstName ? `คุณ${cp.firstName}` : 'ลูกค้า'
  const spouseName = cp?.spouseProfile?.firstName ? `คุณ${cp.spouseProfile.firstName}` : 'คู่สมรส'
  const hasSpouse = /สมรส|แต่งงาน/.test(cp?.maritalStatus || '') || !!(cp?.spouseProfile?.firstName || cp?.spouseName)

  const { data, isLoading } = useQuery({ queryKey: ['action-items', person], queryFn: () => api.get(`/action-items?person=${person}`).then(r => r.data) })
  const { data: ratios } = useQuery({ queryKey: ['financial-ratios', ratioPerson], queryFn: () => api.get(`/financial-ratios?person=${ratioPerson}`).then(r => r.data) })
  const ret = useRetirementReadiness(ratioPerson)
  const ins = useInsuranceReadiness(ratioPerson)
  const edu = useEducationReadiness()

  const items: Item[] = data?.items || []
  const reviewDate: string | null = data?.planReviewDate || null

  const s = ratios?.summary
  const metricCtx: MetricCtx = useMemo(() => ({
    emergencyMonths: s && s.totalMonthlyExp > 0 ? s.liquidAssets / s.totalMonthlyExp : 0,
    insHave: ins?.have ?? 0,
    retHave: ret?.have ?? 0,
    debtToAsset: s && s.totalAssets > 0 ? (s.totalDebtBalance / s.totalAssets) * 100 : 0,
    savingsRate: s && s.monthlyIncome > 0 ? (s.annualSavings / (s.monthlyIncome * 12)) * 100 : 0,
    eduTotal: edu && edu.childCount > 0 ? edu.totalNominal : 0,
    liquidAssets: s?.liquidAssets ?? 0,
    sixMonthReserve: s ? 6 * s.totalMonthlyExp : 0,
  }), [s, ins, ret, edu])

  // ── คำแนะนำอัตโนมัติจากการวิเคราะห์ ──
  const suggestions = useMemo(() => {
    const out: Array<Partial<Item> & { autoKey: string; title: string; category: string; reason: string }> = []
    if (s) {
      // สภาพคล่อง — เกณฑ์ CFP ~3-6 เดือน: น้อยไป (เสี่ยง) หรือ มากไป (เงินจมเสียโอกาส)
      const months = metricCtx.emergencyMonths
      if (months < 6) out.push({ autoKey: 'emergency-fund', title: 'เพิ่มเงินสำรองฉุกเฉินให้ครบ 6 เดือน', category: 'liquidity', priority: 'high', owner: 'client', metricKey: 'emergencyMonths', baseline: months, target: 6, reason: `ปัจจุบันสำรอง ~${months.toFixed(1)} เดือน (ต่ำกว่าเกณฑ์ 3-6 เดือน)` })
      else if (months > 6) {
        const excess = Math.max(0, s.liquidAssets - 6 * s.totalMonthlyExp)
        out.push({ autoKey: 'emergency-excess', title: 'จัดสรรเงินสำรองส่วนเกินไปลงทุนเพิ่มผลตอบแทน', category: 'liquidity', priority: 'medium', owner: 'client', metricKey: 'liquidAssets', baseline: s.liquidAssets, reason: `สำรอง ~${months.toFixed(0)} เดือน (เกิน 6 เดือน · เงินจมเสียโอกาส) · ส่วนเกิน ~${baht(excess)}` })
      }
      // หนี้ต่อสินทรัพย์ — สูงเกิน 50% เท่านั้นที่เป็นปัญหา
      if (metricCtx.debtToAsset > 50) out.push({ autoKey: 'reduce-debt', title: 'ลดภาระหนี้ให้ต่ำกว่า 50% ของสินทรัพย์', category: 'debt', priority: 'high', owner: 'client', metricKey: 'debtToAsset', baseline: metricCtx.debtToAsset, target: 50, reason: `หนี้ต่อสินทรัพย์ ${metricCtx.debtToAsset.toFixed(0)}% (สูงกว่าเกณฑ์ 50%)` })
      // การออม — น้อยไป (เตรียมไม่พอ) หรือ มากเกินจนกระทบคุณภาพชีวิต/ควรลงทุนให้งอกเงย
      if (metricCtx.savingsRate < 10) out.push({ autoKey: 'raise-savings', title: 'เพิ่มอัตราการออมให้ถึง 10% ของรายได้', category: 'savings', priority: 'medium', owner: 'client', metricKey: 'savingsRate', baseline: metricCtx.savingsRate, target: 10, reason: `ออม ~${metricCtx.savingsRate.toFixed(0)}% ของรายได้ (ต่ำกว่าเกณฑ์ 10%)` })
      else if (metricCtx.savingsRate > 40) out.push({ autoKey: 'savings-high', title: 'ทบทวนสมดุลการออม & จัดสรรไปลงทุนเพื่อการเติบโต', category: 'savings', priority: 'low', owner: 'client', reason: `ออมสูง ~${metricCtx.savingsRate.toFixed(0)}% ของรายได้ — ควรนำไปลงทุนให้งอกเงย/ดูแลคุณภาพชีวิต` })
    }
    if (ins && ins.gap > 0) out.push({ autoKey: 'insurance-gap', title: 'เพิ่มทุนประกันชีวิตให้เพียงพอตามความจำเป็น', category: 'insurance', priority: 'high', owner: 'client', metricKey: 'insuranceCoverage', baseline: ins.have, target: ins.need, reason: `ทุนประกันขาดอีก ${baht(ins.gap)}` })
    if (ret && ret.gap > 0) out.push({ autoKey: 'retirement-gap', title: 'ออมเพื่อการเกษียณเพิ่มเติม', category: 'retirement', priority: 'high', owner: 'client', metricKey: 'retirementAssets', baseline: ret.have, target: ret.needed, reason: `เงินเกษียณขาดอีก ${baht(ret.gap)} (ออม ${fmt(ret.annualSavings)}/ปี)` })
    if (edu && edu.childCount > 0) out.push({ autoKey: 'education-fund', title: 'เริ่มเก็บทุนการศึกษาบุตร', category: 'education', priority: 'medium', owner: 'client', baseline: 0, reason: `บุตร ${edu.childCount} คน · ค่าเล่าเรียนรวม ${baht(edu.totalNominal)} · ออม ~${fmt(edu.monthlySaving)}/เดือน` })
    out.push({ autoKey: 'make-will', title: 'จัดทำพินัยกรรม & ตรวจสอบผู้รับผลประโยชน์', category: 'estate', priority: 'medium', owner: 'client', reason: 'ให้การส่งต่อมรดกเป็นไปตามความประสงค์' })
    out.push({ autoKey: 'tax-deduction', title: 'ใช้สิทธิลดหย่อนภาษีให้เต็มเพดาน', category: 'tax', priority: 'low', owner: 'client', reason: 'RMF/SSF/ประกัน/บริจาค ฯลฯ' })

    const existingKeys = new Set(items.map(i => i.autoKey).filter(Boolean))
    return out.filter(o => !existingKeys.has(o.autoKey))
  }, [s, ins, ret, edu, items, metricCtx])

  const create = useMutation({
    mutationFn: (body: any) => api.post('/action-items', { ...body, person }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items'] }),
  })
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/action-items/${id}`, body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items'] }),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/action-items/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items'] }),
  })
  const saveReview = useMutation({
    mutationFn: (d: string | null) => api.put('/plan-review-date', { planReviewDate: d }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['action-items'] }),
  })
  const advice: Record<string, string> = data?.advice || {}
  const saveAdvice = useMutation({
    mutationFn: ({ section, text }: { section: string; text: string }) => api.put('/action-plan-advice', { person, section, text }).then(r => r.data),
    onSuccess: (res: any) => qc.setQueryData(['action-items', person], (old: any) => old ? { ...old, advice: res.advice } : old),
  })

  // ── สรุปความคืบหน้ารวม ──
  const doneCount = items.filter(i => i.status === 'done').length
  const overallPct = items.length ? Math.round((doneCount / items.length) * 100) : 0

  const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow)' }


  const goals = (cp?.financialGoals as any)?.[person] ?? null
  const goalRows: any[] = goals
    ? [...(goals.short || []), ...(goals.medium || []), ...(goals.long || [])]
        .filter((g: any) => (g?.name || '').trim() || Number(String(g?.targetAmount || '').replace(/,/g, '')) > 0)
    : []

  const sectionStatus = (key: string): { label: string; color: string } => {
    const OK = { label: 'เพียงพอ', color: '#10b981' }
    const NEU = { label: 'วางแผน', color: 'var(--text-muted)' }
    const WARN = (t: string) => ({ label: t, color: '#f59e0b' })
    if (key === 'liquidity') { if (!s) return NEU; return (metricCtx.emergencyMonths >= 6 && metricCtx.debtToAsset <= 50 && metricCtx.savingsRate >= 10) ? OK : WARN('ควรปรับปรุง') }
    if (key === 'insurance') { if (!ins) return NEU; return ins.gap > 0 ? WARN(`ขาด ${baht(ins.gap)}`) : OK }
    if (key === 'retirement') { if (!ret) return NEU; return ret.gap > 0 ? WARN(`ขาด ${baht(ret.gap)}`) : OK }
    return NEU
  }

  const AMBER = '#f59e0b', GREEN = '#10b981'
  const renderMetrics = (key: string): React.ReactNode => {
    if (key === 'liquidity') {
      if (!s) return null
      const fails = (ratios?.ratios ?? []).filter((r: any) => r.state !== 'good' && r.state !== 'nodata' && r.value != null && RATIO_INFO[r.key])
      return <>
        <MetricBar label="เงินสำรองฉุกเฉิน" valueText={`${money(metricCtx.liquidAssets)} / ${money(metricCtx.sixMonthReserve)}`}
          pct={metricCtx.sixMonthReserve > 0 ? metricCtx.liquidAssets / metricCtx.sixMonthReserve * 100 : 0} color="var(--cyan)" />
        <StatRow>
          <StatBox label="อัตราการออม" value={`${metricCtx.savingsRate.toFixed(0)}%`} color={metricCtx.savingsRate < 10 ? AMBER : GREEN} />
          <StatBox label="หนี้ / สินทรัพย์" value={`${metricCtx.debtToAsset.toFixed(0)}%`} color={metricCtx.debtToAsset > 50 ? AMBER : undefined} />
        </StatRow>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>อัตราส่วนที่ต้องปรับปรุง</div>
          {fails.length === 0
            ? <div style={{ fontSize: 12, color: GREEN, padding: '2px 0' }}>ทุกอัตราส่วนผ่านเกณฑ์มาตรฐาน ✓</div>
            : fails.map((r: any) => {
              const m = RATIO_INFO[r.key]
              const col = r.state === 'danger' ? '#f43f5e' : AMBER
              const adv = ratios?.advice?.[r.key]
              return (
                <div key={r.key} style={{ padding: '6px 0', borderTop: '1px solid var(--divider)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                      {m.name} <span style={{ fontSize: 9.5, color: 'var(--text-muted)', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '1px 5px' }}>{m.group}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'monospace', color: col, whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtRatio(r.value, m.unit)}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>เกณฑ์ {m.standard}{adv ? ` · ${adv}` : ''}</div>
                </div>
              )
            })}
        </div>
      </>
    }
    if (key === 'insurance') {
      if (!ins) return null
      return <>
        <MetricBar label="ทุนประกันชีวิต (HLV)" valueText={`${money(ins.have)} / ${money(ins.need)}`}
          pct={ins.need > 0 ? ins.have / ins.need * 100 : 0} color={ins.gap > 0 ? AMBER : 'var(--cyan)'} />
        <StatRow>
          <StatBox label="ทุนแนะนำ (Needs)" value={money(ins.needsNeed)} />
          <StatBox label="ส่วนที่ขาด" value={ins.gap > 0 ? money(ins.gap) : 'เพียงพอ'} color={ins.gap > 0 ? AMBER : GREEN} />
        </StatRow>
      </>
    }
    if (key === 'retirement') {
      if (!ret) return null
      const need = (ret as any).needed ?? 0
      return <>
        <MetricBar label="ทุนเกษียณที่ต้องการ" valueText={`${money(ret.have ?? 0)} / ${money(need)}`}
          pct={need > 0 ? (ret.have ?? 0) / need * 100 : 0} color={ret.gap > 0 ? AMBER : 'var(--cyan)'} />
        <StatRow>
          <StatBox label="ส่วนที่ขาด" value={ret.gap > 0 ? money(ret.gap) : 'เพียงพอ'} color={ret.gap > 0 ? AMBER : GREEN} />
          <StatBox label="ต้องออม/เดือน" value={(ret as any).annualSavings > 0 ? money((ret as any).annualSavings / 12) : '—'} />
        </StatRow>
      </>
    }
    if (key === 'investment') {
      return <>
        <StatRow>
          <StatBox label="เป้าหมายการเงิน" value={`${goalRows.length} รายการ`} />
          <StatBox label="ทุนการศึกษา" value={edu && edu.childCount > 0 ? money(edu.totalNominal) : '—'} color={edu && edu.childCount > 0 ? '#ffb800' : undefined} />
        </StatRow>
        {goalRows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {goalRows.slice(0, 4).map((gr: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gr.name || 'เป้าหมาย'}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', flexShrink: 0 }}>{money(Number(String(gr.targetAmount || '').replace(/,/g, '')) || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </>
    }
    if (key === 'tax') {
      return <div style={{ marginBottom: 14 }}><TaxDeductionSummary items={items} hideHeader /></div>
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1120 }}>
      <style>{apKeyframes}</style>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardCheck size={21} style={{ color: 'var(--cyan)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>แผนปฏิบัติการ & ติดตามความคืบหน้า</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>เปลี่ยนคำแนะนำเป็นการปฏิบัติจริง แล้วติดตามผลตามข้อมูลในระบบ</div>
        </div>
        {hasSpouse && (
          <div style={{ display: 'inline-flex', gap: 3, background: 'var(--navy-900)', padding: 3, borderRadius: 9, border: '1px solid var(--card-border)' }}>
            {([['self', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).map(([key, col, Icon, label]) => (
              <button key={key} onClick={() => setPerson(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: person === key ? `${col}20` : 'transparent', color: person === key ? col : 'var(--text-muted)', fontWeight: person === key ? 600 : 400, fontSize: 12.5 }}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarClock size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>นัดทบทวน</span>
          <input type="date" value={reviewDate ? reviewDate.slice(0, 10) : ''}
            onChange={e => saveReview.mutate(e.target.value || null)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13 }} />
        </div>
      </div>

      {/* 6 ด้าน CFP — bento grid */}
      {isLoading ? <div style={{ ...card, color: 'var(--text-muted)', fontSize: 13 }}>กำลังโหลด...</div> : (() => {
        const KNOWN = new Set(PLAN_SECTIONS.flatMap(x => x.cats))
        const itemsFor = (sec: typeof PLAN_SECTIONS[number]) => items.filter(it => sec.cats.includes(it.category) || (sec.key === 'investment' && !KNOWN.has(it.category)))
        const sugFor = (sec: typeof PLAN_SECTIONS[number]) => suggestions.filter(sg => sec.cats.includes(sg.category) || (sec.key === 'investment' && !KNOWN.has(sg.category)))
        const warnSecs = PLAN_SECTIONS.filter(x => sectionStatus(x.key).color === AMBER)
        return <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
            {PLAN_SECTIONS.map((sec, si) => {
              const st = sectionStatus(sec.key)
              const secItems = itemsFor(sec)
              const secSug = sugFor(sec)
              return (
                <div key={sec.key} style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 440 }}>
                  {/* header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${sec.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <sec.icon size={20} style={{ color: sec.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 700 }}>ด้านที่ {si + 1}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{sec.title}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>

                  {/* ① ตัวชี้วัด (คำนวณ) */}
                  {renderMetrics(sec.key)}

                  {/* ② คำแนะนำนักวางแผน */}
                  <AdviceBox value={advice[sec.key] || ''} color={sec.color} onSave={t => saveAdvice.mutate({ section: sec.key, text: t })} />

                  {/* คำแนะนำอัตโนมัติ */}
                  {secSug.map(sg => (
                    <div key={sg.autoKey} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '8px 11px', borderRadius: 10, background: 'var(--navy-900)', border: `1px dashed ${sec.color}44`, marginBottom: 8 }}>
                      <Sparkles size={14} style={{ color: sec.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{sg.title}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(sg as any).reason}</div>
                      </div>
                      <button onClick={() => create.mutate({ ...sg, source: 'auto' })} disabled={create.isPending}
                        title="เพิ่มเข้าแผน" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 9px', borderRadius: 7, border: `1px solid ${sec.color}`, background: `${sec.color}18`, color: sec.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Plus size={11} /> เพิ่ม
                      </button>
                    </div>
                  ))}

                  {/* ③ แผนดำเนินการ — checklist */}
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase', color: sec.color, display: 'flex', alignItems: 'center', gap: 5 }}><ListChecks size={14} /> แผนดำเนินการ</span>
                      <button onClick={() => create.mutate({ title: 'รายการใหม่', category: sec.cats[0], priority: 'medium', owner: 'advisor', source: 'manual' })}
                        title="เพิ่มรายการ" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 7, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-secondary)', fontSize: 11.5, cursor: 'pointer' }}>
                        <Plus size={12} /> เพิ่ม
                      </button>
                    </div>
                    {secItems.length === 0
                      ? <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '4px 0' }}>ยังไม่มีรายการ — เพิ่มจากคำแนะนำหรือกด "เพิ่ม"</div>
                      : secItems.map(it => {
                        const done = it.status === 'done'
                        const open = expandedItem === it.id
                        return (
                          <div key={it.id}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
                              <input type="checkbox" checked={done} onChange={() => update.mutate({ id: it.id, body: { status: done ? 'todo' : 'done' } })}
                                style={{ width: 16, height: 16, accentColor: sec.color, cursor: 'pointer', flexShrink: 0 }} />
                              <span onClick={() => setExpandedItem(open ? null : it.id)}
                                style={{ flex: 1, minWidth: 0, fontSize: 12.5, cursor: 'pointer', color: done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', opacity: done ? .65 : 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{it.title}</span>
                              <ChevronDown size={14} onClick={() => setExpandedItem(open ? null : it.id)} style={{ color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                            </div>
                            {open && (
                              <div style={{ margin: '4px 0 10px' }}>
                                <ItemCard it={it} index={0} metricCtx={metricCtx} items={items}
                                  onPatch={(id, body) => update.mutate({ id, body })} onRemove={id => { remove.mutate(id); setExpandedItem(null) }} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* บทสรุปภาพรวม */}
          <div style={{ marginTop: 4, padding: '20px 24px', borderRadius: 14, border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 42, height: 42, borderRadius: 999, background: 'var(--cyan)', color: '#00201d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClipboardCheck size={21} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>บทสรุปภาพรวมแผนการเงิน</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.65 }}>
                ความคืบหน้ารวม <strong style={{ color: 'var(--cyan-light)' }}>{overallPct}%</strong> ({doneCount}/{items.length} รายการเสร็จ)
                {warnSecs.length > 0
                  ? <> · ด้านที่ควรเร่งดำเนินการ: <strong style={{ color: AMBER }}>{warnSecs.map(w => w.title).join(' · ')}</strong></>
                  : <> · ทุกด้านอยู่ในเกณฑ์ดี 👍</>}
              </div>
            </div>
          </div>
        </>
      })()}
    </div>
  )
}
