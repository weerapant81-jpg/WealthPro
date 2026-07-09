import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { pvAnnuity, defaultPlan, type PersonPlan } from '../pages/InsurancePlanPage'

const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

/** ความคุ้มครองประกัน (Needs-based) — reuse calc + auto-pull เดียวกับหน้าวางแผนประกัน (กัน drift)
 *  คืน { need, have, gap, coveragePct, existingInsurance } หรือ null ถ้ายังไม่มีข้อมูลพอ */
export function useInsuranceReadiness(person: 'client' | 'spouse') {
  const key = person === 'spouse' ? 'spouse' : 'self'
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: saved } = useQuery({ queryKey: ['insurance-plan'], queryFn: () => api.get('/insurance-plan').then(r => r.data), retry: false })
  const { data: liabilities } = useQuery({ queryKey: ['liabilities'], queryFn: () => api.get('/liabilities').then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: lifePolicies } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: sevPlan } = useQuery({ queryKey: ['severance-plan'], queryFn: () => api.get('/severance-plan').then(r => r.data), retry: false })

  // auto-pull (mirror InsurancePlanPage)
  const spouseJob = Array.isArray(clientProfile?.spouseJobs) ? clientProfile.spouseJobs[0] : null
  const autoIncome = key === 'self'
    ? toNum(clientProfile?.salary) * 12
    : (toNum(spouseJob?.salary) || toNum(clientProfile?.spouseIncome)) * 12
  const autoDebt = Array.isArray(liabilities) ? liabilities.reduce((s: number, l: any) => s + toNum(l.balance), 0) : 0
  const autoInvest = (Array.isArray(invProfile?.investmentAssets) ? invProfile.investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0)
    + (Array.isArray(invProfile?.savingsAccounts) ? invProfile.savingsAccounts.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0)
  const personName = key === 'self' ? (clientProfile?.firstName ?? '') : (clientProfile?.spouseProfile?.firstName ?? '###')
  const personPolicies = Array.isArray(lifePolicies) ? lifePolicies.filter((p: any) => (p.insuredPerson || '').includes(personName)) : []
  const autoInsurance = personPolicies.reduce((s: number, p: any) => s + toNum(p.sumAssured), 0)
  const autoSeverance = toNum(sevPlan?.[key]?.netSeverance)

  const plan: PersonPlan = { ...defaultPlan(), ...(saved?.[key] ?? {}) }
  const income = plan.income || autoIncome
  if (!(income > 0)) return null

  // Needs-based (mirror PersonPanel)
  const sumDeduct = plan.deductions.reduce((s, it) => s + toNum(it.amount), 0)
  const familyExpense = Math.max(0, income - sumDeduct)
  const realRate = (1 + plan.returnRate / 100) / (1 + plan.incomeGrowth / 100) - 1
  const familyIncomePV = pvAnnuity(realRate, plan.years, familyExpense)
  const manualDebt = plan.debts.reduce((s, it) => s + toNum(it.amount), 0)
  const sumDebt = manualDebt + autoDebt
  const coverageNeed = familyIncomePV + sumDebt + toNum(plan.education) + toNum(plan.finalExpense)
  const manualAssets = plan.assets.reduce((s, it) => s + toNum(it.amount), 0)
  const sumAssets = manualAssets + autoInvest + autoInsurance + autoSeverance
  const netNeed = Math.max(0, coverageNeed - sumAssets)

  if (!(coverageNeed > 0)) return null
  return {
    need: coverageNeed,
    have: sumAssets,
    gap: netNeed,
    existingInsurance: autoInsurance,
    coveragePct: Math.max(0, Math.min(100, Math.round((sumAssets / coverageNeed) * 100))),
  }
}
