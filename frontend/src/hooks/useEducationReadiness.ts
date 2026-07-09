import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { levelForAge, growAnnuityFactor, type ChildSetting } from '../pages/EducationPlanPage'

const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
const defaultSetting = (): ChildSetting => ({ type: 'private', savingYears: 10, includeMaster: false, excludedLevels: [] })

/** ทุนการศึกษาบุตร — reuse การคำนวณเดียวกับหน้าทุนการศึกษา (ใช้ผลตอบแทนกองทุนจากตั้งค่าเป็นค่าคงที่)
 *  คืนยอดรวมทุกบุตร { totalPV, annualSaving } หรือ null ถ้าไม่มีบุตร/ค่าเล่าเรียน */
export function useEducationReadiness() {
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: saved } = useQuery({ queryKey: ['education-plan'], queryFn: () => api.get('/education-plan').then(r => r.data), retry: false })

  const children: any[] = clientProfile?.children ?? []
  const eduCosts = profile?.educationCosts ?? {}
  const inf = (profile?.educationInflation ?? 5) / 100
  const r = (profile?.educationFundReturn ?? 4) / 100
  const gInc = toNum(clientProfile?.salaryIncreaseRate) / 100

  let totalPV = 0, totalNominal = 0, annualSaving = 0
  children.forEach((c, i) => {
    const setting: ChildSetting = (saved && saved[i]) ? saved[i] : defaultSetting()
    const age = toNum(c.age)
    const excluded = setting.excludedLevels ?? []
    let pv = 0, nominal = 0
    for (let a = Math.max(age, 3); a <= 23; a++) {
      const lvl = levelForAge(a)
      if (!lvl) continue
      if (lvl.key === 'master' && !setting.includeMaster) continue
      if (excluded.includes(lvl.key)) continue
      const base = toNum(eduCosts?.[lvl.key]?.[setting.type])
      if (base <= 0) continue
      const yfn = a - age
      const inflated = base * Math.pow(1 + inf, yfn)
      nominal += inflated
      pv += inflated / Math.pow(1 + r, yfn)
    }
    const m = Math.max(1, setting.savingYears)
    const af = growAnnuityFactor(r, gInc, m)
    totalPV += pv; totalNominal += nominal
    annualSaving += af > 0 ? pv / af : 0
  })

  if (children.length === 0 || totalPV <= 0) return null
  return { childCount: children.length, totalNominal, totalPV, annualSaving, monthlySaving: annualSaving / 12 }
}
