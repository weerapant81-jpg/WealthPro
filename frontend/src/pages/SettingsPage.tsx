import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Save, CheckCircle, User, TrendingUp, GraduationCap, Percent, Shield, SlidersHorizontal, ChartPie, Landmark } from 'lucide-react'
import { MoneyInput as MoneyInputBase } from '../components/MoneyInput'
import { PageHeader } from '../components/ui'
import { TableExcelButton } from '../components/exportable'
import { WizardNav, PLANNING_STEPS } from '../components/WizardNav'
import { useAuth } from '../context/AuthContext'
import { useClient } from '../context/ClientContext'
import InvestmentAssumptionPage from './InvestmentAssumptionPage'

const CURRENT_YEAR = new Date().getFullYear() + 543  // พ.ศ.

/* ── อัตราเงินเฟ้ออ้างอิง (World Bank) — แสดงให้ดูประกอบ ไม่เขียนทับค่าที่ตั้งไว้เอง ── */
type CategoryRef = {
  key: string; label: string; seriesName: string
  latest: { year: number; value: number } | null
  averages: { years: number; from: number; to: number; value: number }[]
}
type InflationRef = { source: string; sourceUrl: string; categories: CategoryRef[] }

function useInflationRef() {
  return useQuery<InflationRef>({
    queryKey: ['reference-inflation'],
    queryFn: () => api.get('/reference/inflation').then(r => r.data),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
}

function InflationReference({ catKey, current, onUse }: { catKey: string; current: number; onUse: (v: number) => void }) {
  const { data } = useInflationRef()
  const cat = data?.categories?.find(c => c.key === catKey)
  if (!cat?.averages?.length) return null   // ดึงไม่ได้ → ไม่แสดงอะไรเลย ไม่รบกวนการใช้งาน
  const same = (v: number) => Math.abs(current - v) < 0.005
  const chip = (label: string, value: number, hint: string) => (
    <button key={label} type="button" onClick={() => onUse(value)} title={`${hint} — คลิกเพื่อใช้ค่านี้`}
      disabled={same(value)}
      style={{
        padding: '3px 9px', borderRadius: 999, fontSize: 11.5, cursor: same(value) ? 'default' : 'pointer',
        border: '1px solid var(--card-border)', background: 'var(--grid)', color: 'var(--text-primary)',
        opacity: same(value) ? 0.45 : 1, fontFamily: 'inherit',
      }}>
      {label} <b style={{ fontFamily: 'monospace' }}>{value.toFixed(2)}%</b>
    </button>
  )
  return (
    <div style={{ margin: '2px 0 6px', padding: '8px 11px', borderRadius: 9, background: 'var(--grid)', border: '1px solid var(--card-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
        CPI จริง · {cat.seriesName} — คลิกเพื่อนำค่าไปใช้
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {cat.averages.map(a => chip(`เฉลี่ย ${a.years} ปี`, a.value, `พ.ศ. ${a.from + 543}–${a.to + 543}`))}
        {cat.latest && chip(`ปี ${cat.latest.year + 543}`, cat.latest.value, 'ปีล่าสุด — ปีเดียวแกว่งมาก ไม่แนะนำใช้วางแผน')}
      </div>
    </div>
  )
}

/* ── อัตราดอกเบี้ยการออมอ้างอิงจาก ธปท. — แสดงอย่างเดียว แก้ไม่ได้ ── */
type RateRow = { key: string; label: string; value: number | null; detail: string; note?: string }
type SavingRatesRef = { source: string; sourceUrl: string; asOf: string | null; rows: RateRow[] }

function SavingRatesCard() {
  const { data } = useQuery<SavingRatesRef>({
    queryKey: ['reference-saving-rates'],
    queryFn: () => api.get('/reference/saving-rates').then(r => r.data),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
  if (!data?.rows?.length) return null   // ดึงไม่ได้ → ไม่แสดงการ์ดเลย
  const beDate = (iso: string | null) => {
    if (!iso) return null
    const [y, m, d] = iso.split('-')
    return y && m && d ? `${d}/${m}/${Number(y) + 543}` : iso
  }
  return (
    <Section icon={<Landmark size={16} />} title="อัตราดอกเบี้ยการออม (อ้างอิงตลาด)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {data.rows.map(r => (
          <div key={r.key} style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
            padding: '8px 0', borderBottom: '1px solid var(--card-border)',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }}>{r.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap', color: r.value === null ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
              {r.value === null ? '—' : `${r.value.toFixed(2)}%`}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
        ข้อมูลอ้างอิงเท่านั้น ไม่ถูกนำไปคำนวณในแผน · ที่มา: {data.source}
        {data.asOf ? ` · ข้อมูล ณ ${beDate(data.asOf)}` : ''}
      </div>
    </Section>
  )
}

function InflationSourceNote() {
  const { data } = useInflationRef()
  if (!data?.categories?.length) return null
  return (
    <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.6 }}>
      แนะนำใช้ค่าเฉลี่ยระยะยาวในการวางแผน — ตัวเลขปีเดียวแกว่งมากและเคยติดลบ
      <br />ที่มา: {data.source}
    </div>
  )
}

const inp: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
  background: 'var(--input-bg, var(--grid))', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}
const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
  borderRadius: 16, padding: '20px 24px',
  // เป็นช่องหนึ่งของ bento grid — ยืดเต็มความสูงของแถว ให้การ์ดในแถวเดียวกันสูงเท่ากัน
  height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
        <span style={{ color: 'var(--cyan)' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, alignItems: 'center', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function NumInput({ value, onChange, unit, step = 1, placeholder = '' }: {
  value: number | string; onChange: (v: number) => void; unit?: string; step?: number; placeholder?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="number" step={step} value={value} placeholder={placeholder}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...inp, textAlign: 'right' }} />
      {unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 32 }}>{unit}</span>}
    </div>
  )
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <MoneyInputBase value={value} onChange={onChange} placeholder="0" style={{ ...inp, textAlign: 'right' }} />
}

const EDU_LEVELS = [
  { key: 'kindergarten', label: 'อนุบาล 1–3' },
  { key: 'primary',      label: 'ประถม 1–6' },
  { key: 'secondary',    label: 'มัธยม 1–6' },
  { key: 'bachelor',     label: 'ปริญญาตรี (ปีแรก)' },
  { key: 'master',       label: 'ปริญญาโท (ปีแรก)' },
]
const EDU_TYPES = [
  { key: 'public',        label: 'สถาบันรัฐ (บาท/ปี)' },
  { key: 'private',       label: 'สถาบันเอกชน (บาท/ปี)' },
  { key: 'international', label: 'สถาบันนานาชาติ (บาท/ปี)' },
]

type EduCosts = Record<string, Record<string, number>>

const defaultEduCosts = (): EduCosts =>
  Object.fromEntries(EDU_LEVELS.map(l => [l.key, Object.fromEntries(EDU_TYPES.map(t => [t.key, 0]))]))

type Form = {
  // ส่วนตัว
  retirementAgeSelf: number | ''
  retirementAgeSpouse: number | ''
  lifeExpectancySelf: number | ''
  lifeExpectancySpouse: number | ''
  // เงินเฟ้อ
  inflationRate: number
  educationInflation: number
  rentInflation: number
  medicalInflation: number
  // ดอกเบี้ย
  creditCardRate: number
  cashAdvanceRate: number
  personalLoanRate: number
  homeLoanRate: number
  carLoanRate: number
  // ผลตอบแทน
  educationFundReturn: number
  educationReturnDuring: number
  preRetirementReturn: number
  postRetirementReturn: number
  expectedReturn: number
  taxRate: number
  // กองทุนสำรองเลี้ยงชีพ
  pvdReturnRate: number | ''
  pvdReturnAsOf: string
  // ประกันสังคม
  ssoReturnRate: number | ''
  ssoReturnAsOf: string
  // การศึกษา
  educationCostYear: number
  educationCosts: EduCosts
}

const defaultForm = (): Form => ({
  retirementAgeSelf: '', retirementAgeSpouse: '',
  lifeExpectancySelf: '', lifeExpectancySpouse: '',
  inflationRate: 3, educationInflation: 5, rentInflation: 4, medicalInflation: 5,
  creditCardRate: 16, cashAdvanceRate: 16, personalLoanRate: 16, homeLoanRate: 6, carLoanRate: 5,
  educationFundReturn: 4, educationReturnDuring: 4,
  preRetirementReturn: 4, postRetirementReturn: 4,
  expectedReturn: 7, taxRate: 10,
  pvdReturnRate: 4, pvdReturnAsOf: 'เฉลี่ย 5 ปี',
  ssoReturnRate: 2.29, ssoReturnAsOf: 'เฉลี่ย 5 ปี (ก.พ. 2568)',
  educationCostYear: CURRENT_YEAR,
  educationCosts: defaultEduCosts(),
})

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'
  const { selectedClient } = useClient()
  // แก้ค่ากลาง เฉพาะ SA ที่ยังไม่ได้เลือกลูกค้า · ถ้าเลือกลูกค้าแล้ว = แก้ของลูกค้ารายนั้น
  const editGlobal = isSuper && !selectedClient
  const { data: profile, isFetched } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data) })
  // ค่าสมมติฐานกลางที่ Super Admin ตั้งไว้ — SA แก้ที่นี่ · FA ใช้เป็น default ตั้งต้นของลูกค้า
  const { data: defaults, isFetched: defFetched } = useQuery({ queryKey: ['assumption-defaults'], queryFn: () => api.get('/assumption-defaults').then(r => r.data), retry: false })
  const [form, setForm] = useState<Form>(defaultForm())
  const initRef = useRef(false)
  const skipFirstSave = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saved, setSaved] = useState(false)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<'assumptions' | 'portfolio'>(searchParams.get('tab') === 'portfolio' ? 'portfolio' : 'assumptions')
  useEffect(() => { const t = searchParams.get('tab'); if (t === 'portfolio' || t === 'assumptions') setTab(t) }, [searchParams])

  const TabBar = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {([['assumptions', 'สมมติฐาน', SlidersHorizontal], ['portfolio', 'การจัดพอร์ตลงทุน', ChartPie]] as const).map(([key, label, Icon]) => (
        <button key={key} onClick={() => setTab(key)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: tab === key ? 700 : 500,
            border: '1px solid', borderColor: tab === key ? 'var(--cyan)' : 'var(--card-border)',
            background: tab === key ? 'var(--cyan-dim)' : 'transparent',
            color: tab === key ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  )


  useEffect(() => {
    // SA แก้ค่ากลาง (ใช้ defaults) · FA แก้ค่าลูกค้า (ใช้ profile, fallback = defaults)
    const ready = defFetched && (editGlobal || isFetched)
    if (!ready || initRef.current) return   // init ครั้งเดียว — กัน refetch มา reset ค่าที่กำลังแก้
    initRef.current = true
    const base: any = editGlobal ? (defaults ?? {}) : (profile ?? {})
    const fb: any = editGlobal ? {} : (defaults ?? {})
    const pick = (k: string, hard: any) => base[k] ?? fb[k] ?? hard
    const ec = (base.educationCosts && typeof base.educationCosts === 'object') ? base.educationCosts
      : (fb.educationCosts && typeof fb.educationCosts === 'object') ? fb.educationCosts : defaultEduCosts()
    setForm({
      retirementAgeSelf:    pick('retirementAgeSelf', ''),
      retirementAgeSpouse:  pick('retirementAgeSpouse', ''),
      lifeExpectancySelf:   pick('lifeExpectancySelf', ''),
      lifeExpectancySpouse: pick('lifeExpectancySpouse', ''),
      inflationRate:        pick('inflationRate', 3),
      educationInflation:   pick('educationInflation', 5),
      rentInflation:        pick('rentInflation', 4),
      medicalInflation:     pick('medicalInflation', 5),
      creditCardRate:       pick('creditCardRate', 16),
      cashAdvanceRate:      pick('cashAdvanceRate', 16),
      personalLoanRate:     pick('personalLoanRate', 16),
      homeLoanRate:         pick('homeLoanRate', 6),
      carLoanRate:          pick('carLoanRate', 5),
      educationFundReturn:  pick('educationFundReturn', 4),
      educationReturnDuring: pick('educationReturnDuring', 4),
      preRetirementReturn:  pick('preRetirementReturn', 4),
      postRetirementReturn: pick('postRetirementReturn', 4),
      expectedReturn:       pick('expectedReturn', 7),
      taxRate:              pick('taxRate', 10),
      pvdReturnRate:        pick('pvdReturnRate', 4),
      pvdReturnAsOf:        pick('pvdReturnAsOf', 'เฉลี่ย 5 ปี'),
      ssoReturnRate:        pick('ssoReturnRate', 2.29),
      ssoReturnAsOf:        pick('ssoReturnAsOf', 'เฉลี่ย 5 ปี (ก.พ. 2568)'),
      educationCostYear:    pick('educationCostYear', CURRENT_YEAR),
      educationCosts:       ec,
    })
  }, [profile, defaults, isFetched, defFetched, editGlobal])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const setEdu = (level: string, type: string, val: number) =>
    setForm(f => ({ ...f, educationCosts: { ...f.educationCosts, [level]: { ...f.educationCosts[level], [type]: val } } }))

  const save = useMutation({
    mutationFn: (data: Form) => api.put(editGlobal ? '/assumption-defaults' : '/profile', data),
    onSuccess: () => {
      if (editGlobal) qc.invalidateQueries({ queryKey: ['assumption-defaults'] })
      // refresh ['profile'] เสมอ — หน้าคำนวณอื่นอ่านอายุเกษียณ/สมมติฐานจาก /profile (SA แก้ค่ากลาง = โปรไฟล์ SA เอง)
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['projection'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => {
      console.error('[Settings save error]', err?.response?.data ?? err?.message)
    },
  })

  // autosave — บันทึกอัตโนมัติเมื่อค่าเปลี่ยน (debounce) เหมือนหน้าอื่นของแอป · คงปุ่มบันทึกไว้ด้วย
  useEffect(() => {
    if (!initRef.current) return
    if (skipFirstSave.current) { skipFirstSave.current = false; return }   // ข้ามการ populate ครั้งแรกตอนโหลด
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save.mutate(form), 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [form])

  if (tab === 'portfolio') {
    return (
      <div>
        {TabBar}
        <InvestmentAssumptionPage />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {TabBar}
      {/* แถบบอกบริบท: SA แก้ค่ากลาง · FA แก้ค่าลูกค้า (default มาจากค่ากลาง) */}
      <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
        background: editGlobal ? 'rgba(245,158,11,0.12)' : 'var(--cyan-dim)',
        border: `1px solid ${editGlobal ? '#f59e0b' : 'var(--cyan)'}`, color: 'var(--text-secondary)' }}>
        {editGlobal
          ? <><b style={{ color: 'var(--text-primary)' }}>คุณกำลังตั้งค่าสมมติฐานกลาง</b> — ค่านี้จะเป็น default ตั้งต้นให้นักวางแผน (FA) ทุกคนสำหรับลูกค้าใหม่ที่ยังไม่ปรับแก้ (เลือกลูกค้าก่อน หากต้องการแก้เฉพาะรายคน)</>
          : <><b style={{ color: 'var(--text-primary)' }}>แก้ไขสำหรับ{selectedClient?.name ? `ลูกค้า: ${selectedClient.name}` : 'ลูกค้ารายนี้'}</b> — ค่าเริ่มต้นมาจากค่ากลางของผู้ให้บริการ · ค่าที่แก้จะใช้เฉพาะลูกค้าคนนี้</>}
      </div>
      {/* Header + Save bar */}
      <div style={{ marginBottom: 28 }}>
        <PageHeader icon={SlidersHorizontal} title={editGlobal ? 'ตั้งค่าสมมติฐานกลาง' : 'ตั้งค่าสมมติฐาน (รายลูกค้า)'} subtitle="สมมติฐานเหล่านี้ใช้คำนวณแผนการเงินส่วนบุคคล"
          right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {saved && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
              <CheckCircle size={15} /> บันทึกสำเร็จ
            </span>
          )}
          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'var(--cyan)', border: 'none', borderRadius: 10, color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: save.isPending ? 0.6 : 1 }}>
            <Save size={15} />
            {save.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
          } />
      </div>

      {/* bento 3 คอลัมน์ — การ์ดในแถวเดียวกันสูงเท่ากัน (การ์ดยืดเต็มแถวเอง)
          minmax แบบ max(280px, 1/3 ของความกว้าง) = บนจอกว้างได้ 3 คอลัมน์พอดี ไม่เกินนี้
          จอแคบลงจะลดเหลือ 2 แล้ว 1 คอลัมน์อัตโนมัติ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(max(280px, calc((100% - 40px) / 3)), 1fr))',
        gap: 20,
        alignItems: 'stretch',
      }}>

          {/* อัตราเงินเฟ้อ — การ์ดสูงสุดของหน้า */}
          <Section icon={<Percent size={16} />} title="อัตราเงินเฟ้อ">
            <Row label="ทั่วไป">
              <NumInput value={form.inflationRate} onChange={v => set('inflationRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <InflationReference catKey="general" current={form.inflationRate} onUse={v => set('inflationRate', v)} />
            <Row label="การศึกษา">
              <NumInput value={form.educationInflation} onChange={v => set('educationInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
            <InflationReference catKey="education" current={form.educationInflation} onUse={v => set('educationInflation', v)} />
            <Row label="ค่าเช่าที่อยู่อาศัย">
              <NumInput value={form.rentInflation} onChange={v => set('rentInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
            <InflationReference catKey="rent" current={form.rentInflation} onUse={v => set('rentInflation', v)} />
            <Row label="ค่ารักษาพยาบาล">
              <NumInput value={form.medicalInflation} onChange={v => set('medicalInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
            <InflationReference catKey="medical" current={form.medicalInflation} onUse={v => set('medicalInflation', v)} />
            <InflationSourceNote />
          </Section>

          {/* ผลตอบแทนที่คาดหวัง */}
          <Section icon={<TrendingUp size={16} />} title="ผลตอบแทนที่คาดหวัง">
            <Row label="ทุนการศึกษาบุตร">
              <NumInput value={form.educationFundReturn} onChange={v => set('educationFundReturn', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ระหว่างการศึกษาบุตร">
              <NumInput value={form.educationReturnDuring} onChange={v => set('educationReturnDuring', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ก่อนเกษียณ">
              <NumInput value={form.preRetirementReturn} onChange={v => set('preRetirementReturn', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="หลังเกษียณ">
              <NumInput value={form.postRetirementReturn} onChange={v => set('postRetirementReturn', v)} unit="%/ปี" step={0.1} />
            </Row>
          </Section>

          {/* อัตราดอกเบี้ย */}
          <Section icon={<TrendingUp size={16} />} title="อัตราดอกเบี้ย">
            <Row label="บัตรเครดิต">
              <NumInput value={form.creditCardRate} onChange={v => set('creditCardRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="กดเงินสดจากบัตรเครดิต">
              <NumInput value={form.cashAdvanceRate} onChange={v => set('cashAdvanceRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="สินเชื่อส่วนบุคคล">
              <NumInput value={form.personalLoanRate} onChange={v => set('personalLoanRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ดอกเบี้ยบ้าน (สินเชื่อที่อยู่อาศัย)">
              <NumInput value={form.homeLoanRate} onChange={v => set('homeLoanRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ดอกเบี้ยรถยนต์">
              <NumInput value={form.carLoanRate} onChange={v => set('carLoanRate', v)} unit="%/ปี" step={0.1} />
            </Row>
          </Section>

          {/* กองทุนประกันสังคม — วางใต้การ์ดเงินเฟ้อ (คอลัมน์แรกของแถวที่สอง) */}
          <Section icon={<Shield size={16} />} title="กองทุนประกันสังคม">
            <Row label="ผลตอบแทนเฉลี่ย 5 ปี" hint="ใช้ในแท็บ 'มูลค่ากองทุนประกันสังคม'">
              <NumInput value={form.ssoReturnRate} onChange={v => set('ssoReturnRate', v)} unit="%/ปี" step={0.01} />
            </Row>
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>ข้อมูล ณ</div>
              <input value={form.ssoReturnAsOf} onChange={e => set('ssoReturnAsOf', e.target.value)} style={inp} placeholder="เช่น เฉลี่ย 5 ปี (ก.พ. 2568)" />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              อัปเดตจากเว็บประกันสังคม (sso.go.th) — แนะนำตรวจสอบ/แก้ไขทุกเดือน
            </p>
          </Section>

          {/* อัตราดอกเบี้ยการออมอ้างอิงจาก ธปท. — แสดงอย่างเดียว */}
          <SavingRatesCard />

          {/* สมมติฐานส่วนตัว */}
          <Section icon={<User size={16} />} title="สมมติฐานส่วนตัว">
            <Row label="อายุเกษียณ — ตนเอง">
              <NumInput value={form.retirementAgeSelf} onChange={v => set('retirementAgeSelf', v)} unit="ปี" placeholder="60" />
            </Row>
            <Row label="อายุเกษียณ — คู่สมรส">
              <NumInput value={form.retirementAgeSpouse} onChange={v => set('retirementAgeSpouse', v)} unit="ปี" placeholder="60" />
            </Row>
            <Row label="อายุขัย — ตนเอง">
              <NumInput value={form.lifeExpectancySelf} onChange={v => set('lifeExpectancySelf', v)} unit="ปี" placeholder="85" />
            </Row>
            <Row label="อายุขัย — คู่สมรส">
              <NumInput value={form.lifeExpectancySpouse} onChange={v => set('lifeExpectancySpouse', v)} unit="ปี" placeholder="85" />
            </Row>
          </Section>

          {/* กองทุนสำรองเลี้ยงชีพ — ย้ายไปกรอกที่หน้าข้อมูลส่วนบุคคล (สวัสดิการที่มี) แล้ว */}

        {/* ── ค่าใช้จ่ายด้านการศึกษา — เต็มความกว้าง (ตารางกว้าง ใส่ในคอลัมน์เดียวไม่พอ) ── */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Section icon={<GraduationCap size={16} />} title="ค่าใช้จ่ายด้านการศึกษา">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>มูลค่าปัจจุบัน ณ ปี พ.ศ.</span>
              <input type="number" value={form.educationCostYear}
                onChange={e => set('educationCostYear', Number(e.target.value))}
                style={{ ...inp, width: 90, textAlign: 'center' }} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename="ค่าใช้จ่ายการศึกษา" title="ค่าการศึกษา" /></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--card-border)', width: '28%' }}>ระดับการศึกษา</th>
                    {EDU_TYPES.map(t => (
                      <th key={t.key} style={{ textAlign: 'right', padding: '8px 14px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--card-border)' }}>{t.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {EDU_LEVELS.map((lv, i) => (
                    <tr key={lv.key} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--hover)' }}>
                      <td style={{ padding: '8px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>{lv.label}</td>
                      {EDU_TYPES.map(t => (
                        <td key={t.key} style={{ padding: '6px 8px' }}>
                          <MoneyInput
                            value={form.educationCosts[lv.key]?.[t.key] ?? 0}
                            onChange={v => setEdu(lv.key, t.key, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* นำทางวางแผนทีละขั้น — สมมติฐานเป็นขั้นแรก (ไม่มี "ก่อนหน้า") · ซ่อนตอน SA แก้ค่ากลาง */}
        {!editGlobal && (
          <div style={{ gridColumn: '1 / -1' }}>
            <WizardNav steps={PLANNING_STEPS} current="assumptions" />
          </div>
        )}

      </div>
    </div>
  )
}
