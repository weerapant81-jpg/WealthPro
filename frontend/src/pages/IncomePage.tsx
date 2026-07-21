import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, Check, X, Wallet } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card, inp, sel, btn } from '../styles/dark'
import { monthlyIncome as incMonthly, annualIncome as incAnnual } from '../lib/income'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartFrame } from '../components/exportable'
import BalanceSheetTab from './BalanceSheetTab'
import FinancialRatioTab from './FinancialRatioTab'

// ==================== Category Definitions ====================

type CatDef = { value: string; label: string; multi?: boolean }

const FIXED_CATS: CatDef[] = [
  { value: 'fixed_house_loan',  label: 'ค่าผ่อนบ้าน' },
  { value: 'fixed_condo_loan',  label: 'ค่าผ่อนคอนโด' },
  { value: 'fixed_car_loan',    label: 'ค่าผ่อนรถยนต์/จักรยานยนต์' },
  { value: 'fixed_life_ins',    label: 'เบี้ยประกันชีวิต' },
  { value: 'fixed_health_ins',  label: 'เบี้ยประกันสุขภาพ' },
  { value: 'fixed_car_ins',     label: 'เบี้ยประกันรถยนต์' },
  { value: 'fixed_home_ins',    label: 'เบี้ยประกันภัยที่อยู่อาศัย' },
  { value: 'fixed_credit',      label: 'ค่าผ่อนบัตรเครดิต/สินเชื่อส่วนบุคคล' },
  { value: 'fixed_edu_loan',    label: 'หนี้การศึกษา' },
  { value: 'fixed_internet',    label: 'ค่าอินเทอร์เน็ตบ้าน' },
  { value: 'fixed_mobile',      label: 'ค่าแพ็กเกจมือถือ' },
  { value: 'fixed_streaming',   label: 'ค่าบริการสตรีมมิ่ง' },
  { value: 'fixed_common_fee',  label: 'ค่าส่วนกลางคอนโด/หมู่บ้าน' },
  { value: 'fixed_other',       label: 'รายจ่ายอื่นๆ โปรดระบุ', multi: true },
]

const VARIABLE_CATS: CatDef[] = [
  { value: 'var_food',       label: 'ค่าอาหารและเครื่องดื่ม' },
  { value: 'var_transport',  label: 'ค่าเดินทางและพลังงาน' },
  { value: 'var_utilities',  label: 'ค่าสาธารณูปโภค (น้ำ/ไฟ)' },
  { value: 'var_children',   label: 'ค่าใช้จ่ายบุตร' },
  { value: 'var_parents',    label: 'เงินให้บุพการี' },
  { value: 'var_tax',        label: 'ภาษีเงินได้' },
  { value: 'var_personal',   label: 'ของใช้ส่วนตัวและในบ้าน' },
  { value: 'var_lifestyle',  label: 'ไลฟ์สไตล์และการพักผ่อน' },
  { value: 'var_social',     label: 'สังสรรค์กับเพื่อน' },
  { value: 'var_travel',     label: 'ค่าท่องเที่ยว' },
  { value: 'var_health',     label: 'สุขภาพและการดูแลตัวเอง' },
  { value: 'var_other',      label: 'รายจ่ายอื่นๆ โปรดระบุ', multi: true },
]

const SAVING_CATS: CatDef[] = [
  { value: 'saving_savings',       label: 'เงินฝากออมทรัพย์' },
  { value: 'saving_fixed_deposit', label: 'เงินฝากประจำ' },
  { value: 'saving_rmf',           label: 'เงินลงทุน RMF' },
  { value: 'saving_invest_other',  label: 'เงินลงทุนอื่นๆ', multi: true },
  { value: 'saving_other',         label: 'รายจ่ายอื่นๆ โปรดระบุ', multi: true },
]

// ==================== Helpers ====================

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function toMonthly(amount: number, freq: string) {
  if (freq === 'QUARTERLY') return amount / 3
  if (freq === 'ANNUALLY') return amount / 12
  return amount
}

type Entry = { id: string; name: string; amount: number; frequency: string; category: string; person?: string }

// ==================== Sub-components ====================

function AddRow({ cats, usedCats, onAdd, accent }: {
  cats: CatDef[]
  usedCats: string[]
  onAdd: (cat: string, name: string, amount: number, frequency: string, shared: boolean) => void
  accent: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState('')
  const [customName, setCustomName] = useState('')
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState<'MONTHLY' | 'ANNUALLY'>('MONTHLY')
  const [shared, setShared] = useState(false)

  const available = cats.filter(c => c.multi || !usedCats.includes(c.value))
  const catDef = cats.find(c => c.value === selectedCat)
  const needsCustomName = catDef?.multi ?? false
  const canAdd = selectedCat && amount && (!needsCustomName || customName.trim())

  const numAmount = Number(amount) || 0
  const preview = {
    monthly: freq === 'MONTHLY' ? numAmount : numAmount / 12,
    annual:  freq === 'ANNUALLY' ? numAmount : numAmount * 12,
  }

  const handleAdd = () => {
    if (!canAdd) return
    const name = needsCustomName ? customName.trim() : (catDef?.label ?? selectedCat)
    onAdd(selectedCat, name, numAmount, freq, shared)
    setSelectedCat(''); setCustomName(''); setAmount(''); setFreq('MONTHLY'); setShared(false)
    setOpen(false)
  }

  const freqBtn = (f: 'MONTHLY' | 'ANNUALLY') => ({
    padding: '5px 14px', borderRadius: 6, border: '1.5px solid',
    cursor: 'pointer', fontSize: 12, transition: 'all 0.15s',
    borderColor: freq === f ? accent : 'var(--card-border)',
    background: freq === f ? `${accent}20` : 'transparent',
    color: freq === f ? accent : 'var(--text-muted)',
  } as React.CSSProperties)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: `1px dashed ${accent}50`, borderRadius: 8, padding: '8px 14px',
        cursor: 'pointer', color: accent, fontSize: 13, width: '100%', marginTop: 4 }}>
      <Plus size={14} /> เพิ่มรายการ
    </button>
  )

  return (
    <div style={{ padding: 14, background: 'var(--divider)', borderRadius: 10,
      border: `1px solid ${accent}30`, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Row 1: category + custom name */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
          style={{ ...sel, flex: '3 1 200px', minWidth: 0 }}>
          <option value="">— เลือกรายการ —</option>
          {available.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {needsCustomName && (
          <input value={customName} onChange={e => setCustomName(e.target.value)}
            placeholder="ระบุชื่อรายการ" style={{ ...inp, flex: '2 1 160px', minWidth: 0 }} />
        )}
      </div>
      {/* Row 2: freq toggle + amount input + preview */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setFreq('MONTHLY')}  style={freqBtn('MONTHLY')}>รายเดือน</button>
          <button onClick={() => setFreq('ANNUALLY')} style={freqBtn('ANNUALLY')}>รายปี</button>
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={freq === 'MONTHLY' ? 'จำนวน/เดือน (บาท)' : 'จำนวน/ปี (บาท)'}
          style={{ ...inp, flex: '2 1 160px', minWidth: 0 }} min={0} />
        {numAmount > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
            <span>≈ <strong style={{ color: accent }}>{fmt(preview.monthly)}</strong> / เดือน</span>
            <span>≈ <strong style={{ color: accent }}>{fmt(preview.annual)}</strong> / ปี</span>
          </div>
        )}
      </div>
      {/* Row 3: actions */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleAdd} disabled={!canAdd}
          style={{ ...btn(accent), opacity: canAdd ? 1 : 0.45 }}>
          <Plus size={13} /> เพิ่ม
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
          ใช้ร่วมกันทั้งครัวเรือน
        </label>
        <button onClick={() => setOpen(false)}
          style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}

const COLS = '1fr 110px 110px 90px 32px'

function pct(annual: number, totalIncome: number) {
  if (!totalIncome) return '—'
  return ((annual / totalIncome) * 100).toFixed(2) + '%'
}

/* Column header for rows */
function RowHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS,
      gap: 8, padding: '4px 14px', marginBottom: -4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>รายการ</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>/ เดือน</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>/ ปี</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>% รายรับ/ปี</span>
      <span />
    </div>
  )
}

function EntryRow({ entry, accent, totalAnnualIncome, onDelete, onUpdate }: {
  entry: Entry; accent: string; totalAnnualIncome: number
  onDelete: () => void
  onUpdate: (amount: number, frequency: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(entry.amount))
  const [freq, setFreq] = useState<'MONTHLY' | 'ANNUALLY'>(
    entry.frequency === 'ANNUALLY' ? 'ANNUALLY' : 'MONTHLY'
  )

  const monthly = toMonthly(entry.amount, entry.frequency)
  const annual  = monthly * 12

  const numAmount = Number(amount) || 0
  const previewMonthly = freq === 'MONTHLY' ? numAmount : numAmount / 12
  const previewAnnual  = freq === 'ANNUALLY' ? numAmount : numAmount * 12

  const freqBtn = (f: 'MONTHLY' | 'ANNUALLY') => ({
    padding: '3px 10px', borderRadius: 6, border: '1.5px solid', cursor: 'pointer', fontSize: 11,
    borderColor: freq === f ? accent : 'var(--card-border)',
    background: freq === f ? `${accent}20` : 'transparent',
    color: freq === f ? accent : 'var(--text-muted)',
  } as React.CSSProperties)

  const handleSave = () => {
    if (!numAmount) return
    onUpdate(numAmount, freq)
    setEditing(false)
  }

  const handleCancel = () => {
    setAmount(String(entry.amount))
    setFreq(entry.frequency === 'ANNUALLY' ? 'ANNUALLY' : 'MONTHLY')
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 14px', background: `${accent}0d`,
        borderRadius: 10, border: `1px solid ${accent}40`,
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{entry.name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setFreq('MONTHLY')}  style={freqBtn('MONTHLY')}>รายเดือน</button>
            <button onClick={() => setFreq('ANNUALLY')} style={freqBtn('ANNUALLY')}>รายปี</button>
          </div>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ ...inp, width: 160, flex: 'none' }} autoFocus min={0} />
          {numAmount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ≈ <strong style={{ color: accent }}>{fmt(previewMonthly)}</strong>/เดือน &nbsp;
              <strong style={{ color: accent }}>{fmt(previewAnnual)}</strong>/ปี
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
              background: accent, color: '#fff', fontWeight: 500 }}>
            <Check size={13} /> บันทึก
          </button>
          <button onClick={handleCancel}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid var(--card-border)', cursor: 'pointer',
              fontSize: 12, background: 'none', color: 'var(--text-muted)' }}>
            <X size={13} /> ยกเลิก
          </button>
          <button onClick={onDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              borderRadius: 8, border: '1px solid #f43f5e40', cursor: 'pointer',
              fontSize: 12, background: 'none', color: '#f43f5e', marginLeft: 'auto' }}>
            <Trash2 size={13} /> ลบ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS,
      gap: 8, alignItems: 'center', padding: '10px 14px',
      background: 'var(--divider)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
        {entry.name}
        {entry.person === 'shared' && <span style={{ marginLeft: 8, fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>ร่วม</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent, textAlign: 'right' }}>
        {fmt(monthly)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: `${accent}aa`, textAlign: 'right' }}>
        {fmt(annual)}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>
        {pct(annual, totalAnnualIncome)}
      </span>
      <button onClick={() => setEditing(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          padding: 4, justifySelf: 'center', transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = accent)}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
        <Pencil size={14} />
      </button>
    </div>
  )
}

function AutoCalcRow({ label, amount, note, totalAnnualIncome }: {
  label: string; amount: number; note: string; totalAnnualIncome: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS,
      gap: 8, alignItems: 'center', padding: '10px 14px',
      background: 'rgba(14,165,233,0.06)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.18)' }}>
      <div>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--cyan)', marginLeft: 8 }}>⚡ {note}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textAlign: 'right' }}>
        {fmt(amount)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#475569', textAlign: 'right' }}>
        {fmt(amount * 12)}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>
        {pct(amount * 12, totalAnnualIncome)}
      </span>
      <span />
    </div>
  )
}

function SectionCard({ title, sub, accent, total, children }: {
  title: string; sub: string; accent: string; total: number; children: React.ReactNode
}) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: `linear-gradient(90deg, ${accent}12, transparent)` }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>รวม / เดือน</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: accent }}>{fmt(total)} ฿</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>รวม / ปี</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: `${accent}aa` }}>{fmt(total * 12)} ฿</p>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RowHeader />
        {children}
      </div>
    </div>
  )
}

// ==================== Cash Flow Sidebar ====================

const PIE_COLORS_INCOME  = ['#10b981', '#3b82f6', '#f59e0b', '#e879f9']
const PIE_COLORS_EXPENSE = ['#f43f5e', '#f97316', '#a78bfa', '#22d3ee']

function MiniPieChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const filtered = data.filter(d => d.value > 0)

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const r = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {(percent * 100).toFixed(1)}%
      </text>
    )
  }

  return (
    <div style={{ ...card, padding: '16px 12px' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'center' }}>
        {title}
      </p>
      {filtered.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 12 }}>ยังไม่มีข้อมูล</div>
      ) : (
        <ChartFrame title={title} filename={title} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filtered} cx="50%" cy="40%" outerRadius={90} dataKey="value"
                labelLine={false} label={renderLabel}>
                {filtered.map((_, i) => (
                  <Cell key={i}
                    fill={title.includes('รายได้')
                      ? PIE_COLORS_INCOME[i % PIE_COLORS_INCOME.length]
                      : PIE_COLORS_EXPENSE[i % PIE_COLORS_EXPENSE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any) => [fmt(v) + ' ฿', '']}
                contentStyle={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-primary)' }} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </div>
  )
}

function CashFlowSidebar({ incomeSources, totals }: {
  incomeSources: IncomeSource[]
  totals: { income: number; fixed: number; variable: number; saving: number; net: number }
}) {
  const incomeData = incomeSources.filter(s => s.amount && parseFloat(s.amount) > 0).map(s => {
    const monthly = incMonthly(s)
    return { name: s.label || 'รายได้', value: Math.round(monthly * 12 * 100) / 100 }
  })

  const expenseData = [
    { name: 'รายจ่ายคงที่',        value: Math.round(totals.fixed    * 12 * 100) / 100 },
    { name: 'รายจ่ายผันแปร',    value: Math.round(totals.variable * 12 * 100) / 100 },
    { name: 'ออม/ลงทุน',           value: Math.round(totals.saving   * 12 * 100) / 100 },
    { name: 'กระแสเงินสดสุทธิ',    value: Math.round(Math.max(totals.net, 0) * 12 * 100) / 100 },
  ]

  return (
    <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MiniPieChart title="โครงสร้างรายได้" data={incomeData} />
      <MiniPieChart title="โครงสร้างรายจ่าย" data={expenseData} />
    </div>
  )
}

// ==================== CashFlow Tab ====================

type IncomeSource = { label: string; source: string; amount: string; freq?: string; auto?: boolean }

function ImportedIncomeRow({ label, source, monthly, annual, totalAnnualIncome }: {
  label: string; source?: string; monthly: number; annual: number; totalAnnualIncome: number
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS,
      gap: 8, alignItems: 'center', padding: '10px 14px',
      background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
      <div>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
        {source && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{source}</span>}
        <span style={{ marginLeft: 8, fontSize: 10, color: '#10b981', background: 'rgba(16,185,129,0.12)',
          borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>นำเข้า</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981', textAlign: 'right' }}>{fmt(monthly)}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#10b981aa', textAlign: 'right' }}>{fmt(annual)}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
        {totalAnnualIncome > 0 ? ((annual / totalAnnualIncome) * 100).toFixed(2) + '%' : '—'}
      </span>
      <span />
    </div>
  )
}

function CashFlowTab({ person }: { person: 'client' | 'spouse' }) {
  const qc = useQueryClient()

  const { data: expenses = [] } = useQuery<Entry[]>({
    queryKey: ['expenses', person],
    queryFn: () => api.get('/expenses', { params: { person } }).then(r => r.data),
  })
  const { data: profile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const { data: lifePolicies = [] } = useQuery<any[]>({
    queryKey: ['life-insurances'],
    queryFn: () => api.get('/life-insurances').then(r => r.data),
    retry: false,
  })
  const { data: invProfileCF } = useQuery<any>({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['expenses'] })

  const addExpense = useMutation({
    mutationFn: (d: object) => api.post('/expenses', d),
    onSuccess: invalidate,
  })
  const delExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: invalidate,
  })
  const updExpense = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [k: string]: any }) => api.put(`/expenses/${id}`, d),
    onSuccess: invalidate,
  })

  const fixedItems    = expenses.filter(e => e.category.startsWith('fixed_'))
  const variableItems = expenses.filter(e => e.category.startsWith('var_'))
  const savingItems   = expenses.filter(e => e.category.startsWith('saving_'))

  // Auto-calculated items from client profile — แยกตามคน (spouse ใช้ spouseIncomeSources / spouseProfile)
  const incomeSources: IncomeSource[] = (person === 'spouse' ? profile?.spouseIncomeSources : profile?.incomeSources) ?? []
  const welfare: any = person === 'spouse' ? (profile?.spouseProfile ?? {}) : (profile ?? {})

  // monthly salary for SS/PVD calculation (from incomeSources first, fallback to profile.salary)
  const salarySource = incomeSources.find(s => s.label === 'เงินเดือน')
  const monthlySalary = salarySource
    ? (parseFloat(salarySource.amount) || 0)
    : (person === 'spouse' ? 0 : (profile?.salary ?? 0))

  const hasSS  = welfare?.hasSocialSecurity ?? false
  const hasPVD = welfare?.hasPVD ?? false
  const pvdRate = Number(welfare?.pvdEmployeeRate ?? 0)

  const ssMonthly  = hasSS  ? Math.min(monthlySalary, 17500) * 0.05 : 0
  const pvdMonthly = hasPVD ? monthlySalary * (pvdRate / 100) : 0

  // เบี้ยประกันชีวิต — ดึงจากหน้าข้อมูลการประกัน จับคู่ผู้เอาประกันกับ client/spouse ตามชื่อ
  const norm = (s: string) => (s ?? '').replace(/\s+/g, '').toLowerCase()
  const nameMatch = (a: string, b: string) => {
    const x = norm(a), y = norm(b)
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x))
  }
  const personName = person === 'spouse'
    ? (`${profile?.spouseProfile?.firstName ?? ''} ${profile?.spouseProfile?.lastName ?? ''}`.trim() || (profile?.spouseName ?? ''))
    : `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim()
  const lifePremiumAnnual = lifePolicies
    .filter(p => (p.premium ?? 0) > 0 && nameMatch(p.insuredPerson ?? '', personName))
    .reduce((s, p) => s + (p.premium ?? 0), 0)
  const lifePremiumMonthly = lifePremiumAnnual / 12

  // ผ่อนชำระหนี้สินต่อเดือน — ดึงจากตารางหนี้สินคงค้าง (ข้อมูลสินทรัพย์และการลงทุน) อัตโนมัติ
  const debtRows: { name: string; monthly: number }[] = (((person === 'spouse' ? invProfileCF?.spouseData : invProfileCF)?.liabilities ?? []) as any[])
    .map((l: any, i: number) => ({
      name: [l.debtType || `หนี้สินที่ ${i + 1}`, l.assetRef].filter(Boolean).join(' · '),
      monthly: parseFloat(String(l.monthlyPayment ?? '').replace(/,/g, '')) || 0,
    }))
    .filter(d => d.monthly > 0)
  const debtMonthly = debtRows.reduce((x, d) => x + d.monthly, 0)

  // income from incomeSources: ใช้ helper กลาง (freq รายเดือน/รายปี · เผื่อ backward-compat 'โบนัส')
  const incomeMonthly = (src: IncomeSource) => incMonthly(src)

  const totals = useMemo(() => {
    const income   = incomeSources.filter(s => s.amount).reduce((sum, s) => sum + incomeMonthly(s), 0)
    const fixed    = fixedItems.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0) + ssMonthly + pvdMonthly + lifePremiumMonthly + debtMonthly
    const variable = variableItems.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
    const saving   = savingItems.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
    return { income, fixed, variable, saving, total: fixed + variable + saving, net: income - (fixed + variable + saving) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeSources, fixedItems, variableItems, savingItems, ssMonthly, pvdMonthly, lifePremiumMonthly, debtMonthly])

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* Left: sections */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* รายรับ */}
      <SectionCard title="รายรับ" sub="Income" accent="#10b981" total={totals.income}>
        {incomeSources.filter(s => s.amount && parseFloat(s.amount) > 0).length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
            ยังไม่มีข้อมูลรายรับ · กรอกได้ที่หน้า "ข้อมูลลูกค้า → ที่มาของรายได้"
          </p>
        )}
        {incomeSources.filter(s => s.amount && parseFloat(s.amount) > 0).map((s, i) => {
          const monthly = incomeMonthly(s)
          const annual  = incAnnual(s)
          return (
            <ImportedIncomeRow
              key={i}
              label={s.label || 'รายได้'}
              source={s.source}
              monthly={monthly}
              annual={annual}
              totalAnnualIncome={totals.income * 12}
            />
          )
        })}
      </SectionCard>

      {/* รายจ่ายคงที่ */}
      <SectionCard title="รายจ่ายคงที่" sub="Fixed Expenses" accent="#f43f5e" total={totals.fixed}>
        {fixedItems.length === 0 && !hasSS && !hasPVD && lifePremiumMonthly <= 0 && debtRows.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>ยังไม่มีรายจ่ายคงที่</p>
        )}
        {fixedItems.map(e => (
          <EntryRow key={e.id} entry={e} accent="#f43f5e"
            onDelete={() => delExpense.mutate(e.id)}
            onUpdate={(amount, frequency) => updExpense.mutate({ id: e.id, amount, frequency })}
            totalAnnualIncome={totals.income * 12} />
        ))}
        {hasSS && (
          <AutoCalcRow
            label="ประกันสังคม"
            amount={ssMonthly}
            note={`คำนวณอัตโนมัติ min(${fmt(monthlySalary)}, 17,500) × 5% = ${fmt(ssMonthly)} บาท/เดือน`}
            totalAnnualIncome={totals.income * 12} />
        )}
        {hasPVD && (
          <AutoCalcRow
            label="เงินสะสมกองทุนสำรองเลี้ยงชีพ (ส่วนลูกจ้าง)"
            amount={pvdMonthly}
            note={`${fmt(monthlySalary)} × ${pvdRate}% = ${fmt(pvdMonthly)} บาท/เดือน`}
            totalAnnualIncome={totals.income * 12} />
        )}
        {lifePremiumMonthly > 0 && (
          <AutoCalcRow
            label="เบี้ยประกันชีวิต"
            amount={lifePremiumMonthly}
            note={`ดึงจากข้อมูลการประกัน · เบี้ยรวม ${fmt(lifePremiumAnnual)} บาท/ปี`}
            totalAnnualIncome={totals.income * 12} />
        )}
        {debtRows.map((d, i) => (
          <AutoCalcRow key={`debt-${i}`}
            label={`ผ่อนชำระหนี้ · ${d.name}`}
            amount={d.monthly}
            note={`ดึงจากหนี้สินคงค้าง · ${fmt(d.monthly * 12)} บาท/ปี`}
            totalAnnualIncome={totals.income * 12} />
        ))}
        <AddRow
          cats={FIXED_CATS}
          usedCats={fixedItems.map(e => e.category)}
          accent="#f43f5e"
          onAdd={(cat, name, amount, freq, shared) => addExpense.mutate({ name, amount, frequency: freq, category: cat, isFixed: true, person: shared ? 'shared' : person })}
        />
      </SectionCard>

      {/* รายจ่ายผันแปร */}
      <SectionCard title="รายจ่ายผันแปร" sub="Variable Expenses" accent="#f97316" total={totals.variable}>
        {variableItems.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>ยังไม่มีรายจ่ายผันแปร</p>
        )}
        {variableItems.map(e => (
          <EntryRow key={e.id} entry={e} accent="#f97316"
            onDelete={() => delExpense.mutate(e.id)}
            onUpdate={(amount, frequency) => updExpense.mutate({ id: e.id, amount, frequency })}
            totalAnnualIncome={totals.income * 12} />
        ))}
        <AddRow
          cats={VARIABLE_CATS}
          usedCats={variableItems.map(e => e.category)}
          accent="#f97316"
          onAdd={(cat, name, amount, freq, shared) => addExpense.mutate({ name, amount, frequency: freq, category: cat, isFixed: false, person: shared ? 'shared' : person })}
        />
      </SectionCard>

      {/* รายจ่ายเพื่อการออม/ลงทุน */}
      <SectionCard title="รายจ่ายเพื่อการออม/ลงทุน" sub="Saving / Investment" accent="#a78bfa" total={totals.saving}>
        {savingItems.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>ยังไม่มีรายการออมและลงทุน</p>
        )}
        {savingItems.map(e => (
          <EntryRow key={e.id} entry={e} accent="#a78bfa"
            onDelete={() => delExpense.mutate(e.id)}
            onUpdate={(amount, frequency) => updExpense.mutate({ id: e.id, amount, frequency })}
            totalAnnualIncome={totals.income * 12} />
        ))}
        <AddRow
          cats={SAVING_CATS}
          usedCats={savingItems.map(e => e.category)}
          accent="#a78bfa"
          onAdd={(cat, name, amount, freq, shared) => addExpense.mutate({ name, amount, frequency: freq, category: cat, isFixed: false, person: shared ? 'shared' : person })}
        />
      </SectionCard>

      {/* สรุป Net Cash Flow */}
      <div style={{ ...card, padding: '20px 24px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          สรุปงบกระแสเงินสด
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 160px', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}></span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>/ เดือน</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>/ ปี</span>
          </div>
          {[
            { label: 'รายรับรวม',                          value: totals.income,   sign: '+', color: '#10b981' },
            { label: 'รายจ่ายคงที่รวม',                    value: totals.fixed,    sign: '-', color: '#f43f5e', bold: false },
            { label: 'รายจ่ายผันแปรรวม',               value: totals.variable, sign: '-', color: '#f97316', bold: false },
            { label: 'รายจ่ายเพื่อการออม/ลงทุนรวม',       value: totals.saving,   sign: '-', color: '#a78bfa', bold: false },
            { label: 'รายจ่ายรวม',                         value: totals.total,    sign: '-', color: '#fb7185', bold: true  },
          ].map(r => (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 160px', gap: 8,
              fontSize: r.bold ? 14 : 13, paddingBottom: 8, borderBottom: '1px solid var(--card-border)',
              background: r.bold ? 'rgba(251,113,133,0.06)' : undefined, borderRadius: r.bold ? 6 : undefined,
              padding: r.bold ? '8px 10px' : undefined, margin: r.bold ? '4px -10px' : undefined }}>
              <span style={{ color: r.bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: r.bold ? 700 : 400 }}>{r.label}</span>
              <span style={{ color: r.color, fontWeight: r.bold ? 700 : 500, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.sign}{fmt(r.value)} ฿</span>
              <span style={{ color: `${r.color}aa`, fontWeight: r.bold ? 700 : 500, textAlign: 'right', whiteSpace: 'nowrap' }}>{r.sign}{fmt(r.value * 12)} ฿</span>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 160px', gap: 8, alignItems: 'center', paddingTop: 4 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>กระแสเงินสดสุทธิ</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Net Cash Flow</p>
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: totals.net >= 0 ? '#10b981' : '#f43f5e', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {totals.net >= 0 ? '+' : ''}{fmt(totals.net)} ฿
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, color: totals.net >= 0 ? '#10b981aa' : '#f43f5eaa', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {totals.net >= 0 ? '+' : ''}{fmt(totals.net * 12)} ฿
            </span>
          </div>
          {totals.net < 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.1)', borderRadius: 8, border: '1px solid rgba(244,63,94,0.25)', fontSize: 12, color: '#fca5a5' }}>
              ⚠️ รายจ่ายมากกว่ารายรับ {fmt(Math.abs(totals.net))} บาท/เดือน ควรปรับแผนการใช้จ่าย
            </div>
          )}
          {totals.net > 0 && totals.income > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#6ee7b7' }}>
              ✅ อัตราเหลือสุทธิ {((totals.net / totals.income) * 100).toFixed(1)}% ของรายรับ
            </div>
          )}
        </div>
      </div>

      </div>{/* end left column */}

      {/* Right: sidebar */}
      <CashFlowSidebar incomeSources={incomeSources} totals={totals} />

    </div>
  )
}

// ==================== Main Page ====================

type Tab = 'balance' | 'cashflow' | 'ratio'

const TABS: { id: Tab; label: string; sub: string }[] = [
  { id: 'balance',  label: 'งบดุลส่วนบุคคล',     sub: 'Balance Sheet' },
  { id: 'cashflow', label: 'งบกระแสเงินสด',       sub: 'Cash Flow Statement' },
  { id: 'ratio',    label: 'อัตราส่วนทางการเงิน', sub: 'Financial Ratio' },
]

export default function IncomePage({ person = 'client' }: { person?: 'client' | 'spouse' }) {
  const [tab, setTab] = useState<Tab>('cashflow')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
    transition: 'all 0.15s', minWidth: 160,
    background: active ? 'var(--cyan-dim)' : 'transparent',
    borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader icon={Wallet} title="งบการเงินส่วนบุคคล" subtitle="ภาพรวมสถานะการเงินและกระแสเงินสด" />

      <div style={{ display: 'flex', gap: 4, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 6, width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>
            <span style={{ fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{t.label}</span>
            <span style={{ fontSize: 11, color: tab === t.id ? 'var(--cyan)' : 'var(--text-muted)', marginTop: 2 }}>{t.sub}</span>
          </button>
        ))}
      </div>

      {tab === 'balance' && <BalanceSheetTab person={person} />}

      {tab === 'cashflow' && <CashFlowTab person={person} />}

      {tab === 'ratio' && (
        <FinancialRatioTab person={person} />
      )}
    </div>
  )
}
