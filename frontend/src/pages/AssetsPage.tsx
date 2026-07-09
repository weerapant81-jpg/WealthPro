import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, Pencil, TrendingUp, AlertCircle } from 'lucide-react'
import { card, inp, sel, btn, btnGhost } from '../styles/dark'

const ASSET_CATS = ['CASH', 'INVESTMENT', 'REAL_ESTATE', 'VEHICLE', 'GOLD', 'CRYPTO', 'OTHER']
const LIAB_CATS = ['mortgage', 'car_loan', 'personal_loan', 'credit_card', 'student_loan', 'other']
const ASSET_TH: Record<string, string> = { CASH: 'เงินสด/เงินฝาก', INVESTMENT: 'การลงทุน', REAL_ESTATE: 'อสังหาริมทรัพย์', VEHICLE: 'ยานพาหนะ', GOLD: 'ทองคำ', CRYPTO: 'คริปโต', OTHER: 'อื่นๆ' }
const LIAB_TH: Record<string, string> = { mortgage: 'จำนอง/ผ่อนบ้าน', car_loan: 'ผ่อนรถ', personal_loan: 'สินเชื่อส่วนบุคคล', credit_card: 'บัตรเครดิต', student_loan: 'กยศ.', other: 'อื่นๆ' }

function fmt(n: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(n)
}

type Asset = { id: string; name: string; value: number; category: string; returnRate: number }
type Liability = { id: string; name: string; balance: number; interestRate: number; monthlyPayment: number; category: string }

function AssetForm({ onSave, initial, onCancel }: { onSave: (d: any) => void; initial?: Asset; onCancel: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', value: initial?.value || '', category: initial?.category || 'CASH', returnRate: initial?.returnRate || '' })
  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10, marginBottom: 10 }}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อสินทรัพย์" style={{ ...inp, gridColumn: '1/-1' }} />
        <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="มูลค่า (บาท)" style={inp} />
        <input type="number" value={form.returnRate} onChange={e => setForm(f => ({ ...f, returnRate: e.target.value }))} placeholder="ผลตอบแทน %/ปี" style={inp} />
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...sel, gridColumn: '1/-1' }}>
          {ASSET_CATS.map(c => <option key={c} value={c}>{ASSET_TH[c]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(form)} style={btn('#10b981')}>บันทึก</button>
        <button onClick={onCancel} style={btnGhost}>ยกเลิก</button>
      </div>
    </div>
  )
}

function LiabilityForm({ onSave, initial, onCancel }: { onSave: (d: any) => void; initial?: Liability; onCancel: () => void }) {
  const [form, setForm] = useState({ name: initial?.name || '', balance: initial?.balance || '', interestRate: initial?.interestRate || '', monthlyPayment: initial?.monthlyPayment || '', category: initial?.category || LIAB_CATS[0] })
  return (
    <div style={{ background: 'var(--navy-800)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10, marginBottom: 10 }}>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อหนี้สิน" style={{ ...inp, gridColumn: '1/-1' }} />
        <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="ยอดคงเหลือ (บาท)" style={inp} />
        <input type="number" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} placeholder="ดอกเบี้ย %/ปี" style={inp} />
        <input type="number" value={form.monthlyPayment} onChange={e => setForm(f => ({ ...f, monthlyPayment: e.target.value }))} placeholder="ผ่อน/เดือน (บาท)" style={inp} />
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={sel}>
          {LIAB_CATS.map(c => <option key={c} value={c}>{LIAB_TH[c]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(form)} style={btn('#f43f5e')}>บันทึก</button>
        <button onClick={onCancel} style={btnGhost}>ยกเลิก</button>
      </div>
    </div>
  )
}

export default function AssetsPage() {
  const qc = useQueryClient()
  const [addingAsset, setAddingAsset] = useState(false)
  const [addingLiab, setAddingLiab] = useState(false)
  const [editingAsset, setEditingAsset] = useState<string | null>(null)
  const [editingLiab, setEditingLiab] = useState<string | null>(null)

  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ['assets'], queryFn: () => api.get('/assets').then(r => r.data) })
  const { data: liabilities = [] } = useQuery<Liability[]>({ queryKey: ['liabilities'], queryFn: () => api.get('/liabilities').then(r => r.data) })

  const inv = (ep: string) => { qc.invalidateQueries({ queryKey: [ep] }); qc.invalidateQueries({ queryKey: ['projection'] }) }
  const createA = useMutation({ mutationFn: (d: any) => api.post('/assets', d), onSuccess: () => { inv('assets'); setAddingAsset(false) } })
  const updateA = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/assets/${id}`, d), onSuccess: () => { inv('assets'); setEditingAsset(null) } })
  const deleteA = useMutation({ mutationFn: (id: string) => api.delete(`/assets/${id}`), onSuccess: () => inv('assets') })
  const createL = useMutation({ mutationFn: (d: any) => api.post('/liabilities', d), onSuccess: () => { inv('liabilities'); setAddingLiab(false) } })
  const updateL = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/liabilities/${id}`, d), onSuccess: () => { inv('liabilities'); setEditingLiab(null) } })
  const deleteL = useMutation({ mutationFn: (id: string) => api.delete(`/liabilities/${id}`), onSuccess: () => inv('liabilities') })

  const totalAssets = assets.reduce((s, a) => s + a.value, 0)
  const totalLiab = liabilities.reduce((s, l) => s + l.balance, 0)
  const netWorth = totalAssets - totalLiab

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)' }}>สินทรัพย์ - หนี้สิน</h2>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
        {[
          { label: 'สินทรัพย์รวม', value: fmt(totalAssets), color: '#10b981', accent: '#10b981' },
          { label: 'หนี้สินรวม', value: fmt(totalLiab), color: '#f43f5e', accent: '#f43f5e' },
          { label: 'Net Worth', value: fmt(netWorth), color: netWorth >= 0 ? '#0ea5e9' : '#f43f5e', accent: '#0ea5e9' },
        ].map(({ label, value, color, accent }) => (
          <div key={label} style={{ ...card, borderTop: `2px solid ${accent}` }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Assets */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '3px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={17} color="#10b981" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>สินทรัพย์</p>
          </div>
          <button onClick={() => setAddingAsset(true)} style={btn('#10b981')}><Plus size={14} />เพิ่ม</button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {addingAsset && <AssetForm onSave={d => createA.mutate(d)} onCancel={() => setAddingAsset(false)} />}
          {assets.map(a => editingAsset === a.id
            ? <AssetForm key={a.id} initial={a} onSave={d => updateA.mutate({ ...d, id: a.id })} onCancel={() => setEditingAsset(null)} />
            : (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--divider)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ASSET_TH[a.category]} · ผลตอบแทน {a.returnRate}%/ปี</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{fmt(a.value)}</span>
                  <button onClick={() => setEditingAsset(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={() => deleteA.mutate(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          )}
          {assets.length === 0 && !addingAsset && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '28px 0' }}>ยังไม่มีสินทรัพย์</p>}
        </div>
      </div>

      {/* Liabilities */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '3px solid #f43f5e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(244,63,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={17} color="#f43f5e" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>หนี้สิน</p>
          </div>
          <button onClick={() => setAddingLiab(true)} style={btn('#f43f5e')}><Plus size={14} />เพิ่ม</button>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {addingLiab && <LiabilityForm onSave={d => createL.mutate(d)} onCancel={() => setAddingLiab(false)} />}
          {liabilities.map(l => editingLiab === l.id
            ? <LiabilityForm key={l.id} initial={l} onSave={d => updateL.mutate({ ...d, id: l.id })} onCancel={() => setEditingLiab(null)} />
            : (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--divider)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{l.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{LIAB_TH[l.category]} · ดอกเบี้ย {l.interestRate}% · ผ่อน {fmt(l.monthlyPayment)}/เดือน</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f43f5e' }}>{fmt(l.balance)}</span>
                  <button onClick={() => setEditingLiab(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={() => deleteL.mutate(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          )}
          {liabilities.length === 0 && !addingLiab && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '28px 0' }}>ยังไม่มีหนี้สิน</p>}
        </div>
      </div>
    </div>
  )
}
