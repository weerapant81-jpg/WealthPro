import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Check, X, Users, Clock, UserCheck } from 'lucide-react'
import * as s from '../styles/dark'
import { TableExcelButton } from '../components/exportable'

interface AdminUser {
  id: string
  email: string
  name: string
  phone: string | null
  birthDate: string | null
  role: string
  isEmailVerified: boolean
  isApproved: boolean
  createdAt: string
}

export default function AdminPage() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'all'>('pending')
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users', tab],
    queryFn: async () => {
      const { data } = await api.get(`/admin/users?status=${tab}`)
      return data
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.put(`/admin/users/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const reject = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const tabs = [
    { key: 'pending', label: 'รอการอนุมัติ', icon: Clock },
    { key: 'approved', label: 'อนุมัติแล้ว', icon: UserCheck },
    { key: 'all', label: 'ทั้งหมด', icon: Users },
  ] as const

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={s.h2}>อนุมัตินักวางแผน (FA)</h1>
        <p style={s.muted}>อนุมัติหรือปฏิเสธการสมัครของนักวางแผนการเงิน</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
            background: tab === key ? 'var(--cyan-dim)' : 'var(--divider)',
            color: tab === key ? 'var(--cyan-light)' : 'var(--text-muted)',
          }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={s.card}>
        {isLoading ? (
          <p style={{ ...s.muted, textAlign: 'center', padding: 40 }}>กำลังโหลด...</p>
        ) : users.length === 0 ? (
          <p style={{ ...s.muted, textAlign: 'center', padding: 40 }}>ไม่มีรายการ</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TableExcelButton filename="รายชื่อผู้ใช้งาน" title="ผู้ใช้งาน" />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['ชื่อ', 'อีเมล', 'เบอร์โทร', 'วันเกิด', 'ยืนยันอีเมล', 'สถานะ', 'วันสมัคร', 'การจัดการ'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '12px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>{u.phone || '-'}</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-secondary)' }}>
                      {u.birthDate ? new Date(u.birthDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: u.isEmailVerified ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: u.isEmailVerified ? '#22c55e' : '#ef4444' }}>
                        {u.isEmailVerified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: u.isApproved ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)', color: u.isApproved ? 'var(--cyan)' : '#f59e0b' }}>
                        {u.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString('th-TH')}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      {!u.isApproved && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => approve.mutate(u.id)}
                            title="อนุมัติ"
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <Check size={13} /> อนุมัติ
                          </button>
                          <button onClick={() => { if (confirm(`ลบผู้ใช้ ${u.email} ?`)) reject.mutate(u.id) }}
                            title="ปฏิเสธ"
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <X size={13} /> ปฏิเสธ
                          </button>
                        </div>
                      )}
                      {u.isApproved && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
