import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { CheckCircle, User, Users, Plus, Trash2, Loader, AlertCircle, Clock, TrendingUp, IdCard, GraduationCap, Briefcase, HeartPulse, HeartHandshake, Dumbbell } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card, inp, sel, btn } from '../styles/dark'
import { TableExcelButton } from '../components/exportable'
import { WizardNav } from '../components/WizardNav'
import { MoneyInputStr as CommaInput } from '../components/MoneyInput'
import InsuranceTab from './InsuranceTab'
import InvestmentProfileTab from './InvestmentProfileTab'
import FinancialGoalsTab from './FinancialGoalsTab'
import IncomePage from './IncomePage'
import RiskAssessmentPage from './RiskAssessmentPage'

const MARITAL = ['โสด', 'สมรส', 'หย่าร้าง', 'หม้าย', 'แยกกันอยู่']
const CONTACT_CH = ['โทรศัพท์', 'Line', 'Email', 'Facebook', 'อื่นๆ']
const EDUCATION_LEVELS = [
  'ต่ำกว่ามัธยมศึกษา',
  'มัธยมศึกษาตอนต้น (ม.3)',
  'มัธยมศึกษาตอนปลาย (ม.6) / ปวช.',
  'อนุปริญญา / ปวส.',
  'ปริญญาตรี',
  'ปริญญาโท',
  'ปริญญาเอก',
  'อื่นๆ',
]

type Child = { name: string; age: string; school: string }
type Job = { occupation: string; jobTitle: string; company: string; workYears: string; salary: string; salaryIncreaseRate: string }
const emptyJob = (): Job => ({ occupation: '', jobTitle: '', company: '', workYears: '', salary: '', salaryIncreaseRate: '' })
type IncomeSource = { label: string; source: string; amount: string }
const INCOME_SOURCE_LABELS = ['เงินเดือน', 'รายได้จากอาชีพเสริม', 'รายได้จากการลงทุน', 'รายได้จากค่าเช่า', 'เงินปันผล', 'โบนัส', 'อื่นๆ']
const emptyIncomeSource = (): IncomeSource => ({ label: '', source: '', amount: '' })

const defaultForm = {
  firstName: '', lastName: '', nickname: '', birthDate: '', nationalId: '',
  maritalStatus: 'โสด', nationality: 'ไทย', education: '', educationField: '', occupation: '', jobTitle: '',
  workYears: '', salary: '', salaryIncreaseRate: '', company: '',
  address: '', phone: '', contactEmail: '', contactChannel: 'โทรศัพท์',
  addrHouseNo: '', addrSubdistrict: '', addrDistrict: '', addrProvince: '', addrZipcode: '',
  hasSocialSecurity: false, socialSecurityYears: '',
  hasGroupInsurance: false, giRoomLimit: '', giMedicalLimit: '', giSurgeryLimit: '', giOpdLimit: '',
  hasPVD: false, pvdEmployeeRate: '', pvdEmployerRate: '', pvdCurrentValue: '', pvdReturnRate: '',
  healthInfo: {
    smoke: 'ไม่สูบ', alcohol: 'ไม่ดื่ม',
    chronic: { has: false, detail: '' },
    severeIllness: { has: false, detail: '' },
    surgery: { has: false, detail: '' },
    hospitalized: { has: false, detail: '' },
    regularHospital: { has: false, detail: '' },
    insuranceRejected: { has: false, detail: '' },
    familyParents: { has: false, detail: '' },
    familyGrandPaternal: { has: false, detail: '' },
    familyGrandMaternal: { has: false, detail: '' },
    hobby: { has: false, detail: '' },
  } as any,
  consent: { pdpa: false, tos: false, signature: '', signedName: '', signedAt: '' } as any,
  spouseName: '', spouseAge: '', spouseOccupation: '', spouseIncome: '',
  fatherAge: '', motherAge: '', parentCareExpense: '', dependents: '',
  parentsInfo: {
    fatherName: '', fatherHealth: 'แข็งแรง', fatherChronic: { has: false, detail: '' },
    motherName: '', motherHealth: 'แข็งแรง', motherChronic: { has: false, detail: '' },
  } as any,
}

const PARENT_HEALTH = ['แข็งแรง', 'ปานกลาง', 'ไม่แข็งแรง']

const defaultHealth = () => ({
  smoke: 'ไม่สูบ', alcohol: 'ไม่ดื่ม',
  chronic: { has: false, detail: '' },
  severeIllness: { has: false, detail: '' },
  surgery: { has: false, detail: '' },
  hospitalized: { has: false, detail: '' },
  regularHospital: { has: false, detail: '' },
  insuranceRejected: { has: false, detail: '' },
  familyParents: { has: false, detail: '' },
  familyGrandPaternal: { has: false, detail: '' },
  familyGrandMaternal: { has: false, detail: '' },
  hobby: { has: false, detail: '' },
})

// ข้อมูลส่วนตัวของคู่สมรส (เก็บแยกใน JSON) — งาน/รายได้ใช้ spouseJobs / spouseIncomeSources
const defaultSpouseProfile = {
  firstName: '', lastName: '', nickname: '', birthDate: '', nationalId: '',
  nationality: 'ไทย', education: '', educationField: '',
  phone: '', contactEmail: '', contactChannel: 'โทรศัพท์',
  hasSocialSecurity: false, socialSecurityYears: '',
  hasGroupInsurance: false, giRoomLimit: '', giMedicalLimit: '', giSurgeryLimit: '', giOpdLimit: '',
  hasPVD: false, pvdEmployeeRate: '', pvdEmployerRate: '', pvdCurrentValue: '', pvdReturnRate: '',
  healthInfo: defaultHealth() as any,
  fatherAge: '', motherAge: '', parentCareExpense: '', dependents: '',
  parentsInfo: {
    fatherName: '', fatherHealth: 'แข็งแรง', fatherChronic: { has: false, detail: '' },
    motherName: '', motherHealth: 'แข็งแรง', motherChronic: { has: false, detail: '' },
  } as any,
}

function SectionTitle({ icon: Icon, title, sub, accent = 'var(--cyan)' }: { icon: React.ElementType; title: string; sub?: string; accent?: string }) {
  const soft = accent === 'var(--cyan)' ? 'var(--cyan-dim)' : `${accent}22`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={accent} />
      </div>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
        {sub && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  )
}

const hPill = (active: boolean): React.CSSProperties => ({
  padding: '5px 16px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
  borderColor: active ? 'var(--cyan)' : 'var(--card-border)',
  background: active ? 'var(--cyan-dim)' : 'transparent',
  color: active ? 'var(--cyan-light)' : 'var(--text-secondary)',
})

// "ไม่มี/มี (ระบุ)" row
function HealthItem({ label, value, onChange, yes = 'มี', no = 'ไม่มี', placeholder = 'โปรดระบุ' }: {
  label: string; value: { has: boolean; detail: string }; onChange: (v: { has: boolean; detail: string }) => void
  yes?: string; no?: string; placeholder?: string
}) {
  const v = value || { has: false, detail: '' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid var(--divider)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)', minWidth: 220, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onChange({ ...v, has: false })} style={hPill(!v.has)}>{no}</button>
        <button onClick={() => onChange({ ...v, has: true })} style={hPill(v.has)}>{yes}</button>
      </div>
      {v.has && <input value={v.detail} onChange={e => onChange({ ...v, detail: e.target.value })} placeholder={placeholder} style={{ ...inp, flex: 1, minWidth: 200 }} />}
    </div>
  )
}

// 3-option radio row (smoke / alcohol)
function HealthChoice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '9px 0', borderBottom: '1px solid var(--divider)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text-primary)', minWidth: 220, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(o => <button key={o} onClick={() => onChange(o)} style={hPill(value === o)}>{o}</button>)}
      </div>
    </div>
  )
}

/* ── PDPA + Terms of Service (ร่างเบื้องต้น ควรให้นักกฎหมายตรวจก่อนใช้จริง) ── */
export const PDPA_TEXT = `หนังสือแสดงความยินยอมในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคล (PDPA)

ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ข้าพเจ้า (เจ้าของข้อมูลส่วนบุคคล) ยินยอมให้นักวางแผนการเงิน/ผู้ให้บริการ ("ผู้ควบคุมข้อมูล") เก็บรวบรวม ใช้ และประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้า ดังนี้

1. ข้อมูลที่จัดเก็บ: ชื่อ-นามสกุล วันเกิด เลขบัตรประชาชน ที่อยู่ ข้อมูลติดต่อ ข้อมูลครอบครัว ข้อมูลการเงิน (รายรับ-รายจ่าย ทรัพย์สิน หนี้สิน) ข้อมูลการประกัน ข้อมูลการลงทุน และข้อมูลสุขภาพ (ข้อมูลอ่อนไหว)

2. วัตถุประสงค์: เพื่อวิเคราะห์และจัดทำแผนการเงินส่วนบุคคล ให้คำแนะนำ และติดตามผลตามที่ข้าพเจ้าร้องขอเท่านั้น

3. ข้อมูลอ่อนไหว (สุขภาพ): ข้าพเจ้ายินยอมโดยชัดแจ้งให้จัดเก็บและใช้ข้อมูลสุขภาพเพื่อการวางแผนประกันและการเงิน

4. การเปิดเผย: ข้อมูลจะถูกเก็บเป็นความลับ ใช้เพื่อวัตถุประสงค์ข้างต้นเท่านั้น และจะไม่เปิดเผยต่อบุคคลภายนอกโดยไม่ได้รับความยินยอม เว้นแต่กฎหมายกำหนด

5. ระยะเวลาจัดเก็บ: ตลอดระยะเวลาการให้บริการและตามที่กฎหมายกำหนด

6. สิทธิของเจ้าของข้อมูล: ข้าพเจ้ามีสิทธิขอเข้าถึง แก้ไข ลบ ระงับการใช้ คัดค้านการประมวลผล ขอให้โอนย้าย และเพิกถอนความยินยอมได้ตามกฎหมาย โดยติดต่อผู้ควบคุมข้อมูล

ข้าพเจ้าได้อ่านและเข้าใจข้อความข้างต้นโดยตลอดแล้ว และยินยอมให้ดำเนินการตามที่ระบุ`

export const TOS_TEXT = `เงื่อนไขการให้บริการวางแผนการเงิน (Terms of Service)

1. ขอบเขตบริการ: ผู้ให้บริการจัดทำแผนการเงินภายใต้ข้อมูลที่ลูกค้าให้มา และให้คำแนะนำตามหลักการวางแผนการเงิน

2. ความถูกต้องของข้อมูล: ลูกค้ารับรองว่าข้อมูลที่ให้เป็นความจริงและครบถ้วน หากข้อมูลไม่ครบถ้วน/ไม่ถูกต้อง อาจทำให้คำแนะนำมีข้อจำกัด

3. ข้อจำกัดความรับผิด: บริการนี้ไม่ครอบคลุมการคัดเลือกหลักทรัพย์รายตัว และผู้ให้บริการไม่รับผิดชอบต่อผลขาดทุนจากการลงทุน การตัดสินใจลงทุนเป็นของลูกค้า

4. การประมาณการ: ตัวเลขและกราฟเป็นการประมาณการภายใต้สมมติฐาน ผลลัพธ์จริงอาจแตกต่างไปตามสภาวะเศรษฐกิจและปัจจัยอื่น

5. การรักษาความลับ: ข้อมูลของลูกค้าจะถูกเก็บเป็นความลับตามนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)

6. การยอมรับ: การลงนามถือว่าลูกค้าได้อ่าน เข้าใจ และยอมรับเงื่อนไขการให้บริการนี้`

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = value }
  }, [])
  const pos = (e: any) => { const r = ref.current!.getBoundingClientRect(); const t = e.touches?.[0]; return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top } }
  const start = (e: any) => { drawing.current = true; const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e: any) => { if (!drawing.current) return; e.preventDefault(); const ctx = ref.current!.getContext('2d')!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0f2a43'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke() }
  const end = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current!.toDataURL('image/png')) }
  const clear = () => { const c = ref.current!; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); onChange('') }
  return (
    <div>
      <canvas ref={ref} width={520} height={140}
        style={{ width: 520, maxWidth: '100%', height: 140, background: '#fff', borderRadius: 8, border: '1px solid var(--card-border)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      <button onClick={clear} style={{ marginTop: 6, padding: '4px 12px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>ล้างลายเซ็น</button>
    </div>
  )
}

function ConsentModal({ consent, clientName, onSave, onClose }: { consent: any; clientName: string; onSave: (c: any) => void; onClose: () => void }) {
  const [pdpa, setPdpa] = useState(!!consent?.pdpa)
  const [tos, setTos] = useState(!!consent?.tos)
  const [sig, setSig] = useState(consent?.signature || '')
  const [name, setName] = useState(consent?.signedName || clientName?.trim() || '')
  const canSave = pdpa && tos && !!sig && !!name.trim()
  const box: React.CSSProperties = { background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: 200, overflowY: 'auto' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px', width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>ความยินยอมและเงื่อนไขการให้บริการ</h3>
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14 }}>กรุณาอ่านและลงนามเพื่อยืนยันการให้บริการและการจัดเก็บข้อมูล</p>

        <div style={box}>{PDPA_TEXT}</div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '8px 0 16px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={pdpa} onChange={e => setPdpa(e.target.checked)} style={{ marginTop: 2 }} /> ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และประมวลผลข้อมูลส่วนบุคคลตาม PDPA ข้างต้น
        </label>

        <div style={box}>{TOS_TEXT}</div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '8px 0 16px', fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={tos} onChange={e => setTos(e.target.checked)} style={{ marginTop: 2 }} /> ข้าพเจ้าได้อ่าน เข้าใจ และยอมรับเงื่อนไขการให้บริการ
        </label>

        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ชื่อ-นามสกุลผู้ลงนาม</label>
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, marginTop: 4, maxWidth: 320 }} />
        </div>
        <label style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>ลายเซ็น</label>
        <SignaturePad value={sig} onChange={setSig} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
          <button disabled={!canSave} onClick={() => onSave({ pdpa, tos, signature: sig, signedName: name.trim(), signedAt: new Date().toISOString() })}
            style={{ padding: '9px 22px', background: canSave ? 'var(--cyan)' : 'var(--navy-700)', border: 'none', borderRadius: 8, color: canSave ? '#fff' : 'var(--text-muted)', fontSize: 13.5, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }}>ยืนยันและลงนาม</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
        {label}{required && <span style={{ color: '#f43f5e', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Grid({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14 }}>
      {children}
    </div>
  )
}

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'invalid'

export default function ClientProfilePage() {
  const qc = useQueryClient()
  type TabKey = 'personal' | 'family' | 'insurance' | 'investment' | 'goals' | 'finance' | 'risk'
  const TAB_KEYS: TabKey[] = ['personal', 'family', 'insurance', 'investment', 'goals', 'finance', 'risk']
  const TAB_STEPS: { key: TabKey; label: string }[] = [
    { key: 'personal', label: 'ข้อมูลส่วนบุคคล' },
    { key: 'family', label: 'ข้อมูลครอบครัว' },
    { key: 'insurance', label: 'ข้อมูลการประกัน' },
    { key: 'investment', label: 'ข้อมูลสินทรัพย์-หนี้สิน' },
    { key: 'goals', label: 'เป้าหมายทางการเงิน' },
    { key: 'finance', label: 'งบการเงินส่วนบุคคล' },
    { key: 'risk', label: 'ประเมินความเสี่ยง' },
  ]
  const [searchParams, setSearchParams] = useSearchParams()
  const goTab = (key: string) => { setSearchParams({ tab: key }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const urlTab = searchParams.get('tab') as TabKey | null
  const [tab, setTab] = useState<TabKey>(urlTab && TAB_KEYS.includes(urlTab) ? urlTab : 'personal')
  // ขับแท็บจาก URL (?tab=) — เมนูย่อยใน sidebar ลิงก์มาที่นี่
  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null
    if (t && TAB_KEYS.includes(t) && t !== tab) setTab(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  // slot บน topbar (สำหรับปุ่มสลับลูกค้า/คู่สมรส + ชิป PDPA)
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setTopSlot(document.getElementById('topbar-actions')) }, [])
  const [form, setForm] = useState(defaultForm)
  const [children, setChildren] = useState<Child[]>([])
  const [additionalJobs, setAdditionalJobs] = useState<Job[]>([])
  const [spouseJobs, setSpouseJobs] = useState<Job[]>([emptyJob()])
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([
    { label: 'เงินเดือน', source: '', amount: '' },
    { label: 'รายได้จากอาชีพเสริม', source: '', amount: '' },
    { label: 'รายได้จากการลงทุน', source: '', amount: '' },
    { label: 'อื่นๆ', source: '', amount: '' },
  ])
  const [spouseIncomeSources, setSpouseIncomeSources] = useState<IncomeSource[]>([
    { label: 'เงินเดือน', source: '', amount: '' },
    { label: 'รายได้จากอาชีพเสริม', source: '', amount: '' },
    { label: 'รายได้จากการลงทุน', source: '', amount: '' },
    { label: 'อื่นๆ', source: '', amount: '' },
  ])
  // refs ให้ auto-save อ่านค่ารายได้ "ล่าสุด" ตอน debounce ยิง (กัน stale closure — effect ที่คำนวณ incomeSources จากเงินเดือนทำงานหลังเรียก triggerAutoSave)
  const incomeSourcesRef = useRef(incomeSources)
  useEffect(() => { incomeSourcesRef.current = incomeSources }, [incomeSources])
  const spouseIncomeSourcesRef = useRef(spouseIncomeSources)
  useEffect(() => { spouseIncomeSourcesRef.current = spouseIncomeSources }, [spouseIncomeSources])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [person, setPerson] = useState<'client' | 'spouse'>('client')
  const [spouseProfile, setSpouseProfile] = useState<typeof defaultSpouseProfile>(defaultSpouseProfile)
  const spouseProfileRef = useRef(spouseProfile)
  useEffect(() => { spouseProfileRef.current = spouseProfile }, [spouseProfile])
  const [showConsent, setShowConsent] = useState(false)
  const consentAutoOpened = useRef(false)
  const isFirstLoad = useRef(true)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const { data: addrTree } = useQuery({
    queryKey: ['th-address'],
    queryFn: () => fetch('/th-address.json').then(r => r.json()),
    staleTime: Infinity,
  })
  const sortTh = (a: string, b: string) => a.localeCompare(b, 'th')
  const provinceList: string[] = addrTree ? Object.keys(addrTree).sort(sortTh) : []
  const districtList: string[] = (addrTree && form.addrProvince) ? Object.keys(addrTree[form.addrProvince] || {}).sort(sortTh) : []
  const subdistrictList: string[] = (addrTree && form.addrProvince && form.addrDistrict) ? Object.keys(addrTree[form.addrProvince]?.[form.addrDistrict] || {}).sort(sortTh) : []

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        nickname: profile.nickname || '',
        birthDate: profile.birthDate ? profile.birthDate.split('T')[0] : '',
        nationalId: profile.nationalId || '',
        maritalStatus: profile.maritalStatus || 'โสด',
        nationality: profile.nationality || 'ไทย',
        education: profile.education || '',
        educationField: profile.educationField || '',
        occupation: profile.occupation || '',
        jobTitle: profile.jobTitle || '',
        workYears: profile.workYears ?? '',
        salary: profile.salary ?? '',
        salaryIncreaseRate: profile.salaryIncreaseRate ?? '',
        company: profile.company || '',
        address: profile.address || '',
        addrHouseNo: profile.addrHouseNo || '',
        addrSubdistrict: profile.addrSubdistrict || '',
        addrDistrict: profile.addrDistrict || '',
        addrProvince: profile.addrProvince || '',
        addrZipcode: profile.addrZipcode || '',
        phone: profile.phone || '',
        contactEmail: profile.contactEmail || '',
        contactChannel: profile.contactChannel || 'โทรศัพท์',
        hasSocialSecurity: profile.hasSocialSecurity ?? false,
        socialSecurityYears: profile.socialSecurityYears ?? '',
        hasGroupInsurance: profile.hasGroupInsurance ?? false,
        giRoomLimit: profile.giRoomLimit ?? '',
        giMedicalLimit: profile.giMedicalLimit ?? '',
        giSurgeryLimit: profile.giSurgeryLimit ?? '',
        giOpdLimit: profile.giOpdLimit ?? '',
        hasPVD: profile.hasPVD ?? false,
        healthInfo: (profile.healthInfo && typeof profile.healthInfo === 'object') ? { ...defaultForm.healthInfo, ...profile.healthInfo } : defaultForm.healthInfo,
        consent: (profile.consent && typeof profile.consent === 'object') ? { ...defaultForm.consent, ...profile.consent } : defaultForm.consent,
        pvdEmployeeRate: profile.pvdEmployeeRate ?? '',
        pvdEmployerRate: profile.pvdEmployerRate ?? '',
        pvdCurrentValue: profile.pvdCurrentValue ?? '',
        pvdReturnRate: profile.pvdReturnRate ?? '',
        spouseName: profile.spouseName || '',
        spouseAge: profile.spouseAge ?? '',
        spouseOccupation: profile.spouseOccupation || '',
        spouseIncome: profile.spouseIncome ?? '',
        fatherAge: profile.fatherAge ?? '',
        motherAge: profile.motherAge ?? '',
        parentCareExpense: profile.parentCareExpense ?? '',
        dependents: profile.dependents ?? '',
        parentsInfo: (profile.parentsInfo && typeof profile.parentsInfo === 'object')
          ? { ...defaultForm.parentsInfo, ...profile.parentsInfo }
          : defaultForm.parentsInfo,
      })
      setChildren((profile.children || []).map((c: any) => ({ name: c.name || '', age: c.age ?? '', school: c.school || '' })))
      setAdditionalJobs((profile.additionalJobs || []).map((j: any) => ({ occupation: j.occupation || '', jobTitle: j.jobTitle || '', company: j.company || '', workYears: j.workYears ?? '', salary: j.salary ?? '', salaryIncreaseRate: j.salaryIncreaseRate ?? '' })))
      const sj = profile.spouseJobs && profile.spouseJobs.length > 0
        ? profile.spouseJobs.map((j: any) => ({ occupation: j.occupation || '', jobTitle: j.jobTitle || '', company: j.company || '', workYears: j.workYears ?? '', salary: j.salary ?? '', salaryIncreaseRate: j.salaryIncreaseRate ?? '' }))
        : profile.spouseOccupation || profile.spouseIncome
          ? [{ occupation: profile.spouseOccupation || '', jobTitle: '', company: '', workYears: '', salary: profile.spouseIncome ?? '', salaryIncreaseRate: '' }]
          : [emptyJob()]
      setSpouseJobs(sj)
      if (profile.incomeSources?.length) setIncomeSources(profile.incomeSources)
      if (profile.spouseIncomeSources?.length) setSpouseIncomeSources(profile.spouseIncomeSources)
      const sp = (profile.spouseProfile && typeof profile.spouseProfile === 'object') ? profile.spouseProfile : {}
      const migratedName = (profile.spouseName || '').trim().split(/\s+/)
      const next = {
        ...defaultSpouseProfile,
        ...sp,
        firstName: sp.firstName || migratedName[0] || '',
        lastName: sp.lastName || migratedName.slice(1).join(' ') || '',
        healthInfo: { ...defaultHealth(), ...(sp.healthInfo || {}) },
        parentsInfo: { ...defaultSpouseProfile.parentsInfo, ...(sp.parentsInfo || {}) },
      }
      setSpouseProfile(next)
      spouseProfileRef.current = next
      isFirstLoad.current = true
    }
  }, [profile])

  const save = useMutation({
    mutationFn: (payload: { form: typeof defaultForm; children: Child[]; additionalJobs: Job[]; spouseJobs: Job[]; incomeSources: IncomeSource[]; spouseIncomeSources: IncomeSource[] }) =>
      api.put('/client-profile', {
        ...payload.form,
        additionalJobs: payload.additionalJobs.map(j => ({ ...j, workYears: j.workYears !== '' ? Number(j.workYears) : null, salary: j.salary !== '' ? Number(j.salary) : null, salaryIncreaseRate: j.salaryIncreaseRate !== '' ? Number(j.salaryIncreaseRate) : null })),
        spouseJobs: payload.spouseJobs.map(j => ({ ...j, workYears: j.workYears !== '' ? Number(j.workYears) : null, salary: j.salary !== '' ? Number(j.salary) : null, salaryIncreaseRate: j.salaryIncreaseRate !== '' ? Number(j.salaryIncreaseRate) : null })),
        incomeSources: payload.incomeSources,
        spouseIncomeSources: payload.spouseIncomeSources,
        spouseProfile: spouseProfileRef.current,
        spouseOccupation: payload.spouseJobs[0]?.occupation || null,
        spouseIncome: payload.spouseJobs[0]?.salary !== '' ? Number(payload.spouseJobs[0]?.salary) || null : null,
        address: [
          payload.form.addrHouseNo,
          payload.form.addrSubdistrict ? 'ต.' + payload.form.addrSubdistrict : '',
          payload.form.addrDistrict ? 'อ.' + payload.form.addrDistrict : '',
          payload.form.addrProvince ? 'จ.' + payload.form.addrProvince : '',
          payload.form.addrZipcode,
        ].filter(Boolean).join(' ') || payload.form.address,
        birthDate: payload.form.birthDate ? new Date(payload.form.birthDate).toISOString() : null,
        workYears: payload.form.workYears !== '' ? Number(payload.form.workYears) : null,
        salary: payload.form.salary !== '' ? Number(payload.form.salary) : null,
        salaryIncreaseRate: payload.form.salaryIncreaseRate !== '' ? Number(payload.form.salaryIncreaseRate) : null,
        spouseName: `${spouseProfileRef.current.firstName} ${spouseProfileRef.current.lastName}`.trim() || payload.form.spouseName || null,
        spouseAge: spouseProfileRef.current.birthDate
          ? new Date().getFullYear() - new Date(spouseProfileRef.current.birthDate).getFullYear()
          : (payload.form.spouseAge !== '' ? Number(payload.form.spouseAge) : null),
        fatherAge: payload.form.fatherAge !== '' ? Number(payload.form.fatherAge) : null,
        motherAge: payload.form.motherAge !== '' ? Number(payload.form.motherAge) : null,
        parentCareExpense: payload.form.parentCareExpense !== '' ? Number(payload.form.parentCareExpense) : null,
        dependents: payload.form.dependents !== '' ? Number(payload.form.dependents) : null,
        socialSecurityYears: payload.form.socialSecurityYears !== '' ? Number(payload.form.socialSecurityYears) : null,
        giRoomLimit: payload.form.giRoomLimit !== '' ? Number(payload.form.giRoomLimit) : null,
        giMedicalLimit: payload.form.giMedicalLimit !== '' ? Number(payload.form.giMedicalLimit) : null,
        giSurgeryLimit: payload.form.giSurgeryLimit !== '' ? Number(payload.form.giSurgeryLimit) : null,
        giOpdLimit: payload.form.giOpdLimit !== '' ? Number(payload.form.giOpdLimit) : null,
        pvdEmployeeRate: payload.form.pvdEmployeeRate !== '' ? Number(payload.form.pvdEmployeeRate) : null,
        pvdEmployerRate: payload.form.pvdEmployerRate !== '' ? Number(payload.form.pvdEmployerRate) : null,
        pvdCurrentValue: payload.form.pvdCurrentValue !== '' ? Number(payload.form.pvdCurrentValue) : null,
        pvdReturnRate: payload.form.pvdReturnRate !== '' ? Number(payload.form.pvdReturnRate) : null,
        children: payload.children.map(c => ({ name: c.name, age: c.age !== '' ? Number(c.age) : null, school: c.school })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-profile'] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
    onError: (err: any) => {
      console.error('[Save Error]', err?.response?.status, err?.response?.data, err?.message)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 4000)
    },
  })

  const triggerAutoSave = useCallback((newForm: typeof defaultForm, newChildren: Child[], newJobs: Job[], newSpouseJobs: Job[], newIncomeSources?: IncomeSource[], newSpouseIncomeSources?: IncomeSource[]) => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    if (!newForm.phone.trim() || !newForm.contactEmail.trim()) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      setSaveStatus('invalid')
      return
    }
    setSaveStatus('pending')
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setSaveStatus('saving')
      // ถ้าไม่ได้ส่งมาชัดเจน → อ่านค่า "ล่าสุด" จาก ref ตอนยิงจริง (ไม่ใช่ค่าที่ capture ตอนเรียก)
      save.mutate({
        form: newForm, children: newChildren, additionalJobs: newJobs, spouseJobs: newSpouseJobs,
        incomeSources: newIncomeSources ?? incomeSourcesRef.current,
        spouseIncomeSources: newSpouseIncomeSources ?? spouseIncomeSourcesRef.current,
      })
    }, 1500)
  }, [save])

  const BOOL_FIELDS = ['hasSocialSecurity', 'hasGroupInsurance', 'hasPVD']
  const set = (k: string, v: string) => {
    setForm(f => {
      const value = BOOL_FIELDS.includes(k) ? v === 'true' : v
      const next = { ...f, [k]: value }
      triggerAutoSave(next, children, additionalJobs, spouseJobs)
      return next
    })
  }
  // update with autosave (for multi-field / nested updates)
  const setFormSave = (updater: (f: typeof form) => typeof form) => {
    setForm(f => {
      const next = updater(f)
      triggerAutoSave(next, children, additionalJobs, spouseJobs)
      return next
    })
  }
  const setHealth = (k: string, v: any) => setFormSave(f => ({ ...f, healthInfo: { ...(f.healthInfo as any), [k]: v } }))
  const setParent = (k: string, v: any) => setFormSave(f => ({ ...f, parentsInfo: { ...(f.parentsInfo as any), [k]: v } }))

  // --- คู่สมรส: ข้อมูลส่วนตัว (spouseProfile) ---
  const setSp = (k: string, v: string) => {
    setSpouseProfile(p => {
      const value = BOOL_FIELDS.includes(k) ? v === 'true' : v
      const next = { ...p, [k]: value }
      spouseProfileRef.current = next
      triggerAutoSave(form, children, additionalJobs, spouseJobs)
      return next
    })
  }
  const setSpHealth = (k: string, v: any) => {
    setSpouseProfile(p => {
      const next = { ...p, healthInfo: { ...(p.healthInfo as any), [k]: v } }
      spouseProfileRef.current = next
      triggerAutoSave(form, children, additionalJobs, spouseJobs)
      return next
    })
  }
  const setSpParent = (k: string, v: any) => {
    setSpouseProfile(p => {
      const next = { ...p, parentsInfo: { ...(p.parentsInfo as any), [k]: v } }
      spouseProfileRef.current = next
      triggerAutoSave(form, children, additionalJobs, spouseJobs)
      return next
    })
  }

  // auto-open consent popup once when name + address are filled but not yet signed
  useEffect(() => {
    if (consentAutoOpened.current) return
    const c: any = form.consent
    if (form.firstName && form.addrProvince && form.addrHouseNo && c && !c.signedAt) {
      setShowConsent(true); consentAutoOpened.current = true
    }
  }, [form.firstName, form.addrProvince, form.addrHouseNo, form.consent])

  const addChild = () => {
    setChildren(c => {
      const next = [...c, { name: '', age: '', school: '' }]
      triggerAutoSave(form, next, additionalJobs, spouseJobs)
      return next
    })
  }

  const removeChild = (i: number) => {
    setChildren(c => {
      const next = c.filter((_, idx) => idx !== i)
      triggerAutoSave(form, next, additionalJobs, spouseJobs)
      return next
    })
  }

  const setChild = (i: number, k: keyof Child, v: string) => {
    setChildren(c => {
      const next = c.map((ch, idx) => idx === i ? { ...ch, [k]: v } : ch)
      triggerAutoSave(form, next, additionalJobs, spouseJobs)
      return next
    })
  }

  const addJob = () => {
    setAdditionalJobs(j => {
      const next = [...j, emptyJob()]
      triggerAutoSave(form, children, next, spouseJobs)
      return next
    })
  }

  const removeJob = (i: number) => {
    setAdditionalJobs(j => {
      const next = j.filter((_, idx) => idx !== i)
      triggerAutoSave(form, children, next, spouseJobs)
      return next
    })
  }

  const setJob = (i: number, k: keyof Job, v: string) => {
    setAdditionalJobs(j => {
      const next = j.map((jj, idx) => idx === i ? { ...jj, [k]: v } : jj)
      triggerAutoSave(form, children, next, spouseJobs)
      return next
    })
  }

  const addSpouseJob = () => {
    setSpouseJobs(j => {
      const next = [...j, emptyJob()]
      triggerAutoSave(form, children, additionalJobs, next)
      return next
    })
  }

  const removeSpouseJob = (i: number) => {
    setSpouseJobs(j => {
      const next = j.filter((_, idx) => idx !== i)
      triggerAutoSave(form, children, additionalJobs, next)
      return next
    })
  }

  const setSpouseJob = (i: number, k: keyof Job, v: string) => {
    setSpouseJobs(j => {
      const next = j.map((jj, idx) => idx === i ? { ...jj, [k]: v } : jj)
      triggerAutoSave(form, children, additionalJobs, next)
      return next
    })
  }

  // สร้างบรรทัด "เงินเดือน" หนึ่งบรรทัดต่ออาชีพ (อาชีพหลัก + อาชีพเสริมแต่ละอาชีพ) — แยกกัน ไม่รวมยอด
  const num = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
  const jobLabel = (j: { occupation?: string; jobTitle?: string; company?: string }) =>
    j.jobTitle?.trim() || j.occupation?.trim() || j.company?.trim() || ''

  useEffect(() => {
    const jobs = [{ occupation: form.occupation, jobTitle: form.jobTitle, company: form.company, salary: form.salary }, ...additionalJobs]
    const salaryRows: IncomeSource[] = jobs
      .filter(j => num(j.salary) > 0)
      .map(j => ({ label: 'เงินเดือน', source: jobLabel(j), amount: String(num(j.salary)) }))
    setIncomeSources(s => {
      const nonSalary = s.filter(r => r.label !== 'เงินเดือน')
      const next = [...salaryRows, ...nonSalary]
      // เทียบว่าเปลี่ยนจริงไหม กันลูป
      if (JSON.stringify(next) === JSON.stringify(s)) return s
      return next
    })
  }, [form.salary, form.occupation, form.jobTitle, form.company, additionalJobs])

  // เช่นเดียวกันสำหรับคู่สมรส
  useEffect(() => {
    const salaryRows: IncomeSource[] = spouseJobs
      .filter(j => num(j.salary) > 0)
      .map(j => ({ label: 'เงินเดือน', source: jobLabel(j), amount: String(num(j.salary)) }))
    setSpouseIncomeSources(s => {
      const nonSalary = s.filter(r => r.label !== 'เงินเดือน')
      const next = [...salaryRows, ...nonSalary]
      if (JSON.stringify(next) === JSON.stringify(s)) return s
      return next
    })
  }, [spouseJobs])

  const setIS = (i: number, k: keyof IncomeSource, v: string) => {
    setIncomeSources(s => {
      const next = s.map((row, idx) => idx === i ? { ...row, [k]: v } : row)
      triggerAutoSave(form, children, additionalJobs, spouseJobs, next)
      return next
    })
  }
  const addIS = () => {
    setIncomeSources(s => {
      const next = [...s, emptyIncomeSource()]
      triggerAutoSave(form, children, additionalJobs, spouseJobs, next)
      return next
    })
  }
  const removeIS = (i: number) => {
    setIncomeSources(s => {
      const next = s.filter((_, idx) => idx !== i)
      triggerAutoSave(form, children, additionalJobs, spouseJobs, next)
      return next
    })
  }

  const setSpouseIS = (i: number, k: keyof IncomeSource, v: string) => {
    setSpouseIncomeSources(s => {
      const next = s.map((row, idx) => idx === i ? { ...row, [k]: v } : row)
      triggerAutoSave(form, children, additionalJobs, spouseJobs, incomeSources, next)
      return next
    })
  }
  const addSpouseIS = () => {
    setSpouseIncomeSources(s => {
      const next = [...s, emptyIncomeSource()]
      triggerAutoSave(form, children, additionalJobs, spouseJobs, incomeSources, next)
      return next
    })
  }
  const removeSpouseIS = (i: number) => {
    setSpouseIncomeSources(s => {
      const next = s.filter((_, idx) => idx !== i)
      triggerAutoSave(form, children, additionalJobs, spouseJobs, incomeSources, next)
      return next
    })
  }

  const hasSpouse = form.maritalStatus === 'สมรส'

  const showPersonToggle = tab === 'personal' || tab === 'investment' || tab === 'goals' || tab === 'finance'
  const isSigned = !!(form.consent as any)?.signedAt

  return (
    <div>
      {/* ปุ่มสลับลูกค้า/คู่สมรส + ชิป PDPA → ย้ายไปแสดงบน topbar (portal) */}
      {topSlot && createPortal(
        <>
          {showPersonToggle && (
            <div style={{ display: 'inline-flex', gap: 3, background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 9, padding: 3 }}>
              {([
                ['client', form.firstName ? `คุณ${form.firstName}` : 'ลูกค้า'],
                ['spouse', (spouseProfile.firstName) ? `คุณ${spouseProfile.firstName}` : 'คู่สมรส'],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setPerson(val)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: person === val ? 600 : 400,
                    background: person === val ? 'var(--cyan-dim)' : 'transparent',
                    color: person === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                  {val === 'client' ? <User size={13} /> : <Users size={13} />}{label}
                </button>
              ))}
            </div>
          )}
          {isSigned && (
            <button onClick={() => setShowConsent(true)}
              title={`ลงนามยินยอม PDPA แล้ว โดย ${(form.consent as any).signedName} เมื่อ ${new Date((form.consent as any).signedAt).toLocaleString('th-TH')} — คลิกเพื่อดู/ลงนามใหม่`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 999, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: 11.5, cursor: 'pointer' }}>
              <CheckCircle size={12} /> ลงนาม PDPA แล้ว
            </button>
          )}
        </>, topSlot)}

      <div style={{ marginBottom: 24 }}>
        <PageHeader icon={IdCard} title="ข้อมูลลูกค้า" subtitle="บันทึกข้อมูลส่วนบุคคลสำหรับใช้ในการวางแผนการเงิน" />
      </div>

      {/* ยังไม่ลงนาม → แสดงแบนเนอร์เตือนในหน้า (เซ็นแล้ว = ชิปบน topbar) */}
      {!isSigned && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}>
          <AlertCircle size={16} color="#f59e0b" />
          <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ยังไม่ได้ลงนามยินยอม PDPA / เงื่อนไขการให้บริการ</span>
          <button onClick={() => setShowConsent(true)} style={{ marginLeft: 'auto', padding: '5px 14px', background: 'var(--cyan)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>ลงนามยินยอม</button>
        </div>
      )}

      {showConsent && (
        <ConsentModal
          consent={form.consent}
          clientName={`${form.firstName} ${form.lastName}`.trim()}
          onClose={() => setShowConsent(false)}
          onSave={c => { setFormSave(f => ({ ...f, consent: c })); setShowConsent(false) }}
        />
      )}

      {/* แท็บย้ายไปเป็นเมนูย่อยใน sidebar แล้ว (ขับด้วย ?tab=) */}

      {/* Personal Tab */}
      {tab === 'personal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {person === 'spouse' && !hasSpouse && (
            <span style={{ fontSize: 12, color: '#f59e0b' }}>* สถานภาพยังไม่ใช่ "สมรส" (เปลี่ยนได้ที่ข้อมูลลูกค้า)</span>
          )}

          {person === 'client' && (<>

          {/* General Info */}
          <div style={card}>
            <SectionTitle icon={User} title="ข้อมูลทั่วไป" sub="ข้อมูลประจำตัวของลูกค้า" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Grid cols={3}>
                <Field label="ชื่อ" required><input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="ชื่อ" style={inp} /></Field>
                <Field label="นามสกุล" required><input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="นามสกุล" style={inp} /></Field>
                <Field label="ชื่อเล่น"><input value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="ชื่อเล่น" style={inp} /></Field>
              </Grid>
              <Grid cols={3}>
                <Field label="วันเดือนปีเกิด"><input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)} style={inp} /></Field>
                <Field label="อายุปัจจุบัน">
                  <div style={{ ...inp, background: 'var(--divider)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    {form.birthDate ? `${new Date().getFullYear() - new Date(form.birthDate).getFullYear()} ปี` : '— ปี'}
                  </div>
                </Field>
                <Field label="เลขบัตรประชาชน"><input value={form.nationalId} onChange={e => set('nationalId', e.target.value)} placeholder="x-xxxx-xxxxx-xx-x" maxLength={13} style={inp} /></Field>
              </Grid>
              <Grid cols={3}>
                <Field label="สถานภาพสมรส">
                  <select value={form.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} style={sel}>
                    {MARITAL.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="สัญชาติ"><input value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="ไทย" style={inp} /></Field>
                <Field label="ช่องทางติดต่อหลัก">
                  <select value={form.contactChannel} onChange={e => set('contactChannel', e.target.value)} style={sel}>
                    {CONTACT_CH.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </Grid>
              <Grid cols={2}>
                <Field label="เบอร์โทรศัพท์" required>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08x-xxx-xxxx"
                    style={{ ...inp, borderColor: saveStatus === 'invalid' && !form.phone.trim() ? '#f43f5e' : undefined }} />
                  {saveStatus === 'invalid' && !form.phone.trim() && (
                    <span style={{ fontSize: 11, color: '#f43f5e', marginTop: 4, display: 'block' }}>กรุณากรอกเบอร์โทรศัพท์</span>
                  )}
                </Field>
                <Field label="Email" required>
                  <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="email@example.com"
                    style={{ ...inp, borderColor: saveStatus === 'invalid' && !form.contactEmail.trim() ? '#f43f5e' : undefined }} />
                  {saveStatus === 'invalid' && !form.contactEmail.trim() && (
                    <span style={{ fontSize: 11, color: '#f43f5e', marginTop: 4, display: 'block' }}>กรุณากรอก Email</span>
                  )}
                </Field>
              </Grid>
              <Field label="ที่อยู่ปัจจุบัน">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="เลขที่ / หมู่ / ถนน">
                    <input value={form.addrHouseNo} onChange={e => set('addrHouseNo', e.target.value)} placeholder="เช่น 199/78 หมู่ 1 ถ.มิตรภาพ" style={inp} />
                  </Field>
                  <Grid cols={2}>
                    <Field label="จังหวัด">
                      <select value={form.addrProvince} style={sel}
                        onChange={e => setFormSave(f => ({ ...f, addrProvince: e.target.value, addrDistrict: '', addrSubdistrict: '', addrZipcode: '' }))}>
                        <option value="">— เลือกจังหวัด —</option>
                        {provinceList.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="อำเภอ / เขต">
                      <select value={form.addrDistrict} disabled={!form.addrProvince} style={{ ...sel, opacity: form.addrProvince ? 1 : 0.5 }}
                        onChange={e => setFormSave(f => ({ ...f, addrDistrict: e.target.value, addrSubdistrict: '', addrZipcode: '' }))}>
                        <option value="">— เลือกอำเภอ/เขต —</option>
                        {districtList.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </Field>
                    <Field label="ตำบล / แขวง">
                      <select value={form.addrSubdistrict} disabled={!form.addrDistrict} style={{ ...sel, opacity: form.addrDistrict ? 1 : 0.5 }}
                        onChange={e => {
                          const sub = e.target.value
                          const zip = addrTree?.[form.addrProvince]?.[form.addrDistrict]?.[sub] || ''
                          setFormSave(f => ({ ...f, addrSubdistrict: sub, addrZipcode: zip }))
                        }}>
                        <option value="">— เลือกตำบล/แขวง —</option>
                        {subdistrictList.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="รหัสไปรษณีย์">
                      <input value={form.addrZipcode} readOnly placeholder="อัตโนมัติ" style={{ ...inp, background: 'var(--navy-800)', color: 'var(--cyan)' }} />
                    </Field>
                  </Grid>
                  <Field label="ประเทศ">
                    <input value="ไทย" readOnly style={{ ...inp, background: 'var(--navy-800)' }} />
                  </Field>
                </div>
              </Field>
            </div>
          </div>

          {/* Education */}
          <div style={card}>
            <SectionTitle icon={GraduationCap} accent="#ffb800" title="ข้อมูลการศึกษา" sub="ระดับการศึกษาสูงสุด" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Grid cols={2}>
                <Field label="ระดับการศึกษา">
                  <select value={form.education} onChange={e => set('education', e.target.value)} style={sel}>
                    <option value="">— กรุณาเลือก —</option>
                    {EDUCATION_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </Field>
                <Field label="สาขาวิชา">
                  <input value={form.educationField} onChange={e => set('educationField', e.target.value)}
                    placeholder="เช่น บริหารธุรกิจ, วิศวกรรมคอมพิวเตอร์" style={inp} />
                </Field>
              </Grid>
              {(form.education || form.educationField) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎓</div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>การศึกษา</div>
                    <div style={{ fontSize: 13, color: 'var(--cyan-light)', fontWeight: 500 }}>
                      {form.education || '—'}{form.educationField ? ` · ${form.educationField}` : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Work Info */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={18} color="var(--cyan)" />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ข้อมูลการทำงาน</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{1 + additionalJobs.length} อาชีพ</p>
                </div>
              </div>
              <button onClick={addJob} style={btn()}><Plus size={14} />เพิ่มอาชีพ</button>
            </div>

            {/* Primary job */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, marginBottom: additionalJobs.length ? 12 : 0 }}>
              <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>อาชีพหลัก</div>
              <Grid cols={2}>
                <Field label="อาชีพ"><input value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="เช่น พนักงานเอกชน" style={inp} /></Field>
                <Field label="ตำแหน่งงาน"><input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="เช่น Senior Engineer" style={inp} /></Field>
              </Grid>
              <Field label="บริษัทที่ทำงาน"><input value={form.company} onChange={e => set('company', e.target.value)} placeholder="ชื่อบริษัท" style={inp} /></Field>
              <Grid cols={3}>
                <Field label="อายุงาน (ปี)"><input type="number" value={form.workYears} onChange={e => set('workYears', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                <Field label="เงินเดือนปัจจุบัน (บาท)"><CommaInput value={form.salary} onChange={v => set('salary', v)} placeholder="เช่น 50,000" style={inp} /></Field>
                <Field label="เงินเดือนเพิ่มขึ้นปีละ (%)"><input type="number" value={form.salaryIncreaseRate} onChange={e => set('salaryIncreaseRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
              </Grid>
            </div>

            {/* Additional jobs */}
            {additionalJobs.map((j, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, marginBottom: i < additionalJobs.length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>อาชีพที่ {i + 2}</span>
                  <button onClick={() => removeJob(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={14} /></button>
                </div>
                <Grid cols={2}>
                  <Field label="อาชีพ"><input value={j.occupation} onChange={e => setJob(i, 'occupation', e.target.value)} placeholder="เช่น ธุรกิจส่วนตัว" style={inp} /></Field>
                  <Field label="ตำแหน่งงาน"><input value={j.jobTitle} onChange={e => setJob(i, 'jobTitle', e.target.value)} placeholder="เช่น เจ้าของกิจการ" style={inp} /></Field>
                </Grid>
                <Field label="บริษัท / ชื่อกิจการ"><input value={j.company} onChange={e => setJob(i, 'company', e.target.value)} placeholder="ชื่อบริษัทหรือกิจการ" style={inp} /></Field>
                <Grid cols={3}>
                  <Field label="อายุงาน (ปี)"><input type="number" value={j.workYears} onChange={e => setJob(i, 'workYears', e.target.value)} placeholder="เช่น 3" style={inp} /></Field>
                  <Field label="รายได้ (บาท/เดือน)"><CommaInput value={j.salary} onChange={v => setJob(i, 'salary', v)} placeholder="เช่น 20,000" style={inp} /></Field>
                  <Field label="รายได้เพิ่มขึ้นปีละ (%)"><input type="number" value={j.salaryIncreaseRate} onChange={e => setJob(i, 'salaryIncreaseRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                </Grid>
              </div>
            ))}
          </div>

          {/* Income Sources */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} color="var(--cyan)" />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ที่มาของรายได้</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>รายได้ทุกแหล่งต่อเดือน (บาท)</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <TableExcelButton filename="ที่มาของรายได้" title="รายได้" />
                <button onClick={addIS} style={btn()}><Plus size={14} />เพิ่มรายได้</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ที่มาของรายได้</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>แหล่งที่มา</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>จำนวน (บาท/เดือน)</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>รายได้ทั้งปี (บาท)</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {incomeSources.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <select
                        value={INCOME_SOURCE_LABELS.includes(row.label) ? row.label : 'อื่นๆ'}
                        onChange={e => setIS(i, 'label', e.target.value)}
                        style={{ ...sel, fontSize: 12, padding: '5px 8px', width: 200 }}
                      >
                        {INCOME_SOURCE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {row.label === 'เงินเดือน'
                        ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.source || '—'}</span>
                        : <input
                            value={row.source}
                            onChange={e => setIS(i, 'source', e.target.value)}
                            placeholder="ระบุแหล่งที่มา..."
                            style={{ ...inp, fontSize: 12, width: '100%', boxSizing: 'border-box' }}
                          />
                      }
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {row.label === 'เงินเดือน' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <span style={{ fontSize: 10, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>ดึงจากข้อมูลการทำงาน</span>
                          <div style={{ ...inp, fontSize: 12, textAlign: 'right', width: 160, background: 'var(--divider)', color: 'var(--text-secondary)', cursor: 'default', userSelect: 'none' }}>
                            {row.amount !== '' ? Number(row.amount).toLocaleString('th-TH') : '—'}
                          </div>
                        </div>
                      ) : (
                        <CommaInput
                          value={row.amount}
                          onChange={v => setIS(i, 'amount', v)}
                          placeholder="0"
                          style={{ ...inp, fontSize: 12, textAlign: 'right', width: 160 }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(() => {
                        if (row.label === 'โบนัส') {
                          const amt = parseFloat(row.amount) || 0
                          return amt > 0
                            ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(amt)}</span>
                            : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        }
                        const monthly = parseFloat(row.amount) || 0
                        const yearly = monthly * 12
                        return monthly > 0
                          ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(yearly)}</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      })()}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {incomeSources.length > 1 && (
                        <button onClick={() => removeIS(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const total = incomeSources.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                  return (
                    <tr style={{ borderTop: '2px solid var(--card-border)', background: 'var(--hover)' }}>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>รายได้รวม</td>
                      <td />
                      <td style={{ padding: '10px 10px', fontSize: 15, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>
                        {total > 0 ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(total) + ' บาท' : '—'}
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 15, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>
                        {(() => {
                          const totalYearly = incomeSources.reduce((s, r) => {
                            const amt = parseFloat(r.amount) || 0
                            return s + (r.label === 'โบนัส' ? amt : amt * 12)
                          }, 0)
                          return totalYearly > 0 ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(totalYearly) + ' บาท' : '—'
                        })()}
                      </td>
                      <td />
                    </tr>
                  )
                })()}
              </tfoot>
            </table>
          </div>

          {/* Welfare */}
          <div style={card}>
            <SectionTitle icon={Briefcase} accent="#10b981" title="สวัสดิการที่มี" sub="สวัสดิการจากนายจ้างและกองทุน" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Social Security */}
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>ประกันสังคม</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => set('hasSocialSecurity', String(val))}
                        style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                          borderColor: form.hasSocialSecurity === val ? 'var(--cyan)' : 'var(--card-border)',
                          background: form.hasSocialSecurity === val ? 'var(--cyan-dim)' : 'transparent',
                          color: form.hasSocialSecurity === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                        {val ? 'มี' : 'ไม่มี'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.hasSocialSecurity && (
                  <div style={{ paddingLeft: 156 }}>
                    <Field label="เป็นสมาชิกมาแล้ว (ปี)">
                      <input type="number" value={form.socialSecurityYears} onChange={e => set('socialSecurityYears', e.target.value)}
                        placeholder="เช่น 5" style={{ ...inp, maxWidth: 180 }} />
                    </Field>
                  </div>
                )}
              </div>

              {/* Group Insurance */}
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>ประกันสุขภาพกลุ่ม</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => set('hasGroupInsurance', String(val))}
                        style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                          borderColor: form.hasGroupInsurance === val ? 'var(--cyan)' : 'var(--card-border)',
                          background: form.hasGroupInsurance === val ? 'var(--cyan-dim)' : 'transparent',
                          color: form.hasGroupInsurance === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                        {val ? 'มี' : 'ไม่มี'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.hasGroupInsurance && (
                  <div style={{ paddingLeft: 156 }}>
                    <Grid cols={2}>
                      <Field label="วงเงินค่าห้อง (บาท/คืน)"><input type="number" value={form.giRoomLimit} onChange={e => set('giRoomLimit', e.target.value)} placeholder="เช่น 3000" style={inp} /></Field>
                      <Field label="วงเงินค่ารักษา (บาท/ครั้ง)"><input type="number" value={form.giMedicalLimit} onChange={e => set('giMedicalLimit', e.target.value)} placeholder="เช่น 100000" style={inp} /></Field>
                      <Field label="วงเงินค่าผ่าตัด (บาท/ครั้ง)"><input type="number" value={form.giSurgeryLimit} onChange={e => set('giSurgeryLimit', e.target.value)} placeholder="เช่น 200000" style={inp} /></Field>
                      <Field label="วงเงิน OPD (บาท/ครั้ง)"><input type="number" value={form.giOpdLimit} onChange={e => set('giOpdLimit', e.target.value)} placeholder="เช่น 1000" style={inp} /></Field>
                    </Grid>
                  </div>
                )}
              </div>

              {/* PVD */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>กองทุนสำรองเลี้ยงชีพ</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => set('hasPVD', String(val))}
                        style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                          borderColor: form.hasPVD === val ? 'var(--cyan)' : 'var(--card-border)',
                          background: form.hasPVD === val ? 'var(--cyan-dim)' : 'transparent',
                          color: form.hasPVD === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                        {val ? 'มี' : 'ไม่มี'}
                      </button>
                    ))}
                  </div>
                </div>
                {form.hasPVD && (
                  <div style={{ paddingLeft: 156 }}>
                    <Grid cols={2}>
                      <Field label="อัตราสะสมส่วนลูกจ้าง (%)"><input type="number" value={form.pvdEmployeeRate} onChange={e => set('pvdEmployeeRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                      <Field label="อัตราสมทบส่วนนายจ้าง (%)"><input type="number" value={form.pvdEmployerRate} onChange={e => set('pvdEmployerRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                    </Grid>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Health Info */}
          <div style={card}>
            <SectionTitle icon={HeartPulse} accent="#f472b6" title="ข้อมูลสุขภาพ" sub="ประวัติสุขภาพและประวัติครอบครัว" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <HealthChoice label="สูบบุหรี่" value={(form.healthInfo as any).smoke} options={['ไม่สูบ', 'สูบ', 'บางครั้ง']} onChange={v => setHealth('smoke', v)} />
              <HealthChoice label="ดื่มสุรา" value={(form.healthInfo as any).alcohol} options={['ไม่ดื่ม', 'ดื่ม', 'บางครั้ง']} onChange={v => setHealth('alcohol', v)} />
              <HealthItem label="โรคประจำตัว" value={(form.healthInfo as any).chronic} onChange={v => setHealth('chronic', v)} />
              <HealthItem label="ประวัติการเจ็บป่วยรุนแรง" value={(form.healthInfo as any).severeIllness} onChange={v => setHealth('severeIllness', v)} />
              <HealthItem label="ประวัติการเข้ารับการผ่าตัด" value={(form.healthInfo as any).surgery} onChange={v => setHealth('surgery', v)} />
              <HealthItem label="ประวัติการรักษาตัวใน รพ." value={(form.healthInfo as any).hospitalized} onChange={v => setHealth('hospitalized', v)} yes="เคย" no="ไม่เคย" placeholder="โปรดระบุโรค" />
              <HealthItem label="รพ.ประจำที่ท่านรักษาตัว" value={(form.healthInfo as any).regularHospital} onChange={v => setHealth('regularHospital', v)} placeholder="โปรดระบุชื่อ รพ." />
              <HealthItem label="เคยถูกบริษัทประกันภัยปฏิเสธ/เลื่อน/เพิ่มเบี้ย" value={(form.healthInfo as any).insuranceRejected} onChange={v => setHealth('insuranceRejected', v)} yes="เคย" no="ไม่เคย" placeholder="โปรดระบุสาเหตุ" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', margin: '14px 0 4px' }}>ประวัติการเจ็บป่วยร้ายแรงของบุคคลในครอบครัว</div>
              <HealthItem label="พ่อ / แม่" value={(form.healthInfo as any).familyParents} onChange={v => setHealth('familyParents', v)} />
              <HealthItem label="ปู่ / ย่า" value={(form.healthInfo as any).familyGrandPaternal} onChange={v => setHealth('familyGrandPaternal', v)} />
              <HealthItem label="ตา / ยาย" value={(form.healthInfo as any).familyGrandMaternal} onChange={v => setHealth('familyGrandMaternal', v)} />
            </div>
          </div>

          {/* Hobby / Activity */}
          <div style={card}>
            <SectionTitle icon={Dumbbell} accent="#22c55e" title="งานอดิเรก / กิจกรรม" sub="กิจกรรมยามว่าง กีฬา ความสนใจ" />
            <HealthItem label="มีงานอดิเรก / กิจกรรมที่ทำเป็นประจำ" value={(form.healthInfo as any).hobby} onChange={v => setHealth('hobby', v)} yes="มี" no="ไม่มี" placeholder="ระบุ เช่น วิ่งมาราธอน ท่องเที่ยว ปั่นจักรยาน" />
          </div>

          </>)}

          {person === 'spouse' && (<>

          {/* Spouse General Info */}
          <div style={card}>
            <SectionTitle icon={Users} title="ข้อมูลทั่วไป (คู่สมรส)" sub="ข้อมูลประจำตัวของคู่สมรส" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Grid cols={3}>
                <Field label="ชื่อ"><input value={spouseProfile.firstName} onChange={e => setSp('firstName', e.target.value)} placeholder="ชื่อ" style={inp} /></Field>
                <Field label="นามสกุล"><input value={spouseProfile.lastName} onChange={e => setSp('lastName', e.target.value)} placeholder="นามสกุล" style={inp} /></Field>
                <Field label="ชื่อเล่น"><input value={spouseProfile.nickname} onChange={e => setSp('nickname', e.target.value)} placeholder="ชื่อเล่น" style={inp} /></Field>
              </Grid>
              <Grid cols={3}>
                <Field label="วันเดือนปีเกิด"><input type="date" value={spouseProfile.birthDate} onChange={e => setSp('birthDate', e.target.value)} style={inp} /></Field>
                <Field label="อายุปัจจุบัน">
                  <div style={{ ...inp, background: 'var(--divider)', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    {spouseProfile.birthDate ? `${new Date().getFullYear() - new Date(spouseProfile.birthDate).getFullYear()} ปี` : '— ปี'}
                  </div>
                </Field>
                <Field label="เลขบัตรประชาชน"><input value={spouseProfile.nationalId} onChange={e => setSp('nationalId', e.target.value)} placeholder="x-xxxx-xxxxx-xx-x" maxLength={13} style={inp} /></Field>
              </Grid>
              <Grid cols={3}>
                <Field label="สัญชาติ"><input value={spouseProfile.nationality} onChange={e => setSp('nationality', e.target.value)} placeholder="ไทย" style={inp} /></Field>
                <Field label="ช่องทางติดต่อหลัก">
                  <select value={spouseProfile.contactChannel} onChange={e => setSp('contactChannel', e.target.value)} style={sel}>
                    {CONTACT_CH.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="เบอร์โทรศัพท์"><input value={spouseProfile.phone} onChange={e => setSp('phone', e.target.value)} placeholder="08x-xxx-xxxx" style={inp} /></Field>
              </Grid>
              <Grid cols={2}>
                <Field label="Email"><input type="email" value={spouseProfile.contactEmail} onChange={e => setSp('contactEmail', e.target.value)} placeholder="email@example.com" style={inp} /></Field>
              </Grid>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--hover)', borderRadius: 8 }}>
                ที่อยู่ใช้ร่วมกับลูกค้า (ดูได้ที่มุมมอง "ลูกค้า")
              </div>
            </div>
          </div>

          {/* Spouse Education */}
          <div style={card}>
            <SectionTitle icon={GraduationCap} accent="#ffb800" title="ข้อมูลการศึกษา (คู่สมรส)" sub="ระดับการศึกษาสูงสุด" />
            <Grid cols={2}>
              <Field label="ระดับการศึกษา">
                <select value={spouseProfile.education} onChange={e => setSp('education', e.target.value)} style={sel}>
                  <option value="">— กรุณาเลือก —</option>
                  {EDUCATION_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              <Field label="สาขาวิชา"><input value={spouseProfile.educationField} onChange={e => setSp('educationField', e.target.value)} placeholder="เช่น บริหารธุรกิจ" style={inp} /></Field>
            </Grid>
          </div>

          {/* Spouse Work Info */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={18} color="var(--cyan)" /></div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ข้อมูลการทำงาน (คู่สมรส)</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{spouseJobs.length} อาชีพ</p>
                </div>
              </div>
              <button onClick={addSpouseJob} style={btn()}><Plus size={14} />เพิ่มอาชีพ</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {spouseJobs.map((j, i) => (
                <div key={i} style={{ background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>{i === 0 ? 'อาชีพหลัก' : `อาชีพที่ ${i + 1}`}</span>
                    {i > 0 && <button onClick={() => removeSpouseJob(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={14} /></button>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Grid cols={2}>
                      <Field label="อาชีพ"><input value={j.occupation} onChange={e => setSpouseJob(i, 'occupation', e.target.value)} placeholder="เช่น พนักงานเอกชน" style={inp} /></Field>
                      <Field label="ตำแหน่งงาน"><input value={j.jobTitle} onChange={e => setSpouseJob(i, 'jobTitle', e.target.value)} placeholder="เช่น ครู" style={inp} /></Field>
                    </Grid>
                    <Field label="บริษัท / สถานที่ทำงาน"><input value={j.company} onChange={e => setSpouseJob(i, 'company', e.target.value)} placeholder="ชื่อบริษัทหรือสถานที่ทำงาน" style={inp} /></Field>
                    <Grid cols={3}>
                      <Field label="อายุงาน (ปี)"><input type="number" value={j.workYears} onChange={e => setSpouseJob(i, 'workYears', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                      <Field label="เงินเดือน/รายได้ (บาท/เดือน)"><CommaInput value={j.salary} onChange={v => setSpouseJob(i, 'salary', v)} placeholder="เช่น 40,000" style={inp} /></Field>
                      <Field label="รายได้เพิ่มขึ้นปีละ (%)"><input type="number" value={j.salaryIncreaseRate} onChange={e => setSpouseJob(i, 'salaryIncreaseRate', e.target.value)} placeholder="เช่น 3" style={inp} /></Field>
                    </Grid>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spouse Income Sources */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={18} color="var(--cyan)" /></div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ที่มาของรายได้ (คู่สมรส)</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>รายได้ทุกแหล่งต่อเดือน (บาท)</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <TableExcelButton filename="ที่มาของรายได้-คู่สมรส" title="รายได้คู่สมรส" />
                <button onClick={addSpouseIS} style={btn()}><Plus size={14} />เพิ่มรายได้</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ที่มาของรายได้</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>แหล่งที่มา</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>จำนวน (บาท/เดือน)</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>รายได้ทั้งปี (บาท)</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {spouseIncomeSources.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={INCOME_SOURCE_LABELS.includes(row.label) ? row.label : 'อื่นๆ'} onChange={e => setSpouseIS(i, 'label', e.target.value)} style={{ ...sel, fontSize: 12, padding: '5px 8px', width: 200 }}>
                        {INCOME_SOURCE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {row.label === 'เงินเดือน'
                        ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.source || '—'}</span>
                        : <input value={row.source} onChange={e => setSpouseIS(i, 'source', e.target.value)} placeholder="ระบุแหล่งที่มา..." style={{ ...inp, fontSize: 12, width: '100%', boxSizing: 'border-box' }} />}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                      {row.label === 'เงินเดือน' ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                          <span style={{ fontSize: 10, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>ดึงจากข้อมูลการทำงาน</span>
                          <div style={{ ...inp, fontSize: 12, textAlign: 'right', width: 160, background: 'var(--divider)', color: 'var(--text-secondary)', cursor: 'default', userSelect: 'none' }}>
                            {row.amount !== '' ? Number(row.amount).toLocaleString('th-TH') : '—'}
                          </div>
                        </div>
                      ) : (
                        <CommaInput value={row.amount} onChange={v => setSpouseIS(i, 'amount', v)} placeholder="0" style={{ ...inp, fontSize: 12, textAlign: 'right', width: 160 }} />
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const amt = parseFloat(row.amount) || 0
                        if (row.label === 'โบนัส') return amt > 0 ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(amt)}</span> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                        return amt > 0 ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(amt * 12)}</span> : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      })()}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {spouseIncomeSources.length > 1 && (
                        <button onClick={() => removeSpouseIS(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const total = spouseIncomeSources.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
                  const totalYearly = spouseIncomeSources.reduce((s, r) => { const amt = parseFloat(r.amount) || 0; return s + (r.label === 'โบนัส' ? amt : amt * 12) }, 0)
                  return (
                    <tr style={{ borderTop: '2px solid var(--card-border)', background: 'var(--hover)' }}>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>รายได้รวม</td>
                      <td />
                      <td style={{ padding: '10px 10px', fontSize: 15, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{total > 0 ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(total) + ' บาท' : '—'}</td>
                      <td style={{ padding: '10px 10px', fontSize: 15, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{totalYearly > 0 ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(totalYearly) + ' บาท' : '—'}</td>
                      <td />
                    </tr>
                  )
                })()}
              </tfoot>
            </table>
          </div>

          {/* Spouse Welfare */}
          <div style={card}>
            <SectionTitle icon={Briefcase} accent="#10b981" title="สวัสดิการที่มี (คู่สมรส)" sub="สวัสดิการจากนายจ้างและกองทุน" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>ประกันสังคม</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setSp('hasSocialSecurity', String(val))} style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', borderColor: spouseProfile.hasSocialSecurity === val ? 'var(--cyan)' : 'var(--card-border)', background: spouseProfile.hasSocialSecurity === val ? 'var(--cyan-dim)' : 'transparent', color: spouseProfile.hasSocialSecurity === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{val ? 'มี' : 'ไม่มี'}</button>
                    ))}
                  </div>
                </div>
                {spouseProfile.hasSocialSecurity && (
                  <div style={{ paddingLeft: 156 }}>
                    <Field label="เป็นสมาชิกมาแล้ว (ปี)"><input type="number" value={spouseProfile.socialSecurityYears} onChange={e => setSp('socialSecurityYears', e.target.value)} placeholder="เช่น 5" style={{ ...inp, maxWidth: 180 }} /></Field>
                  </div>
                )}
              </div>
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>ประกันสุขภาพกลุ่ม</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setSp('hasGroupInsurance', String(val))} style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', borderColor: spouseProfile.hasGroupInsurance === val ? 'var(--cyan)' : 'var(--card-border)', background: spouseProfile.hasGroupInsurance === val ? 'var(--cyan-dim)' : 'transparent', color: spouseProfile.hasGroupInsurance === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{val ? 'มี' : 'ไม่มี'}</button>
                    ))}
                  </div>
                </div>
                {spouseProfile.hasGroupInsurance && (
                  <div style={{ paddingLeft: 156 }}>
                    <Grid cols={2}>
                      <Field label="วงเงินค่าห้อง (บาท/คืน)"><input type="number" value={spouseProfile.giRoomLimit} onChange={e => setSp('giRoomLimit', e.target.value)} placeholder="เช่น 3000" style={inp} /></Field>
                      <Field label="วงเงินค่ารักษา (บาท/ครั้ง)"><input type="number" value={spouseProfile.giMedicalLimit} onChange={e => setSp('giMedicalLimit', e.target.value)} placeholder="เช่น 100000" style={inp} /></Field>
                      <Field label="วงเงินค่าผ่าตัด (บาท/ครั้ง)"><input type="number" value={spouseProfile.giSurgeryLimit} onChange={e => setSp('giSurgeryLimit', e.target.value)} placeholder="เช่น 200000" style={inp} /></Field>
                      <Field label="วงเงิน OPD (บาท/ครั้ง)"><input type="number" value={spouseProfile.giOpdLimit} onChange={e => setSp('giOpdLimit', e.target.value)} placeholder="เช่น 1000" style={inp} /></Field>
                    </Grid>
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140 }}>กองทุนสำรองเลี้ยงชีพ</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[true, false].map(val => (
                      <button key={String(val)} onClick={() => setSp('hasPVD', String(val))} style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer', borderColor: spouseProfile.hasPVD === val ? 'var(--cyan)' : 'var(--card-border)', background: spouseProfile.hasPVD === val ? 'var(--cyan-dim)' : 'transparent', color: spouseProfile.hasPVD === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{val ? 'มี' : 'ไม่มี'}</button>
                    ))}
                  </div>
                </div>
                {spouseProfile.hasPVD && (
                  <div style={{ paddingLeft: 156 }}>
                    <Grid cols={2}>
                      <Field label="อัตราสะสมส่วนลูกจ้าง (%)"><input type="number" value={spouseProfile.pvdEmployeeRate} onChange={e => setSp('pvdEmployeeRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                      <Field label="อัตราสมทบส่วนนายจ้าง (%)"><input type="number" value={spouseProfile.pvdEmployerRate} onChange={e => setSp('pvdEmployerRate', e.target.value)} placeholder="เช่น 5" style={inp} /></Field>
                    </Grid>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Spouse Health Info */}
          <div style={card}>
            <SectionTitle icon={HeartPulse} accent="#f472b6" title="ข้อมูลสุขภาพ (คู่สมรส)" sub="ประวัติสุขภาพและประวัติครอบครัว" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <HealthChoice label="สูบบุหรี่" value={(spouseProfile.healthInfo as any).smoke} options={['ไม่สูบ', 'สูบ', 'บางครั้ง']} onChange={v => setSpHealth('smoke', v)} />
              <HealthChoice label="ดื่มสุรา" value={(spouseProfile.healthInfo as any).alcohol} options={['ไม่ดื่ม', 'ดื่ม', 'บางครั้ง']} onChange={v => setSpHealth('alcohol', v)} />
              <HealthItem label="โรคประจำตัว" value={(spouseProfile.healthInfo as any).chronic} onChange={v => setSpHealth('chronic', v)} />
              <HealthItem label="ประวัติการเจ็บป่วยรุนแรง" value={(spouseProfile.healthInfo as any).severeIllness} onChange={v => setSpHealth('severeIllness', v)} />
              <HealthItem label="ประวัติการเข้ารับการผ่าตัด" value={(spouseProfile.healthInfo as any).surgery} onChange={v => setSpHealth('surgery', v)} />
              <HealthItem label="ประวัติการรักษาตัวใน รพ." value={(spouseProfile.healthInfo as any).hospitalized} onChange={v => setSpHealth('hospitalized', v)} yes="เคย" no="ไม่เคย" placeholder="โปรดระบุโรค" />
              <HealthItem label="รพ.ประจำที่ท่านรักษาตัว" value={(spouseProfile.healthInfo as any).regularHospital} onChange={v => setSpHealth('regularHospital', v)} placeholder="โปรดระบุชื่อ รพ." />
              <HealthItem label="เคยถูกบริษัทประกันภัยปฏิเสธ/เลื่อน/เพิ่มเบี้ย" value={(spouseProfile.healthInfo as any).insuranceRejected} onChange={v => setSpHealth('insuranceRejected', v)} yes="เคย" no="ไม่เคย" placeholder="โปรดระบุสาเหตุ" />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', margin: '14px 0 4px' }}>ประวัติการเจ็บป่วยร้ายแรงของบุคคลในครอบครัว</div>
              <HealthItem label="พ่อ / แม่" value={(spouseProfile.healthInfo as any).familyParents} onChange={v => setSpHealth('familyParents', v)} />
              <HealthItem label="ปู่ / ย่า" value={(spouseProfile.healthInfo as any).familyGrandPaternal} onChange={v => setSpHealth('familyGrandPaternal', v)} />
              <HealthItem label="ตา / ยาย" value={(spouseProfile.healthInfo as any).familyGrandMaternal} onChange={v => setSpHealth('familyGrandMaternal', v)} />
            </div>
          </div>

          {/* Hobby / Activity (คู่สมรส) */}
          <div style={card}>
            <SectionTitle icon={Dumbbell} accent="#22c55e" title="งานอดิเรก / กิจกรรม (คู่สมรส)" sub="กิจกรรมยามว่าง กีฬา ความสนใจ" />
            <HealthItem label="มีงานอดิเรก / กิจกรรมที่ทำเป็นประจำ" value={(spouseProfile.healthInfo as any).hobby} onChange={v => setSpHealth('hobby', v)} yes="มี" no="ไม่มี" placeholder="ระบุ เช่น วิ่งมาราธอน ท่องเที่ยว ปั่นจักรยาน" />
          </div>

          </>)}
        </div>
      )}

      {/* Family Tab */}
      {tab === 'family' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Children */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={18} color="var(--cyan)" />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>ข้อมูลบุตร</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>จำนวน {children.length} คน</p>
                </div>
              </div>
              <button onClick={addChild} style={btn()}><Plus size={14} />เพิ่มบุตร</button>
            </div>

            {children.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>ยังไม่มีข้อมูลบุตร</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {children.map((c, i) => (
                  <div key={i} style={{ background: 'var(--divider)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 500 }}>บุตรคนที่ {i + 1}</span>
                      <button onClick={() => removeChild(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={14} /></button>
                    </div>
                    <Grid cols={3}>
                      <Field label="ชื่อ"><input value={c.name} onChange={e => setChild(i, 'name', e.target.value)} placeholder="ชื่อ" style={inp} /></Field>
                      <Field label="อายุ (ปี)"><input type="number" value={c.age} onChange={e => setChild(i, 'age', e.target.value)} placeholder="เช่น 8" style={inp} /></Field>
                      <Field label="โรงเรียน/มหาวิทยาลัย"><input value={c.school} onChange={e => setChild(i, 'school', e.target.value)} placeholder="ชื่อสถาบัน" style={inp} /></Field>
                    </Grid>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parents */}
          <div style={card}>
            <SectionTitle icon={HeartHandshake} accent="#a78bfa" title="ข้อมูลบิดา-มารดา" sub="ภาระดูแลบุพการีและผู้พึ่งพา" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                { label: 'บิดา', nameK: 'fatherName', ageK: 'fatherAge', healthK: 'fatherHealth', chronicK: 'fatherChronic' },
                { label: 'มารดา', nameK: 'motherName', ageK: 'motherAge', healthK: 'motherHealth', chronicK: 'motherChronic' },
              ] as const).map(p => {
                const pi = form.parentsInfo as any
                const chronic = pi[p.chronicK] || { has: false, detail: '' }
                const ageVal = (form as any)[p.ageK]
                return (
                  <div key={p.label} style={{ background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>{p.label}</div>
                    <Grid cols={3}>
                      <Field label={`ชื่อ-นามสกุล (${p.label})`}><input value={pi[p.nameK]} onChange={e => setParent(p.nameK, e.target.value)} placeholder="ชื่อ-นามสกุล" style={inp} /></Field>
                      <Field label="อายุ (ปี)"><input type="number" value={ageVal} onChange={e => set(p.ageK, e.target.value)} placeholder="เช่น 60" style={inp} /></Field>
                      <Field label="สุขภาพ">
                        <select value={pi[p.healthK]} onChange={e => setParent(p.healthK, e.target.value)} style={sel}>
                          {PARENT_HEALTH.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </Field>
                    </Grid>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 90 }}>โรคประจำตัว</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[true, false].map(val => (
                          <button key={String(val)} onClick={() => setParent(p.chronicK, { ...chronic, has: val })}
                            style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer',
                              borderColor: chronic.has === val ? 'var(--cyan)' : 'var(--card-border)',
                              background: chronic.has === val ? 'var(--cyan-dim)' : 'transparent',
                              color: chronic.has === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                            {val ? 'มี' : 'ไม่มี'}
                          </button>
                        ))}
                      </div>
                      {chronic.has && (
                        <input value={chronic.detail} onChange={e => setParent(p.chronicK, { ...chronic, detail: e.target.value })}
                          placeholder="โปรดระบุโรคประจำตัว" style={{ ...inp, flex: 1, minWidth: 200 }} />
                      )}
                    </div>
                  </div>
                )
              })}
              <Grid cols={2}>
                <Field label="ค่าใช้จ่ายที่ดูแลบิดา-มารดา (บาท/เดือน)"><CommaInput value={form.parentCareExpense} onChange={v => set('parentCareExpense', v)} placeholder="เช่น 5,000" style={inp} /></Field>
                <Field label="สมาชิกที่พึ่งพาทางการเงิน (คน)">
                  <input type="number" value={form.dependents} onChange={e => set('dependents', e.target.value)} placeholder="เช่น 2" style={inp} />
                </Field>
              </Grid>
              <div style={{ padding: '12px 14px', background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#7dd3fc', lineHeight: 1.6 }}>
                  💡 ข้อมูลนี้จะถูกนำไปคำนวณภาระค่าใช้จ่ายในการวางแผนการเงินและการจำลองอนาคต
                </p>
              </div>
            </div>
          </div>

          {/* Parents — spouse (แสดงเฉพาะเมื่อสมรส) */}
          {hasSpouse && (
          <div style={card}>
            <SectionTitle icon={HeartHandshake} accent="#a78bfa" title="ข้อมูลบิดา-มารดา (คู่สมรส)" sub="ภาระดูแลบุพการีของคู่สมรส" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {([
                { label: 'บิดา', nameK: 'fatherName', ageK: 'fatherAge', healthK: 'fatherHealth', chronicK: 'fatherChronic' },
                { label: 'มารดา', nameK: 'motherName', ageK: 'motherAge', healthK: 'motherHealth', chronicK: 'motherChronic' },
              ] as const).map(p => {
                const pi = spouseProfile.parentsInfo as any
                const chronic = pi[p.chronicK] || { has: false, detail: '' }
                const ageVal = (spouseProfile as any)[p.ageK]
                return (
                  <div key={p.label} style={{ background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>{p.label}</div>
                    <Grid cols={3}>
                      <Field label={`ชื่อ-นามสกุล (${p.label})`}><input value={pi[p.nameK]} onChange={e => setSpParent(p.nameK, e.target.value)} placeholder="ชื่อ-นามสกุล" style={inp} /></Field>
                      <Field label="อายุ (ปี)"><input type="number" value={ageVal} onChange={e => setSp(p.ageK, e.target.value)} placeholder="เช่น 60" style={inp} /></Field>
                      <Field label="สุขภาพ">
                        <select value={pi[p.healthK]} onChange={e => setSpParent(p.healthK, e.target.value)} style={sel}>
                          {PARENT_HEALTH.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </Field>
                    </Grid>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 90 }}>โรคประจำตัว</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[true, false].map(val => (
                          <button key={String(val)} onClick={() => setSpParent(p.chronicK, { ...chronic, has: val })}
                            style={{ padding: '5px 18px', borderRadius: 20, border: '1.5px solid', fontSize: 13, cursor: 'pointer',
                              borderColor: chronic.has === val ? 'var(--cyan)' : 'var(--card-border)',
                              background: chronic.has === val ? 'var(--cyan-dim)' : 'transparent',
                              color: chronic.has === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
                            {val ? 'มี' : 'ไม่มี'}
                          </button>
                        ))}
                      </div>
                      {chronic.has && (
                        <input value={chronic.detail} onChange={e => setSpParent(p.chronicK, { ...chronic, detail: e.target.value })}
                          placeholder="โปรดระบุโรคประจำตัว" style={{ ...inp, flex: 1, minWidth: 200 }} />
                      )}
                    </div>
                  </div>
                )
              })}
              <Grid cols={2}>
                <Field label="ค่าใช้จ่ายที่ดูแลบิดา-มารดา (บาท/เดือน)"><CommaInput value={spouseProfile.parentCareExpense} onChange={v => setSp('parentCareExpense', v)} placeholder="เช่น 5,000" style={inp} /></Field>
                <Field label="สมาชิกที่พึ่งพาทางการเงิน (คน)">
                  <input type="number" value={spouseProfile.dependents} onChange={e => setSp('dependents', e.target.value)} placeholder="เช่น 2" style={inp} />
                </Field>
              </Grid>
              <div style={{ padding: '12px 14px', background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#7dd3fc', lineHeight: 1.6 }}>
                  💡 ข้อมูลนี้จะถูกนำไปคำนวณภาระค่าใช้จ่ายในการวางแผนการเงินและการจำลองอนาคต
                </p>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {tab === 'insurance' && <InsuranceTab />}
      {tab === 'investment' && <InvestmentProfileTab person={person} />}
      {tab === 'goals' && <FinancialGoalsTab person={person} />}
      {tab === 'finance' && <IncomePage person={person} />}
      {tab === 'risk' && <RiskAssessmentPage />}

      {/* Auto-save status */}
      <div style={{ marginTop: 20, height: 32, display: 'flex', alignItems: 'center' }}>
        {saveStatus === 'pending' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <Clock size={14} /> รอบันทึกอัตโนมัติ...
          </span>
        )}
        {saveStatus === 'saving' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> กำลังบันทึก...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981' }}>
            <CheckCircle size={14} /> บันทึกอัตโนมัติแล้ว
          </span>
        )}
        {saveStatus === 'error' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f43f5e' }}>
            <AlertCircle size={14} /> บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ
          </span>
        )}
        {saveStatus === 'invalid' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#f97316' }}>
            <AlertCircle size={14} /> กรุณากรอกเบอร์โทรและ Email ก่อนบันทึก
          </span>
        )}
      </div>

      {/* นำทางกรอกข้อมูลทีละหน้า — ก่อนหน้า / ถัดไป */}
      <WizardNav steps={TAB_STEPS} current={tab} onGo={goTab} />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
