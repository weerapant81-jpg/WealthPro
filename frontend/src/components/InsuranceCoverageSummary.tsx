import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

/* สรุปความคุ้มครองประกัน (8 มิติ) — ตรรกะเดียวกับ InsuranceRadarChart ในหน้าข้อมูลการประกัน
   จับคู่ผู้เอาประกันกับลูกค้า/คู่สมรสตามชื่อ · แสดงแบบกระชับสำหรับแดชบอร์ด */

const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(n)
const norm = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
const nameMatch = (a: any, b: any) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }

export const AXES = [
  { key: 'life', label: 'เสียชีวิต', ref: 10_000_000, stdFactor: (inc: number) => inc * 10 },
  { key: 'disabled', label: 'ทุพพลภาพ', ref: 5_000_000, stdFactor: (inc: number) => inc * 2 },
  { key: 'ipd', label: 'ค่ารักษาฯ (IPD)', ref: 2_000_000, stdFactor: (inc: number) => inc * 1.0 },
  { key: 'daily', label: 'ค่าชดเชยรายวัน', ref: null, stdFactor: (inc: number) => inc * 0.0015 * 5 },
  { key: 'criticalH', label: 'โรคร้ายแรงลุกลาม', ref: 3_000_000, stdFactor: (inc: number) => inc * 3 },
  { key: 'criticalL', label: 'โรคร้ายแรงเริ่มต้น', ref: 1_000_000, stdFactor: (inc: number) => inc * 1 },
  { key: 'accident', label: 'อุบัติเหตุ', ref: 1_000_000, stdFactor: (inc: number) => inc * 3 },
  { key: 'opd', label: 'วงเงิน OPD', ref: null, stdFactor: (inc: number) => inc * 0.05 },
]

/** ตรรกะความคุ้มครองประกัน 8 มิติ — ใช้ร่วมกันระหว่างการ์ดสรุป (ธีมมืด) และสไลด์รายงาน (ธีมสว่าง)
 *  คืน { radarData, avg, personName, hasPolicies } เพื่อกัน drift */
export function useInsuranceCoverage(person: 'self' | 'spouse' = 'self') {
  const { data: policies = [] } = useQuery<any[]>({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: riders = [] } = useQuery<any[]>({ queryKey: ['all-riders'], queryFn: () => api.get('/all-riders').then(r => r.data), retry: false })
  const { data: incomes = [] } = useQuery<any[]>({ queryKey: ['incomes'], queryFn: () => api.get('/incomes').then(r => r.data), retry: false })
  const { data: cp } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })

  const src = person === 'spouse' ? cp?.spouseProfile : cp
  const personName = `${src?.firstName ?? ''} ${src?.lastName ?? ''}`.trim() || (person === 'spouse' ? (cp?.spouseName ?? '') : '')

  const annualIncome = (Array.isArray(incomes) ? incomes : [])
    .filter((i: any) => i.isActive)
    .reduce((s: number, i: any) => s + (i.frequency === 'MONTHLY' ? i.amount * 12 : i.amount), 0)

  const fPolicies = personName ? policies.filter(p => nameMatch(p.insuredPerson, personName)) : []
  const fIds = new Set(fPolicies.map(p => p.id))
  const fRiders = riders.filter(r => fIds.has(r.policyId))

  const totalLife = fPolicies.reduce((s, p) => s + (p.sumAssured ?? 0), 0)
  const planContains = (kw: string) => fRiders.filter(r => (r.planName ?? '').includes(kw)).reduce((s, r) => s + (r.coverageAmount ?? 0), 0)
  const typeSum = (rt: string) => fRiders.filter(r => r.riderType === rt).reduce((s, r) => s + (r.coverageAmount ?? 0), 0)

  const raw: Record<string, number> = {
    life: totalLife,
    disabled: typeSum('disabled') || planContains('ทุพพลภาพ'),
    ipd: typeSum('health'),
    daily: typeSum('daily') || planContains('ชดเชยรายวัน') || planContains('รายวัน'),
    criticalH: typeSum('criticalH') || planContains('ลุกลาม'),
    criticalL: typeSum('criticalL') || planContains('เริ่มต้น'),
    accident: typeSum('accident'),
    opd: fRiders.filter(r => r.riderType === 'other' && ['OPD', 'opd', 'ผู้ป่วยนอก'].some(kw => (r.planName ?? '').includes(kw))).reduce((s, r) => s + (r.coverageAmount ?? 0), 0),
  }

  const radarData = AXES.map(a => {
    const stdAmount = annualIncome > 0 ? a.stdFactor(annualIncome) : 0
    const refVal = a.ref ?? (stdAmount > 0 ? stdAmount : 1)
    const actual = Math.min(100, Math.round((raw[a.key] / refVal) * 100))
    const benchmark = a.ref == null ? 100 : Math.min(100, Math.round((stdAmount / refVal) * 100))
    // จำนวนที่ควรมี (มาตรฐาน) = ref ถ้ากำหนดไว้ ไม่งั้นใช้ค่าตามรายได้
    const recommended = a.ref ?? stdAmount
    return { key: a.key, subject: a.label, actual, benchmark, amount: raw[a.key], recommended }
  })
  const avg = Math.round(radarData.reduce((s, d) => s + d.actual, 0) / radarData.length)
  return { radarData, avg, personName, hasPolicies: fPolicies.length > 0 }
}

export default function InsuranceCoverageSummary({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const { radarData, avg, personName, hasPolicies } = useInsuranceCoverage(person)

  if (!hasPolicies) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>ยังไม่มีกรมธรรม์ของ{personName || 'ผู้เอาประกัน'} — เพิ่มที่หน้าข้อมูลการประกัน</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {radarData.map(d => {
        const barColor = `hsl(${Math.round((d.actual / 100) * 120)}, 75%, 50%)`
        return (
          <div key={d.subject} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.3 }}>{d.subject}</span>
            <div style={{ width: 60, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <div style={{ width: `${d.actual}%`, height: '100%', borderRadius: 3, background: barColor }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: d.amount <= 0 ? 'var(--text-muted)' : barColor, minWidth: 92, textAlign: 'right' }}>
              {d.amount > 0 ? fmt(d.amount) : '—'}
            </span>
          </div>
        )
      })}
      <div style={{ marginTop: 6, padding: '9px 12px', background: 'rgba(14,165,233,0.07)', borderRadius: 8, textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>คะแนนความคุ้มครองเฉลี่ย </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: avg >= 70 ? '#10b981' : avg >= 40 ? '#f59e0b' : '#f43f5e' }}>{avg}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> / 100</span></span>
      </div>
    </div>
  )
}
