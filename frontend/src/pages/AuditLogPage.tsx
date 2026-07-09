import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ShieldCheck, Eye, Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card } from '../styles/dark'

type Log = {
  id: string
  actorName: string
  clientName: string
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE'
  resource: string
  resourceLabel: string
  ip: string | null
  createdAt: string
}

const ACTION: Record<string, { label: string; color: string; Icon: any }> = {
  VIEW: { label: 'เปิดดู', color: '#38bdf8', Icon: Eye },
  CREATE: { label: 'เพิ่ม', color: '#10b981', Icon: Plus },
  UPDATE: { label: 'แก้ไข', color: '#f59e0b', Icon: Pencil },
  DELETE: { label: 'ลบ', color: '#fb7185', Icon: Trash2 },
}

export default function AuditLogPage() {
  const { data, isLoading } = useQuery<{ total: number; logs: Log[] }>({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/audit-logs', { params: { limit: 200 } }).then(r => r.data),
  })
  const logs = data?.logs ?? []

  const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader icon={ShieldCheck} title="บันทึกการเข้าถึงข้อมูล" subtitle="PDPA · ใครเปิดดู/แก้ไข/ลบ ข้อมูลลูกค้าเมื่อไหร่" />

      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>กำลังโหลด...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีบันทึกการเข้าถึง</div>
        ) : (
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)', background: 'var(--navy-900)' }}>
                <th style={th}>เวลา</th>
                <th style={th}>ผู้ใช้งาน (นักวางแผน)</th>
                <th style={th}>ลูกค้า</th>
                <th style={th}>การกระทำ</th>
                <th style={th}>ข้อมูล</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => {
                const a = ACTION[l.action] ?? { label: l.action, color: 'var(--text-muted)', Icon: Eye }
                return (
                  <tr key={l.id} style={{ background: i % 2 ? 'var(--hover)' : 'transparent' }}>
                    <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(l.createdAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ ...td, color: 'var(--text-primary)', fontWeight: 600 }}>{l.actorName}</td>
                    <td style={td}>{l.clientName}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: `${a.color}1f`, color: a.color, fontSize: 11.5, fontWeight: 700 }}>
                        <a.Icon size={12} /> {a.label}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-primary)' }}>{l.resourceLabel}</td>
                    <td style={{ ...td, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11.5 }}>{l.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {data && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>แสดง {logs.length} จากทั้งหมด {data.total} รายการ (ล่าสุด 200 รายการ)</div>}
    </div>
  )
}
