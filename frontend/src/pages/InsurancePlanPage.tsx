import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Check, Loader2, TrendingUp, ShieldCheck, HeartPulse } from 'lucide-react'
import { calc as calcTaxPlan, defaultState as defaultTaxState } from '../lib/tax'
import { monthlyIncome } from '../lib/income'
import { useIsCompact } from '../hooks/useViewport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { ChartFrame } from '../components/exportable'

/* ── helpers ── */
const fmt = (n: number, d = 0) =>
  isFinite(n) && !isNaN(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-'
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
export function pvAnnuity(rate: number, n: number, pmt: number) {
  if (rate === 0) return pmt * n
  return pmt * (1 - Math.pow(1 + rate, -n)) / rate
}

type Item = { label: string; amount: number }
export interface PersonPlan {
  income: number
  // ── Human Life Value ──
  hlvDeduct: Item[]      // ค่าใช้จ่ายเฉพาะตัวผู้เอาประกัน (ภาษี/เบี้ยตัวเอง/ส่วนตัว)
  hlvReturn: number      // i (อัตราคิดลด)
  hlvGrowth: number      // g (การเติบโตของรายได้)
  // ── Needs-Based ──
  deductions: Item[]
  debts: Item[]
  education: number      // ทุนการศึกษาบุตร
  finalExpense: number   // ค่าใช้จ่ายสุดท้าย (งานศพ/ค่ารักษา)
  assets: Item[]
  years: number
  returnRate: number
  incomeGrowth: number
  retirementNeedPct: number  // (เดิม) ไม่ใช้แล้วใน Needs-Based v2 — คงไว้กัน data เก่าพัง
  // ── Needs-Based ส่วนที่ 1: ความต้องการค่าใช้จ่าย (กรอกเอง) ต่อปี ──
  needFamilyExpense: number  // ค่าใช้จ่ายสำหรับครอบครัว
  needParentCare: number     // ค่าดูแลบุพการีที่ต้องการ
  needChildCare: number      // ค่าใช้จ่ายในการดูแลบุตร
  needOthers: Item[]         // ค่าใช้จ่ายอื่นๆ (เพิ่มรายการได้)
  // ── กรณีทุพพลภาพ ──
  disCareAnnual: number   // ค่ารักษา/ดูแลระยะยาว ต่อปี
  disCareYears: number    // จำนวนปีที่ต้องดูแล
  disHomeMod: number      // ค่าปรับปรุงที่อยู่/อุปกรณ์ (ครั้งเดียว)
  disExisting: number     // ความคุ้มครองทุพพลภาพเดิม
  selectedMethod?: 'hlv' | 'needs'   // วิธีที่เลือกใช้เป็นทุนประกันชีวิตที่แนะนำ
}

export const defaultPlan = (): PersonPlan => ({
  income: 0,
  hlvDeduct: [],
  hlvReturn: 5.9,
  hlvGrowth: 5,
  deductions: [
    { label: 'ค่าใช้จ่ายส่วนตัว', amount: 0 },
  ],
  debts: [
    { label: 'หนี้อื่น ๆ', amount: 0 },
  ],
  education: 0,
  finalExpense: 0,
  assets: [
    { label: 'สินทรัพย์อื่น ๆ', amount: 0 },
  ],
  years: 0,   // 0 = ใช้ค่าที่คำนวณจากอายุบุตรคนเล็ก (22 − อายุ); กรอกเองเพื่อพิมพ์ทับ
  returnRate: 5.9,
  incomeGrowth: 5,
  retirementNeedPct: 70,
  needFamilyExpense: 0,
  needParentCare: 0,
  needChildCare: 0,
  needOthers: [{ label: '', amount: 0 }],
  disCareAnnual: 0,
  disCareYears: 20,
  disHomeMod: 0,
  disExisting: 0,
  selectedMethod: 'needs',
})

/* ══════════════════════════════════════════════════════════════════════════
   สูตรคำนวณทุนประกันกลาง (HLV + Needs-Based) — source of truth เดียว
   ใช้ร่วมทั้งหน้าวางแผนประกัน (PersonPanel) และ useInsuranceReadiness/สไลด์นำเสนอ
   กัน drift · รับ "ค่าดึงอัตโนมัติ" ที่ resolve แล้วเป็น input
   ══════════════════════════════════════════════════════════════════════════ */
export interface InsuranceAutos {
  autoIncome: number
  workingYears: number
  autoDebt: number
  autoAssets: { investment: number; deposit: number; insurance: number; severance: number }
  autoDeduct: { ss: number; pvd: number; savings: number; insurance: number; tax: number; personal: number }
  autoYears: number
  preRetReturn: number
  autoTPD: number   // ความคุ้มครองทุพพลภาพเดิม (rider) สำหรับกรณีทุพพลภาพ
}
const INS_AUTO_LABELS = /ประกันสังคม|สำรองเลี้ยงชีพ|เงินออม|RMF|SSF|ThaiESG|เบี้ยประกัน|ภาษี/i

export function computeInsurance(plan: PersonPlan, a: InsuranceAutos) {
  const income = plan.income || a.autoIncome
  const coverageYears = plan.years || a.autoYears
  const manualSum = (items: Item[]) => (items ?? []).filter(it => !INS_AUTO_LABELS.test(it.label)).reduce((s, it) => s + toNum(it.amount), 0)

  // Human Life Value
  const hlvAuto = a.autoDeduct.ss + a.autoDeduct.pvd + a.autoDeduct.savings + a.autoDeduct.insurance + a.autoDeduct.tax + a.autoDeduct.personal
  const hlvSelf = hlvAuto + manualSum(plan.hlvDeduct)
  const hlvNetIncome = Math.max(0, income - hlvSelf)
  const hlvReal = (1 + a.preRetReturn / 100) / (1 + plan.hlvGrowth / 100) - 1
  const hlv = pvAnnuity(hlvReal, a.workingYears, hlvNetIncome)

  // Needs-Based
  const needOthersSum = (plan.needOthers ?? []).reduce((s, it) => s + toNum(it.amount), 0)
  const familyExpense = toNum(plan.needFamilyExpense) + toNum(plan.needParentCare) + toNum(plan.needChildCare) + needOthersSum
  const realRate = (1 + a.preRetReturn / 100) / (1 + plan.incomeGrowth / 100) - 1
  const familyIncomePV = pvAnnuity(realRate, coverageYears, familyExpense)
  const manualDebt = plan.debts.reduce((s, it) => s + toNum(it.amount), 0)
  const sumDebt = manualDebt + a.autoDebt
  const coverageNeed = familyIncomePV + sumDebt

  // สินทรัพย์ที่มี (หักออก)
  const manualAssets = plan.assets.reduce((s, it) => s + toNum(it.amount), 0)
  // เงินชดเชยประกันสังคม (กรณีเสียชีวิต) = มูลค่า ณ ปัจจุบัน ไม่ต้อง discount
  const severancePV = a.autoAssets.severance
  const autoAssetTotal = a.autoAssets.investment + a.autoAssets.deposit + a.autoAssets.insurance + severancePV
  const sumAssets = manualAssets + autoAssetTotal

  const hlvCoverage = hlv + sumDebt
  const hlvNet = Math.max(0, hlvCoverage - sumAssets)
  const netNeed = Math.max(0, coverageNeed - sumAssets)

  const method: 'hlv' | 'needs' = plan.selectedMethod ?? 'needs'
  const recommendedNeed = method === 'hlv' ? hlvCoverage : coverageNeed   // "ทุนที่ควรมี" ตามวิธีที่เลือก
  const recommendedNet = method === 'hlv' ? hlvNet : netNeed

  // ── กรณีทุพพลภาพ ── หักเฉพาะค่าใช้จ่ายจากการทำงาน (ยังมีชีวิต ยังต้องใช้จ่ายส่วนตัว — ไม่หัก personal)
  const disWorkDeduct = a.autoDeduct.ss + a.autoDeduct.pvd + a.autoDeduct.savings + a.autoDeduct.insurance + a.autoDeduct.tax
  const disNetIncome = Math.max(0, income - disWorkDeduct)
  const disIncomeLossPV = pvAnnuity(realRate, a.workingYears, disNetIncome)
  const disCarePV = pvAnnuity(realRate, toNum(plan.disCareYears), toNum(plan.disCareAnnual))
  const ssoDisMonthly = 0.5 * Math.min(income / 12, 15000)   // เงินทดแทนทุพพลภาพ ปกส. 50% ค่าจ้าง (เพดาน 15,000)
  const ssoDisPV = pvAnnuity(realRate, a.workingYears, ssoDisMonthly * 12)
  const disTotal = disIncomeLossPV + disCarePV + toNum(plan.disHomeMod) + sumDebt
  const disOffset = sumAssets + a.autoTPD + ssoDisPV
  const disNet = Math.max(0, disTotal - disOffset)

  return {
    income, coverageYears, hlvAuto, hlvSelf, hlvNetIncome, hlvReal, hlv,
    familyExpense, realRate, familyIncomePV, manualDebt, sumDebt, coverageNeed,
    manualAssets, severancePV, autoAssetTotal, sumAssets, hlvCoverage, hlvNet, netNeed,
    method, recommendedNeed, recommendedNet,
    disNetIncome, disIncomeLossPV, disCarePV, ssoDisPV, disTotal, disOffset, disNet,
  }
}

/* ── small components ── */
const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.22)' }
const numInp: React.CSSProperties = { width: 130, padding: '5px 8px', textAlign: 'right', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)', fontSize: 13, fontWeight: 500, outline: 'none', fontFamily: 'monospace' }

function MoneyInput({ value, onChange, width = 130 }: { value: number; onChange: (v: number) => void; width?: number }) {
  const [text, setText] = useState(value ? value.toLocaleString('en-US') : '')
  useEffect(() => { setText(value ? value.toLocaleString('en-US') : '') }, [value])
  return (
    <input type="text" inputMode="numeric" value={text}
      onChange={e => {
        const raw = e.target.value.replace(/,/g, '')
        if (raw === '') { setText(''); onChange(0); return }
        if (!/^\d+$/.test(raw)) return
        const n = Number(raw); setText(n.toLocaleString('en-US')); onChange(n)
      }}
      style={{ ...numInp, width }} />
  )
}

function EditableList({ items, onChange, color, total }: { items: Item[]; onChange: (v: Item[]) => void; color: string; total?: number }) {
  const set = (i: number, k: keyof Item, v: any) => onChange(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={it.label} onChange={e => set(i, 'label', e.target.value)} placeholder="รายการ"
            style={{ flex: 1, padding: '5px 8px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12.5, outline: 'none' }} />
          <MoneyInput value={it.amount} onChange={v => set(i, 'amount', v)} width={120} />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2 }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { label: '', amount: 0 }])}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: '1px dashed var(--card-border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', marginTop: 2, width: 'fit-content' }}>
        <Plus size={11} /> เพิ่มรายการ
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, marginTop: 2, borderTop: '1px solid var(--card-border)' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>รวม</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color }}>{fmt(total ?? items.reduce((s, it) => s + toNum(it.amount), 0))} บาท</span>
      </div>
    </div>
  )
}

function Section({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        <span style={{ color: 'var(--cyan)' }}>{no}.</span> {title}
      </p>
      {children}
    </div>
  )
}

function ResultRow({ label, value, big = false, color = 'var(--text-primary)' }: { label: string; value: number; big?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: big ? '4px 0' : '6px 0', borderBottom: big ? 'none' : '1px solid var(--divider)' }}>
      <span style={{ fontSize: big ? 14 : 12.5, fontWeight: big ? 700 : 400, color: big ? color : 'var(--text-secondary)' }}>{label}</span>
      <span><span style={{ fontFamily: 'monospace', fontSize: big ? 22 : 13, fontWeight: big ? 800 : 600, color }}>{fmt(value)}</span> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
    </div>
  )
}

/* ── small input row ── */
function AssumpRow({ label, value, onChange, unit, step = 0.1 }: { label: string; value: number; onChange: (v: number) => void; unit: string; step?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
      <span><input type="number" step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ ...numInp, width: 70 }} /> <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span></span>
    </div>
  )
}

/* ── read-only auto row (ดึงอัตโนมัติ) ── */
function AutoRow({ label, value, color = '#4ade80' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '4px 0' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {label}<span style={{ fontSize: 9, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 4, padding: '1px 5px' }}>auto</span>
      </span>
      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color }}>{fmt(value)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>บาท</span></span>
    </div>
  )
}

/* ── หัวคอลัมน์แต่ละวิธี (ไอคอน + แถบสี accent) ── */
function MethodHeader({ no, title, sub, accent, Icon }: { no: number; title: string; sub: string; accent: string; Icon: React.ElementType }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', borderRadius: 13, background: `linear-gradient(135deg, ${accent}26, ${accent}0a 70%)`, border: `1px solid ${accent}40`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent}24`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: accent, lineHeight: 1.15, letterSpacing: '-0.01em' }}>{no}. {title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  )
}

/* ── การ์ดผลลัพธ์ทุนประกัน (พรีเมียม) ── */
function ResultCard({ label, value, accent, note }: { label: string; value: number; accent: string; note: string }) {
  return (
    <div style={{ position: 'relative', background: `linear-gradient(160deg, ${accent}20, var(--card-bg) 58%)`, border: `1.5px solid ${accent}55`, borderRadius: 16, padding: '18px 20px', overflow: 'hidden', boxShadow: `0 10px 34px -12px ${accent}55` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, transparent 85%)` }} />
      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.01em' }}>{label}</p>
      <p style={{ fontSize: 34, fontWeight: 800, color: accent, fontFamily: 'monospace', margin: '6px 0 3px', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {fmt(value)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-muted)' }}>บาท</span>
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{note}</p>
    </div>
  )
}

/* ── per-person panel: HLV | Needs-Based ── */
function PersonPanel({ plan, onChange, autoIncome, workingYears, autoDebt, autoAssets, autoTPD, autoDeduct, autoYears, youngestAge, preRetReturn }: { plan: PersonPlan; onChange: (p: PersonPlan) => void; color: string; autoIncome: number; workingYears: number; autoDebt: number; autoAssets: { investment: number; deposit: number; insurance: number; severance: number }; autoTPD: number; autoDeduct: { ss: number; pvd: number; savings: number; insurance: number; tax: number; personal: number }; autoYears: number; youngestAge: number | null; preRetReturn: number }) {
  const set = <K extends keyof PersonPlan>(k: K, v: PersonPlan[K]) => onChange({ ...plan, [k]: v })

  // สูตรคำนวณกลาง (ใช้ร่วมกับ useInsuranceReadiness/สไลด์นำเสนอ กัน drift)
  const C = computeInsurance(plan, { autoIncome, workingYears, autoDebt, autoAssets, autoDeduct, autoYears, preRetReturn, autoTPD })
  const {
    income, coverageYears, hlvNetIncome, hlvReal, hlv, hlvSelf,
    familyExpense, realRate, familyIncomePV, sumDebt, coverageNeed,
    severancePV, sumAssets, hlvCoverage, hlvNet, netNeed,
    disNetIncome, disIncomeLossPV, disCarePV, ssoDisPV, disTotal, disOffset, disNet,
  } = C

  const compact = useIsCompact()
  const selectedMethod = plan.selectedMethod ?? 'needs'
  const chartData = [
    { name: 'HLV', 'มีแล้ว': Math.round(sumAssets), 'ส่วนที่ขาด': Math.round(hlvNet) },
    { name: 'Needs-Based', 'มีแล้ว': Math.round(sumAssets), 'ส่วนที่ขาด': Math.round(netNeed) },
    { name: 'ทุพพลภาพ', 'มีแล้ว': Math.round(disOffset), 'ส่วนที่ขาด': Math.round(disNet) },
  ]
  const th: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }
  const td: React.CSSProperties = { padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── สรุป (ตาราง) + กราฟเปรียบเทียบ ── */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 16, alignItems: 'stretch' }}>
      <div style={card}>
        <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>สรุป ทุนประกันภัยที่ควรมี</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>ติ๊กเลือกวิธีคำนวณทุนประกันชีวิตที่จะแนะนำ · หน่วย: บาท</p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ ...th, width: 44, textAlign: 'center' }}>เลือก</th>
                <th style={{ ...th, textAlign: 'left' }}>วิธีคำนวณทุนประกัน</th>
                <th style={th}>ทุนที่ควรมี</th>
                <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981' }} />มีแล้ว</span></th>
                <th style={th}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}><span style={{ width: 8, height: 8, borderRadius: 999, background: '#f59e0b' }} />ทำเพิ่ม</span></th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--divider)', background: selectedMethod === 'hlv' ? '#22d3ee14' : 'transparent' }}>
                <td style={{ textAlign: 'center', padding: '9px 10px' }}><input type="checkbox" checked={selectedMethod === 'hlv'} onChange={() => set('selectedMethod', 'hlv')} style={{ width: 16, height: 16, accentColor: '#22d3ee', cursor: 'pointer' }} /></td>
                <td style={{ padding: '9px 10px', fontSize: 13, color: 'var(--text-primary)' }}>ทุนประกันที่ควรมี · <span style={{ color: '#22d3ee', fontWeight: 700 }}>Human Life Value</span></td>
                <td style={td}>{fmt(hlvCoverage)}</td>
                <td style={{ ...td, color: '#10b981' }}>{fmt(sumAssets)}</td>
                <td style={{ ...td, fontWeight: 800, color: '#f59e0b' }}>{fmt(hlvNet)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--divider)', background: selectedMethod === 'needs' ? '#fbbf2414' : 'transparent' }}>
                <td style={{ textAlign: 'center', padding: '9px 10px' }}><input type="checkbox" checked={selectedMethod === 'needs'} onChange={() => set('selectedMethod', 'needs')} style={{ width: 16, height: 16, accentColor: '#fbbf24', cursor: 'pointer' }} /></td>
                <td style={{ padding: '9px 10px', fontSize: 13, color: 'var(--text-primary)' }}>ทุนประกันที่ควรมี · <span style={{ color: '#fbbf24', fontWeight: 700 }}>Need Base Analysis</span></td>
                <td style={td}>{fmt(coverageNeed)}</td>
                <td style={{ ...td, color: '#10b981' }}>{fmt(sumAssets)}</td>
                <td style={{ ...td, fontWeight: 800, color: '#f59e0b' }}>{fmt(netNeed)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', padding: '9px 10px', color: 'var(--text-muted)', fontSize: 16 }}>—</td>
                <td style={{ padding: '9px 10px', fontSize: 13, color: 'var(--text-primary)' }}>ทุนประกัน · <span style={{ color: '#fb7185', fontWeight: 700 }}>กรณีทุพพลภาพ</span></td>
                <td style={td}>{fmt(disTotal)}</td>
                <td style={{ ...td, color: '#10b981' }}>{fmt(disOffset)}</td>
                <td style={{ ...td, fontWeight: 800, color: '#f59e0b' }}>{fmt(disNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── กราฟเปรียบเทียบทุนประกัน 3 รูปแบบ ── */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>เปรียบเทียบทุนประกัน</p>
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 8 }}>ความสูงแท่ง = ทุนที่ต้องการ · ตัวเลขบนแท่ง = ส่วนที่ขาด</p>
        <ChartFrame title="เปรียบเทียบทุนประกัน" filename="insurance-coverage" height={240}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} width={34} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: any, n: any) => [`${fmt(Number(v))} บาท`, n]} labelStyle={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: 4 }} contentStyle={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={9} />
              {/* status encoding: มีแล้ว = คุ้มครองแล้ว (เขียว) · ส่วนที่ขาด = ต้องทำเพิ่ม (อำพัน) — CVD-safe ΔE46 + คั่น 2px สีพื้น */}
              <Bar dataKey="มีแล้ว" stackId="a" fill="#10b981" stroke="var(--card-bg)" strokeWidth={2} maxBarSize={54} />
              <Bar dataKey="ส่วนที่ขาด" stackId="a" fill="#f59e0b" stroke="var(--card-bg)" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={54}>
                <LabelList dataKey="ส่วนที่ขาด" position="top" formatter={(v: any) => Number(v) > 0 ? `${(Number(v) / 1e6).toFixed(1)}M` : ''} style={{ fontSize: 10.5, fontWeight: 800, fill: 'var(--text-secondary)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
      </div>

      <div className="ins-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(360px, 1fr))', gap: 16, alignItems: 'start', overflowX: 'auto', paddingBottom: 4 }}>

      {/* ══ Column 1: Human Life Value ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MethodHeader no={1} title="Human Life Value" sub="มูลค่ารายได้ในอนาคต" accent="#22d3ee" Icon={TrendingUp} />

        <Section no={1} title="รายได้ − หักค่าใช้จ่ายเฉพาะตัว + จากการทำงาน">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>รายได้รวมต่อปี (auto จากรายได้ทุกแหล่ง)</span>
              <MoneyInput value={plan.income || autoIncome} onChange={v => set('income', v)} />
            </div>
            <div style={{ borderTop: '1px dashed var(--card-border)', margin: '4px 0' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>หักค่าใช้จ่ายจากการทำงาน + เฉพาะตัว</span>
            <AutoRow label="เงินสมทบประกันสังคม" value={autoDeduct.ss} color="#f59e0b" />
            <AutoRow label="เงินสมทบกองทุนสำรองเลี้ยงชีพ" value={autoDeduct.pvd} color="#f59e0b" />
            <AutoRow label="กองทุนลดหย่อนภาษี (RMF/SSF/ThaiESG)" value={autoDeduct.savings} color="#f59e0b" />
            <AutoRow label="เบี้ยประกันชีวิต/สุขภาพของตนเอง" value={autoDeduct.insurance} color="#f59e0b" />
            <AutoRow label="ภาษีเงินได้" value={autoDeduct.tax} color="#f59e0b" />
            <AutoRow label="ค่าใช้จ่ายส่วนตัว" value={autoDeduct.personal} color="#f59e0b" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ค่าใช้จ่ายอื่นๆ (กรอกเอง)</span>
            <EditableList items={plan.hlvDeduct} onChange={v => set('hlvDeduct', v)} color="#f59e0b" total={hlvSelf} />
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '2px 0' }} />
            <ResultRow label="รายได้สุทธิเป็นของครอบครัว/ปี" value={hlvNetIncome} color="var(--cyan-light)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ระยะเวลาที่ทำงานได้ (ถึงเกษียณ)</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>{workingYears} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ปี</span></span>
            </div>
            <ResultRow label={`มูลค่าปัจจุบันของรายได้ (PV ${workingYears} ปี)`} value={hlv} color="var(--cyan-light)" />
          </div>
        </Section>

        <Section no={2} title="สมมติฐาน">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>อัตราผลตอบแทนจากการลงทุน (i)</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>{preRetReturn.toFixed(2)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span></span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>
              ดึงจาก "อัตราผลตอบแทนจากการลงทุนก่อนเกษียณ" หน้าตั้งค่าสมมติฐาน
            </div>
            <AssumpRow label="อัตราการเพิ่มของรายได้ (g)" value={plan.hlvGrowth} onChange={v => set('hlvGrowth', v)} unit="%" />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>ดึงจาก "เงินเดือนเพิ่มขึ้น" หน้าข้อมูลส่วนบุคคล (แก้ไขทับได้)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real Rate = (1+i)/(1+g) − 1</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>{(hlvReal * 100).toFixed(2)}%</span>
            </div>
          </div>
        </Section>

        <Section no={3} title="หนี้สินคงค้าง (D + M)">
          <AutoRow label="หนี้สินจากงบการเงิน" value={autoDebt} color="#f87171" />
          <div style={{ borderTop: '1px dashed var(--card-border)', margin: '6px 0' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>หนี้เพิ่มเติม (กรอกเอง)</span>
          <EditableList items={plan.debts} onChange={v => set('debts', v)} color="#f87171" total={sumDebt} />
        </Section>

        <Section no={4} title="สินทรัพย์ที่มี + เงินชดเชย (หักออก)">
          <AutoRow label="สินทรัพย์ลงทุน" value={autoAssets.investment} color="#4ade80" />
          <AutoRow label="เงินฝาก" value={autoAssets.deposit} color="#4ade80" />
          <AutoRow label="ทุนประกันชีวิตเดิม" value={autoAssets.insurance} color="#4ade80" />
          <AutoRow label="เงินชดเชย (ประกันสังคม)" value={severancePV} color="#4ade80" />
          <div style={{ borderTop: '1px dashed var(--card-border)', margin: '6px 0' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>สินทรัพย์เพิ่มเติม (กรอกเอง)</span>
          <EditableList items={plan.assets} onChange={v => set('assets', v)} color="#4ade80" total={sumAssets} />
        </Section>

        <Section no={5} title="สรุปการคำนวณ">
          <ResultRow label={`มูลค่าปัจจุบันของรายได้ (${workingYears} ปี)`} value={hlv} color="var(--cyan-light)" />
          <ResultRow label="(+) หนี้สินคงค้าง" value={sumDebt} color="#f87171" />
          <ResultRow label="(−) สินทรัพย์ที่มี + เงินชดเชย" value={sumAssets} color="#4ade80" />
        </Section>

        <ResultCard label="ทุนประกันแบบ Human Life Value (สุทธิ)" value={hlvNet} accent="#22d3ee" note={`= PV รายได้ ${fmt(hlv)} + หนี้สิน ${fmt(sumDebt)} − สินทรัพย์ที่มี ${fmt(sumAssets)}`} />
      </div>

      {/* ══ Column 2: Needs-Based ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MethodHeader no={2} title="Needs-Based Analysis" sub="วิเคราะห์ความต้องการจริง (DIME)" accent="#fbbf24" Icon={ShieldCheck} />

        <Section no={1} title="ความต้องการค่าใช้จ่าย">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ค่าใช้จ่ายสำหรับครอบครัว (ต่อปี)</span>
              <MoneyInput value={plan.needFamilyExpense} onChange={v => set('needFamilyExpense', v)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ค่าดูแลบุพการีที่ต้องการ (ต่อปี)</span>
              <MoneyInput value={plan.needParentCare} onChange={v => set('needParentCare', v)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ค่าใช้จ่ายในการดูแลบุตร (ต่อปี)</span>
              <MoneyInput value={plan.needChildCare} onChange={v => set('needChildCare', v)} />
            </div>
            {(plan.needOthers ?? []).map((it, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <input value={it.label} onChange={e => set('needOthers', plan.needOthers.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} placeholder="ค่าใช้จ่ายอื่นๆ (ระบุ)"
                  style={{ flex: 1, minWidth: 0, padding: '4px 8px', background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, outline: 'none' }} />
                <MoneyInput value={it.amount} onChange={v => set('needOthers', plan.needOthers.map((x, idx) => idx === i ? { ...x, amount: v } : x))} />
                <button onClick={() => set('needOthers', plan.needOthers.filter((_, idx) => idx !== i))} title="ลบรายการ"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}><Trash2 size={14} /></button>
              </div>
            ))}
            <button onClick={() => set('needOthers', [...(plan.needOthers ?? []), { label: '', amount: 0 }])}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'none', border: '1px dashed var(--card-border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', width: 'fit-content' }}>
              <Plus size={12} /> เพิ่มรายการ
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>รวมค่าใช้จ่ายที่ต้องการ/ปี</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>{fmt(familyExpense)} บาท</span>
            </div>
            <AssumpRow label="ระยะเวลาที่ต้องการความคุ้มครอง" value={coverageYears} onChange={v => set('years', v)} unit="ปี" step={1} />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>
              {youngestAge != null
                ? `auto: จนบุตรคนเล็ก (อายุ ${youngestAge} ปี) พึ่งตัวเองได้ = 22 − ${youngestAge} · พิมพ์ทับได้`
                : 'auto: ไม่มีข้อมูลบุตร → ใช้จำนวนปีทำงานถึงเกษียณ · พิมพ์ทับได้'}
            </div>
            <ResultRow label="มูลค่าปัจจุบันของรายจ่ายที่ต้องการ" value={familyIncomePV} color="var(--cyan-light)" />
          </div>
        </Section>

        <Section no={2} title="สมมติฐาน">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>อัตราผลตอบแทนจากการลงทุน (i)</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{preRetReturn.toFixed(2)} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span></span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>
              ดึงจาก "อัตราผลตอบแทนจากการลงทุนก่อนเกษียณ" หน้าตั้งค่าสมมติฐาน
            </div>
            <AssumpRow label="อัตราการเพิ่มของรายได้ (g)" value={plan.incomeGrowth} onChange={v => set('incomeGrowth', v)} unit="%" />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -2 }}>ดึงจาก "เงินเดือนเพิ่มขึ้น" หน้าข้อมูลส่วนบุคคล (แก้ไขทับได้)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--card-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real Rate = (1+i)/(1+g) − 1</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>{(realRate * 100).toFixed(2)}%</span>
            </div>
          </div>
        </Section>

        <Section no={3} title="หนี้สินคงค้าง (D + M)">
          <AutoRow label="หนี้สินจากงบการเงิน" value={autoDebt} color="#f87171" />
          <div style={{ borderTop: '1px dashed var(--card-border)', margin: '6px 0' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>หนี้เพิ่มเติม (กรอกเอง)</span>
          <EditableList items={plan.debts} onChange={v => set('debts', v)} color="#f87171" total={sumDebt} />
        </Section>

        <Section no={4} title="สินทรัพย์ที่มี + เงินชดเชย (หักออก)">
          <AutoRow label="สินทรัพย์ลงทุน" value={autoAssets.investment} color="#4ade80" />
          <AutoRow label="เงินฝาก" value={autoAssets.deposit} color="#4ade80" />
          <AutoRow label="ทุนประกันชีวิตเดิม" value={autoAssets.insurance} color="#4ade80" />
          <AutoRow label="เงินชดเชย (ประกันสังคม)" value={severancePV} color="#4ade80" />
          <div style={{ borderTop: '1px dashed var(--card-border)', margin: '6px 0' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>สินทรัพย์เพิ่มเติม (กรอกเอง)</span>
          <EditableList items={plan.assets} onChange={v => set('assets', v)} color="#4ade80" total={sumAssets} />
        </Section>

        <Section no={5} title="สรุปการคำนวณ">
          <ResultRow label="ค่าใช้จ่ายที่ต้องการ/ปี" value={familyExpense} color="var(--cyan-light)" />
          <ResultRow label={`รายได้ทดแทน (PV ${coverageYears} ปี)`} value={familyIncomePV} color="var(--cyan-light)" />
          <ResultRow label="(+) หนี้สินคงค้าง" value={sumDebt} color="#f87171" />
          <ResultRow label="ความต้องการรวม" value={coverageNeed} color="#f59e0b" />
          <ResultRow label="(−) สินทรัพย์ที่มี + เงินชดเชย" value={sumAssets} color="#4ade80" />
        </Section>

        <ResultCard label="ทุนประกันแบบ Needs-Based (สุทธิ)" value={netNeed} accent="#fbbf24" note={`= ความต้องการรวม ${fmt(coverageNeed)} − สินทรัพย์ที่มี ${fmt(sumAssets)}`} />
      </div>

      {/* ══ Column 3: กรณีทุพพลภาพ ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MethodHeader no={3} title="กรณีทุพพลภาพ" sub="Total Permanent Disability" accent="#fb7185" Icon={HeartPulse} />

        <Section no={1} title="รายได้ที่สูญเสีย (หักเฉพาะค่าใช้จ่ายจากการทำงาน)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ResultRow label="รายได้รวมต่อปี" value={income} color="var(--cyan-light)" />
            <div style={{ borderTop: '1px dashed var(--card-border)', margin: '4px 0' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>หักค่าใช้จ่ายจากการทำงาน (ไม่หักค่าใช้จ่ายส่วนตัว)</span>
            <AutoRow label="เงินสมทบประกันสังคม" value={autoDeduct.ss} color="#f59e0b" />
            <AutoRow label="เงินสมทบกองทุนสำรองเลี้ยงชีพ" value={autoDeduct.pvd} color="#f59e0b" />
            <AutoRow label="กองทุนลดหย่อนภาษี (RMF/SSF/ThaiESG)" value={autoDeduct.savings} color="#f59e0b" />
            <AutoRow label="เบี้ยประกันชีวิต/สุขภาพของตนเอง" value={autoDeduct.insurance} color="#f59e0b" />
            <AutoRow label="ภาษีเงินได้" value={autoDeduct.tax} color="#f59e0b" />
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>* ทุพพลภาพยังมีชีวิต จึงไม่หักค่าใช้จ่ายส่วนตัว</div>
            <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
            <ResultRow label="รายได้ที่เป็นของครอบครัว/ปี" value={disNetIncome} color="var(--cyan-light)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ระยะเวลาสูญเสียรายได้ (ถึงเกษียณ)</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#fb7185' }}>{workingYears} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ปี</span></span>
            </div>
            <ResultRow label={`รายได้ที่สูญเสีย (PV ${workingYears} ปี)`} value={disIncomeLossPV} color="var(--cyan-light)" />
          </div>
        </Section>

        <Section no={2} title="ค่ารักษา / ดูแลระยะยาว">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ค่ารักษา/ดูแล ต่อปี</span>
              <MoneyInput value={plan.disCareAnnual} onChange={v => set('disCareAnnual', v)} />
            </div>
            <AssumpRow label="จำนวนปีที่ต้องดูแล" value={plan.disCareYears} onChange={v => set('disCareYears', v)} unit="ปี" step={1} />
            <ResultRow label={`มูลค่าปัจจุบันค่าดูแล (${plan.disCareYears} ปี)`} value={disCarePV} color="var(--cyan-light)" />
          </div>
        </Section>

        <Section no={3} title="ค่าใช้จ่ายเพิ่ม + ความคุ้มครองเดิม">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ปรับปรุงที่อยู่/อุปกรณ์ช่วยเหลือ</span>
              <MoneyInput value={plan.disHomeMod} onChange={v => set('disHomeMod', v)} />
            </div>
            <div style={{ borderTop: '1px dashed var(--card-border)', margin: '2px 0' }} />
            <AutoRow label="ความคุ้มครองทุพพลภาพเดิม" value={autoTPD} color="#4ade80" />
            <AutoRow label="เงินชดเชยประกันสังคม ทุพพลภาพ" value={ssoDisPV} color="#4ade80" />
          </div>
        </Section>

        <Section no={4} title="สรุปการคำนวณ">
          <ResultRow label="รายได้ที่สูญเสีย (PV)" value={disIncomeLossPV} color="var(--cyan-light)" />
          <ResultRow label="(+) ค่ารักษา/ดูแลระยะยาว" value={disCarePV} color="#f59e0b" />
          <ResultRow label="(+) ปรับปรุงที่อยู่/อุปกรณ์" value={toNum(plan.disHomeMod)} color="#f59e0b" />
          <ResultRow label="(+) หนี้สินคงค้าง" value={sumDebt} color="#f87171" />
          <ResultRow label="ความต้องการรวม" value={disTotal} color="#fb7185" />
          <ResultRow label="(−) สินทรัพย์ + ความคุ้มครองเดิม + ปกส." value={disOffset} color="#4ade80" />
        </Section>

        <ResultCard label="ทุนคุ้มครองทุพพลภาพที่ต้องการ (สุทธิ)" value={disNet} accent="#fb7185" note={`= ความต้องการรวม ${fmt(disTotal)} − หักออก ${fmt(disOffset)}`} />
      </div>
    </div>
    </div>
  )
}

/* ── main page ── */
export default function InsurancePlanPage({ person = 'self' }: { person?: 'self' | 'spouse' }) {

  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: saved, isFetched } = useQuery({ queryKey: ['insurance-plan'], queryFn: () => api.get('/insurance-plan').then(r => r.data), retry: false })
  // แหล่งข้อมูลสำหรับดึงอัตโนมัติ
  const { data: liabilities } = useQuery({ queryKey: ['liabilities', person], queryFn: () => api.get('/liabilities', { params: { person } }).then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: lifePolicies } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: allRiders } = useQuery({ queryKey: ['all-riders'], queryFn: () => api.get('/all-riders').then(r => r.data), retry: false })
  const { data: expenses } = useQuery({ queryKey: ['expenses', person], queryFn: () => api.get('/expenses', { params: { person } }).then(r => r.data), retry: false })
  const { data: taxPlan } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })

  const [self, setSelf] = useState<PersonPlan>(defaultPlan())
  const [spouse, setSpouse] = useState<PersonPlan>(defaultPlan())
  const loadedRef = useRef(false)
  const filledGrowthRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    // migration: ลบ item "ค่าใช้จ่ายส่วนตัว" ในลิสต์ manual เดิม (ตอนนี้เป็น auto row แล้ว) กัน double-count
    const stripPersonal = (p: any) => p?.hlvDeduct ? { ...p, hlvDeduct: p.hlvDeduct.filter((it: any) => it.label !== 'ค่าใช้จ่ายส่วนตัว') } : p
    if (saved?.self) setSelf(s => ({ ...s, ...stripPersonal(saved.self) }))
    if (saved?.spouse) setSpouse(s => ({ ...s, ...stripPersonal(saved.spouse) }))
    loadedRef.current = true
  }, [isFetched, saved])

  // autosave
  const qc = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const persist = (payload: any) => { qc.setQueryData(['insurance-plan'], payload); return api.put('/insurance-plan', payload) }
  const save = useMutation({
    mutationFn: (payload: any) => persist(payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valuesRef = useRef<any>({ self, spouse })
  valuesRef.current = { self, spouse }
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate({ self, spouse }), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [self, spouse])
  // flush ค่าล่าสุดตอน unmount (สลับแท็บ)
  useEffect(() => {
    return () => { if (loadedRef.current) persist(valuesRef.current).catch(() => {}) }
  }, [])

  const spouseJob = Array.isArray(clientProfile?.spouseJobs) ? clientProfile.spouseJobs[0] : null
  // รายได้รวมต่อปี — ดึงจากทุกแหล่ง (incomeSources): โบนัส = ก้อนรายปี, อื่นๆ = รายเดือน ×12
  // ให้ตรงกับ "รายได้รวมทั้งปี" ที่งบกระแสเงินสด/แดชบอร์ดใช้ · fallback เงินเดือน×12 ถ้ายังไม่มี incomeSources
  const annualIncomeFrom = (src: any): number => {
    const arr = Array.isArray(src) ? src : []
    const monthly = arr
      .filter((s: any) => toNum(s.amount) > 0)
      .reduce((sum: number, s: any) => sum + monthlyIncome(s), 0)
    return monthly * 12
  }
  const autoIncomeSelf = annualIncomeFrom(clientProfile?.incomeSources) || toNum(clientProfile?.salary) * 12
  const autoIncomeSpouse = annualIncomeFrom(clientProfile?.spouseIncomeSources) || (toNum(spouseJob?.salary) || toNum(clientProfile?.spouseIncome)) * 12

  // จำนวนปีทำงานถึงเกษียณ (สำหรับ HLV)
  const selfAge = clientProfile?.birthDate ? new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear() : null
  const currentAge = person === 'self' ? selfAge : (clientProfile?.spouseAge ?? null)
  const retAge = (person === 'self' ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
  const workingYears = currentAge != null ? Math.max(0, retAge - currentAge) : 25
  // อัตราผลตอบแทนจากการลงทุน (i) สำหรับ HLV + Needs-Based — ดึงจากหน้าตั้งค่าสมมติฐาน
  const preRetReturn = profile?.preRetirementReturn ?? 4

  // ── ค่าดึงอัตโนมัติ (Needs-Based) — แยกตามคน (client = ฟิลด์หลัก, spouse = spouseData) ──
  const invSrc: any = person === 'self' ? invProfile : (invProfile?.spouseData ?? {})
  // หนี้รวม = หนี้สินคงค้าง (investment-profile) + หนี้ในตาราง (งบดุล) — ให้ตรงกับงบดุล/อัตราส่วน
  const profileDebt = Array.isArray(invSrc?.liabilities) ? invSrc.liabilities.reduce((s: number, l: any) => s + toNum(l.currentBalance), 0) : 0
  const tableDebt = Array.isArray(liabilities) ? liabilities.reduce((s: number, l: any) => s + toNum(l.balance), 0) : 0
  const autoDebt = profileDebt + tableDebt
  // แยกสินทรัพย์ลงทุน กับ เงินฝาก (มูลค่าปัจจุบัน) เพื่อแสดงเป็นคนละรายการ
  const autoInvestment = Array.isArray(invSrc?.investmentAssets) ? invSrc.investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0
  const autoDeposit = Array.isArray(invSrc?.savingsAccounts) ? invSrc.savingsAccounts.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0
  const personName = person === 'self' ? (clientProfile?.firstName ?? '') : (clientProfile?.spouseProfile?.firstName ?? '###')
  const personPolicies = Array.isArray(lifePolicies) ? lifePolicies.filter((p: any) => (p.insuredPerson || '').includes(personName)) : []
  const personPolicyIds = new Set(personPolicies.map((p: any) => p.id))
  const autoInsurance = personPolicies.reduce((s: number, p: any) => s + toNum(p.sumAssured), 0)
  // autoAssets ประกาศหลังคำนวณเงินชดเชยประกันสังคม (ใช้ welfare/monthlySalary ที่อยู่ด้านล่าง)

  // ความคุ้มครองทุพพลภาพเดิม: รวม rider ประเภท "ทุพพลภาพ" (disabled) ของกรมธรรม์บุคคลนั้น
  const autoTPD = Array.isArray(allRiders)
    ? allRiders.filter((r: any) => personPolicyIds.has(r.policyId) && (r.riderType === 'disabled' || (r.planName || '').includes('ทุพพลภาพ')))
        .reduce((s: number, r: any) => s + toNum(r.coverageAmount), 0)
    : 0

  // ── ค่าหักอัตโนมัติ 5 รายการ (ต่อปี) แยกตามคน — ใช้ทั้ง HLV และ Needs-Based ──
  const toAnnual = (amount: number, freq: string) => freq === 'MONTHLY' ? amount * 12 : amount
  const welfare: any = person === 'self' ? clientProfile : clientProfile?.spouseProfile
  const monthlySalary = person === 'self' ? toNum(clientProfile?.salary) : (toNum(spouseJob?.salary) || toNum(clientProfile?.spouseIncome))
  const autoSS = welfare?.hasSocialSecurity ? Math.min(monthlySalary, 17500) * 0.05 * 12 : 0
  const autoPVD = welfare?.hasPVD ? monthlySalary * (toNum(welfare?.pvdEmployeeRate) / 100) * 12 : 0

  // ── เงินชดเชยประกันสังคม (กรณีเสียชีวิต) = ค่าทำศพ + เงินสงเคราะห์กรณีตาย + บำเหน็จชราภาพสะสม (คืนทายาท) ──
  // มูลค่า ณ ปัจจุบัน · แสดงเป็นสินทรัพย์ที่ครอบครัวได้รับ หักออกจากทุนประกันชีวิต
  const ssoAvgWage = Math.min(monthlySalary, 15000)               // ค่าจ้างเฉลี่ย (เพดาน ปกส. 15,000)
  const ssoMonths = toNum(welfare?.socialSecurityYears) * 12      // จำนวนเดือนที่สมทบมาแล้ว
  const ssoFuneral = 50000                                        // ค่าทำศพ (คงที่)
  const ssoSurvivor = ssoMonths >= 120 ? ssoAvgWage * 6 : ssoMonths >= 36 ? ssoAvgWage * 2 : 0   // เงินสงเคราะห์กรณีตาย (6 เท่า/2 เท่า)
  const ssoOldAge = toNum(welfare?.socialSecurityValue)           // บำเหน็จชราภาพสะสม (คืนทายาท) = มูลค่ากองทุน ปกส. ปัจจุบัน
  const autoSSCompensation = welfare?.hasSocialSecurity ? (ssoFuneral + ssoSurvivor + ssoOldAge) : 0
  const autoAssets = { investment: autoInvestment, deposit: autoDeposit, insurance: autoInsurance, severance: autoSSCompensation }
  const autoSavings = Array.isArray(expenses)
    ? expenses.filter((e: any) => String(e.category).startsWith('saving_')).reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0
  // ค่าใช้จ่ายส่วนตัว (auto) = ค่าใช้จ่ายผันแปรรวมต่อปี หัก "เงินให้บุพการี" (var_parents) และ "ภาษีเงินได้" (var_tax)
  const autoPersonalExpense = Array.isArray(expenses)
    ? expenses.filter((e: any) => String(e.category).startsWith('var_') && e.category !== 'var_parents' && e.category !== 'var_tax')
        .reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0

  // อัตราการเพิ่มของรายได้ (g) default = "เงินเดือนเพิ่มขึ้น" หน้าข้อมูลส่วนบุคคล
  const rawSalGrowth = person === 'self' ? clientProfile?.salaryIncreaseRate : spouseJob?.salaryIncreaseRate
  const autoSalaryGrowth = (rawSalGrowth != null && rawSalGrowth !== '' && !isNaN(Number(rawSalGrowth))) ? Number(rawSalGrowth) : null
  // เติม g จากเงินเดือนเพิ่มขึ้น ครั้งเดียวต่อคน หากยังเป็นค่าเริ่มต้น (5)
  useEffect(() => {
    if (!loadedRef.current || autoSalaryGrowth == null || filledGrowthRef.current[person]) return
    const upd = person === 'self' ? setSelf : setSpouse
    upd(p => {
      const patch: Partial<PersonPlan> = {}
      if (p.hlvGrowth === 5) patch.hlvGrowth = autoSalaryGrowth
      if (p.incomeGrowth === 5) patch.incomeGrowth = autoSalaryGrowth
      return Object.keys(patch).length ? { ...p, ...patch } : p
    })
    filledGrowthRef.current[person] = true
  }, [person, autoSalaryGrowth])
  const lifePremiumAnnual = personPolicies.reduce((s: number, p: any) => s + toNum(p.premium), 0)
  const healthPremiumAnnual = Array.isArray(expenses)
    ? expenses.filter((e: any) => e.category === 'fixed_health_ins').reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0
  const autoInsPremium = lifePremiumAnnual + healthPremiumAnnual
  const autoTax = taxPlan?.[person] ? calcTaxPlan({ ...defaultTaxState(), ...taxPlan[person] }).tax : 0
  const autoDeduct = { ss: autoSS, pvd: autoPVD, savings: autoSavings, insurance: autoInsPremium, tax: autoTax, personal: autoPersonalExpense }

  // ระยะเวลาความคุ้มครอง (Needs-Based) = จนบุตรคนเล็กพึ่งตัวเองได้ (22 − อายุบุตรคนเล็ก) · ไม่มีบุตร → ปีทำงานถึงเกษียณ
  const children = Array.isArray(clientProfile?.children) ? clientProfile.children : []
  const childAges = children.map((c: any) => toNum(c.age)).filter((a: number) => a > 0)
  const youngestAge = childAges.length ? Math.min(...childAges) : null
  const autoYears = youngestAge != null ? Math.max(1, 22 - youngestAge) : (workingYears || 20)

  // ทุนการศึกษาบุตร (E) — ดึงค่าเล่าเรียนรวม (totalNominal) จากหน้าทุนการศึกษา (hook เดียวกัน กัน drift)

  const color = person === 'self' ? '#06b6d4' : '#c084fc'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes ins-spin { to { transform: rotate(360deg) } }
        .ins-spin { animation: ins-spin 0.9s linear infinite }
        @keyframes insUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        .ins-grid > div { animation: insUp .5s cubic-bezier(.2,.7,.3,1) both }
        .ins-grid > div:nth-child(2) { animation-delay: .08s }
        .ins-grid > div:nth-child(3) { animation-delay: .16s }
        .ins-sumrow { transition: background .15s }
        .ins-sumrow:hover { background: var(--hover) }
      `}</style>

      {/* คำบรรยาย + สถานะบันทึก (หัวข้อหลักแสดงโดย PageHeader ของหน้าวางแผนการเงิน) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: -8 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: 200 }}>คำนวณทุนประกันที่เหมาะสม 3 มุมมอง: Human Life Value · Needs-Based (DIME) · กรณีทุพพลภาพ</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          {status === 'saving' && <><Loader2 size={14} className="ins-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
          {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
        </div>
      </div>

      {person === 'self'
        ? <PersonPanel plan={self} onChange={setSelf} color={color} autoIncome={autoIncomeSelf} workingYears={workingYears} autoDebt={autoDebt} autoAssets={autoAssets} autoTPD={autoTPD} autoDeduct={autoDeduct} autoYears={autoYears} youngestAge={youngestAge} preRetReturn={preRetReturn} />
        : <PersonPanel plan={spouse} onChange={setSpouse} color={color} autoIncome={autoIncomeSpouse} workingYears={workingYears} autoDebt={autoDebt} autoAssets={autoAssets} autoTPD={autoTPD} autoDeduct={autoDeduct} autoYears={autoYears} youngestAge={youngestAge} preRetReturn={preRetReturn} />}
    </div>
  )
}
