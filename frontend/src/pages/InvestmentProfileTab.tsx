import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { card, inp, sel, btn } from '../styles/dark'
import { MoneyInputStr as NumInput } from '../components/MoneyInput'
import { Plus, Trash2, Clock, CheckCircle, Loader, TrendingUp, Home, Briefcase, AlertTriangle, PiggyBank, CreditCard } from 'lucide-react'
import { TableExcelButton } from '../components/exportable'

// ─── Types ────────────────────────────────────────────────────────────────────

type SavingsAccount = {
  depositType: string   // ประเภทเงินฝาก (fixed or custom for อื่นๆ)
  bank: string          // ชื่อธนาคาร
  currentValue: string
  interestRate: string
}

// ธนาคารในประเทศไทย — ใช้เป็นตัวเลือกใน datalist (ยังพิมพ์เองได้)
const THAI_BANKS = [
  'ธนาคารกสิกรไทย', 'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย', 'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารทหารไทยธนชาต (ttb)', 'ธนาคารออมสิน', 'ธนาคารเพื่อการเกษตรและสหกรณ์ (ธ.ก.ส.)',
  'ธนาคารอาคารสงเคราะห์ (ธอส.)', 'ธนาคารซีไอเอ็มบี ไทย', 'ธนาคารยูโอบี', 'ธนาคารแลนด์ แอนด์ เฮ้าส์',
  'ธนาคารเกียรตินาคินภัทร', 'ธนาคารทิสโก้', 'ธนาคารไอซีบีซี (ไทย)', 'ธนาคารอิสลามแห่งประเทศไทย',
  'ธนาคารสแตนดาร์ดชาร์เตอร์ด (ไทย)', 'ธนาคารซิตี้แบงก์', 'อื่นๆ',
]
const BANK_DATALIST_ID = 'thai-banks'

function emptySavings(): SavingsAccount {
  return { depositType: '', bank: '', currentValue: '', interestRate: '' }
}
function defaultSavings(): SavingsAccount[] {
  return [
    { depositType: 'เงินฝากออมทรัพย์', bank: '', currentValue: '', interestRate: '' },
    { depositType: 'เงินฝากประจำ',     bank: '', currentValue: '', interestRate: '' },
    { depositType: 'สลากออมสิน',        bank: '', currentValue: '', interestRate: '' },
    { depositType: 'อื่นๆ',             bank: '', currentValue: '', interestRate: '' },
  ]
}

type PersonalAsset = {
  id?: string
  assetType: string
  customLabel: string
  currentValue: string
  yearsHeld: string
  debtRemaining: string
}

type InvestmentAsset = {
  id?: string
  assetClass: string
  assetName: string
  investDate: string
  investAmount: string
  currentValue: string
  annualReturn: string
}

const ASSET_CLASSES = [
  'ตราสารตลาดเงิน',
  'ตราสารหนี้ ในประเทศ',
  'ตราสารหนี้ ต่างประเทศ',
  'ตราสารหนี้ เอกชน',
  'หุ้น ในประเทศ',
  'หุ้น ต่างประเทศ',
  'กองทุนรวม',
  'Cryptocurrency',
  'Forex',
  'ทองคำ',
  'อื่นๆ',
]

type Liability = {
  id?: string
  debtType: string        // ประเภทหนี้สิน
  assetRef: string        // ชื่อ/ทะเบียน
  creditor: string        // ชื่อเจ้าหนี้
  currentBalance: string  // มูลค่าหนี้ปัจจุบัน
  termYears: string       // ระยะเวลาครบกำหนด (ปี)
  monthlyPayment?: string  // ผ่อนชำระต่อเดือน (บาท)
}

const LIABILITY_TYPES = [
  'หนี้อสังหาฯ',
  'หนี้สินรถยนต์',
  'หนี้ธุรกิจ',
  'หนี้บัตรเครดิต',
  'สินเชื่อส่วนบุคคล',
  'อื่นๆ',
]

function emptyLiability(): Liability {
  return { debtType: '', assetRef: '', creditor: '', currentBalance: '', termYears: '', monthlyPayment: '' }
}

type InvestmentConstraint = {
  liquidity: boolean; liquidityDetail: string
  legalRestriction: boolean; legalDetail: string
  taxBurden: boolean; taxDetail: string
  personalRestriction: boolean; personalDetail: string
}

type InvestmentAssumptions = {
  expectedLifespan: string
  targetRetirementAge: string
  // Education costs (PV)
  eduPrimaryPerYear: string
  eduSecondaryPerYear: string
  eduTutoringPerYear: string
  eduSummerCampPerYear: string
  eduUndergrad: string
  eduGrad: string
  // Income growth
  incomeGrowthRate: string
  spouseIncomeGrowthRate: string
  // PVD
  pvdEmployeeRateSelf: string
  pvdEmployerRateSelf: string
  pvdReturnRateSelf: string
  pvdEmployeeRateSpouse: string
  pvdEmployerRateSpouse: string
  pvdReturnRateSpouse: string
  // Economic
  inflationGeneral: string
  inflationEducation: string
  inflationRent: string
  creditCardInterestRate: string
  postRetirementReturn: string
}

const PERSONAL_ASSET_TYPES = [
  'บ้านอยู่อาศัย', 'บ้านให้เช่า', 'คอนโด',
  'รถยนต์', 'ทองคำ', 'อื่นๆ',
]

const SECURITY_TYPES_LEFT = [
  'เงินฝาก', 'กองทุน SSF', 'กองทุนตลาดเงิน', 'กองทุน RMF',
  'ตั๋วเงินคลัง', 'กองทุนรวมต่างประเทศ', 'ตั๋วสัญญาใช้เงิน',
  'สัญญาฟิวเจอร์ส', 'หุ้นกู้ระดับ Investment Grade', 'สัญญาออปชัน',
  'หุ้นกู้ระดับ Junk Bond', 'สินค้าเกษตรล่วงหน้า', 'พันธบัตรรัฐบาล',
  'ทองคำ', 'หุ้นกู้แปลงสภาพ', 'กองทุนรวมทองคำ',
  'กองทุนรวมตราสารหนี้ภาคเอกชน', 'เพชร', 'กองทุนรวมพันธบัตรรัฐบาล',
  'งานศิลปะ',
]
const SECURITY_TYPES_RIGHT = [
  'หุ้นสามัญขนาดเล็ก', 'คริปโตเคอเรนซี (Crypto currency)',
  'หุ้นสามัญขนาดกลาง', 'Unit link Insurance', 'หุ้นสามัญขนาดใหญ่',
  'ประกันชีวิตและสะสมทรัพย์', 'กองทุนรวมหุ้น', 'อสังหาริมทรัพย์',
  'ใบสำคัญแสดงสิทธิ', 'กองทุนอสังหาริมทรัพย์', 'NVDR',
  'อื่นๆ', 'ETF', 'Hedge fund',
]
const ALL_SECURITY_TYPES = [...SECURITY_TYPES_LEFT, ...SECURITY_TYPES_RIGHT]

// จัดกลุ่มหลักทรัพย์ตามประเภทและระดับความเสี่ยง (เรียงจากเสี่ยงต่ำ → สูง)
const SECURITY_GROUPS: { name: string; risk: string; color: string; types: string[] }[] = [
  { name: 'เงินสดและตราสารตลาดเงิน', risk: 'เสี่ยงต่ำมาก', color: '#34d399',
    types: ['เงินฝาก', 'กองทุนตลาดเงิน', 'ตั๋วเงินคลัง', 'ตั๋วสัญญาใช้เงิน'] },
  { name: 'ตราสารหนี้', risk: 'เสี่ยงต่ำ', color: '#22d3ee',
    types: ['พันธบัตรรัฐบาล', 'กองทุนรวมพันธบัตรรัฐบาล', 'หุ้นกู้ระดับ Investment Grade', 'กองทุนรวมตราสารหนี้ภาคเอกชน', 'หุ้นกู้แปลงสภาพ', 'หุ้นกู้ระดับ Junk Bond'] },
  { name: 'กองทุนรวมและประกัน', risk: 'เสี่ยงปานกลาง', color: '#60a5fa',
    types: ['กองทุน SSF', 'กองทุน RMF', 'กองทุนรวมต่างประเทศ', 'ประกันชีวิตและสะสมทรัพย์', 'Unit link Insurance'] },
  { name: 'ตราสารทุน', risk: 'เสี่ยงสูง', color: '#f59e0b',
    types: ['หุ้นสามัญขนาดใหญ่', 'หุ้นสามัญขนาดกลาง', 'หุ้นสามัญขนาดเล็ก', 'กองทุนรวมหุ้น', 'NVDR', 'ETF', 'ใบสำคัญแสดงสิทธิ'] },
  { name: 'ตราสารอนุพันธ์', risk: 'เสี่ยงสูงมาก', color: '#fb7185',
    types: ['สัญญาฟิวเจอร์ส', 'สัญญาออปชัน', 'สินค้าเกษตรล่วงหน้า'] },
  { name: 'สินทรัพย์ทางเลือก', risk: 'เสี่ยงสูงมาก', color: '#c084fc',
    types: ['ทองคำ', 'กองทุนรวมทองคำ', 'อสังหาริมทรัพย์', 'กองทุนอสังหาริมทรัพย์', 'คริปโตเคอเรนซี (Crypto currency)', 'Hedge fund', 'เพชร', 'งานศิลปะ', 'อื่นๆ'] },
]
// กันตกหล่น: ประเภทใดยังไม่ถูกจัดกลุ่ม ให้ไปอยู่กลุ่มสุดท้าย
;(() => {
  const grouped = new Set(SECURITY_GROUPS.flatMap(g => g.types))
  ALL_SECURITY_TYPES.forEach(t => { if (!grouped.has(t)) SECURITY_GROUPS[SECURITY_GROUPS.length - 1].types.push(t) })
})()

function SecurityTypeChips({ selected, activeColor, onToggle }: { selected: string[]; activeColor: string; onToggle: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {SECURITY_GROUPS.map(g => (
        <div key={g.name} style={{ border: `1px solid ${g.color}33`, borderLeft: `3px solid ${g.color}`, borderRadius: 10, padding: '10px 12px', background: `${g.color}0a` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: g.color }}>{g.name}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', border: '1px solid var(--card-border)', borderRadius: 20, padding: '1px 7px' }}>{g.risk}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {g.types.map(t => {
              const sel = selected.includes(t)
              return (
                <button key={t} onClick={() => onToggle(t)} style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '1px solid',
                  borderColor: sel ? activeColor : 'var(--card-border)',
                  background: sel ? activeColor + '22' : 'transparent',
                  color: sel ? activeColor : 'var(--text-muted)',
                  fontWeight: sel ? 600 : 400,
                }}>{t}</button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultConstraints: InvestmentConstraint = {
  liquidity: false, liquidityDetail: '',
  legalRestriction: false, legalDetail: '',
  taxBurden: false, taxDetail: '',
  personalRestriction: false, personalDetail: '',
}

const defaultAssumptions: InvestmentAssumptions = {
  expectedLifespan: '90',
  targetRetirementAge: '55',
  eduPrimaryPerYear: '120000',
  eduSecondaryPerYear: '150000',
  eduTutoringPerYear: '104000',
  eduSummerCampPerYear: '200000',
  eduUndergrad: '1200000',
  eduGrad: '2000000',
  incomeGrowthRate: '5',
  spouseIncomeGrowthRate: '5',
  pvdEmployeeRateSelf: '5',
  pvdEmployerRateSelf: '5',
  pvdReturnRateSelf: '4',
  pvdEmployeeRateSpouse: '15',
  pvdEmployerRateSpouse: '5',
  pvdReturnRateSpouse: '3',
  inflationGeneral: '3',
  inflationEducation: '5',
  inflationRent: '4',
  creditCardInterestRate: '16',
  postRetirementReturn: '4',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(v: string) {
  const n = parseFloat(v.replace(/,/g, ''))
  if (isNaN(n)) return '—'
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

// อัตราผลตอบแทนต่อปีแบบทบต้น (CAGR) จากเงินลงทุน → มูลค่าปัจจุบัน ตามระยะเวลาที่ลงทุนจริง (ปีชนปี)
function annualizedReturn(cost: number, value: number, investDate: string): number | null {
  if (cost <= 0 || value <= 0 || !investDate) return null
  const start = new Date(investDate)
  if (isNaN(start.getTime())) return null
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1 / 365.25) return null // ลงทุนยังไม่ถึง 1 วัน
  return (Math.pow(value / cost, 1 / years) - 1) * 100
}

function emptyPersonalAsset(): PersonalAsset {
  return { assetType: 'บ้านอยู่อาศัย', customLabel: '', currentValue: '', yearsHeld: '', debtRemaining: '' }
}
function emptyInvestmentAsset(): InvestmentAsset {
  return { assetClass: '', assetName: '', investDate: '', investAmount: '', currentValue: '', annualReturn: '' }
}

// ─── NumInput: แสดง comma เมื่อ blur, strip เมื่อ focus ──────────────────────

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color="var(--cyan)" />
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  )
}

// ─── ConstraintRow ────────────────────────────────────────────────────────────

function ConstraintRow({ label, hasVal, detail, onToggle, onDetail }: {
  label: string; hasVal: boolean; detail: string
  onToggle: (v: boolean) => void; onDetail: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--divider)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', paddingTop: 6 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => onToggle(v)} style={{
            padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
            borderColor: hasVal === v ? 'var(--cyan)' : 'var(--card-border)',
            background: hasVal === v ? 'rgba(14,165,233,0.12)' : 'transparent',
            color: hasVal === v ? 'var(--cyan-light)' : 'var(--text-muted)',
          }}>{v ? 'มี' : 'ไม่มี'}</button>
        ))}
      </div>
      <input
        value={detail}
        onChange={e => onDetail(e.target.value)}
        placeholder="รายละเอียด..."
        style={{ ...inp, fontSize: 12 }}
        disabled={!hasVal}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestmentProfileTab({ person = 'client' }: { person?: 'client' | 'spouse' }) {
  const qc = useQueryClient()

  // State
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>(defaultSavings())
  const [personalAssets, setPersonalAssets] = useState<PersonalAsset[]>([emptyPersonalAsset()])
  const [investmentAssets, setInvestmentAssets] = useState<InvestmentAsset[]>([emptyInvestmentAsset()])
  const [liabilities, setLiabilities] = useState<Liability[]>([emptyLiability()])
  const [unwantedTypes, setUnwantedTypes] = useState<string[]>([])
  const [preferredTypes, setPreferredTypes] = useState<string[]>([])
  const [constraints, setConstraints] = useState<InvestmentConstraint>(defaultConstraints)
  const [assumptions, setAssumptions] = useState<InvestmentAssumptions>(defaultAssumptions)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const profileRef = useRef<any>(null)

  // Load
  const { data: profile } = useQuery({
    queryKey: ['investment-profile'],
    queryFn: () => api.get('/investment-profile').then(r => r.data),
    retry: false,
  })

  // เติมข้อมูลลง state จากแหล่งของบุคคลที่เลือก (client = ฟิลด์หลัก, spouse = spouseData)
  const hydrate = (src: any) => {
    setSavingsAccounts(src?.savingsAccounts?.length ? src.savingsAccounts : defaultSavings())
    setPersonalAssets(src?.personalAssets?.length ? src.personalAssets : [emptyPersonalAsset()])
    setInvestmentAssets(src?.investmentAssets?.length ? src.investmentAssets : [emptyInvestmentAsset()])
    setLiabilities(src?.liabilities?.length ? src.liabilities : [emptyLiability()])
    setUnwantedTypes(src?.unwantedTypes ?? [])
    setPreferredTypes(src?.preferredTypes ?? [])
    setConstraints({ ...defaultConstraints, ...(src?.constraints ?? {}) })
    setAssumptions({ ...defaultAssumptions, ...(src?.assumptions ?? {}) })
  }

  useEffect(() => {
    if (!profile) return
    profileRef.current = profile
    hydrate(person === 'client' ? profile : profile.spouseData)
  }, [profile])

  // สลับคนจากปุ่มหน้าหลัก (prop) → โหลดข้อมูลของคนนั้น (ยกเลิกบันทึกค้างก่อน)
  useEffect(() => {
    if (!profileRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    hydrate(person === 'client' ? profileRef.current : profileRef.current?.spouseData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person])

  // Save
  const saveMut = useMutation({
    mutationFn: (payload: any) => api.put('/investment-profile', payload),
    onSuccess: () => { setSaveStatus('saved'); qc.invalidateQueries({ queryKey: ['investment-profile'] }); setTimeout(() => setSaveStatus('idle'), 2000) },
    onMutate: () => setSaveStatus('saving'),
  })

  const triggerSave = useCallback((sa = savingsAccounts, pa = personalAssets, ia = investmentAssets, uw = unwantedTypes, pf = preferredTypes, co = constraints, as = assumptions, lb = liabilities) => {
    setSaveStatus('pending')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const data = { savingsAccounts: sa, personalAssets: pa, investmentAssets: ia, liabilities: lb, unwantedTypes: uw, preferredTypes: pf, constraints: co, assumptions: as }
    saveTimer.current = setTimeout(() => {
      saveMut.mutate(person === 'client' ? data : { spouseData: data })
    }, 1500)
  }, [savingsAccounts, personalAssets, investmentAssets, liabilities, unwantedTypes, preferredTypes, constraints, assumptions, person])

  // ── Savings Account helpers ──
  const setSA = (i: number, field: keyof SavingsAccount, val: string) => {
    const next = savingsAccounts.map((a, idx) => idx === i ? { ...a, [field]: val } : a)
    setSavingsAccounts(next); triggerSave(next)
  }
  const addSA = () => {
    const next = [...savingsAccounts, emptySavings()]
    setSavingsAccounts(next); triggerSave(next)
  }
  const removeSA = (i: number) => {
    const next = savingsAccounts.filter((_, idx) => idx !== i)
    setSavingsAccounts(next); triggerSave(next)
  }

  // ── Personal Assets helpers ──
  const setPA = (i: number, field: keyof PersonalAsset, val: string) => {
    const next = personalAssets.map((a, idx) => idx === i ? { ...a, [field]: val } : a)
    setPersonalAssets(next); triggerSave(undefined, next)
  }
  const addPA = () => { const next = [...personalAssets, emptyPersonalAsset()]; setPersonalAssets(next); triggerSave(undefined, next) }
  const removePA = (i: number) => { const next = personalAssets.filter((_, idx) => idx !== i); setPersonalAssets(next); triggerSave(undefined, next) }

  // ── Investment Assets helpers ──
  const setIA = (i: number, field: keyof InvestmentAsset, val: string) => {
    const next = investmentAssets.map((a, idx) => idx === i ? { ...a, [field]: val } : a)
    setInvestmentAssets(next); triggerSave(undefined, undefined, next)
  }
  const addIA = () => { const next = [...investmentAssets, emptyInvestmentAsset()]; setInvestmentAssets(next); triggerSave(undefined, undefined, next) }
  const removeIA = (i: number) => { const next = investmentAssets.filter((_, idx) => idx !== i); setInvestmentAssets(next); triggerSave(undefined, undefined, next) }

  // ── Liability helpers ──
  const setLB = (i: number, field: keyof Liability, val: string) => {
    const next = liabilities.map((l, idx) => idx === i ? { ...l, [field]: val } : l)
    setLiabilities(next); triggerSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next)
  }
  const addLB = () => { const next = [...liabilities, emptyLiability()]; setLiabilities(next); triggerSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next) }
  const removeLB = (i: number) => { const next = liabilities.filter((_, idx) => idx !== i); setLiabilities(next); triggerSave(undefined, undefined, undefined, undefined, undefined, undefined, undefined, next) }
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.currentBalance.replace(/,/g, '')) || 0), 0)

  // ── Security type toggles ──
  const toggleUnwanted = (t: string) => {
    const next = unwantedTypes.includes(t) ? unwantedTypes.filter(x => x !== t) : [...unwantedTypes, t]
    setUnwantedTypes(next); triggerSave(undefined, undefined, undefined, next)
  }
  const togglePreferred = (t: string) => {
    const next = preferredTypes.includes(t) ? preferredTypes.filter(x => x !== t) : [...preferredTypes, t]
    setPreferredTypes(next); triggerSave(undefined, undefined, undefined, undefined, next)
  }

  // ── Constraint helper ──
  const setConstraint = (field: keyof InvestmentConstraint, val: any) => {
    const next = { ...constraints, [field]: val }
    setConstraints(next); triggerSave(undefined, undefined, undefined, undefined, undefined, next)
  }

  // ── Assumption helper ──

  // ── Computed totals ──
  const totalPersonalAssetValue = personalAssets.reduce((s, a) => s + (parseFloat(a.currentValue.replace(/,/g, '')) || 0), 0)
  const totalInvestValue = investmentAssets.reduce((s, a) => s + (parseFloat(a.currentValue.replace(/,/g, '')) || 0), 0)
  const totalInvestCost = investmentAssets.reduce((s, a) => s + (parseFloat(a.investAmount.replace(/,/g, '')) || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── 0. Savings Accounts ── */}
      <datalist id={BANK_DATALIST_ID}>
        {THAI_BANKS.map(b => <option key={b} value={b} />)}
      </datalist>
      <div style={card}>
        <SectionHeader icon={PiggyBank} title="บัญชีเงินฝาก" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename="บัญชีเงินฝาก" title="เงินฝาก" /></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              {[
                { label: 'ประเภทเงินฝาก', align: 'left' },
                { label: 'ชื่อธนาคาร', align: 'left' },
                { label: 'มูลค่าปัจจุบัน (บาท)', align: 'right' },
                { label: 'อัตราดอกเบี้ย', align: 'center' },
                { label: 'สัดส่วน', align: 'left' },
                { label: '', align: 'left' },
              ].map(h => (
                <th key={h.label} style={{ padding: '7px 10px', textAlign: h.align as any, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const totalSavings = savingsAccounts.reduce((s, a) => s + (parseFloat(a.currentValue.replace(/,/g, '')) || 0), 0)
              return savingsAccounts.map((a, i) => {
                const val = parseFloat(a.currentValue.replace(/,/g, '')) || 0
                const pct = totalSavings > 0 ? (val / totalSavings * 100).toFixed(1) : '0.0'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={a.depositType} onChange={e => setSA(i, 'depositType', e.target.value)} placeholder="ระบุประเภท..." style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input list={BANK_DATALIST_ID} value={a.bank || ''} onChange={e => setSA(i, 'bank', e.target.value)} placeholder="เลือก/พิมพ์ธนาคาร" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <NumInput value={a.currentValue} onChange={v => setSA(i, 'currentValue', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <input value={a.interestRate} onChange={e => setSA(i, 'interestRate', e.target.value)} placeholder="0.00" style={{ ...inp, fontSize: 11, width: 70, textAlign: 'center', boxSizing: 'border-box' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>%</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 60, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(parseFloat(pct), 100)}%`, background: 'var(--cyan)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{val > 0 ? pct + '%' : '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {savingsAccounts.length > 1 && (
                        <button onClick={() => removeSA(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            })()}
          </tbody>
          <tfoot>
            {(() => {
              const totalSavings = savingsAccounts.reduce((s, a) => s + (parseFloat(a.currentValue.replace(/,/g, '')) || 0), 0)
              return (
                <tr style={{ borderTop: '1px solid var(--card-border)', background: 'var(--hover)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>รวม</td>
                  <td />
                  <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{totalSavings > 0 ? fmtNum(String(totalSavings)) : '—'}</td>
                  <td />
                  <td />
                  <td />
                </tr>
              )
            })()}
          </tfoot>
        </table>
        <button onClick={addSA} style={{ ...btn, marginTop: 12, fontSize: 12, padding: '6px 14px' }}>
          <Plus size={13} /> เพิ่มบัญชีอื่นๆ
        </button>
      </div>

      {/* ── 1. Personal Assets ── */}
      <div style={card}>
        <SectionHeader icon={Home} title="สินทรัพย์ส่วนตัว" sub="มูลค่าปัจจุบัน" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename="สินทรัพย์ส่วนตัว" title="สินทรัพย์ส่วนตัว" /></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dense-table" style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {[
                  { label: 'ประเภทสินทรัพย์', align: 'left' },
                  { label: 'ชื่อ/ทะเบียน', align: 'left' },
                  { label: 'มูลค่าปัจจุบัน (บาท)', align: 'right' },
                  { label: 'จำนวนปีที่ถือครอง', align: 'center' },
                  { label: 'สัดส่วน', align: 'left' },
                  { label: '', align: 'left' },
                ].map(h => (
                  <th key={h.label} style={{ padding: '7px 10px', textAlign: h.align as any, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personalAssets.map((a, i) => {
                const val = parseFloat(a.currentValue.replace(/,/g, '')) || 0
                const pct = totalPersonalAssetValue > 0 ? (val / totalPersonalAssetValue * 100).toFixed(1) : '0.0'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={a.assetType} onChange={e => setPA(i, 'assetType', e.target.value)} style={{ ...sel, fontSize: 11, padding: '4px 6px' }}>
                        {PERSONAL_ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={a.customLabel} onChange={e => setPA(i, 'customLabel', e.target.value)} placeholder="ทะเบียน / ชื่อ" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <NumInput value={a.currentValue} onChange={v => setPA(i, 'currentValue', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 80 }}>
                      <input value={a.yearsHeld} onChange={e => setPA(i, 'yearsHeld', e.target.value)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'center' }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 50, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(parseFloat(pct), 100)}%`, background: 'var(--cyan)', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {personalAssets.length > 1 && (
                        <button onClick={() => removePA(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)', background: 'var(--hover)' }}>
                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>รวม</td>
                <td />
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmtNum(String(totalPersonalAssetValue))}</td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={addPA} style={{ ...btn, marginTop: 12, fontSize: 12, padding: '6px 14px' }}>
          <Plus size={13} /> เพิ่มสินทรัพย์
        </button>
      </div>

      {/* ── 2. Investment Assets ── */}
      <div style={card}>
        <SectionHeader icon={TrendingUp} title="สินทรัพย์การลงทุน" sub="มูลค่าพอร์ตปัจจุบัน" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename="สินทรัพย์การลงทุน" title="สินทรัพย์การลงทุน" /></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dense-table" style={{ width: '100%', minWidth: 1040, borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {[
                  { label: 'ประเภทสินทรัพย์', align: 'left' },
                  { label: 'ชื่อสินทรัพย์ / กองทุน', align: 'left' },
                  { label: 'วันที่ลงทุน', align: 'left' },
                  { label: 'เงินลงทุน (บาท)', align: 'right' },
                  { label: 'มูลค่าปัจจุบัน (บาท)', align: 'right' },
                  { label: 'ผลตอบแทน (ต่อปี)', align: 'right' },
                  { label: 'ส่วนต่าง', align: 'right' },
                  { label: 'สัดส่วน', align: 'left' },
                  { label: '', align: 'left' },
                ].map(h => (
                  <th key={h.label} style={{ padding: '7px 10px', textAlign: h.align as any, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {investmentAssets.map((a, i) => {
                const cost = parseFloat(a.investAmount.replace(/,/g, '')) || 0
                const val = parseFloat(a.currentValue.replace(/,/g, '')) || 0
                const diff = val - cost
                // อัตราผลตอบแทนต่อปี (CAGR) คำนวณจากวันที่ลงทุน → ปัจจุบัน (ปีชนปี)
                const annualReturnPct = annualizedReturn(cost, val, a.investDate)
                const pct = totalInvestValue > 0 ? (val / totalInvestValue * 100).toFixed(1) : '0.0'
                const color = diff >= 0 ? '#10b981' : '#fb7185'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '6px 8px', width: 150 }}>
                      <select value={a.assetClass} onChange={e => setIA(i, 'assetClass', e.target.value)} style={{ ...sel, fontSize: 11, padding: '4px 6px', width: '100%' }}>
                        <option value="">-- เลือก --</option>
                        {ASSET_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={a.assetName} onChange={e => setIA(i, 'assetName', e.target.value)} placeholder="ชื่อกองทุน / หุ้น / ทรัพย์สิน" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '6px 8px', width: 140 }}>
                      <input type="date" value={a.investDate} onChange={e => setIA(i, 'investDate', e.target.value)} style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <NumInput value={a.investAmount} onChange={v => setIA(i, 'investAmount', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <NumInput value={a.currentValue} onChange={v => setIA(i, 'currentValue', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {annualReturnPct !== null ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: annualReturnPct >= 0 ? '#10b981' : '#fb7185' }}>
                          {annualReturnPct >= 0 ? '+' : ''}{annualReturnPct.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cost > 0 ? color : 'var(--text-muted)' }}>
                        {cost > 0 ? (diff >= 0 ? '+' : '') + fmtNum(String(diff)) : '—'}
                      </div>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 50, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(parseFloat(pct), 100)}%`, background: '#10b981', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      {investmentAssets.length > 1 && (
                        <button onClick={() => removeIA(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)', background: 'var(--hover)' }}>
                {/* ประเภทสินทรัพย์ */}
                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>รวมทั้งหมด</td>
                {/* ชื่อสินทรัพย์ */}
                <td />
                {/* วันที่ลงทุน */}
                <td />
                {/* เงินลงทุน */}
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>{fmtNum(String(totalInvestCost))}</td>
                {/* มูลค่าปัจจุบัน */}
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#10b981', textAlign: 'right' }}>{fmtNum(String(totalInvestValue))}</td>
                {/* ผลตอบแทน (weighted avg) */}
                <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {(() => {
                    let weighted = 0; let coveredVal = 0
                    investmentAssets.forEach(a => {
                      const c = parseFloat(a.investAmount.replace(/,/g, '')) || 0
                      const val = parseFloat(a.currentValue.replace(/,/g, '')) || 0
                      const r = annualizedReturn(c, val, a.investDate)
                      if (r !== null && val > 0) {
                        coveredVal += val
                        weighted += r * val
                      }
                    })
                    if (coveredVal === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    weighted = weighted / coveredVal
                    const c = weighted >= 0 ? '#10b981' : '#fb7185'
                    return (
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>
                        {weighted >= 0 ? '+' : ''}{weighted.toFixed(2)}%
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>ผลตอบแทนพอร์ต</div>
                      </div>
                    )
                  })()}
                </td>
                {/* ส่วนต่าง */}
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {(() => {
                    const totalDiff = totalInvestValue - totalInvestCost
                    const c = totalDiff >= 0 ? '#10b981' : '#fb7185'
                    return totalInvestCost > 0 ? (
                      <div style={{ fontSize: 13, fontWeight: 700, color: c }}>
                        {(totalDiff >= 0 ? '+' : '') + fmtNum(String(totalDiff))}
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>
                  })()}
                </td>
                {/* สัดส่วน */}
                <td />
                {/* ลบ */}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={addIA} style={{ ...btn, marginTop: 12, fontSize: 12, padding: '6px 14px' }}>
          <Plus size={13} /> เพิ่มรายการลงทุน
        </button>
      </div>

      {/* ── 2.5 Liabilities (หนี้สินคงค้าง) ── */}
      <div style={card}>
        <SectionHeader icon={CreditCard} title="หนี้สินคงค้าง" sub="ภาระหนี้สินที่ยังค้างชำระ" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename="หนี้สินคงค้าง" title="หนี้สินคงค้าง" /></div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                {[
                  { label: 'ประเภทหนี้สิน', align: 'left' },
                  { label: 'ชื่อ/ทะเบียน', align: 'left' },
                  { label: 'ชื่อเจ้าหนี้', align: 'left' },
                  { label: 'มูลค่าหนี้ปัจจุบัน (บาท)', align: 'right' },
                  { label: 'ผ่อนชำระต่อเดือน (บาท)', align: 'right' },
                  { label: 'ระยะเวลาครบกำหนด (ปี)', align: 'right' },
                  { label: '', align: 'left' },
                ].map(h => (
                  <th key={h.label} style={{ padding: '7px 10px', textAlign: h.align as any, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '6px 8px', width: 170 }}>
                    <select value={l.debtType} onChange={e => setLB(i, 'debtType', e.target.value)} style={{ ...sel, fontSize: 11, padding: '4px 6px', width: '100%' }}>
                      <option value="">-- เลือก --</option>
                      {LIABILITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={l.assetRef} onChange={e => setLB(i, 'assetRef', e.target.value)} placeholder="เช่น บ้านเลขที่ / ทะเบียนรถ" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <input value={l.creditor} onChange={e => setLB(i, 'creditor', e.target.value)} placeholder="เช่น ธนาคารกสิกรไทย" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                  </td>
                  <td style={{ padding: '6px 8px', width: 180 }}>
                    <NumInput value={l.currentBalance} onChange={v => setLB(i, 'currentBalance', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 8px', width: 150 }}>
                    <NumInput value={l.monthlyPayment ?? ''} onChange={v => setLB(i, 'monthlyPayment', v)} placeholder="0" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 8px', width: 130 }}>
                    <input type="number" value={l.termYears} onChange={e => setLB(i, 'termYears', e.target.value)} placeholder="เช่น 10" style={{ ...inp, fontSize: 11, width: '100%', boxSizing: 'border-box', textAlign: 'right' }} />
                  </td>
                  <td style={{ padding: '6px 4px' }}>
                    {liabilities.length > 1 && (
                      <button onClick={() => removeLB(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--card-border)', background: 'var(--hover)' }}>
                <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>รวมหนี้สิน</td>
                <td />
                <td />
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#fb7185', textAlign: 'right' }}>{fmtNum(String(totalLiabilities))}</td>
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#f59e0b', textAlign: 'right' }}>{fmtNum(String(liabilities.reduce((x, l) => x + (parseFloat((l.monthlyPayment ?? '').replace(/,/g, '')) || 0), 0)))}</td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={addLB} style={{ ...btn, marginTop: 12, fontSize: 12, padding: '6px 14px' }}>
          <Plus size={13} /> เพิ่มหนี้สิน
        </button>
      </div>

      {/* ── 3. Security Type Preferences ── */}
      <div style={card}>
        <SectionHeader icon={Briefcase} title="ประเภทหลักทรัพย์" sub="เลือกประเภทที่สนใจและไม่สนใจลงทุน" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 24 }}>
          {/* ไม่ต้องการลงทุน */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#fb7185', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={12} /> ประเภทที่ไม่ต้องการลงทุน
            </p>
            <SecurityTypeChips selected={unwantedTypes} activeColor="#fb7185" onToggle={toggleUnwanted} />
          </div>
          {/* ต้องการลงทุน */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={12} /> ประเภทที่ต้องการลงทุน
            </p>
            <SecurityTypeChips selected={preferredTypes} activeColor="#10b981" onToggle={togglePreferred} />
          </div>
        </div>
      </div>

      {/* ── 4. Investment Constraints ── */}
      <div style={card}>
        <SectionHeader icon={AlertTriangle} title="ข้อจำกัดในการลงทุน" />
        <div style={{ marginTop: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 120px 1fr', gap: 12, paddingBottom: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ประเภทข้อจำกัด</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>มี / ไม่มี</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>รายละเอียด</span>
          </div>
          <ConstraintRow label="ความต้องการสภาพคล่อง" hasVal={constraints.liquidity} detail={constraints.liquidityDetail}
            onToggle={v => setConstraint('liquidity', v)} onDetail={v => setConstraint('liquidityDetail', v)} />
          <ConstraintRow label="กฎหมาย/ข้อบังคับที่เกี่ยวข้อง" hasVal={constraints.legalRestriction} detail={constraints.legalDetail}
            onToggle={v => setConstraint('legalRestriction', v)} onDetail={v => setConstraint('legalDetail', v)} />
          <ConstraintRow label="ภาระภาษี" hasVal={constraints.taxBurden} detail={constraints.taxDetail}
            onToggle={v => setConstraint('taxBurden', v)} onDetail={v => setConstraint('taxDetail', v)} />
          <ConstraintRow label="ข้อจำกัดเฉพาะตัวลูกค้า" hasVal={constraints.personalRestriction} detail={constraints.personalDetail}
            onToggle={v => setConstraint('personalRestriction', v)} onDetail={v => setConstraint('personalDetail', v)} />
        </div>
      </div>

      {/* Auto-save status */}
      <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
        {saveStatus === 'pending' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Clock size={13} /> รอบันทึกอัตโนมัติ...</span>}
        {saveStatus === 'saving' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Loader size={13} className="animate-spin" /> กำลังบันทึก...</span>}
        {saveStatus === 'saved' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#10b981' }}><CheckCircle size={13} /> บันทึกแล้ว</span>}
      </div>
    </div>
  )
}

// ─── Assumption Row ───────────────────────────────────────────────────────────

