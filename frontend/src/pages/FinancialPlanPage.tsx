import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Target, GraduationCap, HeartPulse, TrendingUp, Shield, Briefcase, Scale, ScrollText, Receipt, User, Users, SlidersHorizontal } from 'lucide-react'
import RetirementPlanPage from './RetirementPlanPage'
import EstatePlanPage from './EstatePlanPage'
import TaxPlanningPage from './TaxPlanningPage'
import { PageHeader } from '../components/ui'
import { WizardNav, PLANNING_STEPS } from '../components/WizardNav'
import { useClient } from '../context/ClientContext'
import { hasSpouseInfo } from '../lib/spouse'
import EducationPlanPage from './EducationPlanPage'
import InsurancePlanPage from './InsurancePlanPage'
import ProjectionInvestmentTab from './projection/ProjectionInvestmentTab'
import RebalanceTab from './projection/RebalanceTab'
import ProjectionSocialSecurityTab from './projection/ProjectionSocialSecurityTab'
import ProjectionPVDTab from './projection/ProjectionPVDTab'
import ProjectionSeveranceTab from './projection/ProjectionSeveranceTab'

type Person = 'self' | 'spouse'

// มูลค่าสินทรัพย์ลงทุน + เมนูย่อย "การปรับสัดส่วนลงทุน" ในหน้าเดียวกัน
function InvestmentWithRebalance({ person = 'self' }: { person?: Person }) {
  const [sub, setSub] = useState<'value' | 'rebalance'>('value')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'inline-flex', gap: 3, background: 'var(--navy-900)', padding: 3, borderRadius: 10, border: '1px solid var(--card-border)', alignSelf: 'flex-start' }}>
        {([['value', 'มูลค่าสินทรัพย์ลงทุน', TrendingUp], ['rebalance', 'การปรับสัดส่วนลงทุน', SlidersHorizontal]] as const).map(([k, lbl, Ic]) => (
          <button key={k} onClick={() => setSub(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: sub === k ? 'var(--cyan)' : 'transparent', color: sub === k ? '#00201d' : 'var(--text-secondary)' }}>
            <Ic size={14} /> {lbl}
          </button>
        ))}
      </div>
      {sub === 'value' ? <ProjectionInvestmentTab key={person} person={person} /> : <RebalanceTab key={person} person={person} />}
    </div>
  )
}

const TABS = [
  { key: 'investment', label: 'มูลค่าสินทรัพย์ลงทุน', icon: TrendingUp, Comp: InvestmentWithRebalance, proj: true, hasPerson: true },
  { key: 'social', label: 'กองทุนประกันสังคม', icon: Shield, Comp: ProjectionSocialSecurityTab, proj: true, hasPerson: true },
  { key: 'pvd', label: 'กองทุนสำรองเลี้ยงชีพ', icon: Briefcase, Comp: ProjectionPVDTab, proj: true, hasPerson: true },
  { key: 'severance', label: 'เงินชดเชยเกษียณอายุ', icon: Scale, Comp: ProjectionSeveranceTab, proj: true, hasPerson: true },
  { key: 'retirement', label: 'วางแผนเกษียณ', icon: Target, Comp: RetirementPlanPage, proj: false, hasPerson: true },
  { key: 'education', label: 'ทุนการศึกษาบุตร', icon: GraduationCap, Comp: EducationPlanPage, proj: false, hasPerson: false },
  { key: 'insurance', label: 'วางแผนประกัน', icon: HeartPulse, Comp: InsurancePlanPage, proj: false, hasPerson: true },
  { key: 'tax', label: 'วางแผนภาษี', icon: Receipt, Comp: TaxPlanningPage, proj: false, hasPerson: false },
  { key: 'estate', label: 'วางแผนมรดก', icon: ScrollText, Comp: EstatePlanPage, proj: false, hasPerson: true },
] as const

const TAB_KEYS = TABS.map(t => t.key) as string[]

export default function FinancialPlanPage() {
  const [searchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const [tab, setTab] = useState<string>(urlTab && TAB_KEYS.includes(urlTab) ? urlTab : 'investment')
  const [person, setPerson] = useState<Person>('self')
  // ขับแท็บจาก URL (?tab=) — เมนูย่อยใน sidebar ลิงก์มาที่นี่
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && TAB_KEYS.includes(t) && t !== tab) setTab(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setTopSlot(document.getElementById('topbar-actions')) }, [])
  const active = TABS.find(t => t.key === tab)!
  const Active = active.Comp as any

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const clientName = clientProfile?.firstName ? `คุณ${clientProfile.firstName}` : 'ลูกค้า'
  const spouseName = clientProfile?.spouseProfile?.firstName ? `คุณ${clientProfile.spouseProfile.firstName}` : 'คู่สมรส'
  // remount แท็บเมื่อสลับลูกค้า → รีเซ็ต local state (loadedRef/auto-fill) ให้ดึงชื่อ/อายุของลูกค้าที่เลือกใหม่ถูกต้อง
  const { selectedClient } = useClient()
  const clientKey = selectedClient?.id ?? 'me'
  // ซ่อนปุ่มสลับคู่สมรสเมื่อลูกค้าโสด/ไม่มีคู่สมรส
  const showSpouse = hasSpouseInfo(clientProfile)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('self') }, [showSpouse, person])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ปุ่มสลับลูกค้า/คู่สมรส → topbar (portal) · แท็บย้ายไปเป็นเมนูย่อยใน sidebar */}
      {topSlot && active.hasPerson && showSpouse && createPortal(
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--navy-900)', padding: 3, borderRadius: 9, border: '1px solid var(--card-border)' }}>
          {([['self', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).map(([key, c, Icon, label]) => (
            <button key={key} onClick={() => setPerson(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: person === key ? `${c}20` : 'transparent', color: person === key ? c : 'var(--text-muted)', fontWeight: person === key ? 600 : 400, fontSize: 12.5 }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>, topSlot)}

      <PageHeader icon={active.icon} title={active.label} subtitle="วางแผนการเงิน" />

      {active.proj
        ? <Active key={`${person}-${clientKey}`} person={person} />
        : active.hasPerson
          ? <Active key={clientKey} person={person} />
          : <Active key={clientKey} />}

      {/* นำทางวางแผนทีละหน้า — ก่อนหน้า / ถัดไป (ลำดับกลาง PLANNING_STEPS ตรงกับ sidebar) */}
      <WizardNav steps={PLANNING_STEPS} current={tab} />
    </div>
  )
}
