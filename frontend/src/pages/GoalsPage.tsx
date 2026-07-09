import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, Target } from 'lucide-react'
import { card, inp, sel, btn, btnGhost } from '../styles/dark'

const CATS = ['EMERGENCY_FUND', 'RETIREMENT', 'HOUSE', 'EDUCATION', 'TRAVEL', 'OTHER']
const CAT_TH: Record<string, string> = { EMERGENCY_FUND: 'กองทุนฉุกเฉิน', RETIREMENT: 'เกษียณ', HOUSE: 'บ้าน', EDUCATION: 'การศึกษา', TRAVEL: 'ท่องเที่ยว', OTHER: 'อื่นๆ' }
const CAT_COLOR: Record<string, string> = { EMERGENCY_FUND: '#f59e0b', RETIREMENT: '#0ea5e9', HOUSE: '#10b981', EDUCATION: '#8b5cf6', TRAVEL: '#06b6d4', OTHER: '#6b7280' }

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n)
}

type Goal = { id: string; name: string; targetAmount: number; currentAmount: number; targetDate: string; category: string; priority: number }

function GoalForm({ onSave, initial, onCancel }: { onSave: (d: any) => void; initial?: Goal; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '', targetAmount: initial?.targetAmount || '',
    currentAmount: initial?.currentAmount || 0,
    targetDate: initial?.targetDate?.split('T')[0] || '',
    category: initial?.category || 'EMERGENCY_FUND', priority: initial?.priority || 1,
  })
  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10, marginBottom: 10 }}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อเป้าหมาย" style={{ ...inp, gridColumn: '1/-1' }} />
        <input type="number" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))} placeholder="เงินเป้าหมาย (บาท)" style={inp} />
        <input type="number" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: Number(e.target.value) }))} placeholder="มีแล้ว (บาท)" style={inp} />
        <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} style={inp} />
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={sel}>
          {CATS.map(c => <option key={c} value={c}>{CAT_TH[c]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ ...form, targetDate: new Date(form.targetDate).toISOString() })} style={btn('#f59e0b')}>บันทึก</button>
        <button onClick={onCancel} style={btnGhost}>ยกเลิก</button>
      </div>
    </div>
  )
}

export default function GoalsPage() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ['goals'], queryFn: () => api.get('/goals').then(r => r.data) })
  const inv = () => qc.invalidateQueries({ queryKey: ['goals'] })
  const create = useMutation({ mutationFn: (d: any) => api.post('/goals', d), onSuccess: () => { inv(); setAdding(false) } })
  const update = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/goals/${id}`, d), onSuccess: () => { inv(); setEditing(null) } })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/goals/${id}`), onSuccess: inv })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>เป้าหมายการเงิน</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{goals.length} เป้าหมาย</p>
        </div>
        <button onClick={() => setAdding(true)} style={btn('#f59e0b')}><Plus size={15} />เพิ่มเป้าหมาย</button>
      </div>

      {adding && <GoalForm onSave={d => create.mutate(d)} onCancel={() => setAdding(false)} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {goals.map(g => {
          const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100)
          const remaining = g.targetAmount - g.currentAmount
          const daysLeft = Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000)
          const color = CAT_COLOR[g.category] || '#6b7280'

          return editing === g.id
            ? <GoalForm key={g.id} initial={g} onSave={d => update.mutate({ ...d, id: g.id })} onCancel={() => setEditing(null)} />
            : (
              <div key={g.id} style={{ ...card, borderTop: `3px solid ${color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: `${color}20`, color, fontWeight: 500 }}>{CAT_TH[g.category]}</span>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>{g.name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setEditing(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Pencil size={14} /></button>
                    <button onClick={() => remove.mutate(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <span>มีแล้ว <strong style={{ color: 'var(--text-primary)' }}>{fmt(g.currentAmount)}</strong></span>
                  <span>เป้า <strong style={{ color: 'var(--text-primary)' }}>{fmt(g.targetAmount)}</strong></span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 99, height: 6, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{ color }}>{pct.toFixed(1)}%</span>
                  <span>ขาดอีก {fmt(remaining)}</span>
                  <span>{daysLeft > 0 ? `เหลือ ${daysLeft} วัน` : '⚠ เลยกำหนด'}</span>
                </div>
              </div>
            )
        })}
      </div>

      {goals.length === 0 && !adding && (
        <div style={{ ...card, textAlign: 'center', padding: '60px 24px' }}>
          <Target size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>ยังไม่มีเป้าหมาย กด "เพิ่มเป้าหมาย" เพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  )
}
