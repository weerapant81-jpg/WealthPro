import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { calcPerson, useProjectedAssetAtRetirement, fallbackProjections, type Person } from '../pages/RetirementPlanPage'

/** มูลค่ารวม/คงเหลือ กองทุนเกษียณ รายปี (closeBalance) — reuse calcPerson เดียวกับหน้าวางแผนเกษียณ
 *  คืน { retireAge, byAge } โดย byAge[อายุ] = เงินคงเหลือหลังเกษียณของปีนั้น */
export function useRetirementBalances(person: 'client' | 'spouse') {
  const isSelf = person !== 'spouse'
  const key = isSelf ? 'self' : 'spouse'
  const { data: plan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: ssoPlan } = useQuery({ queryKey: ['sso-plan'], queryFn: () => api.get('/sso-plan').then(r => r.data), retry: false })
  const { data: pvdPlan } = useQuery({ queryKey: ['pvd-plan'], queryFn: () => api.get('/pvd-plan').then(r => r.data), retry: false })
  const { data: sevPlan } = useQuery({ queryKey: ['severance-plan'], queryFn: () => api.get('/severance-plan').then(r => r.data), retry: false })

  const dataRaw: Person | null = plan?.[key] ?? null
  // อายุเกษียณ = แหล่งเดียวจากหน้าสมมติฐาน (profile) มาก่อนค่าที่บันทึกในแผน
  const retireAge = (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? dataRaw?.retirementAge ?? 60
  const projectedAsset = useProjectedAssetAtRetirement(retireAge, isSelf)

  const byAge: Record<number, number> = {}       // มูลค่ารวม/คงเหลือ ปลายปี (closeBalance) — compound แล้ว
  const byAgeOpen: Record<number, number> = {}    // มูลค่ากองทุนต้นปี (openBalance)
  const byAgeExp: Record<number, number> = {}     // ค่าใช้จ่าย/ปี + เป้าหมายพิเศษ + เงินมรดก (เงินถอนใช้)
  const byAgeReturn: Record<number, number> = {}  // ผลตอบแทนที่กองทุนสร้างในปีนั้น (FV growth)
  if (!dataRaw) return { retireAge, byAge, byAgeOpen, byAgeExp, byAgeReturn }
  const data: Person = { ...dataRaw, retirementAge: retireAge }
  const fb = fallbackProjections(clientProfile, profile, isSelf)
  const ssoPV = ssoPlan?.[key]?.pensionPV ?? fb.ssoPV
  const pvdAtRetire = pvdPlan?.[key]?.valueAtRetirement ?? fb.pvdAtRetire
  const sevNet = sevPlan?.[key]?.netSeverance ?? fb.sevNet
  const extraAssets = ssoPV + pvdAtRetire + sevNet
  const res = calcPerson(data, projectedAsset ?? 0, extraAssets)
  for (const row of res.projectionRows) if (row.phase === 'retirement') {
    const wd = (row.withdrawalLiving ?? 0) + (row.withdrawalGoals ?? 0) + (row.withdrawalLegacy ?? 0)
    byAge[row.age] = Math.max(0, row.closeBalance ?? 0)
    byAgeOpen[row.age] = Math.max(0, row.openBalance ?? 0)
    byAgeExp[row.age] = wd
    // ผลตอบแทน = ยอดปลายปี − ยอดต้นปี + เงินที่ถอนใช้  = (ต้นปี − ถอน) × ผลตอบแทนหลังเกษียณ
    byAgeReturn[row.age] = Math.max(0, (row.closeBalance ?? 0) - (row.openBalance ?? 0) + wd)
  }
  return { retireAge, byAge, byAgeOpen, byAgeExp, byAgeReturn }
}
