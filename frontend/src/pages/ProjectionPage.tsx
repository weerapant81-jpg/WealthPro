import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { hasSpouseInfo } from '../lib/spouse'
import { TrendingUp, Shield, Briefcase, Scale, User, Users } from 'lucide-react'
import ProjectionInvestmentTab from './projection/ProjectionInvestmentTab'
import ProjectionSocialSecurityTab from './projection/ProjectionSocialSecurityTab'
import ProjectionPVDTab from './projection/ProjectionPVDTab'
import ProjectionSeveranceTab from './projection/ProjectionSeveranceTab'

export type Person = 'self' | 'spouse'

const TABS = [
  { key: 'investment', label: 'มูลค่าของสินทรัพย์ลงทุน', icon: TrendingUp },
  { key: 'social', label: 'กองทุนประกันสังคม', icon: Shield },
  { key: 'pvd', label: 'มูลค่ากองทุน PVD/กบข', icon: Briefcase },
  { key: 'severance', label: 'เงินชดเชยตามกฎหมายแรงงาน', icon: Scale },
]

export default function ProjectionPage() {
  const [activeTab, setActiveTab] = useState('investment')
  const [person, setPerson] = useState<Person>('self')

  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const clientName = clientProfile?.firstName ? `คุณ${clientProfile.firstName}` : 'ลูกค้า'
  const spouseName = clientProfile?.spouseProfile?.firstName ? `คุณ${clientProfile.spouseProfile.firstName}` : 'คู่สมรส'
  const showSpouse = hasSpouseInfo(clientProfile)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('self') }, [showSpouse, person])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          มูลค่าอนาคตของสินทรัพย์
        </h2>

        {/* Person switcher */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--navy-950)', padding: 4, borderRadius: 10, border: '1px solid var(--card-border)' }}>
          {([['self', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).filter(([key]) => showSpouse || key === 'self').map(([key, c, Icon, label]) => (
            <button key={key} onClick={() => setPerson(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: person === key ? `${c}20` : 'transparent', color: person === key ? c : 'var(--text-muted)', fontWeight: person === key ? 600 : 400, fontSize: 13, transition: 'all 0.15s' }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', fontSize: 13, fontWeight: active ? 600 : 400,
                color: active ? 'var(--cyan-light)' : 'var(--text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--cyan)' : '2px solid transparent',
                marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Tab content — key={person} so it remounts & reloads data on switch */}
      {activeTab === 'investment' && <ProjectionInvestmentTab key={person} person={person} />}
      {activeTab === 'social'     && <ProjectionSocialSecurityTab key={person} person={person} />}
      {activeTab === 'pvd'        && <ProjectionPVDTab key={person} person={person} />}
      {activeTab === 'severance'  && <ProjectionSeveranceTab key={person} person={person} />}
    </div>
  )
}
