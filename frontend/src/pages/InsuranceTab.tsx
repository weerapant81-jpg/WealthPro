import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, ShieldCheck, CalendarDays, Hash, Building2 } from 'lucide-react'
import { card, inp, sel, btn } from '../styles/dark'
import { MoneyInputStr } from '../components/MoneyInput'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

type LifePolicy = {
  id: string; insuredPerson: string; policyNumber: string; policyDate: string
  sumAssured: number; insuranceType: string; premium: number
  cashValue: number; policyAge: number; company: string; notes: string
}
type Rider = {
  id: string; policyId: string; riderType: string; planName: string | null; coverageAmount: number | null
}

const RIDER_TYPES = [
  { key: 'health',    label: 'ค่ารักษาพยาบาล' },
  { key: 'criticalH', label: 'โรคร้ายแรงลุกลาม' },
  { key: 'criticalL', label: 'โรคร้ายแรงเริ่มต้น' },
  { key: 'accident',  label: 'อุบัติเหตุ' },
  { key: 'daily',     label: 'ค่าชดเชยรายวัน' },
  { key: 'disabled',  label: 'ทุพพลภาพ' },
  { key: 'other',     label: 'อื่นๆ' },
]
type PropInsurance = {
  id: string; coverageType: string; policyNumber: string; insuranceType: string
  coverageAmount: number; premium: number; coveragePeriod: string; company: string; notes: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (!n) return '—'
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
}
// money input styled to fit the form grid (right-aligned, cyan)
const moneyInp: React.CSSProperties = { ...inp, textAlign: 'right', fontFamily: 'monospace', color: 'var(--cyan)' }
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const LIFE_INS_TYPES = ['ประกันชีวิต', 'ประกันสะสมทรัพย์', 'ประกันตลอดชีพ', 'ประกันบำนาญ', 'ประกันชั่วระยะเวลา', 'ยูนิตลิงค์', 'อื่นๆ']

// บริษัทประกันในไทย (ชีวิต + วินาศภัย) — ใช้เป็นตัวเลือกใน datalist (ยังพิมพ์เองได้)
const THAI_INSURERS = [
  'AIA', 'ไทยประกันชีวิต', 'เมืองไทยประกันชีวิต', 'กรุงเทพประกันชีวิต', 'FWD ประกันชีวิต',
  'อลิอันซ์ อยุธยา ประกันชีวิต', 'กรุงไทย-แอกซ่า ประกันชีวิต', 'พรูเด็นเชียล ประกันชีวิต',
  'เจนเนอราลี่ ประกันชีวิต', 'โตเกียวมารีนประกันชีวิต', 'แมนูไลฟ์ ประกันชีวิต', 'ชับบ์ ไลฟ์',
  'ไทยสมุทรประกันชีวิต', 'อาคเนย์ประกันชีวิต', 'บางกอกสหประกันชีวิต', 'สหประกันชีวิต',
  'ทิพยประกันภัย', 'กรุงเทพประกันภัย', 'วิริยะประกันภัย', 'สินมั่นคงประกันภัย',
  'เมืองไทยประกันภัย', 'ธนชาตประกันภัย', 'MSIG ประกันภัย', 'ชับบ์สามัคคีประกันภัย',
  'อลิอันซ์ อยุธยา ประกันภัย', 'กรุงไทยพานิชประกันภัย', 'ไทยศรีประกันภัย', 'อื่นๆ',
]
const INSURER_DATALIST_ID = 'thai-insurers'
const PROP_COVERAGE_TYPES = ['ประกันอัคคีภัยบ้าน', 'ประกันรถยนต์', 'ประกันอุบัติเหตุ', 'ประกันสุขภาพ', 'ประกันทรัพย์สิน', 'อื่นๆ']

// ─── Riders Panel ─────────────────────────────────────────────────────────────

function RidersPanel({ policyId }: { policyId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [addType, setAddType] = useState<string | null>(null)
  const [addPlan, setAddPlan] = useState('')
  const [addAmt, setAddAmt] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editPlan, setEditPlan] = useState('')
  const [editAmt, setEditAmt] = useState('')

  const { data: riders = [] } = useQuery<Rider[]>({
    queryKey: ['riders', policyId],
    queryFn: () => api.get(`/life-insurances/${policyId}/riders`).then(r => r.data),
  })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/life-insurances/${policyId}/riders`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['riders', policyId] }); qc.invalidateQueries({ queryKey: ['all-riders'] }); setAddType(null); setAddPlan(''); setAddAmt('') },
    onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)),
  })
  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => api.put(`/riders/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['riders', policyId] }); qc.invalidateQueries({ queryKey: ['all-riders'] }); setEditId(null) },
    onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/riders/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['riders', policyId] }); qc.invalidateQueries({ queryKey: ['all-riders'] }) },
  })

  const startEdit = (r: Rider) => { setEditId(r.id); setEditPlan(r.planName ?? ''); setEditAmt(r.coverageAmount != null ? String(r.coverageAmount) : '') }

  const tdS: React.CSSProperties = { fontSize: 12, color: 'var(--text-primary)', padding: '7px 10px', borderBottom: '1px solid var(--grid)' }
  const tdM: React.CSSProperties = { ...tdS, color: 'var(--text-muted)' }

  return (
    <div style={{ background: 'rgba(14,165,233,0.04)', borderTop: '1px solid var(--card-border)', padding: '10px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 10 : 0 }}>
        <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {open ? <ChevronUp size={13} color="#7dd3fc" /> : <ChevronDown size={13} color="#7dd3fc" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#7dd3fc' }}>สัญญาเพิ่มเติม {!open && riders.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({riders.length} รายการ)</span>}</span>
        </button>
      </div>
      {open && <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={addType ?? ''}
            onChange={e => setAddType(e.target.value || null)}
            style={{ ...sel, maxWidth: 180, fontSize: 12 }}>
            <option value="">— เลือกประเภท —</option>
            {RIDER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input style={{ ...inp, flex: 1 }} placeholder="ชื่อแผนประกัน" value={addPlan} onChange={e => setAddPlan(e.target.value)} disabled={!addType} />
          <MoneyInputStr value={addAmt} onChange={setAddAmt} placeholder="วงเงิน (บาท)" style={{ ...moneyInp, maxWidth: 150 }} />
          <button
            onClick={() => { if (addType) create.mutate({ riderType: addType, planName: addPlan, coverageAmount: addAmt }) }}
            disabled={!addType}
            style={{ background: addType ? '#0ea5e9' : 'var(--grid)', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: addType ? 'pointer' : 'default', color: '#fff', flexShrink: 0 }}>
            <Plus size={13} />
          </button>
        </div>
      </div>

      {riders.length === 0 && !addType && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่มีสัญญาเพิ่มเติม</p>
      )}

      {riders.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['ประเภท', 'ชื่อแผนประกัน', 'วงเงินคุ้มครอง (บาท)', ''].map(h => (
                <th key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '5px 10px', textAlign: h === 'วงเงินคุ้มครอง (บาท)' ? 'right' : 'left', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riders.map(r => editId === r.id ? (
              <tr key={r.id}>
                <td style={tdM}>{RIDER_TYPES.find(t => t.key === r.riderType)?.label ?? r.riderType}</td>
                <td style={tdS}><input style={{ ...inp, minWidth: 180 }} value={editPlan} onChange={e => setEditPlan(e.target.value)} /></td>
                <td style={tdS}><MoneyInputStr value={editAmt} onChange={setEditAmt} style={{ ...moneyInp, minWidth: 140 }} /></td>
                <td style={tdS}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => update.mutate({ id: r.id, planName: editPlan, coverageAmount: editAmt })} style={{ background: '#0ea5e9', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff' }}><Check size={11} /></button>
                    <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={11} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td style={tdM}>{RIDER_TYPES.find(t => t.key === r.riderType)?.label ?? r.riderType}</td>
                <td style={tdS}>{r.planName || '—'}</td>
                <td style={{ ...tdS, color: '#22d3ee', textAlign: 'right', fontFamily: 'monospace' }}>{r.coverageAmount != null ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(r.coverageAmount) : '—'}</td>
                <td style={tdS}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3 }}><Pencil size={12} /></button>
                    <button onClick={() => remove.mutate(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 3 }}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>}
    </div>
  )
}

// ─── Beneficiary Panel ────────────────────────────────────────────────────────

type Beneficiary = { id: string; policyId: string; name: string; relationship: string | null; sharePercent: number | null }

function BeneficiaryPanel({ policyId }: { policyId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(true)
  const [addName, setAddName] = useState('')
  const [addRel, setAddRel] = useState('')
  const [addPct, setAddPct] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRel, setEditRel] = useState('')
  const [editPct, setEditPct] = useState('')

  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({
    queryKey: ['beneficiaries', policyId],
    queryFn: () => api.get(`/life-insurances/${policyId}/beneficiaries`).then(r => r.data),
  })

  const create = useMutation({
    mutationFn: (d: object) => api.post(`/life-insurances/${policyId}/beneficiaries`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beneficiaries', policyId] }); setAddName(''); setAddRel(''); setAddPct('') },
    onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)),
  })
  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => api.put(`/beneficiaries/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beneficiaries', policyId] }); setEditId(null) },
    onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/beneficiaries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['beneficiaries', policyId] }),
  })

  const startEdit = (b: Beneficiary) => { setEditId(b.id); setEditName(b.name); setEditRel(b.relationship ?? ''); setEditPct(b.sharePercent != null ? String(b.sharePercent) : '') }
  const totalPct = beneficiaries.reduce((s, b) => s + (b.sharePercent ?? 0), 0)

  const tdS: React.CSSProperties = { fontSize: 12, color: 'var(--text-primary)', padding: '7px 10px', borderBottom: '1px solid var(--grid)' }
  const tdM: React.CSSProperties = { ...tdS, color: 'var(--text-muted)' }

  return (
    <div style={{ background: 'rgba(167,139,250,0.04)', borderTop: '1px solid var(--card-border)', padding: '10px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 10 : 0 }}>
        <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {open ? <ChevronUp size={13} color="#a78bfa" /> : <ChevronDown size={13} color="#a78bfa" />}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>ผู้รับประโยชน์ {!open && beneficiaries.length > 0 && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({beneficiaries.length} คน)</span>}</span>
        </button>
        {open && totalPct > 0 && (
          <span style={{ fontSize: 11, color: totalPct === 100 ? '#10b981' : '#f59e0b' }}>รวม {totalPct}%{totalPct !== 100 && ' (ควรรวมเป็น 100%)'}</span>
        )}
      </div>

      {open && (
        <div>
          {/* Add row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input style={{ ...inp, flex: 2 }} placeholder="ชื่อ-นามสกุล" value={addName} onChange={e => setAddName(e.target.value)} />
            <input style={{ ...inp, flex: 1 }} placeholder="ความสัมพันธ์" value={addRel} onChange={e => setAddRel(e.target.value)} />
            <input style={{ ...inp, maxWidth: 90 }} type="number" placeholder="สัดส่วน %" value={addPct} onChange={e => setAddPct(e.target.value)} min={0} max={100} />
            <button onClick={() => { if (addName) create.mutate({ name: addName, relationship: addRel, sharePercent: addPct }) }}
              disabled={!addName}
              style={{ background: addName ? '#a78bfa' : 'var(--grid)', border: 'none', borderRadius: 6, padding: '7px 12px', cursor: addName ? 'pointer' : 'default', color: '#fff', flexShrink: 0 }}>
              <Plus size={13} />
            </button>
          </div>

          {beneficiaries.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>ยังไม่มีข้อมูลผู้รับประโยชน์</p>
          )}

          {beneficiaries.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ชื่อ-นามสกุล', 'ความสัมพันธ์', 'สัดส่วน (%)', ''].map(h => (
                    <th key={h} style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {beneficiaries.map(b => editId === b.id ? (
                  <tr key={b.id}>
                    <td style={tdS}><input style={{ ...inp, minWidth: 160 }} value={editName} onChange={e => setEditName(e.target.value)} /></td>
                    <td style={tdS}><input style={{ ...inp, minWidth: 120 }} value={editRel} onChange={e => setEditRel(e.target.value)} /></td>
                    <td style={tdS}><input style={{ ...inp, maxWidth: 80 }} type="number" value={editPct} onChange={e => setEditPct(e.target.value)} /></td>
                    <td style={tdS}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => update.mutate({ id: b.id, name: editName, relationship: editRel, sharePercent: editPct })} style={{ background: '#a78bfa', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff' }}><Check size={11} /></button>
                        <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={11} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={b.id}>
                    <td style={{ ...tdS, fontWeight: 500 }}>{b.name}</td>
                    <td style={tdM}>{b.relationship || '—'}</td>
                    <td style={{ ...tdS, color: '#a78bfa', fontWeight: 600 }}>{b.sharePercent != null ? `${b.sharePercent}%` : '—'}</td>
                    <td style={tdS}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => startEdit(b)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3 }}><Pencil size={12} /></button>
                        <button onClick={() => remove.mutate(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 3 }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Life Insurance Table ─────────────────────────────────────────────────────

const LIFE_EMPTY = { insuredPerson: '', policyNumber: '', policyDate: '', sumAssured: '', insuranceType: '', premium: '', cashValue: '', policyAge: '', company: '', notes: '' }

function LifeInsuranceSection() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ...LIFE_EMPTY })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const { data: policies = [] } = useQuery<LifePolicy[]>({
    queryKey: ['life-insurances'],
    queryFn: () => api.get('/life-insurances').then(r => r.data),
  })

  const create = useMutation({ mutationFn: (d: object) => api.post('/life-insurances', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['life-insurances'] }); setAdding(false); setForm({ ...LIFE_EMPTY }) }, onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)) })
  const update = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/life-insurances/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['life-insurances'] }); setEditId(null) }, onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)) })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/life-insurances/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['life-insurances'] }) })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setE = (k: string, v: string) => setEditForm((f: any) => ({ ...f, [k]: v }))

  const handleAdd = () => {
    if (!form.insuredPerson) return
    create.mutate({ ...form, sumAssured: Number(form.sumAssured) || null, premium: Number(form.premium) || null, cashValue: Number(form.cashValue) || null, policyAge: Number(form.policyAge) || null, policyDate: form.policyDate || null })
  }
  const startEdit = (p: LifePolicy) => {
    setEditId(p.id)
    setEditForm({ insuredPerson: p.insuredPerson, policyNumber: p.policyNumber || '', policyDate: p.policyDate ? p.policyDate.slice(0, 10) : '', sumAssured: p.sumAssured || '', insuranceType: p.insuranceType || '', premium: p.premium || '', cashValue: p.cashValue || '', policyAge: p.policyAge || '', company: p.company || '', notes: p.notes || '' })
  }
  const handleUpdate = (id: string) => {
    update.mutate({ id, ...editForm, sumAssured: Number(editForm.sumAssured) || null, premium: Number(editForm.premium) || null, cashValue: Number(editForm.cashValue) || null, policyAge: Number(editForm.policyAge) || null, policyDate: editForm.policyDate || null })
  }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', background: 'linear-gradient(90deg, rgba(59,130,246,0.1), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>ประกันชีวิต</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>รายละเอียดกรมธรรม์ประกันชีวิตของคนในครอบครัวและผู้อยู่ในอุปการะ</p>
        </div>
        <button onClick={() => setAdding(a => !a)} style={{ ...btn('#3b82f6'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> เพิ่มกรมธรรม์
        </button>
      </div>

      {/* Add Form */}
      {adding && (
        <div style={{ padding: '16px 20px', background: 'rgba(59,130,246,0.05)', borderBottom: '1px solid var(--card-border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6', marginBottom: 12 }}>เพิ่มกรมธรรม์ประกันชีวิต</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ผู้เอาประกัน *</p><input style={inp} value={form.insuredPerson} onChange={e => set('insuredPerson', e.target.value)} placeholder="ชื่อผู้เอาประกัน" /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>กรมธรรม์เลขที่</p><input style={inp} value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} placeholder="เลขที่กรมธรรม์" /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>วันที่เอาประกัน</p><input style={inp} type="date" value={form.policyDate} onChange={e => set('policyDate', e.target.value)} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>แบบประกัน</p>
              <select style={sel} value={form.insuranceType} onChange={e => set('insuranceType', e.target.value)}>
                <option value="">— เลือกแบบประกัน —</option>
                {LIFE_INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ทุนประกัน (บาท)</p><MoneyInputStr value={form.sumAssured} onChange={v => set('sumAssured', v)} placeholder="0" style={moneyInp} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>เบี้ยประกัน (บาท/ปี)</p><MoneyInputStr value={form.premium} onChange={v => set('premium', v)} placeholder="0" style={moneyInp} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>มูลค่าเวนคืนเงินสด (บาท)</p><MoneyInputStr value={form.cashValue} onChange={v => set('cashValue', v)} placeholder="0" style={moneyInp} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>อายุกรมธรรม์ (ปี)</p><input style={inp} type="number" value={form.policyAge} onChange={e => set('policyAge', e.target.value)} placeholder="0" min={0} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>บริษัทประกัน</p><input style={inp} list={INSURER_DATALIST_ID} value={form.company} onChange={e => set('company', e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อบริษัท" /></div>
            <div style={{ gridColumn: '1 / -1' }}><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>หมายเหตุ</p><input style={inp} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="หมายเหตุเพิ่มเติม" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleAdd} disabled={!form.insuredPerson} style={{ ...btn('#3b82f6'), display: 'flex', alignItems: 'center', gap: 6, opacity: form.insuredPerson ? 1 : 0.45 }}><Check size={13} /> บันทึก</button>
            <button onClick={() => { setAdding(false); setForm({ ...LIFE_EMPTY }) }} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Policies */}
      {policies.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>ยังไม่มีข้อมูลกรมธรรม์</div>
      )}
      {policies.map(p => (
        <div key={p.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
          {/* Policy row */}
          {editId === p.id ? (
            <div style={{ padding: '12px 20px', background: 'rgba(59,130,246,0.06)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
                {[
                  { label: 'ผู้เอาประกัน', el: <input style={inp} value={editForm.insuredPerson} onChange={e => setE('insuredPerson', e.target.value)} /> },
                  { label: 'กรมธรรม์เลขที่', el: <input style={inp} value={editForm.policyNumber} onChange={e => setE('policyNumber', e.target.value)} /> },
                  { label: 'วันที่เอาประกัน', el: <input style={inp} type="date" value={editForm.policyDate} onChange={e => setE('policyDate', e.target.value)} /> },
                  { label: 'แบบประกัน', el: <select style={sel} value={editForm.insuranceType} onChange={e => setE('insuranceType', e.target.value)}><option value="">—</option>{LIFE_INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select> },
                  { label: 'ทุนประกัน (บาท)', el: <MoneyInputStr value={String(editForm.sumAssured ?? '')} onChange={v => setE('sumAssured', v)} style={moneyInp} /> },
                  { label: 'เบี้ยประกัน (บาท/ปี)', el: <MoneyInputStr value={String(editForm.premium ?? '')} onChange={v => setE('premium', v)} style={moneyInp} /> },
                  { label: 'มูลค่าเวนคืน (บาท)', el: <MoneyInputStr value={String(editForm.cashValue ?? '')} onChange={v => setE('cashValue', v)} style={moneyInp} /> },
                  { label: 'อายุกรมธรรม์ (ปี)', el: <input style={inp} type="number" value={editForm.policyAge} onChange={e => setE('policyAge', e.target.value)} /> },
                  { label: 'บริษัทประกัน', el: <input style={inp} list={INSURER_DATALIST_ID} value={editForm.company} onChange={e => setE('company', e.target.value)} /> },
                  { label: 'หมายเหตุ', el: <input style={inp} value={editForm.notes} onChange={e => setE('notes', e.target.value)} /> },
                ].map(({ label, el }) => (
                  <div key={label}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                    {el}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleUpdate(p.id)} style={{ ...btn('#3b82f6'), display: 'flex', alignItems: 'center', gap: 5 }}><Check size={12} /> บันทึก</button>
                <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px 20px' }}>
              {/* หัวกรมธรรม์: ผู้เอาประกัน + แบบประกัน + meta + ปุ่ม */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1.5px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#60a5fa' }}>
                  {(p.insuredPerson || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.insuredPerson}</span>
                    {p.insuranceType && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 999, padding: '2px 9px' }}>
                        <ShieldCheck size={11} />{p.insuranceType}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Hash size={11} />{p.policyNumber || '—'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><CalendarDays size={11} />{fmtDate(p.policyDate)}</span>
                    <span>อายุกรมธรรม์ {p.policyAge ?? '—'} ปี</span>
                    {p.company && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Building2 size={11} />{p.company}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(p)} title="แก้ไข" style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'flex' }}><Pencil size={13} /></button>
                  <button onClick={() => remove.mutate(p.id)} title="ลบ" style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 7, cursor: 'pointer', color: '#f43f5e', padding: 6, display: 'flex' }}><Trash2 size={13} /></button>
                </div>
              </div>
              {/* แถบตัวเลขเด่น */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 12, background: 'var(--card-border)', border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
                {([
                  ['ทุนประกัน', fmt(p.sumAssured), 'var(--cyan)'],
                  ['เบี้ย/ปี', fmt(p.premium), '#10b981'],
                  ['มูลค่าเวนคืน', fmt(p.cashValue), '#a78bfa'],
                ] as const).map(([label, val, col]) => (
                  <div key={label} style={{ background: 'var(--navy-900)', padding: '9px 14px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: col, fontFamily: 'monospace', marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
              {p.notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>📝 {p.notes}</p>}
            </div>
          )}
          {/* Riders always visible below each policy */}
          <RidersPanel policyId={p.id} />
          <BeneficiaryPanel policyId={p.id} />
        </div>
      ))}
    </div>
  )
}

// ─── Property Insurance Table ─────────────────────────────────────────────────

const PROP_EMPTY = { coverageType: '', policyNumber: '', insuranceType: '', coverageAmount: '', premium: '', coveragePeriod: '', company: '', notes: '' }

function PropertyInsuranceSection() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ ...PROP_EMPTY })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const { data: policies = [] } = useQuery<PropInsurance[]>({
    queryKey: ['property-insurances'],
    queryFn: () => api.get('/property-insurances').then(r => r.data),
  })

  const create = useMutation({ mutationFn: (d: object) => api.post('/property-insurances', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['property-insurances'] }); setAdding(false); setForm({ ...PROP_EMPTY }) }, onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)) })
  const update = useMutation({ mutationFn: ({ id, ...d }: any) => api.put(`/property-insurances/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['property-insurances'] }); setEditId(null) }, onError: (e: any) => alert('บันทึกไม่สำเร็จ: ' + (e?.response?.data?.error ?? e.message)) })
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/property-insurances/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['property-insurances'] }) })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setE = (k: string, v: string) => setEditForm((f: any) => ({ ...f, [k]: v }))

  const handleAdd = () => {
    if (!form.coverageType) return
    create.mutate({ ...form, coverageAmount: Number(form.coverageAmount) || null, premium: Number(form.premium) || null })
  }
  const startEdit = (p: PropInsurance) => {
    setEditId(p.id)
    setEditForm({ coverageType: p.coverageType, policyNumber: p.policyNumber || '', insuranceType: p.insuranceType || '', coverageAmount: p.coverageAmount || '', premium: p.premium || '', coveragePeriod: p.coveragePeriod || '', company: p.company || '', notes: p.notes || '' })
  }
  const handleUpdate = (id: string) => {
    update.mutate({ id, ...editForm, coverageAmount: Number(editForm.coverageAmount) || null, premium: Number(editForm.premium) || null })
  }

  const thStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-primary)', padding: '10px 10px', borderBottom: '1px solid var(--card-border)', verticalAlign: 'top' }
  const tdMuted: React.CSSProperties = { ...tdStyle, color: 'var(--text-muted)' }

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', background: 'linear-gradient(90deg, rgba(245,158,11,0.1), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>ประกันภัยทรัพย์สิน</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>รายละเอียดการทำประกันภัยทรัพย์สินและอื่นๆ</p>
        </div>
        <button onClick={() => setAdding(a => !a)} style={{ ...btn('#f59e0b'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> เพิ่มกรมธรรม์
        </button>
      </div>

      {adding && (
        <div style={{ padding: '16px 20px', background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid var(--card-border)' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 12 }}>เพิ่มประกันภัยทรัพย์สิน</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>รูปแบบความคุ้มครอง *</p>
              <select style={sel} value={form.coverageType} onChange={e => set('coverageType', e.target.value)}>
                <option value="">— เลือกประเภท —</option>
                {PROP_COVERAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>กรมธรรม์เลขที่</p><input style={inp} value={form.policyNumber} onChange={e => set('policyNumber', e.target.value)} placeholder="เลขที่กรมธรรม์" /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>แบบประกัน</p><input style={inp} value={form.insuranceType} onChange={e => set('insuranceType', e.target.value)} placeholder="ชั้น 1, ชั้น 2+" /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>วงเงินประกัน (บาท)</p><MoneyInputStr value={form.coverageAmount} onChange={v => set('coverageAmount', v)} placeholder="0" style={moneyInp} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>เบี้ยประกัน (บาท/ปี)</p><MoneyInputStr value={form.premium} onChange={v => set('premium', v)} placeholder="0" style={moneyInp} /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ระยะเวลาคุ้มครอง</p><input style={inp} value={form.coveragePeriod} onChange={e => set('coveragePeriod', e.target.value)} placeholder="เช่น 1 ปี, 3 ปี" /></div>
            <div><p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>บริษัทประกัน</p><input style={inp} list={INSURER_DATALIST_ID} value={form.company} onChange={e => set('company', e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อบริษัท" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleAdd} disabled={!form.coverageType} style={{ ...btn('#f59e0b'), display: 'flex', alignItems: 'center', gap: 6, opacity: form.coverageType ? 1 : 0.45 }}><Check size={13} /> บันทึก</button>
            <button onClick={() => { setAdding(false); setForm({ ...PROP_EMPTY }) }} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>ยกเลิก</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: 'var(--hover)' }}>
              {['รูปแบบความคุ้มครอง','กรมธรรม์เลขที่','แบบประกัน','วงเงินประกัน','เบี้ยประกัน','ระยะเวลาคุ้มครอง','บริษัทประกัน',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {policies.length === 0 && (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>ยังไม่มีข้อมูลประกันภัยทรัพย์สิน</td></tr>
            )}
            {policies.map(p => editId === p.id ? (
              <tr key={p.id} style={{ background: 'rgba(245,158,11,0.06)' }}>
                {[
                  <select style={{ ...sel, minWidth: 160 }} value={editForm.coverageType} onChange={e => setE('coverageType', e.target.value)}>{PROP_COVERAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>,
                  <input style={{ ...inp, minWidth: 120 }} value={editForm.policyNumber} onChange={e => setE('policyNumber', e.target.value)} />,
                  <input style={{ ...inp, minWidth: 100 }} value={editForm.insuranceType} onChange={e => setE('insuranceType', e.target.value)} />,
                  <MoneyInputStr value={String(editForm.coverageAmount ?? '')} onChange={v => setE('coverageAmount', v)} style={{ ...moneyInp, minWidth: 120 }} />,
                  <MoneyInputStr value={String(editForm.premium ?? '')} onChange={v => setE('premium', v)} style={{ ...moneyInp, minWidth: 120 }} />,
                  <input style={{ ...inp, minWidth: 100 }} value={editForm.coveragePeriod} onChange={e => setE('coveragePeriod', e.target.value)} />,
                  <input style={{ ...inp, minWidth: 140 }} list={INSURER_DATALIST_ID} value={editForm.company} onChange={e => setE('company', e.target.value)} />,
                ].map((el, i) => <td key={i} style={{ ...tdStyle, padding: '6px 8px' }}>{el}</td>)}
                <td style={{ ...tdStyle, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleUpdate(p.id)} style={{ background: '#f59e0b', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff' }}><Check size={12} /></button>
                    <button onClick={() => setEditId(null)} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={12} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...tdStyle, fontWeight: 600, color: '#f59e0b' }}>{p.coverageType}</td>
                <td style={tdMuted}>{p.policyNumber || '—'}</td>
                <td style={tdStyle}>{p.insuranceType || '—'}</td>
                <td style={{ ...tdStyle, color: '#22d3ee', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.coverageAmount)}</td>
                <td style={{ ...tdStyle, color: '#10b981', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(p.premium)}</td>
                <td style={tdMuted}>{p.coveragePeriod || '—'}</td>
                <td style={tdStyle}>{p.company || '—'}</td>
                <td style={{ ...tdStyle, padding: '6px 8px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><Pencil size={13} /></button>
                    <button onClick={() => remove.mutate(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f43f5e', padding: 4 }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Radar Chart Sidebar ──────────────────────────────────────────────────────

const CustomRadarTick = ({ x, y, payload, textAnchor }: any) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dy={4} textAnchor={textAnchor} fontSize={9} fill="#94a3b8">{payload.value}</text>
  </g>
)

const AXES = [
  { key: 'life',      label: 'เสียชีวิต',              ref: 10_000_000, stdFactor: (inc: number) => inc * 10      },
  { key: 'disabled',  label: 'ทุพพลภาพ',               ref: 5_000_000,  stdFactor: (inc: number) => inc * 2       },
  { key: 'ipd',       label: 'ค่ารักษาฯ (IPD)',         ref: 2_000_000,  stdFactor: (inc: number) => inc * 1.0     },
  { key: 'daily',     label: 'ค่าชดเชยรายวัน',          ref: null,       stdFactor: (inc: number) => inc * 0.0015 * 5 },
  { key: 'criticalH', label: 'โรคร้ายแรงลุกลาม',       ref: 3_000_000,  stdFactor: (inc: number) => inc * 3       },
  { key: 'criticalL', label: 'โรคร้ายแรงเริ่มต้น',     ref: 1_000_000,  stdFactor: (inc: number) => inc * 1       },
  { key: 'accident',  label: 'อุบัติเหตุ',              ref: 1_000_000,  stdFactor: (inc: number) => inc * 3       },
  { key: 'opd',       label: 'วงเงิน OPD',              ref: null,       stdFactor: (inc: number) => inc * 0.05    },
]

function InsuranceRadarChart() {
  const [selectedPerson, setSelectedPerson] = useState<string>('all')
  const { data: policies = [] } = useQuery<LifePolicy[]>({
    queryKey: ['life-insurances'],
    queryFn: () => api.get('/life-insurances').then(r => r.data),
  })
  const { data: riders = [] } = useQuery<Rider[]>({
    queryKey: ['all-riders'],
    queryFn: () => api.get('/all-riders').then(r => r.data),
  })
  const { data: incomes = [] } = useQuery<any[]>({
    queryKey: ['incomes'],
    queryFn: () => api.get('/incomes').then(r => r.data),
  })

  const annualIncome = incomes
    .filter((i: any) => i.isActive)
    .reduce((s: number, i: any) => s + (i.frequency === 'MONTHLY' ? i.amount * 12 : i.amount), 0)

  // รายชื่อผู้เอาประกัน (สำหรับเลือกดูแยกรายคน)
  const persons = Array.from(new Set(policies.map(p => p.insuredPerson).filter(Boolean)))
  const activePerson = selectedPerson !== 'all' && !persons.includes(selectedPerson) ? 'all' : selectedPerson
  const fPolicies = activePerson === 'all' ? policies : policies.filter(p => p.insuredPerson === activePerson)
  const fIds = new Set(fPolicies.map(p => p.id))
  const fRiders = activePerson === 'all' ? riders : riders.filter(r => fIds.has(r.policyId))

  // ทุนประกัน + มูลค่าเวนคืน แยกตามผู้เอาประกัน (สำหรับสรุปด้านล่าง)
  const sumByPerson = persons.map(name => {
    const ps = policies.filter(p => p.insuredPerson === name)
    return {
      name,
      sumAssured: ps.reduce((s, p) => s + (p.sumAssured ?? 0), 0),
      cashValue: ps.reduce((s, p) => s + (p.cashValue ?? 0), 0),
      count: ps.length,
    }
  }).sort((a, b) => b.sumAssured - a.sumAssured)
  const grandSumAssured = sumByPerson.reduce((s, x) => s + x.sumAssured, 0)
  const grandCashValue = sumByPerson.reduce((s, x) => s + x.cashValue, 0)

  const totalLife = fPolicies.reduce((s, p) => s + (p.sumAssured ?? 0), 0)
  const planContains = (kw: string) => fRiders.filter(r => (r.planName ?? '').includes(kw)).reduce((s, r) => s + (r.coverageAmount ?? 0), 0)
  const typeSum = (riderType: string) => fRiders.filter(r => r.riderType === riderType).reduce((s, r) => s + (r.coverageAmount ?? 0), 0)

  const raw: Record<string, number> = {
    life:      totalLife,
    disabled:  typeSum('disabled') || planContains('ทุพพลภาพ'),
    ipd:       typeSum('health'),
    daily:     typeSum('daily') || planContains('ชดเชยรายวัน') || planContains('รายวัน'),
    criticalH: typeSum('criticalH') || planContains('ลุกลาม'),
    criticalL: typeSum('criticalL') || planContains('เริ่มต้น'),
    accident:  typeSum('accident'),
    opd:       fRiders.filter(r => r.riderType === 'other' && ['OPD','opd','ผู้ป่วยนอก'].some(kw => (r.planName ?? '').includes(kw))).reduce((s, r) => s + (r.coverageAmount ?? 0), 0),
  }

  const radarData = AXES.map(a => {
    const stdAmount = annualIncome > 0 ? a.stdFactor(annualIncome) : 0
    const refVal = a.ref ?? (stdAmount > 0 ? stdAmount : 1)
    const actual = Math.min(100, Math.round((raw[a.key] / refVal) * 100))
    const benchmark = a.ref == null ? 100 : Math.min(100, Math.round((stdAmount / refVal) * 100))
    return { subject: a.label, actual, benchmark, fullMark: 100, amount: raw[a.key] }
  })

  const total = radarData.reduce((s, d) => s + d.actual, 0)
  const avg = Math.round(total / radarData.length)

  return (
    <div style={{ ...card, padding: '18px 16px' }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>พอร์ตความคุ้มครองประกันภัย</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>8 มิติ (คะแนน 0–100)</p>

      {/* เลือกผู้เอาประกัน */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ผู้เอาประกัน</p>
        <select value={activePerson} onChange={e => setSelectedPerson(e.target.value)} style={{ ...sel, fontSize: 12 }}>
          <option value="all">ทุกคน (รวม)</option>
          {persons.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
          {activePerson === 'all'
            ? `รวม ${fPolicies.length} กรมธรรม์ · ทุนประกันชีวิตรวม ${fmt(totalLife)}`
            : `${fPolicies.length} กรมธรรม์ · ทุนประกันชีวิต ${fmt(totalLife)}`}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <RadarChart data={radarData} outerRadius="100%" margin={{ top: 40, right: 50, bottom: 40, left: 50 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="subject" tick={<CustomRadarTick />} />
          <Radar name="เกณฑ์มาตรฐาน" dataKey="benchmark" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: '#22d3ee' }} />
          <Radar name="ความคุ้มครองปัจจุบัน" dataKey="actual" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
          <Tooltip formatter={(v: any, name: any) => [`${v} / 100`, name]} contentStyle={{ background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Score list */}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {radarData.map(d => {
          const pct = d.benchmark > 0 ? Math.min(100, Math.round((d.actual / d.benchmark) * 100)) : null
          // ระดับความเพียงพอ 0–100 (เทียบเกณฑ์ ถ้าไม่มีเกณฑ์ใช้ค่าจริง) → ไล่สีแดง→เขียว
          const level = pct != null ? pct : d.actual
          const hue = Math.round((level / 100) * 120) // 0 = แดง, 120 = เขียว
          const barColor = `hsl(${hue}, 75%, 50%)`
          const col = d.amount <= 0 ? 'var(--text-muted)' : barColor
          return (
            <div key={d.subject} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', flex: 1, lineHeight: 1.3 }}>{d.subject}</span>
              <div style={{ width: 56, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <div style={{ width: `${d.actual}%`, height: '100%', borderRadius: 2, background: barColor }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: col, minWidth: 70, textAlign: 'right' }}>
                {d.amount > 0 ? new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(d.amount) : '—'}
              </span>
            </div>
          )
        })}
      </div>

      {annualIncome === 0 && (
        <p style={{ fontSize: 10, color: '#f59e0b', marginTop: 8, textAlign: 'center' }}>* กรุณากรอกข้อมูลรายได้เพื่อแสดงเกณฑ์มาตรฐาน</p>
      )}
      <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(14,165,233,0.07)', borderRadius: 8, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>คะแนนเฉลี่ย{activePerson !== 'all' ? ` (${activePerson})` : ' (ทุกคน)'}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: avg >= 70 ? '#10b981' : avg >= 40 ? '#f59e0b' : '#f43f5e' }}>{avg}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> / 100</span></p>
      </div>

      {/* สรุปทุนประกันชีวิตแยกตามผู้เอาประกัน */}
      {persons.length > 1 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>สรุปแยกตามผู้เอาประกัน</p>
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', marginBottom: 4 }}>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 78, textAlign: 'right' }}>ทุนประกัน</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 78, textAlign: 'right' }}>มูลค่าเวนคืน</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sumByPerson.map(s => {
              const active = activePerson === s.name
              return (
                <button key={s.name} onClick={() => setSelectedPerson(active ? 'all' : s.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: active ? 'rgba(34,211,238,0.1)' : 'none', border: '1px solid', borderColor: active ? '#22d3ee' : 'var(--card-border)',
                    borderRadius: 7, padding: '6px 10px' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.count} กรมธรรม์</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', fontFamily: 'monospace', minWidth: 78, textAlign: 'right' }}>{fmt(s.sumAssured)}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa', fontFamily: 'monospace', minWidth: 78, textAlign: 'right' }}>{fmt(s.cashValue)}</span>
                </button>
              )
            })}
          </div>
          {/* รวมทั้งหมด */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '9px 10px', background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)', borderRadius: 8 }}>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>รวมทั้งหมด</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{policies.length} กรมธรรม์</span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee', fontFamily: 'monospace', minWidth: 78, textAlign: 'right' }}>{fmt(grandSumAssured)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace', minWidth: 78, textAlign: 'right' }}>{fmt(grandCashValue)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function InsuranceTab() {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <datalist id={INSURER_DATALIST_ID}>
        {THAI_INSURERS.map(c => <option key={c} value={c} />)}
      </datalist>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <LifeInsuranceSection />
        <PropertyInsuranceSection />
      </div>
      <div style={{ width: 440, flexShrink: 0, position: 'sticky', top: 72 }}>
        <InsuranceRadarChart />
      </div>
    </div>
  )
}
