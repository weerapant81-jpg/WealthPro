import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Briefcase, TrendingUp, Heart, Baby, Home, CalendarClock, MessageSquare, Send, CheckCircle2, Clock } from 'lucide-react'

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 18 }

// ประเภทเหตุการณ์สำเร็จรูป — key ต้องตรงกับ backend (job|income|marital|child|home|review|other)
const CATS = [
  { key: 'job', label: 'เปลี่ยนงาน', icon: Briefcase },
  { key: 'income', label: 'รายได้เปลี่ยน', icon: TrendingUp },
  { key: 'marital', label: 'แต่งงาน/สถานะครอบครัว', icon: Heart },
  { key: 'child', label: 'มีบุตร', icon: Baby },
  { key: 'home', label: 'ซื้อบ้าน/อสังหาฯ', icon: Home },
  { key: 'review', label: 'ขอนัดทบทวนแผน', icon: CalendarClock },
  { key: 'other', label: 'อื่น ๆ', icon: MessageSquare },
]
const catLabel = (k: string) => CATS.find(c => c.key === k)?.label ?? k
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: 'ส่งแล้ว', color: 'var(--cyan)' },
  seen: { label: 'FA รับทราบ', color: '#f59e0b' },
  resolved: { label: 'ดำเนินการแล้ว', color: '#10b981' },
}

export default function PortalNotify() {
  const qc = useQueryClient()
  const [cat, setCat] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  const { data: history } = useQuery({ queryKey: ['my-requests'], queryFn: () => api.get('/client/requests').then(r => r.data), retry: false })
  const send = useMutation({
    mutationFn: () => api.post('/client/requests', { category: cat, message: msg.trim() || undefined }),
    onSuccess: () => { setOk(true); setCat(null); setMsg(''); qc.invalidateQueries({ queryKey: ['my-requests'] }); setTimeout(() => setOk(false), 4000) },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>แจ้งนักวางแผน</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>มีอะไรเปลี่ยนแปลง? กดแจ้งให้ FA ที่ดูแลคุณทราบได้เลย</div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>เลือกเรื่องที่ต้องการแจ้ง</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATS.map(c => {
            const on = cat === c.key
            return (
              <button key={c.key} onClick={() => setCat(c.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                  border: `1px solid ${on ? 'var(--cyan)' : 'var(--card-border)'}`,
                  background: on ? 'var(--cyan-dim, rgba(0,207,193,0.12))' : 'transparent',
                  color: on ? 'var(--cyan-light, var(--cyan))' : 'var(--text-secondary)' }}>
                <c.icon size={15} /> {c.label}
              </button>
            )
          })}
        </div>

        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} maxLength={2000}
          placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 14, padding: '11px 13px', borderRadius: 10,
            background: 'var(--navy-900)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />

        <button onClick={() => send.mutate()} disabled={!cat || send.isPending}
          style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', borderRadius: 10, border: 'none', cursor: (!cat || send.isPending) ? 'default' : 'pointer',
            background: (!cat || send.isPending) ? 'var(--card-border)' : 'var(--cyan)', color: '#00201d', fontSize: 15, fontWeight: 800, fontFamily: 'inherit' }}>
          <Send size={16} /> {send.isPending ? 'กำลังส่ง...' : 'ส่งคำแจ้ง'}
        </button>
        {ok && <div style={{ marginTop: 10, fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={15} /> ส่งให้นักวางแผนแล้ว จะติดต่อกลับโดยเร็ว</div>}
        {send.isError && <div style={{ marginTop: 10, fontSize: 13, color: '#f43f5e' }}>ส่งไม่สำเร็จ กรุณาลองใหม่</div>}
      </div>

      {/* ประวัติคำแจ้ง */}
      {Array.isArray(history) && history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>ประวัติการแจ้ง</div>
          {history.map((h: any) => {
            const st = STATUS[h.status] ?? STATUS.new
            return (
              <div key={h.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{catLabel(h.category)}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: st.color }}>
                    {h.status === 'resolved' ? <CheckCircle2 size={13} /> : <Clock size={13} />}{st.label}
                  </span>
                </div>
                {h.message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{h.message}</div>}
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  {new Date(h.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
