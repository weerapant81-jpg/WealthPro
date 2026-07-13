import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Save, CheckCircle, User, TrendingUp, GraduationCap, Percent, Shield, SlidersHorizontal, ChartPie } from 'lucide-react'
import { MoneyInput as MoneyInputBase } from '../components/MoneyInput'
import { PageHeader } from '../components/ui'
import { TableExcelButton } from '../components/exportable'
import { useAuth } from '../context/AuthContext'
import InvestmentAssumptionPage from './InvestmentAssumptionPage'

const CURRENT_YEAR = new Date().getFullYear() + 543  // พ.ศ.

const inp: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)',
  background: 'var(--input-bg, var(--grid))', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}
const card: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
  borderRadius: 16, padding: '20px 24px',
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
    const ready = defFetched && (isSuper || isFetched)
    if (!ready || initRef.current) return   // init ครั้งเดียว — กัน refetch มา reset ค่าที่กำลังแก้
    initRef.current = true
    const base: any = isSuper ? (defaults ?? {}) : (profile ?? {})
    const fb: any = isSuper ? {} : (defaults ?? {})
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
  }, [profile, defaults, isFetched, defFetched, isSuper])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  const setEdu = (level: string, type: string, val: number) =>
    setForm(f => ({ ...f, educationCosts: { ...f.educationCosts, [level]: { ...f.educationCosts[level], [type]: val } } }))

  const save = useMutation({
    mutationFn: (data: Form) => api.put(isSuper ? '/assumption-defaults' : '/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: isSuper ? ['assumption-defaults'] : ['profile'] })
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
        background: isSuper ? 'rgba(245,158,11,0.12)' : 'var(--cyan-dim)',
        border: `1px solid ${isSuper ? '#f59e0b' : 'var(--cyan)'}`, color: 'var(--text-secondary)' }}>
        {isSuper
          ? <><b style={{ color: 'var(--text-primary)' }}>คุณกำลังตั้งค่าสมมติฐานกลาง</b> — ค่านี้จะเป็น default ตั้งต้นให้นักวางแผน (FA) ทุกคนสำหรับลูกค้าใหม่ที่ยังไม่ปรับแก้</>
          : <><b style={{ color: 'var(--text-primary)' }}>ค่าเริ่มต้นมาจากค่ากลางของผู้ให้บริการ</b> — คุณแก้ไขสำหรับลูกค้ารายนี้ได้ตามต้องการ (ค่าที่แก้จะใช้เฉพาะลูกค้าคนนี้)</>}
      </div>
      {/* Header + Save bar */}
      <div style={{ marginBottom: 28 }}>
        <PageHeader icon={SlidersHorizontal} title={isSuper ? 'ตั้งค่าสมมติฐานกลาง' : 'ตั้งค่าสมมติฐาน'} subtitle="สมมติฐานเหล่านี้ใช้คำนวณแผนการเงินส่วนบุคคล"
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

      {/* 2-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 20, alignItems: 'start' }}>

        {/* ── คอลัมน์ซ้าย ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

          {/* กองทุนประกันสังคม */}
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

        </div>

        {/* ── คอลัมน์ขวา ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* อัตราเงินเฟ้อ */}
          <Section icon={<Percent size={16} />} title="อัตราเงินเฟ้อ">
            <Row label="ทั่วไป">
              <NumInput value={form.inflationRate} onChange={v => set('inflationRate', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="การศึกษา">
              <NumInput value={form.educationInflation} onChange={v => set('educationInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ค่าเช่าที่อยู่อาศัย">
              <NumInput value={form.rentInflation} onChange={v => set('rentInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
            <Row label="ค่ารักษาพยาบาล">
              <NumInput value={form.medicalInflation} onChange={v => set('medicalInflation', v)} unit="%/ปี" step={0.1} />
            </Row>
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
            <Row label="อัตราภาษีเงินได้">
              <NumInput value={form.taxRate} onChange={v => set('taxRate', v)} unit="%" step={0.1} />
            </Row>
          </Section>

          {/* กองทุนสำรองเลี้ยงชีพ — ย้ายไปกรอกที่หน้าข้อมูลส่วนบุคคล (สวัสดิการที่มี) แล้ว */}

        </div>

        {/* ── ค่าใช้จ่ายด้านการศึกษา — full width ── */}
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

      </div>
    </div>
  )
}
