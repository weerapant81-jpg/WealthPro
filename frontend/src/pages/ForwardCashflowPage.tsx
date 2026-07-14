import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { CalendarRange, User, Users } from 'lucide-react'
import { PageHeader } from '../components/ui'
import ForwardCashflowTab from './ForwardCashflowTab'
import { hasSpouseInfo } from '../lib/spouse'

export default function ForwardCashflowPage() {
  const [person, setPerson] = useState<'self' | 'spouse'>('self')
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null)
  useEffect(() => { setTopSlot(document.getElementById('topbar-actions')) }, [])

  const { data: cp } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const clientName = cp?.firstName ? `คุณ${cp.firstName}` : 'ลูกค้า'
  const spouseName = cp?.spouseProfile?.firstName ? `คุณ${cp.spouseProfile.firstName}` : 'คู่สมรส'
  const showSpouse = hasSpouseInfo(cp)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('self') }, [showSpouse, person])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {topSlot && showSpouse && createPortal(
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--navy-900)', padding: 3, borderRadius: 9, border: '1px solid var(--card-border)' }}>
          {([['self', '#06b6d4', User, clientName], ['spouse', '#c084fc', Users, spouseName]] as const).map(([key, c, Icon, label]) => (
            <button key={key} onClick={() => setPerson(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: person === key ? `${c}20` : 'transparent', color: person === key ? c : 'var(--text-muted)', fontWeight: person === key ? 600 : 400, fontSize: 12.5 }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>, topSlot)}

      <PageHeader icon={CalendarRange} title="งบการเงินล่วงหน้า" subtitle="ประมาณการกระแสเงินสดและภาษีล่วงหน้ารายปีจนถึงอายุขัย" />
      <ForwardCashflowTab person={person} />
    </div>
  )
}
