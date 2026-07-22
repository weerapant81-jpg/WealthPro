import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react'
import { TableExcelButton } from '../components/exportable'

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid var(--card-border)',
  background: 'var(--divider)', color: 'var(--text-primary)',
  fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
}

const optStyle: React.CSSProperties = { background: 'var(--navy-900)', color: 'var(--text-primary)' }

const OWNER_OPTIONS = ['ตนเอง', 'คู่สมรส', 'ร่วมกัน', 'บุตร', 'อื่นๆ']
const PRIORITY_OPTIONS = ['1', '2', '3', '4', '5']

type GoalRow = {
  name: string
  owner: string
  priority: string
  targetDate: string
  targetAmount: string
}

type FinancialGoals = {
  insurance: GoalRow[]    // ความเสี่ยงและการประกัน
  education: GoalRow[]     // ทุนการศึกษาบุตร
  retirement: GoalRow[]    // การเกษียณ
  short: GoalRow[]
  medium: GoalRow[]
  long: GoalRow[]
}

type SectionDef = { key: keyof FinancialGoals; label: string; sub: string; color: string; money: string }

const emptyRow = (): GoalRow => ({ name: '', owner: 'ตนเอง', priority: '1', targetDate: '', targetAmount: '' })
const threeRows = () => Array.from({ length: 3 }, emptyRow)

const defaultGoals = (): FinancialGoals => ({
  insurance: threeRows(), education: threeRows(), retirement: threeRows(),
  short: threeRows(), medium: threeRows(), long: threeRows(),
})

// หมวดเป้าหมายตามด้านการวางแผน (แสดงก่อนเป้าหมายทางการเงิน)
const AREA_SECTIONS: SectionDef[] = [
  { key: 'insurance',  label: 'เป้าหมายด้านความเสี่ยงและการประกัน', sub: 'ความคุ้มครองที่ต้องการ',          color: '#f43f5e', money: 'วงเงินคุ้มครองที่ต้องการ (บาท)' },
  { key: 'education',   label: 'เป้าหมายด้านทุนการศึกษาบุตร',        sub: 'เงินทุนเพื่อการศึกษาบุตร',        color: '#f59e0b', money: 'จำนวนเงินที่ต้องการ (บาท)' },
  { key: 'retirement', label: 'เป้าหมายด้านการเกษียณ',              sub: 'เงินเพื่อการเกษียณอายุ',          color: '#06b6d4', money: 'จำนวนเงินที่ต้องการ (บาท)' },
]

// เป้าหมายทางการเงิน (แยกตามระยะเวลา)
const TIME_SECTIONS: SectionDef[] = [
  { key: 'short',  label: 'เป้าหมายระยะสั้น',  sub: 'ระยะเวลาไม่เกิน 3 ปี', color: '#10b981', money: 'จำนวนเงินที่ต้องการ (บาท)' },
  { key: 'medium', label: 'เป้าหมายระยะกลาง', sub: 'ระยะเวลา 3 – 7 ปี',     color: '#0ea5e9', money: 'จำนวนเงินที่ต้องการ (บาท)' },
  { key: 'long',   label: 'เป้าหมายระยะยาว',  sub: 'ระยะเวลามากกว่า 7 ปี', color: '#8b5cf6', money: 'จำนวนเงินที่ต้องการ (บาท)' },
]

const colsFor = (money: string) => [
  { label: 'เป้าหมาย',                w: '28%' },
  { label: 'ผู้กำหนดเป้าหมาย',        w: '14%' },
  { label: 'ลำดับความสำคัญ',          w: '12%' },
  { label: 'ระยะเวลาที่ต้องการบรรลุ', w: '18%' },
  { label: money,                     w: '18%' },
  { label: '',                        w: '5%'  },
]

type PersonGoals = { self: FinancialGoals; spouse: FinancialGoals }

const normGoals = (g: any): FinancialGoals => ({
  insurance:  g?.insurance?.length  ? g.insurance  : threeRows(),
  education:  g?.education?.length   ? g.education  : threeRows(),
  retirement: g?.retirement?.length ? g.retirement : threeRows(),
  short:  g?.short?.length  ? g.short  : threeRows(),
  medium: g?.medium?.length ? g.medium : threeRows(),
  long:   g?.long?.length   ? g.long   : threeRows(),
})

export default function FinancialGoalsTab({ person = 'client' }: { person?: 'client' | 'spouse' }) {
  const qc = useQueryClient()
  const { data: profile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const [allGoals, setAllGoals] = useState<PersonGoals>({ self: defaultGoals(), spouse: defaultGoals() })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const key: keyof PersonGoals = person === 'spouse' ? 'spouse' : 'self'
  const goals = allGoals[key]

  // ── โหลดครั้งเดียว (กัน server refetch มาทับระหว่างพิมพ์) ──
  const loadedRef = useRef(false)
  const hydratingRef = useRef(false)
  useEffect(() => {
    if (loadedRef.current || profile === undefined) return
    const fg = profile?.financialGoals
    if (fg && (fg.self || fg.spouse)) { hydratingRef.current = true; setAllGoals({ self: normGoals(fg.self), spouse: normGoals(fg.spouse) }) }
    else if (fg) { hydratingRef.current = true; setAllGoals({ self: normGoals(fg), spouse: defaultGoals() }) }
    loadedRef.current = true
  }, [profile])

  // ── autosave (debounce 800ms + setQueryData ให้รายงานเห็นทันที + flush ตอน unmount) ──
  const valuesRef = useRef(allGoals); valuesRef.current = allGoals
  const dirtyRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = (g: PersonGoals) => {
    qc.setQueryData(['client-profile'], (old: any) => old ? { ...old, financialGoals: g } : old)
    return api.put('/client-profile', { financialGoals: g })
  }
  const save = useMutation({
    mutationFn: (g: PersonGoals) => persist(g),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus(s => s === 'saved' ? 'idle' : s), 2000) },
    onError: () => setStatus('idle'),
  })

  useEffect(() => {
    if (!loadedRef.current) return
    if (hydratingRef.current) { hydratingRef.current = false; return }
    dirtyRef.current = true
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { save.mutate(valuesRef.current); dirtyRef.current = false }, 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [allGoals])

  useEffect(() => () => {
    if (dirtyRef.current) api.put('/client-profile', { financialGoals: valuesRef.current })
  }, [])

  const setRow = (section: keyof FinancialGoals, i: number, field: keyof GoalRow, val: string) =>
    setAllGoals(a => ({ ...a, [key]: { ...a[key], [section]: a[key][section].map((r, idx) => idx === i ? { ...r, [field]: val } : r) } }))

  const addRow = (section: keyof FinancialGoals) =>
    setAllGoals(a => ({ ...a, [key]: { ...a[key], [section]: [...a[key][section], emptyRow()] } }))

  const delRow = (section: keyof FinancialGoals, i: number) =>
    setAllGoals(a => ({ ...a, [key]: { ...a[key], [section]: a[key][section].filter((_, idx) => idx !== i) } }))

  // ── อายุเกษียณ / อายุขัย — แก้ค่าเดียวกับหน้าสมมติฐาน & วางแผนเกษียณ (Profile) ไม่สร้างข้อมูลซ้ำ ──
  const ageKey  = person === 'spouse' ? 'retirementAgeSpouse' : 'retirementAgeSelf'
  const lifeKey = person === 'spouse' ? 'lifeExpectancySpouse' : 'lifeExpectancySelf'
  const { data: prof } = useQuery<any>({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const [ages, setAges] = useState<{ ret: string; life: string }>({ ret: '', life: '' })
  const agesLoaded = useRef(false)
  useEffect(() => {
    if (agesLoaded.current || prof === undefined) return
    setAges({ ret: prof?.[ageKey] != null ? String(prof[ageKey]) : '', life: prof?.[lifeKey] != null ? String(prof[lifeKey]) : '' })
    agesLoaded.current = true
  }, [prof, ageKey, lifeKey])
  // เปลี่ยนคน (ลูกค้า/คู่สมรส) → โหลดค่าของคนนั้นใหม่
  useEffect(() => { agesLoaded.current = false }, [person])

  const saveAges = useMutation({
    mutationFn: (payload: any) => {
      qc.setQueryData(['profile'], (old: any) => old ? { ...old, ...payload } : old)   // ให้หน้าสมมติฐาน/เกษียณเห็นทันที
      return api.put('/profile', payload)
    },
    // รีเฟรชหน้าที่คำนวณจากอายุเกษียณ/อายุขัย (สมมติฐาน · วางแผนเกษียณ · พยากรณ์)
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['projection'] })
    },
  })
  const ageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setAge = (field: 'ret' | 'life', v: string) => {
    const clean = v.replace(/[^\d]/g, '').slice(0, 3)
    setAges(a => {
      const next = { ...a, [field]: clean }
      if (ageTimer.current) clearTimeout(ageTimer.current)
      ageTimer.current = setTimeout(() => saveAges.mutate({
        [ageKey]:  next.ret === '' ? '' : Number(next.ret),
        [lifeKey]: next.life === '' ? '' : Number(next.life),
      }), 700)
      return next
    })
  }

  const renderSection = (sec: SectionDef) => {
    const cols = colsFor(sec.money)
    const rows = goals[sec.key]
    return (
      <div key={sec.key} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Section header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 4, height: 32, borderRadius: 2, background: sec.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{sec.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sec.sub}</div>
          </div>
          {/* เฉพาะการ์ดเกษียณ — อายุเกษียณ/อายุขัย (ค่าเดียวกับหน้าสมมติฐาน) */}
          {sec.key === 'retirement' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              {([
                { f: 'ret'  as const, label: 'อายุที่ต้องการเกษียณ', ph: '60' },
                { f: 'life' as const, label: 'อายุขัยที่คาดการณ์',   ph: '85' },
              ]).map(x => (
                <div key={x.f}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{x.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input value={ages[x.f]} onChange={e => setAge(x.f, e.target.value)} placeholder={x.ph} inputMode="numeric"
                      style={{ ...inp, width: 66, textAlign: 'center', fontWeight: 700, color: sec.color, borderColor: `${sec.color}66` }} />
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>ปี</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TableExcelButton filename={`เป้าหมาย-${sec.label}`} title={sec.label} /></div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--hover)' }}>
                <th style={{ width: '5%', padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--card-border)', textAlign: 'center' }}>ที่</th>
                {cols.map((c, i) => (
                  <th key={i} style={{ width: c.w, padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--card-border)', textAlign: i < 4 ? 'left' : 'center' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>

                  <td style={{ padding: '6px 8px' }}>
                    <input value={row.name} onChange={e => setRow(sec.key, i, 'name', e.target.value)}
                      placeholder="ระบุเป้าหมาย..." style={inp} />
                  </td>

                  <td style={{ padding: '6px 8px' }}>
                    <select value={row.owner} onChange={e => setRow(sec.key, i, 'owner', e.target.value)}
                      style={{ ...inp, cursor: 'pointer' }}>
                      {OWNER_OPTIONS.map(o => <option key={o} value={o} style={optStyle}>{o}</option>)}
                    </select>
                  </td>

                  <td style={{ padding: '6px 8px' }}>
                    <select value={row.priority} onChange={e => setRow(sec.key, i, 'priority', e.target.value)}
                      style={{ ...inp, cursor: 'pointer' }}>
                      {PRIORITY_OPTIONS.map(p => <option key={p} value={p} style={optStyle}>{p}</option>)}
                    </select>
                  </td>

                  <td style={{ padding: '6px 8px' }}>
                    <input value={row.targetDate} onChange={e => setRow(sec.key, i, 'targetDate', e.target.value)}
                      placeholder="เช่น ปี 2570 / 3 ปี" style={inp} />
                  </td>

                  <td style={{ padding: '6px 8px' }}>
                    <input
                      value={row.targetAmount}
                      onChange={e => setRow(sec.key, i, 'targetAmount', e.target.value.replace(/,/g, ''))}
                      onBlur={e => { const v = e.target.value.replace(/,/g, ''); const n = Number(v); if (!isNaN(n) && v !== '') setRow(sec.key, i, 'targetAmount', n.toLocaleString('th-TH')) }}
                      placeholder="0"
                      style={{ ...inp, textAlign: 'right' }}
                    />
                  </td>

                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {rows.length > 1 && (
                      <button onClick={() => delRow(sec.key, i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <div style={{ padding: '10px 20px' }}>
          <button onClick={() => addRow(sec.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px dashed ${sec.color}40`, borderRadius: 6, padding: '6px 14px', color: sec.color, fontSize: 12, cursor: 'pointer', opacity: 0.8 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}>
            <Plus size={13} />เพิ่มแถว
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Header + สถานะบันทึก */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เป้าหมายของลูกค้า</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>บันทึกเป้าหมายตามด้านการวางแผน และตามระยะเวลา</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          {status === 'saving' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}><Loader2 size={14} className="fg-spin" />กำลังบันทึก...</span>}
          {status === 'saved' && <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}><CheckCircle size={14} />บันทึกอัตโนมัติแล้ว</span>}
          <style>{`@keyframes fg-spin{to{transform:rotate(360deg)}}.fg-spin{animation:fg-spin .9s linear infinite}`}</style>
        </div>
      </div>

      {/* หมวดตามด้านการวางแผน (ก่อนเป้าหมายทางการเงิน) */}
      {AREA_SECTIONS.map(renderSection)}

      {/* เป้าหมายทางการเงิน (แยกตามระยะเวลา) */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>เป้าหมายทางการเงิน</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>บันทึกเป้าหมายแยกตามระยะเวลา</p>
      </div>
      {TIME_SECTIONS.map(renderSection)}

    </div>
  )
}
