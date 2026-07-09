import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { card, inp } from '../styles/dark'
import { Droplets, CreditCard, PiggyBank, AlertTriangle, CheckCircle2, XCircle, Info, Pencil, Check, X, TrendingUp } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type RatioEntry = { key: string; value: number | null; state: string }
type RatioResult = {
  ratios: RatioEntry[]
  advice: Record<string, string | null>
  healthScore: number | null
  healthLabel: string
  categoryScores?: {
    liquidity: { score: number | null; label: string }
    debt: { score: number | null; label: string }
    savings: { score: number | null; label: string }
  }
  summary: {
    liquidAssets: number; investAssets: number; totalAssets: number
    shortDebtBalance: number; totalDebtBalance: number; netWorth: number
    totalAnnualIncome: number; monthlyIncome: number; annualSavings: number; netAnnualCashFlow: number
    totalMonthlyExp: number; totalMonthlyPayment: number; nonMortgageMonthlyPay: number
  }
}

type Summary = RatioResult['summary']

// คำแนะนำเชิงปฏิบัติ: ควรเพิ่ม/ลดเท่าไหร่ ด้วยวิธีไหน เพื่อให้ถึงเกณฑ์ (คืน null ถ้าผ่านเกณฑ์อยู่แล้ว)
function actionPlan(key: string, value: number | null, sm: Summary): string | null {
  if (value === null) return null
  const baht = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)))
  const perMonth = (yearlyGap: number) => baht(yearlyGap / 12)
  switch (key) {
    case 'ratio1': {
      const gap = sm.shortDebtBalance - sm.liquidAssets
      return gap > 0 ? `เพิ่มสินทรัพย์สภาพคล่องอีก ~${baht(gap)} บาท หรือลดหนี้ระยะสั้นลง เพื่อให้สภาพคล่องครอบคลุมหนี้ระยะสั้น (≥ 1 เท่า)` : null
    }
    case 'ratio2': {
      const target = sm.totalMonthlyExp * 3
      const gap = target - sm.liquidAssets
      return gap > 0 ? `สะสมเงินสำรองฉุกเฉินเพิ่มอีก ~${baht(gap)} บาท (ออม ~${perMonth(gap)} บาท/เดือน เป็นเวลา 12 เดือน) ให้ครบ 3 เดือนของรายจ่าย — เป้าที่ดี 6 เดือน = ${baht(sm.totalMonthlyExp * 6)} บาท` : null
    }
    case 'ratio3': {
      const gap = sm.netWorth * 0.15 - sm.liquidAssets
      return gap > 0 ? `โยกสินทรัพย์มาเป็นเงินสด/สภาพคล่องเพิ่มอีก ~${baht(gap)} บาท ให้ถึง 15% ของความมั่งคั่งสุทธิ` : null
    }
    case 'ratio4': {
      const reduce = sm.totalDebtBalance - sm.totalAssets * 0.5
      return reduce > 0 ? `ทยอยลดยอดหนี้ลงอีก ~${baht(reduce)} บาท (โปะเงินต้น/เลี่ยงก่อหนี้ใหม่) ให้หนี้ไม่เกิน 50% ของสินทรัพย์` : null
    }
    case 'ratio5': {
      const reduce = sm.totalMonthlyPayment - sm.monthlyIncome * 0.35
      return reduce > 0 ? `ลดภาระผ่อนหนี้รวมลง ~${baht(reduce)} บาท/เดือน (รีไฟแนนซ์ ยืดงวด หรือโปะหนี้ดอกสูง) ให้ไม่เกิน 35% ของรายได้` : null
    }
    case 'ratio6': {
      const reduce = sm.nonMortgageMonthlyPay - sm.monthlyIncome * 0.15
      return reduce > 0 ? `ลดภาระหนี้ที่ไม่ใช่บ้านลง ~${baht(reduce)} บาท/เดือน (เร่งปิดบัตรเครดิต/สินเชื่อดอกเบี้ยสูงก่อน) ให้ไม่เกิน 15% ของรายได้` : null
    }
    case 'ratio7': {
      const gapYear = (0.10 - value / 100) * sm.totalAnnualIncome
      return gapYear > 0 ? `ออม/ลงทุนเพิ่มอีก ~${perMonth(gapYear)} บาท/เดือน (~${baht(gapYear)} บาท/ปี) โดยตั้งหักออมอัตโนมัติ ให้อัตราการออมถึง 10% ของรายได้` : null
    }
    case 'ratio8': {
      const gap = sm.netWorth * 0.5 - sm.investAssets
      return gap > 0 ? `จัดสรรเงินไปลงทุนเพิ่มอีก ~${baht(gap)} บาท (กองทุนรวม/หุ้น/ตราสารหนี้ ตามระดับความเสี่ยง) ให้สินทรัพย์ลงทุนถึง 50% ของความมั่งคั่ง` : null
    }
    default: return null
  }
}

// คำแนะนำสำรองตามหลัก CFP (ใช้เมื่อฐานข้อมูลไม่มี rule) — ให้แสดงคำแนะนำเสมอ
const FALLBACK_ADVICE: Record<string, Record<string, string>> = {
  ratio1: { good: 'สินทรัพย์สภาพคล่องครอบคลุมหนี้ระยะสั้นได้ดี', warning: 'สภาพคล่องพอปานกลาง ควรสำรองเงินสดเพิ่มเพื่อรองรับหนี้ระยะสั้น', danger: 'สินทรัพย์สภาพคล่องต่ำกว่าหนี้ระยะสั้น เสี่ยงขาดสภาพคล่อง ควรเพิ่มเงินสำรองหรือลดหนี้ระยะสั้น' },
  ratio2: { good: 'มีเงินสำรองฉุกเฉิน 3–6 เดือนตามเกณฑ์ CFP', warning: 'เงินสำรองฉุกเฉินยังน้อยกว่า 3 เดือน ควรทยอยสะสมให้ถึง 3–6 เท่าของรายจ่าย', danger: 'เงินสำรองฉุกเฉินไม่เพียงพอ ควรเร่งสะสมเงินสดให้ได้อย่างน้อย 3 เดือนของรายจ่าย' },
  ratio3: { good: 'สัดส่วนสินทรัพย์สภาพคล่องต่อความมั่งคั่งเหมาะสม', warning: 'สภาพคล่องต่อความมั่งคั่งค่อนข้างต่ำ พิจารณาปรับพอร์ตให้มีสภาพคล่องมากขึ้น', danger: 'สินทรัพย์ส่วนใหญ่ถูกล็อกในสินทรัพย์ไม่คล่องตัว ควรเพิ่มสัดส่วนสินทรัพย์สภาพคล่อง' },
  ratio4: { good: 'ภาระหนี้ต่อสินทรัพย์อยู่ในระดับปลอดภัย', warning: 'หนี้สินต่อสินทรัพย์เริ่มสูง ควรควบคุมการก่อหนี้ใหม่และเร่งชำระหนี้', danger: 'หนี้สินต่อสินทรัพย์สูงเกินไป เสี่ยงต่อความมั่นคง ควรวางแผนลดหนี้อย่างเร่งด่วน' },
  ratio5: { good: 'ภาระผ่อนหนี้รวมต่อรายได้อยู่ในเกณฑ์ (< 35–45%)', warning: 'ภาระผ่อนหนี้รวมเริ่มสูง ควรระวังการก่อหนี้เพิ่ม', danger: 'ภาระผ่อนหนี้รวมเกิน 45% ของรายได้ ควรปรับโครงสร้างหนี้/รีไฟแนนซ์' },
  ratio6: { good: 'ภาระหนี้ที่ไม่ใช่จำนองต่ำ (< 15–20%)', warning: 'หนี้เพื่อการบริโภคเริ่มสูง ควรลดการใช้บัตรเครดิต/สินเชื่อ', danger: 'หนี้ที่ไม่ใช่จำนองสูงเกินไป ควรเร่งปิดหนี้ดอกเบี้ยสูงก่อน' },
  ratio7: { good: 'อัตราการออมถึงเกณฑ์ CFP (≥ 10% ของรายได้)', warning: 'อัตราการออมยังต่ำกว่า 10% ควรตั้งเป้าออมอัตโนมัติเพิ่มขึ้น', danger: 'อัตราการออมต่ำมาก ควรทบทวนรายจ่ายและเริ่มออมอย่างมีวินัย' },
  ratio8: { good: 'สัดส่วนสินทรัพย์ลงทุนต่อความมั่งคั่งดี สร้างการเติบโตระยะยาว', warning: 'สินทรัพย์ลงทุนยังน้อย ควรทยอยจัดสรรเงินไปลงทุนเพื่อการเติบโต', danger: 'สินทรัพย์ลงทุนน้อยมาก เงินส่วนใหญ่ไม่ได้สร้างผลตอบแทน ควรเริ่มวางแผนลงทุน' },
}

// ─── Ratio Metadata ──────────────────────────────────────────────────────────

const RATIO_META: Record<string, {
  name: string; formula: string; standard: string; unit: 'times' | 'months' | 'pct'
}> = {
  ratio1: { name: 'สภาพคล่อง',                              formula: 'สินทรัพย์สภาพคล่อง / หนี้สินระยะสั้น',                       standard: '> 1 เท่า',    unit: 'times' },
  ratio2: { name: 'สภาพคล่องพื้นฐาน',                      formula: 'สินทรัพย์สภาพคล่อง / รายจ่ายรวมต่อเดือน',                 standard: '3–6 เดือน',  unit: 'months' },
  ratio3: { name: 'สินทรัพย์สภาพคล่องต่อความมั่งคั่งสุทธิ', formula: 'สินทรัพย์สภาพคล่อง / ความมั่งคั่งสุทธิ',                  standard: '> 15%',       unit: 'pct' },
  ratio4: { name: 'หนี้สินต่อสินทรัพย์',                   formula: 'หนี้สินรวม / สินทรัพย์รวม',                                  standard: '< 50%',       unit: 'pct' },
  ratio5: { name: 'การชำระคืนหนี้สินจากรายได้',            formula: '(ผ่อนบ้าน/คอนโด + ผ่อนรถ + บัตร/สินเชื่อ + หนี้การศึกษา) / รายรับต่อเดือน', standard: '< 35–45%',   unit: 'pct' },
  ratio6: { name: 'การชำระคืนหนี้ที่ไม่จดจำนอง',           formula: '(ผ่อนรถ + บัตร/สินเชื่อ + หนี้การศึกษา) / รายรับต่อเดือน',   standard: '< 15–20%',   unit: 'pct' },
  ratio7: { name: 'การออม',                                 formula: '(รายจ่ายเพื่อการออม/ลงทุนรวม + กระแสเงินสดสุทธิ) / รายรับรวม', standard: '≥ 10%',    unit: 'pct' },
  ratio8: { name: 'การลงทุน',                               formula: 'สินทรัพย์ลงทุน / ความมั่งคั่งสุทธิ',                       standard: '≥ 50%',       unit: 'pct' },
}

const STATE_STYLE: Record<string, { color: string; bg: string; border: string; icon: React.FC<any> }> = {
  good:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)', icon: CheckCircle2 },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)', icon: AlertTriangle },
  danger:  { color: '#f43f5e', bg: 'rgba(244,63,94,0.08)',   border: 'rgba(244,63,94,0.25)',  icon: XCircle },
  nodata:  { color: 'var(--text-muted)', bg: 'var(--divider)', border: 'var(--card-border)', icon: Info },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtValue(value: number | null, unit: 'times' | 'months' | 'pct'): string {
  if (value === null) return '—'
  if (unit === 'times')  return value.toFixed(2) + ' เท่า'
  if (unit === 'months') return value.toFixed(2) + ' เดือน'
  return value.toFixed(2) + '%'
}

// ─── Gauge Bar ────────────────────────────────────────────────────────────────

function GaugeBar({ state, value, unit }: { state: string; value: number | null; unit: 'times' | 'months' | 'pct' }) {
  const s = STATE_STYLE[state] ?? STATE_STYLE.nodata
  const fill = value === null ? 0 : Math.min(Math.max(
    unit === 'times'  ? (value / 2) * 100 :
    unit === 'months' ? (value / 9) * 100 :
    unit === 'pct'    ? value : 0
  , 0), 100)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 6, background: 'var(--grid)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fill}%`, background: s.color,
          borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ─── Ratio Card ───────────────────────────────────────────────────────────────

function RatioCard({ entry, advice }: { entry: RatioEntry; advice: string | null }) {
  const meta = RATIO_META[entry.key]
  const s = STATE_STYLE[entry.state] ?? STATE_STYLE.nodata
  const Icon = s.icon
  const adviceText = advice ?? (entry.state !== 'nodata' ? FALLBACK_ADVICE[entry.key]?.[entry.state] ?? null : null)

  return (
    <div style={{ ...card, padding: '16px 20px', border: `1px solid ${s.border}`, background: s.bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {meta.name}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.formula}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>
            {fmtValue(entry.value, meta.unit)}
          </p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>เกณฑ์ {meta.standard}</p>
        </div>
      </div>
      <GaugeBar state={entry.state} value={entry.value} unit={meta.unit} />
      {adviceText && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '10px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 8,
          border: `1px solid ${s.border}` }}>
          <Icon size={14} color={s.color} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{adviceText}</p>
        </div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, color, keys, ratios, advice }: {
  title: string; icon: React.FC<any>; color: string
  keys: string[]
  ratios: RatioEntry[]
  advice: Record<string, string | null>
}) {
  const entries = keys.map(k => ratios.find(r => r.key === k)!).filter(Boolean)
  const stateCounts = { good: 0, warning: 0, danger: 0, nodata: 0 }
  entries.forEach(e => { stateCounts[e.state as keyof typeof stateCounts]++ })

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: `linear-gradient(90deg, ${color}15, transparent)` }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {stateCounts.good > 0    && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>ดี {stateCounts.good}</span>}
          {stateCounts.warning > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>ระวัง {stateCounts.warning}</span>}
          {stateCounts.danger > 0  && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(244,63,94,0.15)',  color: '#f43f5e' }}>เร่งด่วน {stateCounts.danger}</span>}
        </div>
      </div>
      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(e => <RatioCard key={e.key} entry={e} advice={advice[e.key]} />)}
      </div>
    </div>
  )
}

// ─── Health Score Hero ────────────────────────────────────────────────────────

const scoreColor = (sc: number | null) =>
  sc == null ? 'var(--text-muted)' : sc >= 80 ? '#10b981' : sc >= 60 ? '#22d3ee' : sc >= 40 ? '#f59e0b' : '#f43f5e'

function ScoreRing({ score, size, stroke, fontSize }: { score: number | null; size: number; stroke: number; fontSize: number }) {
  const col = scoreColor(score)
  const R = (size - stroke) / 2, C = 2 * Math.PI * R
  const dash = ((score ?? 0) / 100) * C
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize, fontWeight: 800, color: col, lineHeight: 1 }}>{score ?? '—'}</span>
      </div>
    </div>
  )
}

function HealthScoreHero({ score, label, cats }: {
  score: number; label: string
  cats?: RatioResult['categoryScores']
}) {
  const col = scoreColor(score)
  const parts: { key: string; label: string; icon: React.FC<any>; c: string; data?: { score: number | null; label: string } }[] = [
    { key: 'liquidity', label: 'สภาพคล่อง', icon: Droplets,   c: '#22d3ee', data: cats?.liquidity },
    { key: 'debt',      label: 'หนี้สิน',    icon: CreditCard, c: '#f43f5e', data: cats?.debt },
    { key: 'savings',   label: 'การออม',    icon: PiggyBank,  c: '#a78bfa', data: cats?.savings },
  ]
  return (
    <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
      background: `linear-gradient(120deg, ${col}14, transparent 60%)`, border: `1px solid ${col}33` }}>
      {/* Overall gauge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <ScoreRing score={score} size={128} stroke={11} fontSize={34} />
          <span style={{ position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>/ 100</span>
        </div>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>คะแนนสุขภาพการเงินรวม</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: col, margin: '2px 0' }}>{label}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Financial Health Score</p>
        </div>
      </div>

      {/* 3 category breakdown */}
      <div style={{ flex: 1, minWidth: 300, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
        {parts.map(p => {
          const sc = p.data?.score ?? null
          const c = scoreColor(sc)
          const Icon = p.icon
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: `${p.c}0d`, border: `1px solid ${p.c}26`, borderRadius: 12 }}>
              <ScoreRing score={sc} size={72} stroke={8} fontSize={22} />
              <div style={{ minWidth: 0 }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Icon size={13} color={p.c} />{p.label}
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: c, marginTop: 2 }}>{p.data?.label ?? '—'}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Summary Banner ───────────────────────────────────────────────────────────

function SummaryBanner({ summary }: { summary: RatioResult['summary'] }) {
  const items = [
    { label: 'สินทรัพย์รวม',    value: summary.totalAssets,        color: '#22d3ee' },
    { label: 'หนี้สินรวม',       value: summary.totalDebtBalance,   color: '#f43f5e' },
    { label: 'ความมั่งคั่งสุทธิ', value: summary.netWorth,           color: summary.netWorth >= 0 ? '#10b981' : '#f43f5e' },
    { label: 'รายรับรวม/ปี',     value: summary.totalAnnualIncome,  color: '#3b82f6' },
    { label: 'เงินออม/ปี',       value: summary.annualSavings,      color: '#a78bfa' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
      {items.map(it => (
        <div key={it.label} style={{ ...card, padding: '14px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{it.label}</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: it.color }}>
            {it.value >= 0 ? '' : '-'}{fmt(Math.abs(it.value))} ฿
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const NOTES_KEY = 'finplan_advisor_notes'

export default function FinancialRatioTab({ person = 'client' }: { person?: 'client' | 'spouse' }) {
  const { data, isLoading, error } = useQuery<RatioResult>({
    queryKey: ['financial-ratios', person],
    queryFn: () => api.get('/financial-ratios', { params: { person } }).then(r => r.data),
  })

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  }, [notes])

  const startEdit = (cat: string) => { setDraft(notes[cat] ?? ''); setEditing(cat) }
  const saveEdit  = (cat: string) => { setNotes(n => ({ ...n, [cat]: draft })); setEditing(null) }
  const cancelEdit = () => setEditing(null)

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '80px 0', color: 'var(--text-muted)', fontSize: 14 }}>
      กำลังคำนวณอัตราส่วนทางการเงิน...
    </div>
  )

  if (error || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '80px 0', color: '#f43f5e', fontSize: 14 }}>
      เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
    </div>
  )

  const hasData = data.ratios.some(r => r.state !== 'nodata')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Data source banner */}
      <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10,
        fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <Info size={13} color="#3b82f6" />
        ข้อมูลคำนวณจากงบดุลส่วนบุคคลและงบกระแสเงินสดแบบเรียลไทม์ · มาตรฐาน CFP (Certified Financial Planner)
      </div>

      {!hasData && (
        <div style={{ ...card, padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          กรุณากรอกข้อมูลงบดุลส่วนบุคคลและงบกระแสเงินสดก่อน เพื่อให้ระบบคำนวณอัตราส่วนทางการเงิน
        </div>
      )}

      {hasData && data.healthScore != null && (
        <HealthScoreHero score={data.healthScore} label={data.healthLabel} cats={data.categoryScores} />
      )}

      {hasData && <SummaryBanner summary={data.summary} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section
            title="การวิเคราะห์สภาพคล่อง"
            icon={Droplets} color="#22d3ee"
            keys={['ratio1', 'ratio2', 'ratio3']}
            ratios={data.ratios} advice={data.advice}
          />
          <Section
            title="การออมและการลงทุน"
            icon={PiggyBank} color="#a78bfa"
            keys={['ratio7', 'ratio8']}
            ratios={data.ratios} advice={data.advice}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Section
            title="การวิเคราะห์หนี้สิน"
            icon={CreditCard} color="#f43f5e"
            keys={['ratio4', 'ratio5', 'ratio6']}
            ratios={data.ratios} advice={data.advice}
          />
          {/* Advice Summary */}
          {hasData && (
            <div style={{ ...card, padding: '16px 20px' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                สรุปคำแนะนำทางการเงิน
              </p>
              {(['liquidity', 'debt', 'savings'] as const).map(cat => {
                const catMeta = {
                  liquidity: { label: 'ด้านสภาพคล่อง', color: '#22d3ee', icon: Droplets },
                  debt:      { label: 'ด้านหนี้สิน',    color: '#f43f5e', icon: CreditCard },
                  savings:   { label: 'ด้านการออม/ลงทุน', color: '#a78bfa', icon: PiggyBank },
                }[cat]
                const catKeys = {
                  liquidity: ['ratio1','ratio2','ratio3'],
                  debt:      ['ratio4','ratio5','ratio6'],
                  savings:   ['ratio7','ratio8'],
                }[cat]
                const worstEntry = data.ratios
                  .filter(r => catKeys.includes(r.key))
                  .sort(a => a.state === 'danger' ? -1 : a.state === 'warning' ? 0 : 1)[0]
                const advice = worstEntry ? data.advice[worstEntry.key] : null
                const s = worstEntry ? STATE_STYLE[worstEntry.state] : STATE_STYLE.nodata
                const SIcon = s.icon
                const CIcon = catMeta.icon

                const note = notes[cat] ?? ''
                const isEdit = editing === cat

                return (
                  <div key={cat} style={{ marginBottom: 12, padding: '12px 14px',
                    background: `${catMeta.color}08`, borderRadius: 10,
                    border: `1px solid ${catMeta.color}25` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <CIcon size={13} color={catMeta.color} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: catMeta.color }}>{catMeta.label}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: s.color }}>
                        <SIcon size={12} /> {worstEntry?.state === 'good' ? 'ดี' : worstEntry?.state === 'warning' ? 'ควรระวัง' : worstEntry?.state === 'danger' ? 'เร่งด่วน' : '—'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 10 }}>
                      {advice ?? 'ยังไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์'}
                    </p>

                    {/* Concrete action plan — แสดงเมื่อยังไม่ผ่านเกณฑ์ */}
                    {worstEntry && worstEntry.state !== 'good' && worstEntry.state !== 'nodata' && (() => {
                      const plan = actionPlan(worstEntry.key, worstEntry.value, data.summary)
                      return plan ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: note || isEdit ? 10 : 0,
                          padding: '10px 12px', background: `${catMeta.color}12`, borderRadius: 8, border: `1px dashed ${catMeta.color}55` }}>
                          <TrendingUp size={14} color={catMeta.color} style={{ flexShrink: 0, marginTop: 1 }} />
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                            <strong style={{ color: catMeta.color }}>แนะนำให้ปรับ: </strong>{plan}
                          </p>
                        </div>
                      ) : null
                    })()}

                    {/* Additional advisor note */}
                    {isEdit ? (
                      <div>
                        <textarea
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          placeholder="พิมพ์ความเห็นเพิ่มเติม..."
                          rows={3}
                          autoFocus
                          style={{ ...inp, resize: 'vertical' as const, fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(cat)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: catMeta.color, border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: '#fff', fontSize: 12 }}>
                            <Check size={12} /> บันทึก
                          </button>
                          <button onClick={cancelEdit}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>
                            <X size={12} /> ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {note && (
                          <div style={{ flex: 1, fontSize: 12, color: catMeta.color, lineHeight: 1.65,
                            background: `${catMeta.color}12`, borderRadius: 6, padding: '7px 10px',
                            borderLeft: `3px solid ${catMeta.color}60` }}>
                            <span style={{ fontSize: 10, color: `${catMeta.color}99`, display: 'block', marginBottom: 2 }}>ความเห็นเพิ่มเติม</span>
                            {note}
                          </div>
                        )}
                        <button onClick={() => startEdit(cat)}
                          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, background: 'none',
                            border: `1px solid ${catMeta.color}40`, borderRadius: 6, padding: '4px 10px',
                            cursor: 'pointer', color: catMeta.color, fontSize: 11, marginTop: note ? 0 : undefined }}>
                          <Pencil size={11} /> {note ? 'แก้ไข' : 'เพิ่มความเห็น'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
