import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../lib/auth'
import { User, Mail, Phone, LogOut } from 'lucide-react'

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 18 }

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--card-border)' }}>
      <Icon size={18} color="var(--text-muted)" />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value || '—'}</span>
    </div>
  )
}

export default function PortalProfile() {
  const { user } = useAuth()
  const { data: profile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || user?.name || 'ลูกค้า'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 800 }}>โปรไฟล์</div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--navy-800, rgba(0,207,193,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={26} color="var(--cyan)" />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{fullName}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ลูกค้า WealthPro</div>
        </div>
      </div>

      <div style={card}>
        <Row icon={Mail} label="อีเมล" value={profile?.contactEmail || user?.email} />
        <Row icon={Phone} label="เบอร์โทร" value={profile?.phone} />
      </div>

      <button onClick={logout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 12,
          border: '1px solid var(--card-border)', background: 'transparent', color: '#f43f5e', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        <LogOut size={17} /> ออกจากระบบ
      </button>
    </div>
  )
}
