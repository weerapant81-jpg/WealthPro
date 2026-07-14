import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { computeInsurance, defaultPlan, type PersonPlan } from '../pages/InsurancePlanPage'
import { calc as calcTaxPlan, defaultState as defaultTaxState } from '../lib/tax'

const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

/** ความคุ้มครองประกันชีวิต — reuse สูตรกลาง computeInsurance + auto-pull เดียวกับหน้าวางแผนประกัน (กัน drift)
 *  "ทุนที่ควรมี" = ตามวิธีที่เลือก (selectedMethod: HLV หรือ Needs-Based)
 *  คืน { need, have, gap, coveragePct, existingInsurance } หรือ null ถ้ายังไม่มีข้อมูลพอ */
export function useInsuranceReadiness(person: 'client' | 'spouse') {
  const key: 'self' | 'spouse' = person === 'spouse' ? 'spouse' : 'self'
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: saved } = useQuery({ queryKey: ['insurance-plan'], queryFn: () => api.get('/insurance-plan').then(r => r.data), retry: false })
  const { data: liabilities } = useQuery({ queryKey: ['liabilities', key], queryFn: () => api.get('/liabilities', { params: { person: key } }).then(r => r.data), retry: false })
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: lifePolicies } = useQuery({ queryKey: ['life-insurances'], queryFn: () => api.get('/life-insurances').then(r => r.data), retry: false })
  const { data: allRiders } = useQuery({ queryKey: ['all-riders'], queryFn: () => api.get('/all-riders').then(r => r.data), retry: false })
  const { data: expenses } = useQuery({ queryKey: ['expenses', key], queryFn: () => api.get('/expenses', { params: { person: key } }).then(r => r.data), retry: false })
  const { data: taxPlan } = useQuery({ queryKey: ['tax-plan'], queryFn: () => api.get('/tax-plan').then(r => r.data), retry: false })

  // ── auto-pull (mirror InsurancePlanPage main component) ──
  const spouseJob = Array.isArray(clientProfile?.spouseJobs) ? clientProfile.spouseJobs[0] : null
  const annualIncomeFrom = (src: any): number => {
    const arr = Array.isArray(src) ? src : []
    const monthly = arr.filter((s: any) => toNum(s.amount) > 0)
      .reduce((sum: number, s: any) => sum + (s.label === 'โบนัส' ? toNum(s.amount) / 12 : toNum(s.amount)), 0)
    return monthly * 12
  }
  const autoIncome = key === 'self'
    ? annualIncomeFrom(clientProfile?.incomeSources) || toNum(clientProfile?.salary) * 12
    : annualIncomeFrom(clientProfile?.spouseIncomeSources) || (toNum(spouseJob?.salary) || toNum(clientProfile?.spouseIncome)) * 12

  const selfAge = clientProfile?.birthDate ? new Date().getFullYear() - new Date(clientProfile.birthDate).getFullYear() : null
  const currentAge = key === 'self' ? selfAge : (clientProfile?.spouseAge ?? null)
  const retAge = (key === 'self' ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? 60
  const workingYears = currentAge != null ? Math.max(0, retAge - currentAge) : 25
  const preRetReturn = profile?.preRetirementReturn ?? 4

  const invSrc: any = key === 'self' ? invProfile : (invProfile?.spouseData ?? {})
  const profileDebt = Array.isArray(invSrc?.liabilities) ? invSrc.liabilities.reduce((s: number, l: any) => s + toNum(l.currentBalance), 0) : 0
  const tableDebt = Array.isArray(liabilities) ? liabilities.reduce((s: number, l: any) => s + toNum(l.balance), 0) : 0
  const autoDebt = profileDebt + tableDebt
  const autoInvestment = Array.isArray(invSrc?.investmentAssets) ? invSrc.investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0
  const autoDeposit = Array.isArray(invSrc?.savingsAccounts) ? invSrc.savingsAccounts.reduce((s: number, a: any) => s + toNum(a.currentValue), 0) : 0
  const personName = key === 'self' ? (clientProfile?.firstName ?? '') : (clientProfile?.spouseProfile?.firstName ?? '###')
  const personPolicies = Array.isArray(lifePolicies) ? lifePolicies.filter((p: any) => (p.insuredPerson || '').includes(personName)) : []
  const personPolicyIds = new Set(personPolicies.map((p: any) => p.id))
  const autoInsurance = personPolicies.reduce((s: number, p: any) => s + toNum(p.sumAssured), 0)
  // ความคุ้มครองทุพพลภาพเดิม (rider disabled) ของกรมธรรม์บุคคลนั้น
  const autoTPD = Array.isArray(allRiders)
    ? allRiders.filter((r: any) => personPolicyIds.has(r.policyId) && (r.riderType === 'disabled' || (r.planName || '').includes('ทุพพลภาพ')))
        .reduce((s: number, r: any) => s + toNum(r.coverageAmount), 0)
    : 0

  // ค่าหักอัตโนมัติ 5 รายการ (ปกส/PVD/กองทุนออม/เบี้ยประกันตนเอง/ภาษี)
  const toAnnual = (amount: number, freq: string) => freq === 'MONTHLY' ? amount * 12 : amount
  const welfare: any = key === 'self' ? clientProfile : clientProfile?.spouseProfile
  const monthlySalary = key === 'self' ? toNum(clientProfile?.salary) : (toNum(spouseJob?.salary) || toNum(clientProfile?.spouseIncome))
  const autoSS = welfare?.hasSocialSecurity ? Math.min(monthlySalary, 17500) * 0.05 * 12 : 0
  const autoPVD = welfare?.hasPVD ? monthlySalary * (toNum(welfare?.pvdEmployeeRate) / 100) * 12 : 0
  const autoSavings = Array.isArray(expenses)
    ? expenses.filter((e: any) => String(e.category).startsWith('saving_')).reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0
  const lifePremiumAnnual = personPolicies.reduce((s: number, p: any) => s + toNum(p.premium), 0)
  const healthPremiumAnnual = Array.isArray(expenses)
    ? expenses.filter((e: any) => e.category === 'fixed_health_ins').reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0
  const autoTax = taxPlan?.[key] ? calcTaxPlan({ ...defaultTaxState(), ...taxPlan[key] }).tax : 0
  // ค่าใช้จ่ายส่วนตัว = ค่าใช้จ่ายผันแปรรวม หัก "เงินให้บุพการี" (var_parents) และ "ภาษีเงินได้" (var_tax)
  const autoPersonalExpense = Array.isArray(expenses)
    ? expenses.filter((e: any) => String(e.category).startsWith('var_') && e.category !== 'var_parents' && e.category !== 'var_tax')
        .reduce((s: number, e: any) => s + toAnnual(e.amount, e.frequency), 0) : 0
  const autoDeduct = { ss: autoSS, pvd: autoPVD, savings: autoSavings, insurance: lifePremiumAnnual + healthPremiumAnnual, tax: autoTax, personal: autoPersonalExpense }

  // เงินชดเชยประกันสังคม (กรณีเสียชีวิต) = ค่าทำศพ + เงินสงเคราะห์กรณีตาย + บำเหน็จชราภาพสะสม (มิเรอร์หน้าวางแผนประกัน)
  const ssoAvgWage = Math.min(monthlySalary, 15000)
  const ssoMonths = toNum(welfare?.socialSecurityYears) * 12
  const ssoSurvivor = ssoMonths >= 120 ? ssoAvgWage * 6 : ssoMonths >= 36 ? ssoAvgWage * 2 : 0
  const autoSSCompensation = welfare?.hasSocialSecurity ? (50000 + ssoSurvivor + toNum(welfare?.socialSecurityValue)) : 0
  const autoAssets = { investment: autoInvestment, deposit: autoDeposit, insurance: autoInsurance, severance: autoSSCompensation }

  // ระยะเวลาความคุ้มครอง (จนบุตรคนเล็กพึ่งตัวเองได้ 22 − อายุ · ไม่มีบุตร → ปีทำงาน)
  const children = Array.isArray(clientProfile?.children) ? clientProfile.children : []
  const childAges = children.map((c: any) => toNum(c.age)).filter((a: number) => a > 0)
  const youngestAge = childAges.length ? Math.min(...childAges) : null
  const autoYears = youngestAge != null ? Math.max(1, 22 - youngestAge) : (workingYears || 20)

  const plan: PersonPlan = { ...defaultPlan(), ...(saved?.[key] ?? {}) }
  const C = computeInsurance(plan, { autoIncome, workingYears, autoDebt, autoAssets, autoDeduct, autoYears, preRetReturn, autoTPD })

  if (!(C.income > 0) || !(C.recommendedNeed > 0)) return null
  return {
    need: C.recommendedNeed,
    have: C.sumAssets,
    gap: C.recommendedNet,
    method: C.method,
    hlvNeed: C.hlvCoverage, hlvGap: C.hlvNet,
    needsNeed: C.coverageNeed, needsGap: C.netNeed,
    disNeed: C.disTotal, disHave: C.disOffset, disGap: C.disNet,
    existingInsurance: autoInsurance,
    coveragePct: Math.max(0, Math.min(100, Math.round((C.sumAssets / C.recommendedNeed) * 100))),
  }
}
