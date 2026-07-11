import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { GraduationCap, Check, Loader2, LineChart as LineChartIcon, ChevronDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartFrame, TableExcelButton } from '../components/exportable'
import { usePortfolioReturns, type PortfolioReturn } from '../lib/portfolioReturns'

/* ── helpers ── */
const fmt = (n: number, d = 0) =>
  isFinite(n) && !isNaN(n) ? n.toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-'
const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

export const LEVELS = [
  { key: 'kindergarten', label: 'อนุบาล', ages: [3, 4, 5] },
  { key: 'primary', label: 'ประถม', ages: [6, 7, 8, 9, 10, 11] },
  { key: 'secondary', label: 'มัธยม', ages: [12, 13, 14, 15, 16, 17] },
  { key: 'bachelor', label: 'ปริญญาตรี', ages: [18, 19, 20, 21] },
  { key: 'master', label: 'ปริญญาโท', ages: [22, 23] },
]
const TYPES = [
  { key: 'public', label: 'รัฐ' },
  { key: 'private', label: 'เอกชน' },
  { key: 'international', label: 'นานาชาติ' },
]
export function levelForAge(age: number) { return LEVELS.find(l => l.ages.includes(age)) || null }

// ตัวคูณ annuity แบบ "ออมเพิ่มขึ้นทุกปี" อัตรา g (growing annuity, จ่ายปลายงวด m งวด, คิดลด r)
// PV = S × factor โดย S = เงินออมปีแรก, งวดที่ k = S × (1+g)^(k-1)
export function growAnnuityFactor(r: number, g: number, m: number) {
  if (m <= 0) return 0
  const q = (1 + g) / (1 + r)
  if (Math.abs(q - 1) < 1e-9) return m / (1 + g)
  return (1 / (1 + r)) * (1 - Math.pow(q, m)) / (1 - q)
}

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '18px 20px' }

export interface ChildSetting { type: string; savingYears: number; includeMaster: boolean; excludedLevels?: string[] }
const defaultSetting = (): ChildSetting => ({ type: 'private', savingYears: 10, includeMaster: false, excludedLevels: [] })

/* คำนวณกราฟ "เงินออมสะสมเพื่อทุนการศึกษา" (3 ประเภทสถาบัน) — pure, reuse ได้ทั้งหน้าฟีเจอร์และรายงาน */
export const EDU_CHART_TYPES = [
  { key: 'public', label: 'รัฐ', color: '#10b981' },
  { key: 'private', label: 'เอกชน', color: '#f59e0b' },
  { key: 'international', label: 'นานาชาติ', color: '#f43f5e' },
]
export function buildEduChart({ age, setting, eduCosts, inflationPct, ratePct, incomeGrowthPct }: {
  age: number; setting: ChildSetting; eduCosts: any; inflationPct: number; ratePct: number; incomeGrowthPct: number
}) {
  const inf = inflationPct / 100, r = ratePct / 100, gInc = incomeGrowthPct / 100
  const excluded = setting.excludedLevels ?? []
  const m = Math.max(1, setting.savingYears)
  const buildSchedule = (type: string) => {
    const out: { yfn: number; inflated: number }[] = []
    for (let a = Math.max(age, 3); a <= 23; a++) {
      const lvl = levelForAge(a)
      if (!lvl) continue
      if (lvl.key === 'master' && !setting.includeMaster) continue
      if (excluded.includes(lvl.key)) continue
      const base = toNum(eduCosts?.[lvl.key]?.[type])
      if (base <= 0) continue
      const yfn = a - age
      out.push({ yfn, inflated: base * Math.pow(1 + inf, yfn) })
    }
    return out
  }
  const af = growAnnuityFactor(r, gInc, m)
  const plans = EDU_CHART_TYPES.map(t => {
    const sched = buildSchedule(t.key)
    const pv = sched.reduce((s, x) => s + x.inflated / Math.pow(1 + r, x.yfn), 0)
    const annual = af > 0 ? pv / af : 0
    return { ...t, pv, annual, sched }
  })
  const thisYear = new Date().getFullYear()
  const maxYfn = plans.reduce((mx, p) => p.sched.reduce((a, x) => Math.max(a, x.yfn), mx), 0)
  const horizon = Math.max(m, maxYfn) + 4
  const balances = plans.map(() => 0)
  const chartData: any[] = []
  for (let t = 0; t <= horizon; t++) {
    const row: any = { year: thisYear + t + 543 }
    plans.forEach((p, i) => {
      const due = p.sched.filter(x => x.yfn === t).reduce((s, x) => s + x.inflated, 0)
      row[`${p.key}_fee`] = due > 0 ? Math.round(due) : null
      balances[i] -= due
      if (t > 0) balances[i] *= (1 + r)
      if (t < m) balances[i] += p.annual * Math.pow(1 + gInc, t)
      row[p.key] = t <= maxYfn ? Math.round(balances[i]) : null
    })
    chartData.push(row)
  }
  // ค่าใช้จ่ายรวมต่อระดับชั้น (อนาคต ปรับเงินเฟ้อ) แยกตามประเภทสถาบัน — เฉพาะระดับที่มีค่าใช้จ่าย
  const byLevel = LEVELS.map(lvl => {
    if (lvl.key === 'master' && !setting.includeMaster) return null
    if (excluded.includes(lvl.key)) return null
    const row: any = { key: lvl.key, label: lvl.label }
    let any = false
    EDU_CHART_TYPES.forEach(t => {
      let sum = 0
      lvl.ages.forEach(a => {
        if (a < Math.max(age, 3)) return
        const base = toNum(eduCosts?.[lvl.key]?.[t.key])
        if (base <= 0) return
        sum += base * Math.pow(1 + inf, a - age)
      })
      row[t.key] = Math.round(sum)
      if (sum > 0) any = true
    })
    return any ? row : null
  }).filter(Boolean) as { key: string; label: string; public: number; private: number; international: number }[]

  return { chartData, types: EDU_CHART_TYPES, plans, m, byLevel, hasData: plans.some(p => p.annual > 0) }
}

/* คำนวณแผนต่อบุตร (ค่าเล่าเรียนรายปีปรับเงินเฟ้อ + ยอดรวม/PV/ออม) — pure, ใช้ในตารางสรุป+ไทม์ไลน์รวม
   ใช้ fundReturn เป็นอัตราคิดลด (ตรงกับ useEducationReadiness/แดชบอร์ด) */
export function computeChildPlan(age: number, setting: ChildSetting, eduCosts: any, inflationPct: number, ratePct: number, incomeGrowthPct: number) {
  const inf = inflationPct / 100, r = ratePct / 100, gInc = incomeGrowthPct / 100
  const thisYear = new Date().getFullYear()
  const excluded = setting.excludedLevels ?? []
  const rows: { age: number; year: number; levelKey: string; level: string; inflated: number; pv: number; included: boolean }[] = []
  for (let a = Math.max(age, 3); a <= 23; a++) {
    const lvl = levelForAge(a); if (!lvl) continue
    if (lvl.key === 'master' && !setting.includeMaster) continue
    const base = toNum(eduCosts?.[lvl.key]?.[setting.type]); if (base <= 0) continue
    const yfn = a - age
    const inflated = base * Math.pow(1 + inf, yfn)
    rows.push({ age: a, year: thisYear + yfn, levelKey: lvl.key, level: lvl.label, inflated, pv: inflated / Math.pow(1 + r, yfn), included: !excluded.includes(lvl.key) })
  }
  const inc = rows.filter(x => x.included)
  const totalNominal = inc.reduce((s, x) => s + x.inflated, 0)
  const totalPV = inc.reduce((s, x) => s + x.pv, 0)
  const my = Math.max(1, setting.savingYears)
  const af = growAnnuityFactor(r, gInc, my)
  const annualSaving = af > 0 ? totalPV / af : 0   // เงินออมปีแรก
  const monthlySaving = annualSaving / 12
  // ตารางเงินออมรายปี — ออมปีแรก × (1+g)^j ตลอดช่วงออม (thisYear .. +savingYears-1)
  const savingByYear: Record<number, number> = {}
  for (let j = 0; j < my; j++) savingByYear[thisYear + j] = annualSaving * Math.pow(1 + gInc, j)
  return { rows, totalNominal, totalPV, monthlySaving, annualSaving, savingByYear }
}

function ChildCard({ name, age, setting, onChange, eduCosts, inflation, fundReturn, portfolioReturns, incomeGrowth }: {
  name: string; age: number; setting: ChildSetting; onChange: (s: ChildSetting) => void
  eduCosts: any; inflation: number; fundReturn: number; portfolioReturns: PortfolioReturn[]; incomeGrowth: number
}) {
  const [riskId, setRiskId] = useState('med')
  const selPort = portfolioReturns.find(p => p.id === riskId)
  const inf = inflation / 100
  const r = (selPort ? selPort.ret : fundReturn) / 100   // ใช้ผลตอบแทนพอร์ตที่เลือก (fallback ผลตอบแทนกองทุนจากตั้งค่า)

  const rows = useMemo(() => {
    const out: { age: number; year: number; levelKey: string; level: string; base: number; inflated: number; pv: number }[] = []
    const thisYear = new Date().getFullYear()
    for (let a = Math.max(age, 3); a <= 23; a++) {
      const lvl = levelForAge(a)
      if (!lvl) continue
      if (lvl.key === 'master' && !setting.includeMaster) continue
      const base = toNum(eduCosts?.[lvl.key]?.[setting.type])
      if (base <= 0) continue
      const yearsFromNow = a - age
      const inflated = base * Math.pow(1 + inf, yearsFromNow)
      const pv = inflated / Math.pow(1 + r, yearsFromNow)
      out.push({ age: a, year: thisYear + yearsFromNow, levelKey: lvl.key, level: lvl.label, base, inflated, pv })
    }
    return out
  }, [age, setting, eduCosts, inf, r])

  // ระดับที่เลือกนำไปวางแผนออม/ลงทุน (เก็บระดับที่ "ไม่เลือก" ไว้ — ค่าเริ่มต้น = เลือกทุกระดับ)
  const excluded = setting.excludedLevels ?? []
  const isIncluded = (lvlKey: string) => !excluded.includes(lvlKey)
  const toggleLevel = (lvlKey: string) => {
    const next = excluded.includes(lvlKey) ? excluded.filter(k => k !== lvlKey) : [...excluded, lvlKey]
    onChange({ ...setting, excludedLevels: next })
  }

  // ยอดรวม + เงินออม คิดเฉพาะระดับที่เลือก
  const totalNominal = rows.filter(x => isIncluded(x.levelKey)).reduce((s, x) => s + x.inflated, 0)
  const totalPV = rows.filter(x => isIncluded(x.levelKey)).reduce((s, x) => s + x.pv, 0)
  const m = Math.max(1, setting.savingYears)
  const gInc = incomeGrowth / 100
  // ออมเพิ่มขึ้นทุกปีตามอัตราการเพิ่มของรายได้ → growing annuity (annualSaving = เงินออมปีแรก)
  const annuityFactor = growAnnuityFactor(r, gInc, m)
  const annualSaving = annuityFactor > 0 ? totalPV / annuityFactor : 0
  const monthlySaving = annualSaving / 12

  const set = <K extends keyof ChildSetting>(k: K, v: ChildSetting[K]) => onChange({ ...setting, [k]: v })

  return (
    <>
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={17} color="#06b6d4" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{name || 'บุตร'}</p>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>อายุปัจจุบัน {age} ปี</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* type selector */}
          <div style={{ display: 'flex', gap: 3, background: 'var(--navy-950)', padding: 3, borderRadius: 8, border: '1px solid var(--card-border)' }}>
            {TYPES.map(t => (
              <button key={t.key} onClick={() => set('type', t.key)}
                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: setting.type === t.key ? 'var(--cyan-dim)' : 'transparent', color: setting.type === t.key ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: setting.type === t.key ? 600 : 400 }}>{t.label}</button>
            ))}
          </div>
          {/* portfolio (risk) selector — กำหนดอัตราผลตอบแทนที่ใช้คำนวณเงินออม */}
          {portfolioReturns.length > 0 && (
            <div style={{ display: 'flex', gap: 3, background: 'var(--navy-950)', padding: 3, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              {portfolioReturns.map(p => (
                <button key={p.id} onClick={() => setRiskId(p.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: riskId === p.id ? `${p.color}22` : 'transparent', color: riskId === p.id ? p.color : 'var(--text-muted)', fontWeight: riskId === p.id ? 600 : 400 }}>
                  {p.label} <span style={{ fontSize: 10 }}>{p.ret.toFixed(1)}%</span>
                </button>
              ))}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={setting.includeMaster} onChange={e => set('includeMaster', e.target.checked)} /> รวมปริญญาโท
          </label>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>ออม
            <input type="number" value={setting.savingYears} onChange={e => set('savingYears', Number(e.target.value))}
              style={{ width: 56, margin: '0 6px', padding: '4px 6px', textAlign: 'center', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)', fontSize: 12 }} />ปี</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {/* ตาราง (ฝั่งซ้าย) */}
      <div style={{ flex: 1, minWidth: 0 }}>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
          ยังไม่มีค่าเล่าเรียนของระดับ "{TYPES.find(t => t.key === setting.type)?.label}" — กรอกที่ ตั้งค่า → ค่าใช้จ่ายด้านการศึกษา
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <TableExcelButton filename="ค่าเล่าเรียนรายระดับ" title="ค่าเล่าเรียน" />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ ...th, textAlign: 'center', width: '10%' }}>อายุ</th>
                <th style={{ ...th, textAlign: 'center', width: '12%' }}>ปี พ.ศ.</th>
                <th style={{ ...th, textAlign: 'center', width: '20%' }}>ระดับ</th>
                <th style={{ ...th, width: '25%' }}>ค่าเล่าเรียน (ปัจจุบัน)</th>
                <th style={{ ...th, width: '23%' }}>ปรับเงินเฟ้อ</th>
                <th style={{ ...th, textAlign: 'center', width: '10%' }}>วางแผน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x, ri) => {
                const inc = isIncluded(x.levelKey)
                return (
                <tr key={x.age} style={{ background: ri % 2 ? 'var(--hover)' : 'transparent', opacity: inc ? 1 : 0.4 }}>
                  <td style={{ ...td, textAlign: 'center' }}>{x.age}</td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>{x.year + 543}</td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--text-secondary)' }}>{x.level}</td>
                  <td style={tdNum}>{fmt(x.base)}</td>
                  <td style={{ ...tdNum, color: '#f59e0b' }}>{fmt(x.inflated)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input type="checkbox" checked={inc} onChange={() => toggleLevel(x.levelKey)}
                      title="เลือกระดับนี้ไปวางแผนออม/ลงทุน" style={{ cursor: 'pointer' }} />
                  </td>
                </tr>
              )})}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)' }}>
                <td colSpan={4} style={{ ...tdNum, fontWeight: 700, color: 'var(--text-primary)' }}>รวม (เฉพาะที่เลือก)</td>
                <td style={{ ...tdNum, fontWeight: 800, color: '#f59e0b' }}>{fmt(totalNominal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      </div>{/* end left table */}

      {/* การ์ดสรุป — sidebar ด้านขวา */}
      <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'ค่าเล่าเรียนรวม (อนาคต)', value: totalNominal, color: 'var(--text-primary)' },
          { label: 'เงินก้อนที่ต้องเตรียมวันนี้', value: totalPV, color: '#f59e0b' },
          { label: `ออมปีแรก/ปี (+${incomeGrowth}%/ปี)`, value: annualSaving, color: '#4ade80' },
          { label: 'ออมปีแรก/เดือน', value: monthlySaving, color: '#4ade80' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--navy-900)', borderRadius: 10, padding: '10px 14px' }}>
            <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{c.label}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: 'monospace', marginTop: 3 }}>{fmt(c.value)} <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 400 }}>บาท</span></p>
          </div>
        ))}
      </div>
      </div>{/* end flex */}
    </div>

    <EduSavingsChart name={name} age={age} setting={setting} eduCosts={eduCosts}
      inflation={inflation} fundReturn={fundReturn} portfolioReturns={portfolioReturns}
      riskId={riskId} onRiskChange={setRiskId} incomeGrowth={incomeGrowth} />
    </>
  )
}

/* ── การ์ดกราฟ year-to-year เงินออมเพื่อทุนการศึกษา ── */
function EduSavingsChart({ name, age, setting, eduCosts, inflation, fundReturn, portfolioReturns, riskId, onRiskChange, incomeGrowth }: {
  name: string; age: number; setting: ChildSetting
  eduCosts: any; inflation: number; fundReturn: number; portfolioReturns: PortfolioReturn[]
  riskId: string; onRiskChange: (id: string) => void; incomeGrowth: number
}) {
  const m = Math.max(1, setting.savingYears)
  const selPort = portfolioReturns.find(p => p.id === riskId)
  const ratePct = selPort ? selPort.ret : fundReturn   // ผลตอบแทนพอร์ตที่เลือก (fallback ผลตอบแทนกองทุน)

  // reuse ตรรกะกราฟ(pure) — ใช้ร่วมกับสไลด์รายงาน
  const { chartData, plans, hasData } = useMemo(
    () => buildEduChart({ age, setting, eduCosts, inflationPct: inflation, ratePct, incomeGrowthPct: incomeGrowth }),
    [age, setting, eduCosts, inflation, ratePct, incomeGrowth]
  )
  const fmtM = (v: number) => `${(v / 1e6).toFixed(1)}M`

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LineChartIcon size={16} color="#06b6d4" />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            เงินออมสะสมเพื่อทุนการศึกษา — {name || 'บุตร'} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(ออม {m} ปี)</span>
          </p>
        </div>
        {/* portfolio selector — ใช้ร่วมกับตารางเงินออมด้านบน */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--navy-950)', padding: 3, borderRadius: 8, border: '1px solid var(--card-border)' }}>
          {portfolioReturns.map(p => (
            <button key={p.id} onClick={() => onRiskChange(p.id)}
              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: riskId === p.id ? `${p.color}22` : 'transparent', color: riskId === p.id ? p.color : 'var(--text-muted)', fontWeight: riskId === p.id ? 600 : 400 }}>
              {p.label} <span style={{ fontSize: 10 }}>{p.ret.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          เลือกระดับการศึกษาที่ต้องการวางแผน และกรอกค่าเล่าเรียนที่ ตั้งค่า → ค่าใช้จ่ายด้านการศึกษา
        </p>
      ) : (
        <>
          {/* เงินออม/ปี แยกตามประเภทสถาบัน */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 10, marginBottom: 14 }}>
            {plans.map(p => (
              <div key={p.key} style={{ background: 'var(--navy-900)', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${p.color}` }}>
                <p style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>สถาบัน{p.label} · ออมปีแรก</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: p.color, fontFamily: 'monospace', marginTop: 3 }}>{fmt(p.annual)}</p>
                <p style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>บาท/ปี (+{incomeGrowth}%/ปี) · {fmt(p.annual / 12)}/เดือน</p>
              </div>
            ))}
          </div>

          <ChartFrame title="มูลค่ากองทุนการศึกษา" filename="education-fund" height={280}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--card-border)' }} tickLine={false}
                  label={{ value: 'ปี พ.ศ.', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={46} axisLine={false} tickLine={false}
                  label={{ value: 'มูลค่ากองทุน (บาท)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--text-muted)' }} />
                <Tooltip formatter={(v: any) => `${fmt(Number(v))} บาท`}
                  contentStyle={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} cursor={{ stroke: 'var(--card-border)', strokeWidth: 1 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={9} />
                {plans.map(p => (
                  <Line key={p.key} type="monotone" dataKey={p.key} name={`สถาบัน${p.label}`} stroke={p.color} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8 }}>
            * ผลตอบแทน {selPort?.label ?? 'กองทุน'} {ratePct.toFixed(1)}%/ปี (จากหน้าสมมติฐานการลงทุน) · ออมเพิ่มขึ้นปีละ {incomeGrowth}% ตามอัตราการเพิ่มของรายได้ · เฉพาะระดับที่เลือกในตารางด้านบน
          </p>

          {/* ตารางค่าของกราฟแต่ละเส้น */}
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <TableExcelButton filename="มูลค่ากองทุนการศึกษารายปี" title="กองทุนการศึกษา" />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th rowSpan={2} style={{ ...th, textAlign: 'center', verticalAlign: 'bottom' }}>ปี พ.ศ.</th>
                  {plans.map(p => (
                    <th key={p.key} colSpan={2} style={{ ...th, textAlign: 'center', color: p.color, borderLeft: '1px solid var(--divider)' }}>สถาบัน{p.label}</th>
                  ))}
                </tr>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {plans.map(p => (
                    <Fragment key={p.key}>
                      <th style={{ ...th, fontSize: 10, borderLeft: '1px solid var(--divider)' }}>ค่าเทอม (เงินเฟ้อ)</th>
                      <th style={{ ...th, fontSize: 10 }}>มูลค่ากองทุน</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map(row => (
                  <tr key={row.year} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>{row.year}</td>
                    {plans.map(p => (
                      <Fragment key={p.key}>
                        <td style={{ ...tdNum, fontSize: 11, color: row[`${p.key}_fee`] == null ? 'var(--text-muted)' : '#f59e0b', borderLeft: '1px solid var(--divider)' }}>
                          {row[`${p.key}_fee`] == null ? '—' : fmt(row[`${p.key}_fee`])}
                        </td>
                        <td style={{ ...tdNum, fontSize: 11, color: row[p.key] == null ? 'var(--text-muted)' : p.color }}>
                          {row[p.key] == null ? '—' : fmt(row[p.key])}
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'right', color: 'var(--text-primary)' }
const tdNum: React.CSSProperties = { padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }

/* ── มุมมองครอบครัว (บุตร > 1 คน): ตารางสรุป + ไทม์ไลน์ค่าเล่าเรียนรวมรายปี ── */
type ChildPlan = ReturnType<typeof computeChildPlan>
function FamilyEduView({ children, plans, getSetting, setChild }: {
  children: any[]; plans: ChildPlan[]; getSetting: (i: number) => ChildSetting; setChild: (i: number, s: ChildSetting) => void
}) {
  const sumNominal = plans.reduce((s, p) => s + p.totalNominal, 0)
  const sumPV = plans.reduce((s, p) => s + p.totalPV, 0)
  const sumMonthly = plans.reduce((s, p) => s + p.monthlySaving, 0)

  // ไทม์ไลน์รวม: ปี (union ของปีจ่ายค่าเล่าเรียน + ปีที่ออม) × ค่าเล่าเรียนบุตรแต่ละคน + รวม + เงินออมรวมต่อปี
  const allYears = [...new Set(plans.flatMap(p => [...p.rows.filter(x => x.included).map(x => x.year), ...Object.keys(p.savingByYear).map(Number)]))].sort((a, b) => a - b)
  const timeline = allYears.map(year => {
    const perChild = plans.map(p => { const rw = p.rows.find(x => x.year === year && x.included); return rw ? rw.inflated : 0 })
    const saving = plans.reduce((s, p) => s + (p.savingByYear[year] ?? 0), 0)
    return { year, perChild, total: perChild.reduce((s, v) => s + v, 0), saving }
  })
  const maxTotal = Math.max(0, ...timeline.map(t => t.total))
  const totalSaving = timeline.reduce((s, t) => s + t.saving, 0)
  const childName = (c: any, i: number) => c.name || `บุตร ${i + 1}`

  return (
    <>
      {/* สรุปต่อคน */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)' }}>สรุปทุนการศึกษาบุตร <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12.5 }}>({children.length} คน · หน่วย: บาท)</span></p>
          <TableExcelButton filename="สรุปทุนการศึกษาบุตร" title="สรุปทุนการศึกษา" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>บุตร</th>
                <th style={{ ...th, textAlign: 'center' }}>อายุ</th>
                <th style={{ ...th, textAlign: 'left' }}>ประเภทสถาบัน</th>
                <th style={th}>ค่าเล่าเรียนรวม</th>
                <th style={th}>เงินก้อนวันนี้</th>
                <th style={th}>ต้องออม/เดือน</th>
              </tr>
            </thead>
            <tbody>
              {children.map((c, i) => {
                const st = getSetting(i)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)' }}>{childName(c, i)}</td>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>{toNum(c.age)}</td>
                    <td style={{ ...td, textAlign: 'left' }}>
                      <div style={{ display: 'inline-flex', gap: 2, background: 'var(--navy-950)', padding: 2, borderRadius: 7, border: '1px solid var(--card-border)' }}>
                        {TYPES.map(t => (
                          <button key={t.key} onClick={() => setChild(i, { ...st, type: t.key })}
                            style={{ padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, background: st.type === t.key ? 'var(--cyan-dim)' : 'transparent', color: st.type === t.key ? 'var(--cyan)' : 'var(--text-muted)', fontWeight: st.type === t.key ? 600 : 400 }}>{t.label}</button>
                        ))}
                      </div>
                    </td>
                    <td style={tdNum}>{fmt(plans[i].totalNominal)}</td>
                    <td style={{ ...tdNum, color: '#f59e0b' }}>{fmt(plans[i].totalPV)}</td>
                    <td style={{ ...tdNum, fontWeight: 700, color: 'var(--cyan)' }}>{fmt(plans[i].monthlySaving)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)' }}>
                <td colSpan={3} style={{ ...tdNum, textAlign: 'left', fontWeight: 800, color: 'var(--text-primary)' }}>รวมทุกคน</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(sumNominal)}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: '#f59e0b' }}>{fmt(sumPV)}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--cyan)' }}>{fmt(sumMonthly)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ไทม์ไลน์รวมรายปี */}
      <div style={card}>
        <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>ไทม์ไลน์ค่าเล่าเรียนรวมรายปี</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>ปรับเงินเฟ้อแล้ว · ปีที่จ่ายหนักสุด (พีค) ไฮไลต์ไว้ · หน่วย: บาท</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <TableExcelButton filename="ไทม์ไลน์ค่าเล่าเรียนรวมรายปี" title="ไทม์ไลน์การศึกษา" />
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ ...th, textAlign: 'center' }}>ปี พ.ศ.</th>
                {children.map((c, i) => <th key={i} style={th}>{childName(c, i)}</th>)}
                <th style={{ ...th, color: 'var(--text-secondary)' }}>รวมต่อปี</th>
                <th style={{ ...th, color: 'var(--cyan)' }}>เงินที่ออมต่อปี</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t, idx) => {
                const peak = t.total > 0 && t.total === maxTotal
                return (
                  <tr key={t.year} style={{ background: peak ? 'rgba(245,158,11,0.13)' : (idx % 2 ? 'var(--hover)' : 'transparent') }}>
                    <td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>{t.year + 543}</td>
                    {t.perChild.map((v, i) => <td key={i} style={tdNum}>{v > 0 ? fmt(v) : '—'}</td>)}
                    <td style={{ ...tdNum, fontWeight: 700, color: peak ? '#f59e0b' : 'var(--text-primary)' }}>{t.total > 0 ? fmt(t.total) : '—'}</td>
                    <td style={{ ...tdNum, color: t.saving > 0 ? 'var(--cyan)' : 'var(--text-muted)' }}>{t.saving > 0 ? fmt(t.saving) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)' }}>
                <td style={{ ...tdNum, textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)' }}>รวม</td>
                {plans.map((p, i) => <td key={i} style={{ ...tdNum, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(p.totalNominal)}</td>)}
                <td style={{ ...tdNum, fontWeight: 800, color: '#f59e0b' }}>{fmt(sumNominal)}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: 'var(--cyan)' }}>{fmt(totalSaving)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  )
}

export default function EducationPlanPage() {
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: saved, isFetched } = useQuery({ queryKey: ['education-plan'], queryFn: () => api.get('/education-plan').then(r => r.data), retry: false })

  const children: any[] = clientProfile?.children ?? []
  const [settings, setSettings] = useState<Record<number, ChildSetting>>({})
  const loadedRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved && typeof saved === 'object') setSettings(saved)
    loadedRef.current = true
  }, [isFetched, saved])

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = useMutation({
    mutationFn: (payload: any) => api.put('/education-plan', payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate(settings), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [settings])

  const eduCosts = profile?.educationCosts ?? {}
  const inflation = profile?.educationInflation ?? 5
  const fundReturn = profile?.educationFundReturn ?? 4
  const portfolioReturns = usePortfolioReturns()
  // อัตราการเพิ่มของรายได้ (เงินเดือนเพิ่มปีละ %) — ใช้เป็นอัตราเพิ่มของเงินออม
  const incomeGrowth = toNum(clientProfile?.salaryIncreaseRate)

  const getSetting = (i: number) => settings[i] ?? defaultSetting()
  const setChild = (i: number, s: ChildSetting) => setSettings(prev => ({ ...prev, [i]: s }))

  // แผนต่อบุตร (คำนวณด้วย fundReturn — ตรงกับแดชบอร์ด) ใช้ในสรุป/ไทม์ไลน์/หัวข้อพับ
  const plans = useMemo(
    () => children.map((c, i) => computeChildPlan(toNum(c.age), getSetting(i), eduCosts, inflation, fundReturn, incomeGrowth)),
    [children, settings, eduCosts, inflation, fundReturn, incomeGrowth]
  )
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const toggle = (i: number) => setExpanded(e => ({ ...e, [i]: !e[i] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg) } } .edu-spin { animation: edu-spin 0.9s linear infinite }`}</style>

      {/* คำบรรยาย + สถานะบันทึก (หัวข้อหลักแสดงโดย PageHeader ของหน้าวางแผนการเงิน) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: -8 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: 200 }}>
          เงินเฟ้อการศึกษา {inflation}% · ผลตอบแทนกองทุน {fundReturn}% (แก้ที่ ตั้งค่า)
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          {status === 'saving' && <><Loader2 size={14} className="edu-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
          {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
        </div>
      </div>

      {children.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>ยังไม่มีข้อมูลบุตร — เพิ่มที่ "ข้อมูลลูกค้า → ครอบครัว"</p>
        </div>
      ) : children.length === 1 ? (
        <ChildCard name={children[0].name} age={toNum(children[0].age)} setting={getSetting(0)} onChange={s => setChild(0, s)}
          eduCosts={eduCosts} inflation={inflation} fundReturn={fundReturn} portfolioReturns={portfolioReturns} incomeGrowth={incomeGrowth} />
      ) : (
        <>
          <FamilyEduView children={children} plans={plans} getSetting={getSetting} setChild={setChild} />

          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4, marginBottom: -8 }}>รายละเอียดรายบุตร</p>
          {children.map((c, i) => (
            <div key={i}>
              <button onClick={() => toggle(i)}
                style={{ ...card, width: '100%', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', padding: '13px 18px' }}>
                <ChevronDown size={17} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: expanded[i] ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.name || `บุตร ${i + 1}`}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>อายุ {toNum(c.age)} · ค่าเล่าเรียนรวม {fmt(plans[i].totalNominal)} · ออม {fmt(plans[i].monthlySaving)}/เดือน</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--cyan)' }}>{expanded[i] ? 'ซ่อน' : 'ดูรายละเอียด'}</span>
              </button>
              {expanded[i] && (
                <div style={{ marginTop: 10 }}>
                  <ChildCard name={c.name} age={toNum(c.age)} setting={getSetting(i)} onChange={s => setChild(i, s)}
                    eduCosts={eduCosts} inflation={inflation} fundReturn={fundReturn} portfolioReturns={portfolioReturns} incomeGrowth={incomeGrowth} />
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
