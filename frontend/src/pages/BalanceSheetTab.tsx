import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { card, inp, sel, btn } from '../styles/dark'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartFrame, ExcelButton, type ExcelSheet } from '../components/exportable'

// ==================== Category Definitions ====================

type CatDef = { value: string; label: string; multi?: boolean }

const INVEST_CATS: CatDef[] = [
  { value: 'invest_stock',    label: 'หุ้น (โปรดระบุ)', multi: true },
  { value: 'invest_rmf_bond', label: 'กองทุน RMF ตราสารหนี้' },
  { value: 'invest_thai_esg', label: 'กองทุน Thai ESG' },
  { value: 'invest_ssf',      label: 'กองทุน SSF หุ้นต่างประเทศ' },
  { value: 'invest_pvd',      label: 'กองทุนสำรองเลี้ยงชีพ' },
  { value: 'invest_other',    label: 'เงินลงทุนอื่นๆ โปรดระบุ', multi: true },
]

const SHORT_DEBT_CATS: CatDef[] = [
  { value: 'short_credit',   label: 'หนี้บัตรเครดิต' },
  { value: 'short_personal', label: 'หนี้สินเชื่อส่วนบุคคล' },
  { value: 'short_other',    label: 'หนี้สินอื่นๆ โปรดระบุ', multi: true },
]

// ==================== Helpers ====================

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function pct(value: number, total: number) {
  if (!total) return '—'
  return ((value / total) * 100).toFixed(2) + '%'
}

type AssetEntry    = { id: string; name: string; value: number; category: string }
type LiabEntry     = { id: string; name: string; balance: number; category: string }

const BS_COLS = '1fr 130px 90px 32px'

// ==================== AddRow ====================

function AddRow({ cats, usedCats, onAdd, accent }: {
  cats: CatDef[]
  usedCats: string[]
  onAdd: (cat: string, name: string, value: number, shared: boolean) => void
  accent: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState('')
  const [customName, setCustomName] = useState('')
  const [amount, setAmount] = useState('')
  const [shared, setShared] = useState(false)

  const available = cats.filter(c => c.multi || !usedCats.includes(c.value))
  const catDef = cats.find(c => c.value === selectedCat)
  const needsName = catDef?.multi ?? false
  const canAdd = selectedCat && amount && (!needsName || customName.trim())

  const handleAdd = () => {
    if (!canAdd) return
    const name = needsName ? customName.trim() : (catDef?.label ?? selectedCat)
    onAdd(selectedCat, name, Number(amount), shared)
    setSelectedCat(''); setCustomName(''); setAmount(''); setShared(false); setOpen(false)
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
        border: `1px dashed ${accent}50`, borderRadius: 8, padding: '8px 14px',
        cursor: 'pointer', color: accent, fontSize: 13, width: '100%', marginTop: 4 }}>
      <Plus size={14} /> เพิ่มรายการ
    </button>
  )

  return (
    <div style={{ padding: 12, background: 'var(--divider)', borderRadius: 10,
      border: `1px solid ${accent}30`, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
          style={{ ...sel, flex: '3 1 200px', minWidth: 0 }}>
          <option value="">— เลือกรายการ —</option>
          {available.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {needsName && (
          <input value={customName} onChange={e => setCustomName(e.target.value)}
            placeholder="ระบุชื่อรายการ" style={{ ...inp, flex: '2 1 150px', minWidth: 0 }} />
        )}
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="มูลค่า (บาท)" style={{ ...inp, flex: '2 1 140px', minWidth: 0 }} min={0} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={handleAdd} disabled={!canAdd}
          style={{ ...btn(accent), opacity: canAdd ? 1 : 0.45 }}>
          <Plus size={13} /> เพิ่ม
        </button>
        <button onClick={() => setOpen(false)}
          style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
          ยกเลิก
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto' }}>
          <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
          ใช้ร่วมกันทั้งครัวเรือน
        </label>
      </div>
    </div>
  )
}

// ==================== RowHeader ====================

function RowHeader({ valueLabel = 'มูลค่า' }: { valueLabel?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: BS_COLS,
      gap: 8, padding: '4px 14px', marginBottom: -4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>รายการ</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{valueLabel}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>% รวม</span>
      <span />
    </div>
  )
}

// ==================== EntryRow ====================

function EntryRow({ name, value, totalForPct, accent, onDelete, onUpdate }: {
  name: string; value: number; totalForPct: number; accent: string
  onDelete: () => void
  onUpdate: (value: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(String(value))
  const numAmount = Number(amount) || 0

  const handleSave = () => {
    if (!numAmount) return
    onUpdate(numAmount)
    setEditing(false)
  }
  const handleCancel = () => { setAmount(String(value)); setEditing(false) }

  if (editing) {
    return (
      <div style={{ padding: '12px 14px', background: `${accent}0d`,
        borderRadius: 10, border: `1px solid ${accent}40`,
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ ...inp, width: 180, flex: 'none' }} autoFocus min={0} />
          {numAmount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              = <strong style={{ color: accent }}>{fmt(numAmount)}</strong> บาท
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
    <div style={{ display: 'grid', gridTemplateColumns: BS_COLS,
      gap: 8, alignItems: 'center', padding: '10px 14px',
      background: 'var(--divider)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent, textAlign: 'right' }}>
        {fmt(value)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
        {pct(value, totalForPct)}
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

// ==================== SectionCard ====================

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
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>มูลค่ารวม</p>
          <p style={{ fontSize: 18, fontWeight: 700, color: accent }}>{fmt(total)} ฿</p>
        </div>
      </div>
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <RowHeader />
        {children}
      </div>
    </div>
  )
}

// ==================== Sidebar Pie Chart ====================

const PIE_ASSET_COLORS = ['#22d3ee', '#3b82f6', '#a78bfa']
const PIE_DEBT_COLORS  = ['#f43f5e', '#f97316']

function MiniPieChart({ title, data, colors }: {
  title: string
  data: { name: string; value: number }[]
  colors: string[]
}) {
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
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, textAlign: 'center' }}>
        {title}
      </p>
      {filtered.length === 0 ? (
        <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 12 }}>ยังไม่มีข้อมูล</div>
      ) : (
        <ChartFrame title={title} filename={title} height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={filtered} cx="50%" cy="40%" outerRadius={85} dataKey="value"
                labelLine={false} label={renderLabel}>
                {filtered.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
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

// ==================== Imported (read-only) row ====================

function ImportedRow({ name, value, totalForPct, accent, note }: {
  name: string; value: number; totalForPct: number; accent: string; note?: string
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: BS_COLS,
      gap: 8, alignItems: 'center', padding: '10px 14px',
      background: `${accent}08`, borderRadius: 10,
      border: `1px solid ${accent}30` }}>
      <div>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
        {note && <span style={{ marginLeft: 8, fontSize: 10, color: accent, background: `${accent}18`,
          borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{note}</span>}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: accent, textAlign: 'right' }}>
        {fmt(value)}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
        {pct(value, totalForPct)}
      </span>
      <span />
    </div>
  )
}

// ==================== Main Component ====================

export default function BalanceSheetTab({ person = 'client' }: { person?: 'client' | 'spouse' }) {
  const qc = useQueryClient()

  const { data: assets = [] } = useQuery<AssetEntry[]>({
    queryKey: ['assets', person],
    queryFn: () => api.get('/assets', { params: { person } }).then(r => r.data),
  })
  const { data: liabilities = [] } = useQuery<LiabEntry[]>({
    queryKey: ['liabilities', person],
    queryFn: () => api.get('/liabilities', { params: { person } }).then(r => r.data),
  })

  // ── ดึงข้อมูลจาก investment-profile ──
  const { data: invProfile } = useQuery<any>({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })

  // ── client-profile: ใช้ชื่อ client/spouse เพื่อจับคู่กับผู้เอาประกัน ──
  const { data: clientProfile } = useQuery<any>({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
    retry: false,
  })
  // ── กรมธรรม์ประกันชีวิต (สำหรับมูลค่าเวนคืน) ──
  const { data: lifePolicies = [] } = useQuery<any[]>({
    queryKey: ['life-insurances'],
    queryFn: () => api.get('/life-insurances').then(r => r.data),
    retry: false,
  })

  // เลือกแหล่งตามคน: client = ฟิลด์หลัก, spouse = spouseData
  const invSrc = person === 'spouse' ? (invProfile?.spouseData ?? {}) : (invProfile ?? {})
  const savingsAccounts: { depositType: string; currentValue: string; interestRate: string }[] =
    invSrc?.savingsAccounts ?? []
  const investmentAssets: { assetName: string; currentValue: string; investAmount: string }[] =
    invSrc?.investmentAssets ?? []
  const personalAssets: { assetType: string; customLabel: string; currentValue: string; debtRemaining: string }[] =
    invSrc?.personalAssets ?? []
  // หนี้สินคงค้าง (จากแท็บ ข้อมูลสินทรัพย์-หนี้สิน) — แยกระยะสั้น/ยาวด้วยระยะเวลาครบกำหนด
  const profileLiabilities: { debtType: string; assetRef: string; creditor: string; currentBalance: string; termYears: string }[] =
    invSrc?.liabilities ?? []

  // Mutations — Assets
  const addAsset = useMutation({
    mutationFn: (d: object) => api.post('/assets', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
  const delAsset = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })
  const updAsset = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [k: string]: any }) => api.put(`/assets/${id}`, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  // Mutations — Liabilities
  const addLiab = useMutation({
    mutationFn: (d: object) => api.post('/liabilities', d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities'] }),
  })
  const delLiab = useMutation({
    mutationFn: (id: string) => api.delete(`/liabilities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities'] }),
  })
  const updLiab = useMutation({
    mutationFn: ({ id, ...d }: { id: string; [k: string]: any }) => api.put(`/liabilities/${id}`, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liabilities'] }),
  })

  // Group assets — ทุก section มาจาก investment-profile
  const personalItems = personalAssets

  // Group liabilities
  const shortDebt = liabilities.filter(l => l.category.startsWith('short_'))

  // สินทรัพย์เพื่อการลงทุน ที่เพิ่มเองในงบดุล (นอกเหนือจากที่นำเข้าจาก investment-profile)
  const manualInvest = assets.filter(a => a.category.startsWith('invest_'))

  const toNum = (v: string) => parseFloat((v ?? '').replace(/,/g, '')) || 0

  // ── มูลค่าเวนคืนกรมธรรม์ประกันชีวิต — จับคู่ผู้เอาประกันกับ client/spouse ตามชื่อ ──
  const norm = (s: string) => (s ?? '').replace(/\s+/g, '').toLowerCase()
  const nameMatch = (a: string, b: string) => {
    const x = norm(a), y = norm(b)
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x))
  }
  const clientName = `${clientProfile?.firstName ?? ''} ${clientProfile?.lastName ?? ''}`.trim()
  const spouseName = `${clientProfile?.spouseProfile?.firstName ?? ''} ${clientProfile?.spouseProfile?.lastName ?? ''}`.trim()
    || (clientProfile?.spouseName ?? '')
  const personName = person === 'spouse' ? spouseName : clientName
  const cashValuePolicies = lifePolicies.filter(
    p => (p.cashValue ?? 0) > 0 && nameMatch(p.insuredPerson ?? '', personName)
  )
  const insuranceCashValue = cashValuePolicies.reduce((s, p) => s + (p.cashValue ?? 0), 0)

  // หนี้สินคงค้าง → ระยะสั้น (ครบกำหนด ≤ 1 ปี) / ระยะยาว (> 1 ปี)
  const isLongTerm = (l: { termYears: string }) => (parseFloat(l.termYears) || 0) > 1
  const profShortDebt = profileLiabilities.filter(l => !isLongTerm(l) && toNum(l.currentBalance) > 0)
  const profLongDebt  = profileLiabilities.filter(l => isLongTerm(l)  && toNum(l.currentBalance) > 0)

  const totals = useMemo(() => {
    const liquid   = savingsAccounts.reduce((s, a) => s + toNum(a.currentValue), 0)
    const invest   = investmentAssets.reduce((s, a) => s + toNum(a.currentValue), 0)
      + manualInvest.reduce((s, a) => s + a.value, 0)
      + insuranceCashValue
    const personal = personalItems.reduce((s, a) => s + toNum(a.currentValue), 0)
    const totalAssets = liquid + invest + personal

    const shortTotal = shortDebt.reduce((s, l) => s + l.balance, 0)
      + profShortDebt.reduce((s, l) => s + toNum(l.currentBalance), 0)
    const longTotal  = profLongDebt.reduce((s, l) => s + toNum(l.currentBalance), 0)
    const totalLiab  = shortTotal + longTotal

    return { liquid, invest, personal, totalAssets, shortTotal, longTotal, totalLiab,
      netWorth: totalAssets - totalLiab }
  }, [savingsAccounts, investmentAssets, personalAssets, shortDebt, profShortDebt, profLongDebt, manualInvest, insuranceCashValue])

  const addAssetFn = (cat: string, name: string, value: number, shared?: boolean) =>
    addAsset.mutate({ name, value, category: cat, returnRate: 0, person: shared ? 'shared' : person })

  const addLiabFn = (cat: string, name: string, balance: number, shared?: boolean) =>
    addLiab.mutate({ name, balance, category: cat, interestRate: 0, monthlyPayment: 0, person: shared ? 'shared' : person })

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* Left: sections */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ===== ASSETS ===== */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
          borderLeft: '3px solid #22d3ee', paddingLeft: 10 }}>
          สินทรัพย์ (Assets)
        </div>

        {/* สินทรัพย์สภาพคล่อง — นำเข้าจากบัญชีเงินฝาก */}
        <SectionCard title="สินทรัพย์สภาพคล่อง" sub="Liquid Assets · นำเข้าจากบัญชีเงินฝาก" accent="#22d3ee" total={totals.liquid}>
          {savingsAccounts.filter(a => toNum(a.currentValue) > 0).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
              ยังไม่มีข้อมูล — กรอกข้อมูลในแท็บ "ข้อมูลสินทรัพย์และการลงทุน → บัญชีเงินฝาก"
            </p>
          )}
          {savingsAccounts.filter(a => toNum(a.currentValue) > 0).map((a, i) => (
            <ImportedRow key={i}
              name={a.depositType || `บัญชีที่ ${i + 1}`}
              value={toNum(a.currentValue)}
              totalForPct={totals.totalAssets}
              accent="#22d3ee"
              note={a.interestRate ? `${a.interestRate}%` : undefined}
            />
          ))}
        </SectionCard>

        {/* สินทรัพย์เพื่อการลงทุน — นำเข้าจากสินทรัพย์การลงทุน */}
        <SectionCard title="สินทรัพย์เพื่อการลงทุน" sub="Investment Assets · นำเข้าจากสินทรัพย์การลงทุน + เพิ่มรายการอื่นๆ ได้" accent="#3b82f6" total={totals.invest}>
          {investmentAssets.filter(a => toNum(a.currentValue) > 0).length === 0 && manualInvest.length === 0 && cashValuePolicies.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
              ยังไม่มีข้อมูล — กรอกในแท็บ "ข้อมูลสินทรัพย์-หนี้สิน → สินทรัพย์การลงทุน" หรือเพิ่มรายการด้านล่าง
            </p>
          )}
          {cashValuePolicies.map((p, i) => (
            <ImportedRow key={`cv-${i}`}
              name={`มูลค่าเวนคืน — ${p.insuranceType || 'ประกันชีวิต'}${p.policyNumber ? ` (${p.policyNumber})` : ''}`}
              value={p.cashValue}
              totalForPct={totals.totalAssets}
              accent="#3b82f6"
              note={p.company || p.insuredPerson || 'กรมธรรม์'} />
          ))}
          {investmentAssets.filter(a => toNum(a.currentValue) > 0).map((a, i) => (
            <ImportedRow key={i}
              name={a.assetName || `รายการที่ ${i + 1}`}
              value={toNum(a.currentValue)}
              totalForPct={totals.totalAssets}
              accent="#3b82f6"
              note={toNum(a.investAmount) > 0
                ? `${((toNum(a.currentValue) - toNum(a.investAmount)) / toNum(a.investAmount) * 100).toFixed(1)}%`
                : undefined}
            />
          ))}
          {manualInvest.map(a => (
            <EntryRow key={a.id} name={a.name} value={a.value} totalForPct={totals.totalAssets}
              accent="#3b82f6"
              onDelete={() => delAsset.mutate(a.id)}
              onUpdate={value => updAsset.mutate({ id: a.id, value, name: a.name, category: a.category, returnRate: 0 })} />
          ))}
          <AddRow cats={INVEST_CATS} usedCats={manualInvest.map(a => a.category)}
            accent="#3b82f6" onAdd={addAssetFn} />
        </SectionCard>

        {/* สินทรัพย์ส่วนตัว */}
        <SectionCard title="สินทรัพย์ส่วนตัว" sub="Personal Assets · นำเข้าจากสินทรัพย์ส่วนตัว" accent="#a78bfa" total={totals.personal}>
          {personalItems.filter(a => toNum(a.currentValue) > 0).length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
              ยังไม่มีข้อมูล — กรอกข้อมูลในแท็บ "ข้อมูลสินทรัพย์และการลงทุน → สินทรัพย์ส่วนตัว"
            </p>
          )}
          {personalItems.filter(a => toNum(a.currentValue) > 0).map((a, i) => (
            <ImportedRow key={i}
              name={a.customLabel ? `${a.assetType} (${a.customLabel})` : a.assetType}
              value={toNum(a.currentValue)}
              totalForPct={totals.totalAssets}
              accent="#a78bfa"
            />
          ))}
        </SectionCard>

        {/* ===== LIABILITIES ===== */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
          paddingLeft: 10, borderLeft: '3px solid #f43f5e', marginTop: 8 }}>
          หนี้สิน (Liabilities)
        </div>

        {/* หนี้ระยะสั้น */}
        <SectionCard title="หนี้สินระยะสั้น" sub="Short-term Debt (ครบกำหนด ≤ 1 ปี)" accent="#f43f5e" total={totals.shortTotal}>
          {shortDebt.length === 0 && profShortDebt.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
              ยังไม่มีข้อมูล
            </p>
          )}
          {profShortDebt.map((l, i) => (
            <ImportedRow key={`pl-s-${i}`}
              name={l.assetRef ? `${l.debtType} (${l.assetRef})` : (l.debtType || `หนี้สินที่ ${i + 1}`)}
              value={toNum(l.currentBalance)}
              totalForPct={totals.totalLiab}
              accent="#f43f5e"
              note={l.creditor || undefined} />
          ))}
          {shortDebt.map(l => (
            <EntryRow key={l.id} name={l.name} value={l.balance} totalForPct={totals.totalLiab}
              accent="#f43f5e"
              onDelete={() => delLiab.mutate(l.id)}
              onUpdate={balance => updLiab.mutate({ id: l.id, balance, name: l.name, category: l.category, interestRate: 0, monthlyPayment: 0 })} />
          ))}
          <AddRow cats={SHORT_DEBT_CATS} usedCats={shortDebt.map(l => l.category)}
            accent="#f43f5e" onAdd={addLiabFn} />
        </SectionCard>

        {/* หนี้ระยะยาว */}
        <SectionCard title="หนี้สินระยะยาว" sub="Long-term Debt (ครบกำหนด > 1 ปี) · นำเข้าจากหนี้สินคงค้าง" accent="#f97316" total={totals.longTotal}>
          {profLongDebt.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
              ยังไม่มีข้อมูล — กรอกข้อมูลในแท็บ "ข้อมูลสินทรัพย์-หนี้สิน → หนี้สินคงค้าง"
            </p>
          )}
          {profLongDebt.map((l, i) => (
            <ImportedRow key={`pl-l-${i}`}
              name={l.assetRef ? `${l.debtType} (${l.assetRef})` : (l.debtType || `หนี้สินที่ ${i + 1}`)}
              value={toNum(l.currentBalance)}
              totalForPct={totals.totalLiab}
              accent="#f97316"
              note={l.creditor || undefined}
            />
          ))}
        </SectionCard>

        {/* ===== NET WORTH SUMMARY ===== */}
        <div style={{ ...card, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              สรุปงบดุลส่วนบุคคล
            </p>
            <ExcelButton filename={`งบดุล-${person === 'spouse' ? 'คู่สมรส' : 'ลูกค้า'}`} getSheets={(): ExcelSheet => {
              const rows: (string | number)[][] = [['หมวด', 'รายการ', 'มูลค่า (บาท)', '% ของรวม']]
              const push = (cat: string, name: string, val: number, base: number) =>
                rows.push([cat, name, Math.round(val), base ? +((val / base) * 100).toFixed(2) : 0])
              savingsAccounts.filter(a => toNum(a.currentValue) > 0).forEach((a, i) =>
                push('สินทรัพย์สภาพคล่อง', a.depositType || `บัญชีที่ ${i + 1}`, toNum(a.currentValue), totals.totalAssets))
              cashValuePolicies.forEach(p =>
                push('สินทรัพย์เพื่อการลงทุน', `มูลค่าเวนคืน — ${p.insuranceType || 'ประกันชีวิต'}`, p.cashValue, totals.totalAssets))
              investmentAssets.filter(a => toNum(a.currentValue) > 0).forEach((a, i) =>
                push('สินทรัพย์เพื่อการลงทุน', a.assetName || `รายการที่ ${i + 1}`, toNum(a.currentValue), totals.totalAssets))
              manualInvest.forEach(a => push('สินทรัพย์เพื่อการลงทุน', a.name, a.value, totals.totalAssets))
              personalItems.filter(a => toNum(a.currentValue) > 0).forEach(a =>
                push('สินทรัพย์ส่วนตัว', a.customLabel ? `${a.assetType} (${a.customLabel})` : a.assetType, toNum(a.currentValue), totals.totalAssets))
              profShortDebt.forEach((l, i) => push('หนี้สินระยะสั้น', l.debtType || `หนี้สินที่ ${i + 1}`, toNum(l.currentBalance), totals.totalLiab))
              shortDebt.forEach(l => push('หนี้สินระยะสั้น', l.name, l.balance, totals.totalLiab))
              profLongDebt.forEach((l, i) => push('หนี้สินระยะยาว', l.debtType || `หนี้สินที่ ${i + 1}`, toNum(l.currentBalance), totals.totalLiab))
              rows.push([])
              rows.push(['สรุป', 'สินทรัพย์รวม', Math.round(totals.totalAssets), ''])
              rows.push(['สรุป', 'หนี้สินรวม', Math.round(totals.totalLiab), ''])
              rows.push(['สรุป', 'ความมั่งคั่งสุทธิ', Math.round(totals.netWorth), ''])
              return { name: 'งบดุล', rows }
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'สินทรัพย์รวม (1)',      value: totals.totalAssets, color: '#22d3ee', sign: '' },
              { label: 'หนี้สินระยะสั้นรวม',    value: totals.shortTotal,  color: '#f43f5e', sign: '-' },
              { label: 'หนี้สินระยะยาวรวม',     value: totals.longTotal,   color: '#f97316', sign: '-' },
              { label: 'หนี้สินรวม (2)',         value: totals.totalLiab,   color: '#f43f5e', sign: '-' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 13, paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ color: r.color, fontWeight: 500 }}>{r.sign}{fmt(r.value)} ฿</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>ความมั่งคั่งสุทธิ</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Net Worth (1 - 2)</p>
              </div>
              <span style={{ fontSize: 22, fontWeight: 800,
                color: totals.netWorth >= 0 ? '#10b981' : '#f43f5e' }}>
                {totals.netWorth >= 0 ? '+' : ''}{fmt(totals.netWorth)} ฿
              </span>
            </div>
            {totals.netWorth < 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.1)',
                borderRadius: 8, border: '1px solid rgba(244,63,94,0.25)', fontSize: 12, color: '#fca5a5' }}>
                ⚠️ หนี้สินมากกว่าสินทรัพย์ {fmt(Math.abs(totals.netWorth))} บาท
              </div>
            )}
            {totals.netWorth > 0 && totals.totalAssets > 0 && (
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)',
                borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: '#6ee7b7' }}>
                ✅ อัตราส่วนหนี้ต่อสินทรัพย์ {((totals.totalLiab / totals.totalAssets) * 100).toFixed(2)}%
              </div>
            )}
          </div>
        </div>

      </div>{/* end left */}

      {/* Right: sidebar — paddingTop aligns with first SectionCard below the section header */}
      <div style={{ width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 37 }}>
        <MiniPieChart
          title="โครงสร้างสินทรัพย์"
          colors={PIE_ASSET_COLORS}
          data={[
            { name: 'สภาพคล่อง',   value: totals.liquid },
            { name: 'การลงทุน',     value: totals.invest },
            { name: 'ส่วนตัว',      value: totals.personal },
          ]}
        />
        <MiniPieChart
          title="โครงสร้างหนี้สิน"
          colors={PIE_DEBT_COLORS}
          data={[
            { name: 'ระยะสั้น (≤ 1 ปี)', value: totals.shortTotal },
            { name: 'ระยะยาว (> 1 ปี)',  value: totals.longTotal },
          ]}
        />
      </div>

    </div>
  )
}
