import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useClient, type ClientInfo } from '../context/ClientContext'
import { Search, UserCircle, Phone, Mail, ArrowRight, UserPlus, X, Pencil, Trash2 } from 'lucide-react'

export default function ClientsPage() {
  const [q, setQ] = useState('')
  const { setSelectedClient } = useClient()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: clients = [], isLoading } = useQuery<ClientInfo[]>({
    queryKey: ['clients', q],
    queryFn: () => api.get('/clients', { params: { q } }).then(r => r.data),
    staleTime: 30_000,
  })

  function selectClient(c: ClientInfo, goto = '/') {
    setSelectedClient(c)
    sessionStorage.setItem('selected_client_id', c.id)
    sessionStorage.setItem('selected_client_name', c.name)
    sessionStorage.setItem('selected_client_email', c.email)
    navigate(goto)
  }

  // ── สร้าง/แก้ไข/ลบ ลูกค้า (FA จัดการได้เลย ไม่ต้อง login ซ้ำ) ──
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [err, setErr] = useState('')
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim() && emailOk && !!form.phone.trim()

  const resetForm = () => { setShowAdd(false); setEditId(null); setForm({ firstName: '', lastName: '', email: '', phone: '' }); setErr('') }
  const openAdd = () => { setEditId(null); setForm({ firstName: '', lastName: '', email: '', phone: '' }); setErr(''); setShowAdd(true) }
  const openEdit = (c: ClientInfo) => {
    const parts = (c.name || '').trim().split(/\s+/)
    setEditId(c.id); setErr('')
    setForm({ firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', email: c.email || '', phone: c.phone || '' })
    setShowAdd(true)
  }

  const save = useMutation({
    mutationFn: () => {
      if (!form.firstName.trim()) throw new Error('กรุณาระบุชื่อ')
      if (!form.lastName.trim()) throw new Error('กรุณาระบุนามสกุล')
      if (!emailOk) throw new Error('กรุณาระบุอีเมลให้ถูกต้อง')
      if (!form.phone.trim()) throw new Error('กรุณาระบุเบอร์โทรศัพท์')
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`
      const body = { name, firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() }
      return editId
        ? api.put(`/clients/${editId}`, body).then(r => r.data)
        : api.post('/clients', body).then(r => r.data)
    },
    onSuccess: (c: ClientInfo) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      const wasEdit = !!editId
      resetForm()
      if (!wasEdit) selectClient(c, '/client')   // สร้างใหม่ → เลือก + ไปหน้ากรอกข้อมูลทันที
    },
    onError: (e: any) => setErr(e?.response?.data?.error || e?.message || 'บันทึกไม่สำเร็จ'),
  })

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เลือกลูกค้า</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>ค้นหาและเลือกลูกค้าที่ต้องการดูข้อมูล</p>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="ค้นหาชื่อหรืออีเมลลูกค้า..."
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px 12px 40px',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 12, color: 'var(--text-primary)', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>กำลังโหลด...</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <UserCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>ไม่พบลูกค้า{q ? ` ที่ตรงกับ "${q}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(c => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 20px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 14,
              }}
            >
              <div
                onClick={() => selectClient(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, cursor: 'pointer', minWidth: 0 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--cyan-dim)', border: '1.5px solid var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, fontWeight: 700, color: 'var(--cyan)' }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      <Mail size={12} />{c.email}
                    </span>
                    {c.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        <Phone size={12} />{c.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* ปุ่มจัดการ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button title="แก้ไข" onClick={() => openEdit(c)}
                  style={{ display: 'flex', padding: 8, borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.borderColor = 'var(--cyan)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--card-border)' }}>
                  <Pencil size={15} />
                </button>
                <button title="ลบ" disabled={del.isPending}
                  onClick={() => { if (confirm(`ลบลูกค้า "${c.name}" ?\nข้อมูลทั้งหมดของลูกค้ารายนี้จะถูกลบถาวร`)) del.mutate(c.id) }}
                  style={{ display: 'flex', padding: 8, borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f43f5e'; e.currentTarget.style.borderColor = '#f43f5e' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--card-border)' }}>
                  <Trash2 size={15} />
                </button>
                <ArrowRight size={16} onClick={() => selectClient(c)} style={{ color: 'var(--cyan)', cursor: 'pointer', marginLeft: 2 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new client */}
      {!showAdd ? (
        <div style={{ marginTop: 32, padding: '20px 24px', background: 'var(--card-bg)', border: '1px dashed var(--card-border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>เพิ่มลูกค้าใหม่</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>สร้างลูกค้าใหม่ในความดูแลของคุณได้ทันที</div>
          </div>
          <button onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <UserPlus size={14} /> สร้างลูกค้า
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 32, padding: '20px 24px', background: 'var(--card-bg)', border: '1px solid var(--cyan)', borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{editId ? 'แก้ไขข้อมูลลูกค้า' : 'สร้างลูกค้าใหม่'}</div>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {([['firstName', 'ชื่อ *', 'text'], ['lastName', 'นามสกุล *', 'text'], ['email', 'อีเมล *', 'email'], ['phone', 'เบอร์โทร *', 'tel']] as const).map(([k, ph, type]) => (
              <input key={k} type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph}
                style={{ padding: '10px 12px', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            ))}
          </div>
          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: '#f43f5e' }}>{err}</div>}
          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={() => save.mutate()} disabled={!canSubmit || save.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: (!canSubmit || save.isPending) ? 'not-allowed' : 'pointer', opacity: (!canSubmit || save.isPending) ? 0.5 : 1 }}>
              <UserPlus size={14} /> {save.isPending ? 'กำลังบันทึก...' : editId ? 'บันทึกการแก้ไข' : 'สร้างและเริ่มกรอกข้อมูล'}
            </button>
            <button onClick={resetForm} style={{ padding: '9px 16px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
          </div>
        </div>
      )}
    </div>
  )
}
