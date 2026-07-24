import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import {
  ScrollText, Users, Heart, Baby, UserRound, Scale, Wallet,
  Info, AlertTriangle, Landmark, FileText, Gavel, Receipt, Plus, Trash2, CheckCircle, ShieldCheck,
} from 'lucide-react'

type Person = 'self' | 'spouse'

const fmt = (n: number) => Math.round(n || 0).toLocaleString('th-TH')

type Rel = 'spouse' | 'lineal' | 'other'
type Wish = { name: string; pct: number; rel: Rel }

// ---- ค่าที่ผู้วางแผนปรับได้ (เก็บใน estatePlan JSON ต่อ person) ----
type EstateInputs = {
  spouseAlive: boolean
  fatherAlive: boolean
  motherAlive: boolean
  siblingsCount: number
  maritalAssetPct: number   // สัดส่วนของ net worth ที่เป็นสินสมรส (%)
  // ── เฟส 2 ──
  hasWill: boolean
  willType: string
  willDate: string
  willLocation: string
  executor: string          // ผู้จัดการมรดก
  guardian: string          // ผู้ปกครองบุตรผู้เยาว์
  hasLivingWill: boolean     // พินัยกรรมชีวิต / หนังสือแสดงเจตนาการรักษา
  wishes: Wish[]             // การกระจายตามความประสงค์ (พินัยกรรม)
}
const defaultInputs = (): EstateInputs => ({
  spouseAlive: true, fatherAlive: false, motherAlive: false,
  siblingsCount: 0, maritalAssetPct: 100,
  hasWill: false, willType: '', willDate: '', willLocation: '', executor: '', guardian: '', hasLivingWill: false, wishes: [],
})

const WILL_TYPES = [
  'แบบธรรมดา (มีพยาน 2 คน)',
  'แบบเขียนเองทั้งฉบับ',
  'แบบเอกสารฝ่ายเมือง (ที่อำเภอ)',
  'แบบเอกสารลับ',
  'แบบทำด้วยวาจา (กรณีพิเศษ)',
]
const REL_LABEL: Record<Rel, string> = { spouse: 'คู่สมรส (ยกเว้นภาษี)', lineal: 'บุพการี/ผู้สืบสันดาน (5%)', other: 'อื่นๆ (10%)' }
const INHERIT_THRESHOLD = 100_000_000
const heirTax = (share: number, rel: Rel) => rel === 'spouse' ? 0 : Math.max(0, share - INHERIT_THRESHOLD) * (rel === 'lineal' ? 0.05 : 0.10)

function card(): React.CSSProperties {
  return {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    borderRadius: 14, padding: 22, boxShadow: 'var(--shadow)',
  }
}

function SectionTitle({ icon: Icon, title, sub, accent = 'var(--cyan)' }: {
  icon: React.ElementType; title: string; sub?: string; accent?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} style={{ color: accent }} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function Toggle({ on, onChange, label, icon: Icon, color = 'var(--cyan)' }: {
  on: boolean; onChange: (v: boolean) => void; label: string; icon: React.ElementType; color?: string
}) {
  return (
    <button onClick={() => onChange(!on)} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
      background: on ? `${color}14` : 'var(--navy-900)',
      border: `1px solid ${on ? color : 'var(--card-border)'}`,
      color: on ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all .15s',
    }}>
      <Icon size={16} style={{ color: on ? color : 'var(--text-muted)' }} />
      <span style={{ fontSize: 13.5, fontWeight: on ? 600 : 400, flex: 1 }}>{label}</span>
      <span style={{
        width: 34, height: 19, borderRadius: 12, position: 'relative', flexShrink: 0,
        background: on ? color : 'var(--navy-600)', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15,
          borderRadius: '50%', background: '#fff', transition: 'left .15s',
        }} />
      </span>
    </button>
  )
}

export default function EstatePlanPage({ person = 'self' }: { person?: Person }) {
  const qc = useQueryClient()
  const ratioPerson = person === 'spouse' ? 'spouse' : 'client'

  const { data: cp } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data) })
  const { data: ratios } = useQuery({
    queryKey: ['financial-ratios', ratioPerson],
    queryFn: () => api.get(`/financial-ratios?person=${ratioPerson}`).then(r => r.data),
  })
  const { data: savedPlan } = useQuery({ queryKey: ['estate-plan'], queryFn: () => api.get('/estate-plan').then(r => r.data) })
  const { data: lifePolicies } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: allBenefs } = useQuery({ queryKey: ['all-beneficiaries'], queryFn: () => api.get('/all-beneficiaries').then(r => r.data), retry: false })

  // ---- ข้อมูลครอบครัวที่ดึงมา ----
  const sp = cp?.spouseProfile || {}
  const fullName = (fn?: string, ln?: string) => [fn, ln].filter(Boolean).join(' ').trim()
  const clientName = fullName(cp?.firstName, cp?.lastName) || 'ลูกค้า'
  const spouseName = fullName(sp?.firstName, sp?.lastName) || (cp?.spouseName || 'คู่สมรส')
  const married = /สมรส|แต่งงาน/.test(cp?.maritalStatus || '') || !!(sp?.firstName || cp?.spouseName)

  const deceasedName = person === 'self' ? clientName : spouseName
  const survivingSpouseName = person === 'self' ? spouseName : clientName
  const parents = person === 'self' ? (cp?.parentsInfo || {}) : (sp?.parentsInfo || {})
  const children: Array<{ name: string; age: number | null }> = useMemo(
    () => (cp?.children || []).map((c: any) => ({ name: c.name || 'บุตร', age: c.age ?? null })).filter((c: any) => c.name),
    [cp],
  )
  const netWorth = ratios?.summary?.netWorth ?? 0

  // ---- ทุนประกันชีวิตของผู้เสียชีวิต → กระจายตามสัดส่วนผู้รับผลประโยชน์ในกรมธรรม์ ----
  const insurance = useMemo(() => {
    const norm = (s?: string) => (s || '').trim().toLowerCase()
    const dn = norm(deceasedName)
    const first = dn.split(/\s+/)[0] || ''
    // จับคู่กรมธรรม์กับผู้เสียชีวิต: ไม่ระบุผู้เอาประกัน = ถือเป็นลูกค้าหลัก (self)
    const mine = (ins?: string) => {
      const a = norm(ins)
      if (!a) return person === 'self'
      return a === dn || (first.length > 1 && a.includes(first)) || dn.includes(a)
    }
    const policies = (lifePolicies ?? []).filter((p: any) => mine(p.insuredPerson))
    const totalSum = policies.reduce((s: number, p: any) => s + (Number(p.sumAssured) || 0), 0)
    const map = new Map<string, { name: string; rel: string; amount: number }>()
    let unallocated = 0
    for (const p of policies) {
      const sa = Number(p.sumAssured) || 0
      if (sa <= 0) continue
      const bens = (allBenefs ?? []).filter((b: any) => b.policyId === p.id)
      const totalShare = bens.reduce((s: number, b: any) => s + (Number(b.sharePercent) || 0), 0)
      if (!bens.length || totalShare <= 0) { unallocated += sa; continue }   // ไม่ระบุผู้รับ → ตกเป็นกองมรดก
      for (const b of bens) {
        const amt = sa * ((Number(b.sharePercent) || 0) / totalShare)
        const key = (b.name || 'ไม่ระบุชื่อ').trim() || 'ไม่ระบุชื่อ'
        const cur = map.get(key) || { name: key, rel: b.relationship || '', amount: 0 }
        cur.amount += amt
        map.set(key, cur)
      }
    }
    return { policies, totalSum, unallocated, rows: [...map.values()].sort((a, b) => b.amount - a.amount) }
  }, [lifePolicies, allBenefs, deceasedName, person])

  // ---- inputs (autosave) ----
  const [inputs, setInputs] = useState<EstateInputs>(defaultInputs())
  const loadedRef = useRef(false)
  const inputsRef = useRef(inputs)
  useEffect(() => { inputsRef.current = inputs }, [inputs])

  // โหลดค่าที่บันทึกไว้ + เดา default จากข้อมูลจริง (มีบิดา/มารดา → alive)
  useEffect(() => {
    if (loadedRef.current) return
    if (savedPlan === undefined) return
    const saved = savedPlan?.[person]
    if (saved) {
      setInputs({ ...defaultInputs(), ...saved })
    } else {
      setInputs({
        ...defaultInputs(),
        spouseAlive: married,
        fatherAlive: !!parents?.fatherName,
        motherAlive: !!parents?.motherName,
        maritalAssetPct: married ? 100 : 0,
      })
    }
    loadedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPlan, person])

  // reset เมื่อสลับ person
  useEffect(() => { loadedRef.current = false }, [person])

  const persist = (next: EstateInputs) => {
    const base = qc.getQueryData<any>(['estate-plan']) || {}
    const merged = { ...base, [person]: next }
    qc.setQueryData(['estate-plan'], merged)
    api.put('/estate-plan', merged).catch(() => {})
  }
  const set = <K extends keyof EstateInputs>(k: K, v: EstateInputs[K]) => {
    setInputs(prev => { const next = { ...prev, [k]: v }; persist(next); return next })
  }

  // ---- คำนวณ ----
  const spouseIsHeir = inputs.spouseAlive && married
  const spouseHalfSinsomrot = spouseIsHeir ? netWorth * (inputs.maritalAssetPct / 100) / 2 : 0
  const estate = Math.max(0, netWorth - spouseHalfSinsomrot)   // กองมรดกที่นำมาแบ่ง

  const parentsAlive = (inputs.fatherAlive ? 1 : 0) + (inputs.motherAlive ? 1 : 0)
  const nChild = children.length

  type Alloc = { name: string; role: string; heirShare: number; color: string }
  const { allocs, ruleNote, noHeir } = useMemo(() => {
    const out: Alloc[] = []
    let note = ''
    let none = false
    if (nChild > 0) {
      // ลำดับ 1: ผู้สืบสันดาน — คู่สมรส + บิดามารดา (ม.1630 ว.2) ได้ส่วนเสมือนทายาทชั้นบุตร
      const shares = nChild + (spouseIsHeir ? 1 : 0) + parentsAlive
      const each = shares > 0 ? estate / shares : 0
      if (spouseIsHeir) out.push({ name: survivingSpouseName, role: 'คู่สมรส (รับส่วนเท่าบุตร 1 คน)', heirShare: each, color: '#c084fc' })
      children.forEach((c, i) => out.push({ name: c.name || `บุตรคนที่ ${i + 1}`, role: c.age != null && c.age < 20 ? `บุตร (ผู้เยาว์ อายุ ${c.age})` : 'บุตร (ผู้สืบสันดาน)', heirShare: each, color: '#0ea5e9' }))
      if (inputs.fatherAlive) out.push({ name: parents?.fatherName || 'บิดา', role: 'บิดา (รับเสมือนทายาทชั้นบุตร · ม.1630 ว.2)', heirShare: each, color: '#f59e0b' })
      if (inputs.motherAlive) out.push({ name: parents?.motherName || 'มารดา', role: 'มารดา (รับเสมือนทายาทชั้นบุตร · ม.1630 ว.2)', heirShare: each, color: '#f59e0b' })
      note = 'มีผู้สืบสันดาน (ลำดับ 1) — คู่สมรส และบิดามารดา (ม.1630 ว.2) ได้ส่วนแบ่งเท่าบุตร 1 คน แบ่งเท่าๆ กันทุกคน'
    } else if (parentsAlive > 0) {
      // ลำดับ 2: บิดามารดา — คู่สมรสได้ครึ่ง
      const forParents = spouseIsHeir ? estate / 2 : estate
      const each = parentsAlive > 0 ? forParents / parentsAlive : 0
      if (spouseIsHeir) out.push({ name: survivingSpouseName, role: 'คู่สมรส (รับ 1/2)', heirShare: estate / 2, color: '#c084fc' })
      if (inputs.fatherAlive) out.push({ name: parents?.fatherName || 'บิดา', role: 'บิดา (ลำดับ 2)', heirShare: each, color: '#f59e0b' })
      if (inputs.motherAlive) out.push({ name: parents?.motherName || 'มารดา', role: 'มารดา (ลำดับ 2)', heirShare: each, color: '#f59e0b' })
      note = spouseIsHeir ? 'ไม่มีผู้สืบสันดาน แต่มีบิดา/มารดา (ลำดับ 2) — คู่สมรสรับ 1/2 ที่เหลือแบ่งบิดามารดา' : 'ไม่มีคู่สมรส/ผู้สืบสันดาน — บิดามารดารับทั้งหมด'
    } else if (inputs.siblingsCount > 0) {
      // ลำดับ 3: พี่น้องร่วมบิดามารดา — คู่สมรสได้ครึ่ง
      const forSib = spouseIsHeir ? estate / 2 : estate
      const each = forSib / inputs.siblingsCount
      if (spouseIsHeir) out.push({ name: survivingSpouseName, role: 'คู่สมรส (รับ 1/2)', heirShare: estate / 2, color: '#c084fc' })
      for (let i = 0; i < inputs.siblingsCount; i++) out.push({ name: `พี่/น้อง คนที่ ${i + 1}`, role: 'พี่น้องร่วมบิดามารดา (ลำดับ 3)', heirShare: each, color: '#10b981' })
      note = spouseIsHeir ? 'ไม่มีผู้สืบสันดาน/บิดามารดา — คู่สมรสรับ 1/2 ที่เหลือแบ่งพี่น้อง' : 'พี่น้องร่วมบิดามารดารับทั้งหมด'
    } else if (spouseIsHeir) {
      out.push({ name: survivingSpouseName, role: 'คู่สมรส (รับทั้งหมด — ไม่มีทายาทลำดับอื่น)', heirShare: estate, color: '#c084fc' })
      note = 'ไม่มีทายาทโดยธรรมลำดับอื่น — คู่สมรสรับมรดกทั้งหมด'
    } else {
      none = true
      note = 'ไม่พบทายาทโดยธรรม — ตามมาตรา 1753 มรดกตกทอดแก่แผ่นดิน (ควรทำพินัยกรรมโดยด่วน)'
    }
    return { allocs: out, ruleNote: note, noHeir: none }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nChild, parentsAlive, inputs, estate, spouseIsHeir, survivingSpouseName])

  const minorChildren = children.filter(c => c.age != null && (c.age as number) < 20)

  // ---- wishes (การกระจายตามความประสงค์) ----
  const wishes = inputs.wishes ?? []
  const setWishes = (w: Wish[]) => set('wishes', w)
  const addWish = () => setWishes([...wishes, { name: '', pct: 0, rel: 'lineal' }])
  const updWish = (i: number, patch: Partial<Wish>) => setWishes(wishes.map((w, j) => j === i ? { ...w, ...patch } : w))
  const delWish = (i: number) => setWishes(wishes.filter((_, j) => j !== i))
  const wishTotalPct = wishes.reduce((s, w) => s + (Number(w.pct) || 0), 0)
  // เติมความประสงค์เริ่มต้นจากทายาทตามกฎหมาย
  const fillWishesFromLegal = () => {
    const total = allocs.reduce((s, a) => s + a.heirShare, 0)
    if (total <= 0) { setWishes([]); return }
    setWishes(allocs.map(a => ({
      name: a.name,
      pct: Math.round((a.heirShare / total) * 1000) / 10,
      rel: a.role.startsWith('คู่สมรส') ? 'spouse' : /บุตร|บิดา|มารดา/.test(a.role) ? 'lineal' : 'other',
    })))
  }

  // ---- ภาษีมรดก ----  ผู้รับที่ได้เกิน 100 ล้าน · บุพการี/ผู้สืบสันดาน 5% · อื่น 10% · คู่สมรสยกเว้น
  const relOf = (role: string): Rel => role.startsWith('คู่สมรส') ? 'spouse' : /บุตร|บิดา|มารดา/.test(role) ? 'lineal' : 'other'
  const useWill = inputs.hasWill && wishes.length > 0 && wishTotalPct > 0
  const taxHeirs: { name: string; share: number; rel: Rel }[] = useWill
    ? wishes.filter(w => (Number(w.pct) || 0) > 0).map(w => ({ name: w.name || 'ผู้รับ', share: estate * (Number(w.pct) || 0) / 100, rel: w.rel }))
    : allocs.map(a => ({ name: a.name, share: a.heirShare, rel: relOf(a.role) }))
  const totalEstateTax = taxHeirs.reduce((s, h) => s + heirTax(h.share, h.rel), 0)

  // ---- สภาพคล่องจ่ายภาษี + หนี้ ----
  const liquidAssets = ratios?.summary?.liquidAssets ?? 0
  const totalDebt = ratios?.summary?.totalDebtBalance ?? 0
  const liquidityNeed = totalEstateTax + totalDebt
  const liquidityGap = liquidityNeed - liquidAssets

  const noProfile = !cp
  const NUM = (v: number, onC: (n: number) => void) => (
    <input type="number" value={v} min={0} onChange={e => onC(Math.max(0, Number(e.target.value) || 0))}
      style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13 }} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1120 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#a78bfa22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScrollText size={21} style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>วางแผนมรดก</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            จำลองการแบ่งมรดกของ <b style={{ color: 'var(--text-secondary)' }}>{deceasedName}</b> ตามประมวลกฎหมายแพ่งและพาณิชย์ บรรพ 6
          </div>
        </div>
      </div>

      {/* disclaimer */}
      <div style={{ display: 'flex', gap: 10, padding: '11px 14px', borderRadius: 10, background: '#f59e0b12', border: '1px solid #f59e0b40', fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <Info size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
        <span>เครื่องมือนี้ช่วย <b>ประมาณการ</b> การแบ่งมรดก · ภาษีมรดก · และสภาพคล่อง เพื่อประกอบการวางแผนเท่านั้น — การจัดทำพินัยกรรม/เอกสารจริงและการยื่นภาษีควรปรึกษาทนายความ/ผู้เชี่ยวชาญ</span>
      </div>

      {noProfile && (
        <div style={card()}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>ยังไม่มีข้อมูลลูกค้า — กรุณากรอกข้อมูลส่วนบุคคลก่อน</div>
        </div>
      )}

      {/* ── ส่วน 1: ผังทายาท ── */}
      <div style={card()}>
        <SectionTitle icon={Users} title="1 · ผังครอบครัว & ทายาท" sub="ระบุทายาทที่ยังมีชีวิตอยู่ ณ วันที่ประเมิน (ดึงจากข้อมูลลูกค้า)" accent="#a78bfa" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {/* คู่สมรส */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>คู่สมรส</div>
            {married
              ? <Toggle on={inputs.spouseAlive} onChange={v => set('spouseAlive', v)} label={`${survivingSpouseName} ยังมีชีวิต`} icon={Heart} color="#c084fc" />
              : <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '11px 14px', borderRadius: 10, background: 'var(--navy-900)', border: '1px dashed var(--card-border)' }}>สถานะโสด / ไม่มีคู่สมรส</div>}
          </div>
          {/* บิดามารดา */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>บิดา / มารดา (ลำดับ 2)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Toggle on={inputs.fatherAlive} onChange={v => set('fatherAlive', v)} label={`บิดา${parents?.fatherName ? ' · ' + parents.fatherName : ''}`} icon={UserRound} color="#f59e0b" />
              <Toggle on={inputs.motherAlive} onChange={v => set('motherAlive', v)} label={`มารดา${parents?.motherName ? ' · ' + parents.motherName : ''}`} icon={UserRound} color="#f59e0b" />
            </div>
          </div>
          {/* พี่น้อง */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>พี่น้องร่วมบิดามารดา (ลำดับ 3)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, background: 'var(--navy-900)', border: '1px solid var(--card-border)' }}>
              <Users size={16} style={{ color: '#10b981' }} />
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', flex: 1 }}>จำนวน (คน)</span>
              {NUM(inputs.siblingsCount, v => set('siblingsCount', v))}
            </div>
          </div>
        </div>

        {/* บุตร */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 7, fontWeight: 600 }}>ผู้สืบสันดาน / บุตร (ลำดับ 1) — {nChild} คน</div>
          {nChild === 0
            ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '10px 14px', borderRadius: 10, background: 'var(--navy-900)', border: '1px dashed var(--card-border)' }}>ยังไม่มีข้อมูลบุตร (เพิ่มได้ที่หน้าข้อมูลส่วนบุคคล)</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {children.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 9, background: '#06b6d414', border: '1px solid #06b6d440' }}>
                  <Baby size={15} style={{ color: '#06b6d4' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{c.name}</span>
                  {c.age != null && <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>อายุ {c.age}</span>}
                </div>
              ))}
            </div>}
        </div>
      </div>

      {/* ── ส่วน 2: กองมรดกสุทธิ ── */}
      <div style={card()}>
        <SectionTitle icon={Wallet} title="2 · กองมรดกสุทธิ" sub="แยกสินสมรสของคู่สมรสออกก่อน จึงได้กองมรดกที่นำมาแบ่งให้ทายาท" accent="#00cfc1" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Stat label="ความมั่งคั่งสุทธิ (สินทรัพย์ − หนี้สิน)" value={fmt(netWorth)} sub="ดึงจากงบดุล" />
          <div style={{ ...card(), background: 'var(--navy-900)', padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>สัดส่วนที่เป็นสินสมรส</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={0} max={100} step={5} value={inputs.maritalAssetPct}
                disabled={!spouseIsHeir}
                onChange={e => set('maritalAssetPct', Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--cyan)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)', width: 44, textAlign: 'right' }}>{inputs.maritalAssetPct}%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{spouseIsHeir ? 'ทรัพย์ที่ได้มาระหว่างสมรส' : 'ไม่มีคู่สมรส — ทั้งหมดเป็นสินส่วนตัว'}</div>
          </div>
          <Stat label="คู่สมรสรับก่อน (½ สินสมรส)" value={fmt(spouseHalfSinsomrot)} sub="ไม่ถือเป็นมรดก" accent="#c084fc" />
          <Stat label="กองมรดกสุทธิ (นำมาแบ่ง)" value={fmt(estate)} accent="#00cfc1" big />
        </div>
      </div>

      {/* ── ส่วน 3: การแบ่งตามกฎหมาย ── */}
      <div style={card()}>
        <SectionTitle icon={Scale} title="3 · การแบ่งมรดกตามกฎหมาย (กรณีไม่มีพินัยกรรม)" sub="ทายาทโดยธรรม 6 ลำดับ + คู่สมรส (ป.พ.พ. ม.1629, 1635)" accent="#a78bfa" />

        <div style={{ display: 'flex', gap: 9, padding: '10px 14px', borderRadius: 9, background: 'var(--navy-900)', border: '1px solid var(--card-border)', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {noHeir ? <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }} /> : <Info size={15} style={{ color: 'var(--cyan)', flexShrink: 0, marginTop: 1 }} />}
          <span>{ruleNote}</span>
        </div>

        {noHeir
          ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', borderRadius: 11, background: '#ef444414', border: '1px solid #ef444440', color: 'var(--text-primary)' }}>
            <Landmark size={20} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 13.5 }}>มรดก {fmt(estate)} บาท ตกทอดแก่แผ่นดิน — แนะนำให้จัดทำพินัยกรรมเพื่อกำหนดผู้รับ</span>
          </div>
          : <div style={{ overflowX: 'auto', padding: '6px 2px 10px' }}>
            <style>{`
              .et-tree{ --et-line:#64748b; display:inline-block; min-width:100%; text-align:center; }
              .et-stem{ width:2px; height:22px; background:var(--et-line); margin:0 auto; }
              .et-branches{ display:inline-flex; justify-content:center; }
              .et-node{ position:relative; padding:22px 9px 0; }
              .et-node::before,.et-node::after{ content:''; position:absolute; top:0; right:50%; width:50%; height:22px; border-top:2px solid var(--et-line); }
              .et-node::after{ right:auto; left:50%; border-left:2px solid var(--et-line); }
              .et-node:only-child::before,.et-node:only-child::after{ display:none; }
              .et-node:first-child::before,.et-node:last-child::after{ border:0 none; }
              .et-node:last-child::before{ border-right:2px solid var(--et-line); }
            `}</style>
            <div className="et-tree">
              {/* กองมรดก (root) */}
              <div style={{ display: 'inline-block', minWidth: 240, padding: '13px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#0f3d56,#0e2438)', border: '1.5px solid var(--cyan)' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>กองมรดกสุทธิ (นำมาแบ่ง)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan-light)' }}>{fmt(estate)} บาท</div>
                {spouseHalfSinsomrot > 0 && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>คู่สมรสรับ ½ สินสมรส {fmt(spouseHalfSinsomrot)} ก่อน (ไม่ถือเป็นมรดก)</div>}
              </div>
              <div className="et-stem" />
              {/* ทายาท (children) */}
              <div className="et-branches">
                {allocs.map((a, i) => {
                  const pct = estate > 0 ? (a.heirShare / estate) * 100 : 0
                  const isSpouse = a.role.startsWith('คู่สมรส')
                  const total = isSpouse ? a.heirShare + spouseHalfSinsomrot : a.heirShare
                  return (
                    <div className="et-node" key={i}>
                      <div style={{ display: 'inline-block', width: 172, padding: '11px 13px', borderRadius: 11, background: 'var(--navy-900)', border: `1.5px solid ${a.color}`, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.name}</div>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.35, marginBottom: 7 }}>{a.role}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: a.color }}>{fmt(a.heirShare)}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{pct.toFixed(1)}% ของกองมรดก</div>
                        {isSpouse && spouseHalfSinsomrot > 0 && (
                          <div style={{ fontSize: 10.5, color: '#c084fc', marginTop: 6, borderTop: '1px dashed var(--card-border)', paddingTop: 6 }}>+ ½ สินสมรส {fmt(spouseHalfSinsomrot)}<br />รวมรับ <b>{fmt(total)}</b> บาท</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>}
      </div>

      {/* ── ส่วน 4: พินัยกรรม & ผู้จัดการมรดก ── */}
      <div style={card()}>
        <SectionTitle icon={FileText} title="4 · พินัยกรรม & ผู้จัดการมรดก" sub="สถานะเอกสารและผู้เกี่ยวข้อง (checklist)" accent="#3b82f6" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Toggle on={inputs.hasWill} onChange={v => set('hasWill', v)} label="มีพินัยกรรมแล้ว" icon={FileText} color="#3b82f6" />
          {inputs.hasWill && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, padding: '2px 2px 4px' }}>
              <Field label="รูปแบบพินัยกรรม">
                <select value={inputs.willType} onChange={e => set('willType', e.target.value)} style={inpStyle}>
                  <option value="">— เลือก —</option>
                  {WILL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="วันที่ทำพินัยกรรม">
                <input type="date" value={inputs.willDate} onChange={e => set('willDate', e.target.value)} style={inpStyle} />
              </Field>
              <Field label="สถานที่เก็บเอกสาร">
                <input value={inputs.willLocation} onChange={e => set('willLocation', e.target.value)} placeholder="เช่น ตู้เซฟบ้าน · ทนายความ · สนง.ที่ดิน" style={inpStyle} />
              </Field>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <Field label="ผู้จัดการมรดก (Executor)">
              <input value={inputs.executor} onChange={e => set('executor', e.target.value)} placeholder="ชื่อผู้จัดการมรดกที่ระบุ" style={inpStyle} />
            </Field>
            <Field label={`ผู้ปกครองบุตรผู้เยาว์${minorChildren.length > 0 ? ' *' : ''}`}>
              <input value={inputs.guardian} onChange={e => set('guardian', e.target.value)} placeholder={minorChildren.length > 0 ? 'จำเป็น — มีบุตรผู้เยาว์' : 'ชื่อผู้ปกครอง (ถ้ามี)'} style={inpStyle} />
            </Field>
          </div>
          <Toggle on={inputs.hasLivingWill} onChange={v => set('hasLivingWill', v)} label="มีหนังสือแสดงเจตนาการรักษาพยาบาล (Living Will)" icon={Heart} color="#f472b6" />
          {!inputs.hasWill && (
            <div style={{ display: 'flex', gap: 9, padding: '10px 14px', borderRadius: 9, background: '#f59e0b12', border: '1px solid #f59e0b40', fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <span>ยังไม่มีพินัยกรรม — มรดกจะแบ่งตามกฎหมาย (ส่วนที่ 3) · ทำพินัยกรรมเพื่อกำหนดผู้รับตามความประสงค์</span>
            </div>
          )}
        </div>
      </div>

      {/* ── ส่วน 5: เทียบ ตามกฎหมาย vs ตามความประสงค์ ── */}
      <div style={card()}>
        <SectionTitle icon={Gavel} title="5 · การกระจายมรดก — ตามกฎหมาย vs ตามความประสงค์" sub="ระบุความประสงค์ (พินัยกรรม) แล้วเทียบกับการแบ่งตามกฎหมาย" accent="#a78bfa" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
          {/* ตามกฎหมาย */}
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>ตามกฎหมาย (ทายาทโดยธรรม)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {allocs.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>—</div>
                : allocs.map((a, i) => {
                  const pct = estate > 0 ? (a.heirShare / estate) * 100 : 0
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{a.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontFamily: 'monospace', color: a.color, minWidth: 90, textAlign: 'right' }}>{fmt(a.heirShare)}</span>
                    </div>
                  )
                })}
            </div>
          </div>
          {/* ตามความประสงค์ */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>ตามความประสงค์ (พินัยกรรม)</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={fillWishesFromLegal} style={miniBtn('#8b9198')}>ตั้งตามกฎหมาย</button>
                <button onClick={addWish} style={miniBtn('#a78bfa')}><Plus size={11} /> เพิ่ม</button>
              </div>
            </div>
            {wishes.length === 0
              ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>ยังไม่ได้ระบุ — กด "เพิ่ม" หรือ "ตั้งตามกฎหมาย"</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {wishes.map((w, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input value={w.name} onChange={e => updWish(i, { name: e.target.value })} placeholder="ชื่อผู้รับ" style={{ ...inpStyle, flex: 1, minWidth: 0 }} />
                    <select value={w.rel} onChange={e => updWish(i, { rel: e.target.value as Rel })} style={{ ...inpStyle, width: 92, fontSize: 11 }}>
                      <option value="spouse">คู่สมรส</option><option value="lineal">สายตรง</option><option value="other">อื่นๆ</option>
                    </select>
                    <input type="number" value={w.pct} min={0} max={100} onChange={e => updWish(i, { pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ ...inpStyle, width: 58, textAlign: 'right' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                    <button onClick={() => delWish(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--divider)' }}>
                  <span style={{ color: wishTotalPct === 100 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>รวม {wishTotalPct.toFixed(1)}% {wishTotalPct !== 100 && '(ควรเป็น 100%)'}</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{fmt(estate * wishTotalPct / 100)} บาท</span>
                </div>
              </div>}
          </div>
        </div>
      </div>

      {/* ── ส่วน 6: ภาษีมรดก & สภาพคล่อง ── */}
      <div style={card()}>
        <SectionTitle icon={Receipt} title="6 · ภาษีมรดก & สภาพคล่อง" sub="พ.ร.บ.ภาษีการรับมรดก 2558 — ผู้รับสุทธิเกิน 100 ล้าน: สายตรง 5% · อื่น 10% · คู่สมรสยกเว้น" accent="#f59e0b" />
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>ฐานการแบ่ง: {useWill ? 'ตามความประสงค์ (พินัยกรรม)' : 'ตามกฎหมาย'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {taxHeirs.filter(h => h.share > 0).map((h, i) => {
            const t = heirTax(h.share, h.rel)
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 110px', gap: 8, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--divider)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-primary)' }}>{h.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{REL_LABEL[h.rel]}</span>
                <span style={{ fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(h.share)}</span>
                <span style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: t > 0 ? '#f59e0b' : '#10b981' }}>{t > 0 ? fmt(t) : 'ยกเว้น'}</span>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 120px 110px', gap: 8, alignItems: 'center', padding: '10px 4px 2px', marginTop: 2, borderTop: '2px solid var(--card-border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>ภาษีมรดกรวม</span>
            <span /><span />
            <span style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 800, color: totalEstateTax > 0 ? '#f59e0b' : '#10b981' }}>{fmt(totalEstateTax)}</span>
          </div>
        </div>
        {totalEstateTax === 0 && (
          <div style={{ fontSize: 11.5, color: '#10b981', marginTop: 8 }}>✓ ผู้รับแต่ละรายได้รับไม่เกิน 100 ล้านบาท จึงไม่มีภาษีมรดก</div>
        )}

        {/* สภาพคล่อง */}
        <div style={{ marginTop: 16, padding: 14, borderRadius: 11, background: liquidityGap > 0 ? '#ef444412' : '#10b98112', border: `1px solid ${liquidityGap > 0 ? '#ef444440' : '#10b98140'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {liquidityGap > 0 ? <AlertTriangle size={16} style={{ color: '#ef4444' }} /> : <CheckCircle size={16} style={{ color: '#10b981' }} />}
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>สภาพคล่องสำหรับจ่ายภาษี + หนี้สินตกทอด</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
            <MiniStat label="ต้องใช้ (ภาษี + หนี้)" value={fmt(liquidityNeed)} color="#f59e0b" sub={`ภาษี ${fmt(totalEstateTax)} + หนี้ ${fmt(totalDebt)}`} />
            <MiniStat label="สินทรัพย์สภาพคล่อง" value={fmt(liquidAssets)} color="#06b6d4" />
            <MiniStat label={liquidityGap > 0 ? 'ขาดสภาพคล่อง' : 'เพียงพอ (คงเหลือ)'} value={fmt(Math.abs(liquidityGap))} color={liquidityGap > 0 ? '#ef4444' : '#10b981'} />
          </div>
          {liquidityGap > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>
              💡 แนะนำทำ <b>ประกันชีวิต</b> (ระบุผู้รับผลประโยชน์) เพื่อเติมสภาพคล่อง — สินไหมไม่เป็นมรดก จ่ายภาษี/หนี้ได้เร็ว ไม่ต้องเร่งขายสินทรัพย์
            </div>
          )}
        </div>
      </div>

      {/* ── ส่วน 7: ทุนประกันชีวิต — สินไหมถึงผู้รับผลประโยชน์ ── */}
      <div style={card()}>
        <SectionTitle icon={ShieldCheck}
          title="7 · ทุนประกันชีวิต (สินไหมถึงผู้รับผลประโยชน์)"
          sub={`ทุนประกันของ${deceasedName} จ่ายตรงให้ผู้รับผลประโยชน์ตามสัดส่วนที่ระบุในกรมธรรม์ — โดยหลักไม่รวมในกองมรดก`}
          accent="#10b981" />
        {insurance.policies.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ยังไม่มีข้อมูลกรมธรรม์ประกันชีวิตของ{deceasedName} — เพิ่มได้ที่หน้า “ข้อมูลการประกัน”</div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <MiniStat label="ทุนประกันชีวิตรวม" value={fmt(insurance.totalSum)} color="#10b981" sub={`${insurance.policies.length} กรมธรรม์`} />
            </div>
            {insurance.rows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 130px', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, padding: '0 4px' }}>
                  <span>ผู้รับผลประโยชน์</span><span>ความสัมพันธ์</span><span style={{ textAlign: 'right' }}>สัดส่วน</span><span style={{ textAlign: 'right' }}>จำนวนเงิน (บาท)</span>
                </div>
                {insurance.rows.map((r, i) => {
                  const pct = insurance.totalSum > 0 ? (r.amount / insurance.totalSum) * 100 : 0
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px 130px', gap: 8, alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--divider)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.rel || '—'}</span>
                      <span style={{ fontFamily: 'monospace', textAlign: 'right', color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</span>
                      <span style={{ fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(r.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {insurance.unallocated > 0 && (
              <div style={{ display: 'flex', gap: 9, marginTop: 12, padding: '10px 13px', borderRadius: 10, background: '#f59e0b12', border: '1px solid #f59e0b40', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                <span>มีทุนประกัน <b>{fmt(insurance.unallocated)}</b> บาท ที่ยังไม่ได้ระบุผู้รับผลประโยชน์ — จะตกเป็น<b>กองมรดก</b>และถูกแบ่งตามกฎหมาย/พินัยกรรม ควรระบุผู้รับผลประโยชน์ในกรมธรรม์</span>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
              หมายเหตุ: สินไหมประกันชีวิตที่ระบุผู้รับผลประโยชน์แล้วจะจ่ายตรงให้ผู้รับ ไม่นำมารวมเป็นกองมรดก (ตามหลักกฎหมายประกันภัย) · หากผู้รับผลประโยชน์เป็นทายาท เงินก้อนนี้ช่วยเติม<b>สภาพคล่อง</b>สำหรับจ่ายภาษีมรดก/หนี้สินตกทอดได้
            </div>
          </>
        )}
      </div>

      {/* ธงเตือนเบื้องต้น */}
      {(minorChildren.length > 0) && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 15px', borderRadius: 11, background: '#f59e0b12', border: '1px solid #f59e0b40' }}>
          <AlertTriangle size={17} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            มีบุตรผู้เยาว์ {minorChildren.length} คน ({minorChildren.map(c => c.name).join(', ')}) — ควรระบุ <b>ผู้ปกครองทรัพย์สิน</b> และจัดทำพินัยกรรม/ประกันชีวิตเพื่อดูแลบุตรจนบรรลุนิติภาวะ
          </div>
        </div>
      )}
    </div>
  )
}

const inpStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 12.5, outline: 'none' }
const miniBtn = (c: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 7, border: `1px solid ${c}55`, background: `${c}18`, color: c, fontSize: 11, fontWeight: 600, cursor: 'pointer' })

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 11 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'monospace' }}>{value} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Stat({ label, value, sub, accent = 'var(--text-primary)', big }: {
  label: string; value: string; sub?: string; accent?: string; big?: boolean
}) {
  return (
    <div style={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, minHeight: 32 }}>{label}</div>
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 700, color: accent }}>{value} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>บาท</span></div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
