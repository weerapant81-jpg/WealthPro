import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useClient } from '../context/ClientContext'
import { CalendarClock, ListTodo, Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Newspaper, Pin, BellRing, ClipboardCheck } from 'lucide-react'

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 20px' }
const inp: React.CSSProperties = { padding: '8px 10px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 16, outline: 'none', boxSizing: 'border-box' }

type Appt = { id: string; title: string; clientName?: string | null; date: string; note?: string | null }
type Review = { clientId: string; clientName: string; date: string }
type Task = { id: string; title: string; done: boolean; dueDate?: string | null }
type News = { id: string; title: string; body: string; pinned: boolean; createdAt: string }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

/* ══ นัดหมาย + ปฏิทิน ══ */
export function AppointmentsWidget() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { setSelectedClient } = useClient()
  const { data: appts = [] } = useQuery<Appt[]>({ queryKey: ['appointments'], queryFn: () => api.get('/appointments').then(r => r.data), retry: false })
  // วันนัดทบทวนแผนของลูกค้าทุกคน (ตั้งที่หน้าแผนปฏิบัติการ) — read-only บนปฏิทิน
  const { data: reviews = [] } = useQuery<Review[]>({ queryKey: ['plan-reviews'], queryFn: () => api.get('/advisor/plan-reviews').then(r => r.data), retry: false })

  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState<string | null>(null)   // YYYY-MM-DD
  const [form, setForm] = useState({ title: '', clientName: '', time: '09:00', note: '' })

  const byDay = new Map<string, Appt[]>()
  for (const a of appts) { const k = ymd(new Date(a.date)); const arr = byDay.get(k) ?? []; arr.push(a); byDay.set(k, arr) }
  const reviewByDay = new Map<string, Review[]>()
  for (const rv of reviews) { const k = ymd(new Date(rv.date)); const arr = reviewByDay.get(k) ?? []; arr.push(rv); reviewByDay.set(k, arr) }

  // ไปหน้าแผนปฏิบัติการของลูกค้าที่คลิก
  const goClientPlan = (clientId: string, clientName: string) => {
    setSelectedClient({ id: clientId, name: clientName, email: '' } as any)
    sessionStorage.setItem('selected_client_id', clientId)
    sessionStorage.setItem('selected_client_name', clientName)
    sessionStorage.setItem('selected_client_email', '')
    navigate('/action-plan')
  }

  // แจ้งเตือนล่วงหน้า: นัดทบทวนที่จะถึงภายใน 15 วัน
  const startToday = new Date(new Date().toDateString())
  const in15 = new Date(startToday); in15.setDate(in15.getDate() + 15)
  const daysLeft = (d: string) => Math.round((+new Date(new Date(d).toDateString()) - +startToday) / 86400000)
  const soonReviews = reviews
    .filter(r => { const d = new Date(new Date(r.date).toDateString()); return d >= startToday && d <= in15 })
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))

  const add = useMutation({
    mutationFn: () => api.post('/appointments', { title: form.title.trim(), clientName: form.clientName.trim() || undefined, date: `${sel}T${form.time}:00`, note: form.note.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['appointments'] }); setForm({ title: '', clientName: '', time: '09:00', note: '' }); setSel(null) },
  })
  const closeDialog = () => { setSel(null); setForm({ title: '', clientName: '', time: '09:00', note: '' }) }
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/appointments/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }) })

  // month grid
  const y = cursor.getFullYear(), m = cursor.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const todayKey = ymd(new Date())

  type UpItem = { kind: 'appt'; a: Appt } | { kind: 'review'; r: Review }
  const upItemDate = (u: UpItem) => u.kind === 'appt' ? u.a.date : u.r.date
  const upcoming: UpItem[] = [
    ...appts.filter(a => new Date(a.date) >= startToday).map(a => ({ kind: 'appt' as const, a })),
    ...reviews.filter(r => new Date(new Date(r.date).toDateString()) >= startToday).map(r => ({ kind: 'review' as const, r })),
  ].sort((x, y) => +new Date(upItemDate(x)) - +new Date(upItemDate(y))).slice(0, 6)
  const selAppts = sel ? (byDay.get(sel) ?? []) : []
  const selReviews = sel ? (reviewByDay.get(sel) ?? []) : []

  return (
    <>
      {soonReviews.length > 0 && (
        <div style={{ ...card, marginBottom: 16, background: 'linear-gradient(150deg, rgba(245,158,11,0.14), var(--card-bg) 60%)', border: '1px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellRing size={17} color="#f59e0b" />
            <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>ใกล้ถึงนัดทบทวนแผน (ภายใน 15 วัน)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {soonReviews.map(r => {
              const dl = daysLeft(r.date)
              return (
                <button key={r.clientId} onClick={() => goClientPlan(r.clientId, r.clientName)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--navy-900)', border: '1px solid #f59e0b55', borderRadius: 10, cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <ClipboardCheck size={14} color="#f59e0b" />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.clientName}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{new Date(r.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.14)', borderRadius: 6, padding: '1px 7px' }}>{dl <= 0 ? 'วันนี้' : `อีก ${dl} วัน`}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16, alignItems: 'stretch' }}>
        {/* ── การ์ด 1: ปฏิทิน ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarClock size={18} color="var(--cyan)" /><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ปฏิทิน</p></div>
          <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button onClick={() => setCursor(new Date(y, m - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{TH_MONTH[m]} {y + 543}</span>
            <button onClick={() => setCursor(new Date(y, m + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2, textAlign: 'center' }}>
            {TH_DOW.map(d => <div key={d} style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700, padding: '2px 0' }}>{d}</div>)}
            {cells.map((day, i) => {
              if (day == null) return <div key={i} />
              const key = ymd(new Date(y, m, day))
              const has = byDay.has(key)
              const hasReview = reviewByDay.has(key)
              const isToday = key === todayKey
              const isSel = key === sel
              return (
                <button key={i} onClick={() => setSel(key)}
                  style={{ position: 'relative', aspectRatio: '1', minWidth: 0, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16,
                    background: isSel ? 'var(--cyan)' : isToday ? 'var(--cyan-dim)' : 'transparent',
                    color: isSel ? '#00201d' : isToday ? 'var(--cyan)' : 'var(--text-secondary)', fontWeight: isToday || isSel ? 700 : 400 }}>
                  {day}
                  {(has || hasReview) && (
                    <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                      {has && <span style={{ width: 4, height: 4, borderRadius: 999, background: isSel ? '#00201d' : 'var(--cyan)' }} />}
                      {hasReview && <span style={{ width: 4, height: 4, borderRadius: 999, background: '#f59e0b' }} />}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          </div>
        </div>

        {/* ── การ์ด 2: นัดหมายที่จะถึง ── */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarClock size={18} color="var(--cyan)" /><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>นัดหมายที่จะถึง</p></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.length === 0
            ? <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>ยังไม่มีนัดหมาย — คลิกวันในปฏิทินเพื่อเพิ่ม</p>
            : upcoming.map(u => {
              const d = upItemDate(u)
              const accent = u.kind === 'review' ? '#f59e0b' : 'var(--cyan)'
              return (
                <div key={u.kind === 'appt' ? u.a.id : `rv-${u.r.clientId}`}
                  onClick={u.kind === 'review' ? () => goClientPlan(u.r.clientId, u.r.clientName) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--navy-900)', borderRadius: 8, border: `1px solid ${u.kind === 'review' ? '#f59e0b55' : 'var(--divider)'}`, cursor: u.kind === 'review' ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{TH_MONTH[new Date(d).getMonth()]}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: accent }}>{new Date(d).getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {u.kind === 'appt' ? (
                      <>
                        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{u.a.title}</div>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{new Date(u.a.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}{u.a.clientName ? ` · ${u.a.clientName}` : ''}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardCheck size={14} color="#f59e0b" />ทบทวนแผน · {u.r.clientName}</div>
                        <div style={{ fontSize: 13, color: '#f59e0b' }}>นัดทบทวนแผนการเงิน</div>
                      </>
                    )}
                  </div>
                  {u.kind === 'appt'
                    ? <button onClick={() => del.mutate(u.a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                    : <ChevronRight size={15} color="#f59e0b" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Dialog: กรอกนัดหมายเมื่อคลิกวันที่ ── */}
      {sel && (
        <div onClick={closeDialog} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarClock size={16} color="var(--cyan)" />
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{new Date(sel).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={closeDialog} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
            </div>

            {selAppts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selAppts.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--navy-900)', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--cyan)' }}>{new Date(a.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary)' }}>{a.title}{a.clientName ? ` · ${a.clientName}` : ''}</span>
                    <button onClick={() => del.mutate(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--divider)', margin: '2px 0' }} />
              </div>
            )}

            {selReviews.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selReviews.map(r => (
                  <button key={r.clientId} onClick={() => goClientPlan(r.clientId, r.clientName)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b55', borderRadius: 8, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <ClipboardCheck size={14} color="#f59e0b" />
                    <span style={{ flex: 1, fontSize: 12.5, textAlign: 'left' }}>ทบทวนแผน · {r.clientName}</span>
                    <ChevronRight size={14} color="#f59e0b" />
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--divider)', margin: '2px 0' }} />
              </div>
            )}

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="หัวข้อนัดหมาย" autoFocus style={inp} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="ลูกค้า (ไม่บังคับ)" style={{ ...inp, flex: 1 }} />
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} style={{ ...inp, width: 110 }} />
            </div>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="โน้ต (ไม่บังคับ)" rows={2} style={{ ...inp, resize: 'vertical' as const }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => form.title.trim() && add.mutate()} disabled={!form.title.trim() || add.isPending}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: form.title.trim() ? 1 : 0.5 }}>
                <Plus size={14} /> {add.isPending ? 'กำลังบันทึก...' : 'บันทึกนัดหมาย'}
              </button>
              <button onClick={closeDialog} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ══ รายการงาน (To-do) ══ */
export function TasksWidget() {
  const qc = useQueryClient()
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: () => api.get('/tasks').then(r => r.data), retry: false })
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const inv = () => qc.invalidateQueries({ queryKey: ['tasks'] })
  const add = useMutation({ mutationFn: () => api.post('/tasks', { title: title.trim(), dueDate: due || undefined }), onSuccess: () => { inv(); setTitle(''); setDue('') } })
  const toggle = useMutation({ mutationFn: (t: Task) => api.put(`/tasks/${t.id}`, { done: !t.done }), onSuccess: inv })
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/tasks/${id}`), onSuccess: inv })
  const pending = tasks.filter(t => !t.done).length

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ListTodo size={18} color="var(--cyan)" /><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>To do list</p></div>
        {pending > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 5, padding: '2px 8px' }}>ค้าง {pending}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
        {tasks.length === 0 && <p style={{ fontSize: 16, color: 'var(--text-muted)' }}>ยังไม่มีงาน</p>}
        {tasks.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' }}>
            <button onClick={() => toggle.mutate(t)}
              style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 5, border: `2px solid ${t.done ? 'var(--cyan)' : 'var(--outline, var(--card-border))'}`, background: t.done ? 'var(--cyan)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {t.done && <Check size={13} color="#00201d" />}
            </button>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 16, color: t.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
              {t.dueDate && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 5, padding: '1px 7px', whiteSpace: 'nowrap' }}>{new Date(t.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
            </span>
            <button onClick={() => del.mutate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.7 }}><X size={14} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && title.trim()) add.mutate() }}
          placeholder="เพิ่มงานใหม่..." style={{ ...inp, flex: 1, minWidth: 0 }} />
        <input type="date" value={due} onChange={e => setDue(e.target.value)} title="กำหนดการ" style={{ ...inp, width: 140, color: due ? 'var(--text-primary)' : 'var(--text-muted)' }} />
        <button onClick={() => title.trim() && add.mutate()} disabled={!title.trim()}
          style={{ padding: '8px 12px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', cursor: 'pointer', opacity: title.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center' }}><Plus size={16} /></button>
      </div>
    </div>
  )
}

/* ══ ข่าว/ประกาศจากผู้ให้บริการ ══ */
export function NewsWidget() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'
  const { data: news = [] } = useQuery<News[]>({ queryKey: ['announcements'], queryFn: () => api.get('/announcements').then(r => r.data), retry: false })
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [open, setOpen] = useState(false)
  const inv = () => qc.invalidateQueries({ queryKey: ['announcements'] })
  const add = useMutation({ mutationFn: () => api.post('/announcements', { title: form.title.trim(), body: form.body.trim(), pinned: form.pinned }), onSuccess: () => { inv(); setForm({ title: '', body: '', pinned: false }); setOpen(false) } })
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/announcements/${id}`), onSuccess: inv })

  return (
    <div style={{ ...card, borderLeft: '4px solid var(--cyan)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Newspaper size={18} color="var(--cyan)" /><p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ข่าวสารจากผู้ให้บริการ</p></div>
        {isSuper && <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{open ? <X size={13} /> : <Plus size={13} />} {open ? 'ปิด' : 'โพสต์ข่าว'}</button>}
      </div>

      {isSuper && open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: 12, background: 'var(--navy-900)', borderRadius: 10 }}>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="หัวข้อข่าว" style={inp} />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="เนื้อหา" rows={3} style={{ ...inp, resize: 'vertical' as const }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} /> ปักหมุด
            </label>
            <button onClick={() => form.title.trim() && form.body.trim() && add.mutate()} disabled={!form.title.trim() || !form.body.trim() || add.isPending}
              style={{ padding: '8px 18px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (form.title.trim() && form.body.trim()) ? 1 : 0.5 }}>เผยแพร่</button>
          </div>
        </div>
      )}

      {news.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>ยังไม่มีข่าวสาร</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 420, overflowY: 'auto' }}>
          {news.map(n => (
            <div key={n.id} style={{ position: 'relative', padding: '18px 20px', background: 'var(--navy-900)', borderRadius: 14, border: `1px solid ${n.pinned ? 'var(--cyan)' : 'var(--card-border)'}`, boxShadow: n.pinned ? '0 0 0 1px var(--cyan-dim), var(--shadow)' : 'none' }}>
              {/* badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cyan)', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', borderRadius: 999, padding: '3px 11px' }}>
                  {n.pinned ? <><Pin size={11} /> สำคัญ</> : 'WEALTHPRO INSIGHT'}
                </span>
                {isSuper && <button onClick={() => del.mutate(n.id)} title="ลบข่าว" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><Trash2 size={15} /></button>}
              </div>
              {/* หัวข้อใหญ่ */}
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25, margin: '0 0 8px' }}>{n.title}</h3>
              {/* เนื้อหา */}
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{n.body}</p>
              {/* footer */}
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                {new Date(n.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
