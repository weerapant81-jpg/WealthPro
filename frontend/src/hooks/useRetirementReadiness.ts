import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { calcPerson, useProjectedAssetAtRetirement, fallbackProjections, type Person } from '../pages/RetirementPlanPage'

/** ความพร้อมเกษียณ — reuse calc เดียวกับหน้าแผนเกษียณ (กัน drift)
 *  คืน { needed, have, gap, readinessPct } หรือ null ถ้ายังไม่มีข้อมูลพอ */
export function useRetirementReadiness(person: 'client' | 'spouse') {
  const isSelf = person !== 'spouse'
  const key = isSelf ? 'self' : 'spouse'
  const { data: plan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: ssoPlan } = useQuery({ queryKey: ['sso-plan'], queryFn: () => api.get('/sso-plan').then(r => r.data), retry: false })
  const { data: pvdPlan } = useQuery({ queryKey: ['pvd-plan'], queryFn: () => api.get('/pvd-plan').then(r => r.data), retry: false })
  const { data: sevPlan } = useQuery({ queryKey: ['severance-plan'], queryFn: () => api.get('/severance-plan').then(r => r.data), retry: false })

  const data: Person | null = plan?.[key] ?? null
  const retireAge = data?.retirementAge ?? (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
  const projectedAsset = useProjectedAssetAtRetirement(retireAge, isSelf)

  if (!data) return null
  const fb = fallbackProjections(clientProfile, profile, isSelf)
  const ssoPV = ssoPlan?.[key]?.pensionPV ?? fb.ssoPV
  const pvdAtRetire = pvdPlan?.[key]?.valueAtRetirement ?? fb.pvdAtRetire
  const sevNet = sevPlan?.[key]?.netSeverance ?? fb.sevNet
  const extraAssets = ssoPV + pvdAtRetire + sevNet
  const assetAtRetirement = projectedAsset ?? 0

  const res = calcPerson(data, assetAtRetirement, extraAssets)
  // สถานการณ์ "ไม่ออมเพิ่ม" — สินทรัพย์เดิม + เงินก้อน (ปกส./PVD/ชดเชย) โตเอง ไม่มีเงินออมสะสมใหม่
  const resNoSave = calcPerson(data, assetAtRetirement, extraAssets, undefined, undefined, true)
  const have = assetAtRetirement + extraAssets
  const needed = res.totalNeeded
  if (!(needed > 0)) return null
  return {
    needed, have, gap: res.gap, annualSavings: res.annualSavings,
    readinessPct: Math.max(0, Math.min(100, Math.round((have / needed) * 100))),
    sources: { asset: assetAtRetirement, sso: ssoPV, pvd: pvdAtRetire, severance: sevNet },
    retireAge, projectionRows: res.projectionRows, projectionRowsNoSave: resNoSave.projectionRows,
  }
}
