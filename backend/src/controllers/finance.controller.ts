import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

// มุมมองบุคคล: เห็น "ของคนนั้น + ร่วม (shared)" — สำหรับ expenses/assets/liabilities
const personWhere = (req: AuthRequest) => {
  const p = req.query.person === 'spouse' ? 'spouse' : 'client'
  return { in: [p, 'shared'] }
}

// ---- Income ----
export async function getIncomes(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.income.findMany({ where: { userId: req.effectiveUserId! } })
  res.json(data)
}
export async function createIncome(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.income.create({ data: { ...req.body, userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateIncome(req: AuthRequest, res: Response): Promise<void> {
  const id = String(req.params.id)
  const data = await prisma.income.updateMany({ where: { id, userId: req.effectiveUserId! }, data: req.body })
  res.json(data)
}
export async function deleteIncome(req: AuthRequest, res: Response): Promise<void> {
  await prisma.income.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Expense ----
export async function getExpenses(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.expense.findMany({ where: { userId: req.effectiveUserId!, person: personWhere(req) } })
  res.json(data)
}
export async function createExpense(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.expense.create({ data: { ...req.body, userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateExpense(req: AuthRequest, res: Response): Promise<void> {
  await prisma.expense.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: req.body })
  res.json({ ok: true })
}
export async function deleteExpense(req: AuthRequest, res: Response): Promise<void> {
  await prisma.expense.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Asset ----
export async function getAssets(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.asset.findMany({ where: { userId: req.effectiveUserId!, person: personWhere(req) } })
  res.json(data)
}
export async function createAsset(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.asset.create({ data: { ...req.body, userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateAsset(req: AuthRequest, res: Response): Promise<void> {
  await prisma.asset.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: req.body })
  res.json({ ok: true })
}
export async function deleteAsset(req: AuthRequest, res: Response): Promise<void> {
  await prisma.asset.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Liability ----
export async function getLiabilities(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.liability.findMany({ where: { userId: req.effectiveUserId!, person: personWhere(req) } })
  res.json(data)
}
export async function createLiability(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.liability.create({ data: { ...req.body, userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateLiability(req: AuthRequest, res: Response): Promise<void> {
  await prisma.liability.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: req.body })
  res.json({ ok: true })
}
export async function deleteLiability(req: AuthRequest, res: Response): Promise<void> {
  await prisma.liability.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Goal ----
export async function getGoals(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.goal.findMany({ where: { userId: req.effectiveUserId! }, orderBy: { priority: 'asc' } })
  res.json(data)
}
export async function createGoal(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.goal.create({ data: { ...req.body, userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateGoal(req: AuthRequest, res: Response): Promise<void> {
  await prisma.goal.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: req.body })
  res.json({ ok: true })
}
export async function deleteGoal(req: AuthRequest, res: Response): Promise<void> {
  await prisma.goal.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Life Insurance ----
function toISODate(v: any): Date | null {
  if (!v || v === '') return null
  const s = String(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  let year = parseInt(m[1])
  const month = parseInt(m[2])
  const day = parseInt(m[3])
  if (year > 2400) year -= 543
  return new Date(Date.UTC(year, month - 1, day))
}

function sanitizeLife(b: any) {
  const n = (v: any) => (v === '' || v === undefined ? null : v)
  return {
    insuredPerson: b.insuredPerson,
    policyNumber:  n(b.policyNumber),
    policyDate:    toISODate(b.policyDate),
    sumAssured:    b.sumAssured != null && b.sumAssured !== '' ? Number(b.sumAssured) : null,
    insuranceType: n(b.insuranceType),
    premium:       b.premium != null && b.premium !== '' ? Number(b.premium) : null,
    cashValue:     b.cashValue != null && b.cashValue !== '' ? Number(b.cashValue) : null,
    policyAge:     b.policyAge != null && b.policyAge !== '' ? Number(b.policyAge) : null,
    company:       n(b.company),
    notes:         n(b.notes),
  }
}

export async function getLifeInsurances(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.lifeInsurancePolicy.findMany({ where: { userId: req.effectiveUserId! }, orderBy: { createdAt: 'asc' } })
  res.json(data)
}
export async function createLifeInsurance(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.lifeInsurancePolicy.create({ data: { ...sanitizeLife(req.body), userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updateLifeInsurance(req: AuthRequest, res: Response): Promise<void> {
  await prisma.lifeInsurancePolicy.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: sanitizeLife(req.body) })
  res.json({ ok: true })
}
export async function deleteLifeInsurance(req: AuthRequest, res: Response): Promise<void> {
  await prisma.lifeInsurancePolicy.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Life Insurance Riders ----
export async function getAllRiders(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.lifeInsuranceRider.findMany({
    where: { policy: { userId: req.effectiveUserId! } },
    orderBy: { createdAt: 'asc' },
  })
  res.json(data)
}
export async function getRiders(req: AuthRequest, res: Response): Promise<void> {
  const policyId = String(req.params.policyId)
  // verify policy belongs to user
  const policy = await prisma.lifeInsurancePolicy.findFirst({ where: { id: policyId, userId: req.effectiveUserId! } })
  if (!policy) { res.status(404).json({ error: 'Not found' }); return }
  const data = await prisma.lifeInsuranceRider.findMany({ where: { policyId }, orderBy: { createdAt: 'asc' } })
  res.json(data)
}
export async function createRider(req: AuthRequest, res: Response): Promise<void> {
  const policyId = String(req.params.policyId)
  const policy = await prisma.lifeInsurancePolicy.findFirst({ where: { id: policyId, userId: req.effectiveUserId! } })
  if (!policy) { res.status(404).json({ error: 'Not found' }); return }
  const { riderType, planName, coverageAmount } = req.body
  const data = await prisma.lifeInsuranceRider.create({
    data: { policyId, riderType, planName: planName || null, coverageAmount: coverageAmount != null && coverageAmount !== '' ? Number(coverageAmount) : null }
  })
  res.status(201).json(data)
}
export async function updateRider(req: AuthRequest, res: Response): Promise<void> {
  const { planName, coverageAmount } = req.body
  await prisma.lifeInsuranceRider.update({
    where: { id: String(req.params.riderId) },
    data: { planName: planName || null, coverageAmount: coverageAmount != null && coverageAmount !== '' ? Number(coverageAmount) : null }
  })
  res.json({ ok: true })
}
export async function deleteRider(req: AuthRequest, res: Response): Promise<void> {
  await prisma.lifeInsuranceRider.delete({ where: { id: String(req.params.riderId) } })
  res.status(204).send()
}

// ---- Property Insurance ----
function sanitizeProp(b: any) {
  const n = (v: any) => (v === '' || v === undefined ? null : v)
  return {
    coverageType:   b.coverageType,
    policyNumber:   n(b.policyNumber),
    insuranceType:  n(b.insuranceType),
    coverageAmount: b.coverageAmount != null && b.coverageAmount !== '' ? Number(b.coverageAmount) : null,
    premium:        b.premium != null && b.premium !== '' ? Number(b.premium) : null,
    coveragePeriod: n(b.coveragePeriod),
    company:        n(b.company),
    notes:          n(b.notes),
  }
}

export async function getPropertyInsurances(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.propertyInsurance.findMany({ where: { userId: req.effectiveUserId! }, orderBy: { createdAt: 'asc' } })
  res.json(data)
}
export async function createPropertyInsurance(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.propertyInsurance.create({ data: { ...sanitizeProp(req.body), userId: req.effectiveUserId! } })
  res.status(201).json(data)
}
export async function updatePropertyInsurance(req: AuthRequest, res: Response): Promise<void> {
  await prisma.propertyInsurance.updateMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! }, data: sanitizeProp(req.body) })
  res.json({ ok: true })
}
export async function deletePropertyInsurance(req: AuthRequest, res: Response): Promise<void> {
  await prisma.propertyInsurance.deleteMany({ where: { id: String(req.params.id), userId: req.effectiveUserId! } })
  res.status(204).send()
}

// ---- Beneficiaries ----
export async function getBeneficiaries(req: AuthRequest, res: Response): Promise<void> {
  const policyId = String(req.params.policyId)
  const policy = await prisma.lifeInsurancePolicy.findFirst({ where: { id: policyId, userId: req.effectiveUserId! } })
  if (!policy) { res.status(404).json({ error: 'Not found' }); return }
  const data = await prisma.lifeInsuranceBeneficiary.findMany({ where: { policyId }, orderBy: { createdAt: 'asc' } })
  res.json(data)
}
export async function createBeneficiary(req: AuthRequest, res: Response): Promise<void> {
  const policyId = String(req.params.policyId)
  const policy = await prisma.lifeInsurancePolicy.findFirst({ where: { id: policyId, userId: req.effectiveUserId! } })
  if (!policy) { res.status(404).json({ error: 'Not found' }); return }
  const { name, relationship, sharePercent } = req.body
  const data = await prisma.lifeInsuranceBeneficiary.create({
    data: { policyId, name, relationship: relationship || null, sharePercent: sharePercent != null && sharePercent !== '' ? Number(sharePercent) : null }
  })
  res.status(201).json(data)
}
export async function updateBeneficiary(req: AuthRequest, res: Response): Promise<void> {
  const { name, relationship, sharePercent } = req.body
  await prisma.lifeInsuranceBeneficiary.update({
    where: { id: String(req.params.beneficiaryId) },
    data: { name, relationship: relationship || null, sharePercent: sharePercent != null && sharePercent !== '' ? Number(sharePercent) : null }
  })
  res.json({ ok: true })
}
export async function deleteBeneficiary(req: AuthRequest, res: Response): Promise<void> {
  await prisma.lifeInsuranceBeneficiary.delete({ where: { id: String(req.params.beneficiaryId) } })
  res.status(204).send()
}

// ---- Financial Ratios ----
// คำนวณสรุปการเงิน + อัตราส่วน + health score — pure function ใช้ร่วมกับ AI Copilot เพื่อกัน drift
export async function computeFinancialSummary(userId: string, isSpouse: boolean) {
  const pWhere = { in: [isSpouse ? 'spouse' : 'client', 'shared'] }
  const [liabilities, assets, incomes, expenses, rules, clientProfile, invProfile, lifePolicies] = await Promise.all([
    prisma.liability.findMany({ where: { userId, person: pWhere } }),
    prisma.asset.findMany({ where: { userId, person: pWhere } }),
    prisma.income.findMany({ where: { userId, isActive: true } }),
    prisma.expense.findMany({ where: { userId, person: pWhere } }),
    prisma.financialAdviceRule.findMany(),
    prisma.clientProfile.findUnique({ where: { userId } }),
    prisma.investmentProfile.findUnique({ where: { userId } }),
    prisma.lifeInsurancePolicy.findMany({ where: { userId } }),
  ])

  const toAnnual = (amount: number, freq: string) => freq === 'MONTHLY' ? amount * 12 : amount
  const toMonthly = (amount: number, freq: string) => freq === 'MONTHLY' ? amount : amount / 12
  const toNum = (v: any) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0

  // Assets from investment-profile (client = ฟิลด์หลัก, spouse = spouseData) + รายการในตาราง Asset
  const invSrc = isSpouse ? ((invProfile as any)?.spouseData ?? {}) : (invProfile ?? {})
  const savingsAccounts  = (invSrc?.savingsAccounts  ?? []) as any[]
  const investmentAssets = (invSrc?.investmentAssets ?? []) as any[]
  const personalAssets   = (invSrc?.personalAssets   ?? []) as any[]
  const manualInvest     = assets.filter(a => a.category.startsWith('invest_'))

  const liquidAssets  = savingsAccounts.reduce((s: number, a: any)  => s + toNum(a.currentValue), 0)
  const investAssets  = investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
    + manualInvest.reduce((s, a) => s + a.value, 0)
  const personalTotal = personalAssets.reduce((s: number, a: any)   => s + toNum(a.currentValue), 0)
  const totalAssets   = liquidAssets + investAssets + personalTotal

  // หนี้สิน — ตรงกับงบดุล: ระยะสั้น = ตาราง Liability(short_) + หนี้สินคงค้างครบกำหนด ≤ 1 ปี,
  //                          ระยะยาว = หนี้สินคงค้างครบกำหนด > 1 ปี
  const profileLiabilities = (invSrc?.liabilities ?? []) as any[]
  const profShortDebt = profileLiabilities.filter(l => (parseFloat(String(l.termYears)) || 0) <= 1)
    .reduce((s, l) => s + toNum(l.currentBalance), 0)
  const profLongDebt  = profileLiabilities.filter(l => (parseFloat(String(l.termYears)) || 0) > 1)
    .reduce((s, l) => s + toNum(l.currentBalance), 0)

  const shortDebtBalance = liabilities.filter(l => l.category.startsWith('short_')).reduce((s, l) => s + l.balance, 0)
    + profShortDebt
  const longDebtBalance  = profLongDebt
  const totalDebtBalance = shortDebtBalance + longDebtBalance
  const netWorth         = totalAssets - totalDebtBalance
  // ภาระหนี้ตามหลัก CFP: จำนอง(บ้าน+คอนโด) + หนี้อื่น(รถ+บัตร/สินเชื่อ+การศึกษา)
  const HOUSING_CATS = ['fixed_house_loan', 'fixed_condo_loan']
  const NON_MORTGAGE_CATS = ['fixed_car_loan', 'fixed_credit', 'fixed_edu_loan']
  const DEBT_PAYMENT_CATS = [...HOUSING_CATS, ...NON_MORTGAGE_CATS]
  const totalMonthlyPayment = expenses
    .filter(e => DEBT_PAYMENT_CATS.includes(e.category))
    .reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)
  const nonMortgageMonthlyPay   = expenses
    .filter(e => NON_MORTGAGE_CATS.includes(e.category))
    .reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0)

  // รายได้ — ดึงจาก clientProfile.incomeSources (ตรงกับงบกระแสเงินสด CashFlowTab)
  // โบนัส = ก้อนรายปี (หาร 12) · อื่นๆ = ต่อเดือน · fallback ตาราง Income เดิมถ้ายังไม่มี incomeSources
  const incomeSources = (isSpouse ? (clientProfile as any)?.spouseIncomeSources : (clientProfile as any)?.incomeSources) ?? [] as any[]
  const incMonthly = (src: any) => {
    const amt = toNum(src.amount)
    return src.label === 'โบนัส' ? amt / 12 : amt
  }
  const monthlyIncomeSources = (incomeSources as any[]).filter(s => toNum(s.amount) > 0).reduce((s, src) => s + incMonthly(src), 0)
  const incomeTableAnnual = incomes.reduce((s, i) => s + toAnnual(i.amount, i.frequency), 0)
  const totalAnnualIncome = monthlyIncomeSources > 0 ? monthlyIncomeSources * 12 : (isSpouse ? 0 : incomeTableAnnual)
  const monthlyIncome = totalAnnualIncome / 12

  // SS + PVD auto-deductions — สวัสดิการของคนที่เลือก (spouse ใช้ spouseProfile)
  const welfare: any = isSpouse ? ((clientProfile as any)?.spouseProfile ?? {}) : (clientProfile ?? {})
  const salarySource = (incomeSources as any[]).find(s => s.label === 'เงินเดือน')
  const monthlySalary = salarySource ? toNum(salarySource.amount) : (isSpouse ? 0 : (clientProfile?.salary ?? 0))
  const ssMonthly  = welfare?.hasSocialSecurity  ? Math.min(Number(monthlySalary), 17500) * 0.05 : 0
  const pvdMonthly = welfare?.hasPVD ? Number(monthlySalary) * (Number(welfare.pvdEmployeeRate ?? 0) / 100) : 0

  // เบี้ยประกันชีวิต (auto) — ดึงจากกรมธรรม์ จับคู่ผู้เอาประกันกับ client/spouse ตามชื่อ (ให้ตรงกับงบกระแสเงินสด)
  const norm = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
  const nameMatch = (a: any, b: any) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)) }
  const personName = isSpouse
    ? (`${(welfare?.firstName ?? '')} ${(welfare?.lastName ?? '')}`.trim() || String((clientProfile as any)?.spouseName ?? ''))
    : `${(clientProfile as any)?.firstName ?? ''} ${(clientProfile as any)?.lastName ?? ''}`.trim()
  const lifePremiumMonthly = lifePolicies
    .filter(p => (p.premium ?? 0) > 0 && nameMatch(p.insuredPerson, personName))
    .reduce((s, p) => s + (p.premium ?? 0), 0) / 12

  // Expenses (auto: SS + PVD + เบี้ยประกันชีวิต จัดเป็นค่าใช้จ่ายคงที่ ไม่ใช่การออม)
  const savingExpenses       = expenses.filter(e => e.category.startsWith('saving_'))
  const nonSavingExpenses    = expenses.filter(e => !e.category.startsWith('saving_'))
  const autoFixed            = ssMonthly + pvdMonthly + lifePremiumMonthly
  const monthlyNonSaving     = nonSavingExpenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0) + autoFixed
  const totalMonthlyExp      = expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency), 0) + autoFixed
  const annualSavings        = savingExpenses.reduce((s, e) => s + toAnnual(e.amount, e.frequency), 0)
  const netAnnualCashFlow    = totalAnnualIncome - totalMonthlyExp * 12

  // Compute ratios
  const r1 = shortDebtBalance > 0       ? liquidAssets / shortDebtBalance                         : null
  const r2 = totalMonthlyExp > 0         ? liquidAssets / totalMonthlyExp                           : null
  const r3 = netWorth > 0               ? (liquidAssets / netWorth) * 100                          : null
  const r4 = totalAssets > 0            ? (totalDebtBalance / totalAssets) * 100                   : null
  const r5 = monthlyIncome > 0          ? (totalMonthlyPayment / monthlyIncome) * 100               : null
  const r6 = monthlyIncome > 0          ? (nonMortgageMonthlyPay / monthlyIncome) * 100             : null
  const r7 = totalAnnualIncome > 0      ? ((annualSavings + netAnnualCashFlow) / totalAnnualIncome) * 100 : null
  const r8 = netWorth > 0              ? (investAssets / netWorth) * 100                           : null

  const state = (key: string, val: number | null): string => {
    if (val === null) return 'nodata'
    switch (key) {
      case 'ratio1': return val >= 1 ? 'good' : val >= 0.5 ? 'warning' : 'danger'
      case 'ratio2': return (val >= 3 && val <= 6) ? 'good' : val < 3 ? 'warning' : 'danger'
      case 'ratio3': return val >= 15 ? 'good' : val >= 10 ? 'warning' : 'danger'
      case 'ratio4': return val < 50  ? 'good' : val < 70  ? 'warning' : 'danger'
      case 'ratio5': return val < 35  ? 'good' : val < 45  ? 'warning' : 'danger'
      case 'ratio6': return val < 15  ? 'good' : val < 20  ? 'warning' : 'danger'
      case 'ratio7': return val >= 10 ? 'good' : val >= 5  ? 'warning' : 'danger'
      case 'ratio8': return val >= 50 ? 'good' : val >= 25 ? 'warning' : 'danger'
      default: return 'nodata'
    }
  }

  const ratioValues: Record<string, number | null> = {
    ratio1: r1, ratio2: r2, ratio3: r3, ratio4: r4,
    ratio5: r5, ratio6: r6, ratio7: r7, ratio8: r8,
  }

  const ratios = Object.entries(ratioValues).map(([key, value]) => ({
    key, value, state: state(key, value),
  }))

  const adviceMap: Record<string, string | null> = {}
  for (const r of ratios) {
    const rule = rules.find(ru => ru.ratioKey === r.key && ru.state === r.state)
    adviceMap[r.key] = rule?.advice ?? null
  }

  // Financial Health Score (0–100) — เฉลี่ยถ่วงน้ำหนัก 3 หมวดจากสถานะอัตราส่วน (แหล่งเดียว กัน drift)
  const scoreOf = (st: string): number | null => st === 'good' ? 100 : st === 'warning' ? 60 : st === 'danger' ? 20 : null
  const catAvg = (keys: string[]): number | null => {
    const vals = keys.map(k => scoreOf(ratios.find(r => r.key === k)!.state)).filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const rnd = (v: number | null) => v == null ? null : Math.round(v)
  const liquidityScore = catAvg(['ratio1', 'ratio2', 'ratio3'])
  const debtScore      = catAvg(['ratio4', 'ratio5', 'ratio6'])
  const savingsScore   = catAvg(['ratio7', 'ratio8'])
  const cats = [liquidityScore, debtScore, savingsScore].filter((v): v is number => v !== null)
  const healthScore = cats.length ? Math.round(cats.reduce((a, b) => a + b, 0) / cats.length) : null
  const labelOf = (sc: number | null) => sc == null ? 'ไม่มีข้อมูล'
    : sc >= 80 ? 'ดีมาก' : sc >= 60 ? 'ดี' : sc >= 40 ? 'ควรปรับ' : 'เร่งด่วน'
  const healthLabel = labelOf(healthScore)
  const categoryScores = {
    liquidity: { score: rnd(liquidityScore), label: labelOf(liquidityScore) },
    debt:      { score: rnd(debtScore),      label: labelOf(debtScore) },
    savings:   { score: rnd(savingsScore),   label: labelOf(savingsScore) },
  }

  const summary = {
    liquidAssets, investAssets, personalTotal, totalAssets,
    shortDebtBalance, longDebtBalance, totalDebtBalance, netWorth,
    totalAnnualIncome, monthlyIncome, annualSavings, netAnnualCashFlow,
    totalMonthlyExp, totalMonthlyPayment, nonMortgageMonthlyPay,
    healthScore, healthLabel,
  }

  return { ratios, advice: adviceMap, summary, healthScore, healthLabel, categoryScores }
}

export async function getFinancialRatios(req: AuthRequest, res: Response): Promise<void> {
  const result = await computeFinancialSummary(req.effectiveUserId!, req.query.person === 'spouse')
  res.json(result)
}

// ---- Retirement Plan ----
export async function getRetirementPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { retirementPlan: true },
    })
    res.json(p?.retirementPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveRetirementPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { retirementPlan: req.body },
      create: { userId: req.effectiveUserId!, retirementPlan: req.body },
    })
    res.json(data.retirementPlan)
  } catch (err) { next(err) }
}

// ---- PVD Plan ----
export async function getPvdPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { pvdPlan: true },
    })
    res.json(p?.pvdPlan ?? null)
  } catch (err) { next(err) }
}
export async function savePvdPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { pvdPlan: req.body },
      create: { userId: req.effectiveUserId!, pvdPlan: req.body },
    })
    res.json(data.pvdPlan)
  } catch (err) { next(err) }
}

// ---- SSO Plan ----
export async function getSsoPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { ssoPlan: true },
    })
    res.json(p?.ssoPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveSsoPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { ssoPlan: req.body },
      create: { userId: req.effectiveUserId!, ssoPlan: req.body },
    })
    res.json(data.ssoPlan)
  } catch (err) { next(err) }
}

// ---- Severance Plan ----
export async function getSeverancePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { severancePlan: true },
    })
    res.json(p?.severancePlan ?? null)
  } catch (err) { next(err) }
}
export async function saveSeverancePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { severancePlan: req.body },
      create: { userId: req.effectiveUserId!, severancePlan: req.body },
    })
    res.json(data.severancePlan)
  } catch (err) { next(err) }
}

// ---- Cashflow Plan (งบการเงินล่วงหน้า) ----
export async function getCashflowPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { cashflowPlan: true },
    })
    res.json(p?.cashflowPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveCashflowPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { cashflowPlan: req.body },
      create: { userId: req.effectiveUserId!, cashflowPlan: req.body },
    })
    res.json(data.cashflowPlan)
  } catch (err) { next(err) }
}

// ---- Estate Plan ----
export async function getEstatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({
      where: { userId: req.effectiveUserId! },
      select: { estatePlan: true },
    })
    res.json(p?.estatePlan ?? null)
  } catch (err) { next(err) }
}
export async function saveEstatePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { estatePlan: req.body },
      create: { userId: req.effectiveUserId!, estatePlan: req.body },
    })
    res.json(data.estatePlan)
  } catch (err) { next(err) }
}

// ---- Insurance Plan ----
export async function getInsurancePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! }, select: { insurancePlan: true } })
    res.json(p?.insurancePlan ?? null)
  } catch (err) { next(err) }
}
export async function saveInsurancePlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { insurancePlan: req.body },
      create: { userId: req.effectiveUserId!, insurancePlan: req.body },
    })
    res.json(data.insurancePlan)
  } catch (err) { next(err) }
}

// ---- Education Plan ----
export async function getEducationPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! }, select: { educationPlan: true } })
    res.json(p?.educationPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveEducationPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { educationPlan: req.body },
      create: { userId: req.effectiveUserId!, educationPlan: req.body },
    })
    res.json(data.educationPlan)
  } catch (err) { next(err) }
}

// ---- Tax Plan ----
export async function getTaxPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! }, select: { taxPlan: true } })
    res.json(p?.taxPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveTaxPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { taxPlan: req.body },
      create: { userId: req.effectiveUserId!, taxPlan: req.body },
    })
    res.json(data.taxPlan)
  } catch (err) { next(err) }
}

// ---- Report Plan ----
export async function getReportPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const p = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! }, select: { reportPlan: true } })
    res.json(p?.reportPlan ?? null)
  } catch (err) { next(err) }
}
export async function saveReportPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await prisma.profile.upsert({
      where: { userId: req.effectiveUserId! },
      update: { reportPlan: req.body },
      create: { userId: req.effectiveUserId!, reportPlan: req.body },
    })
    res.json(data.reportPlan)
  } catch (err) { next(err) }
}

// ---- Profile ----
export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.profile.findUnique({ where: { userId: req.effectiveUserId! } })
  res.json(data)
}
export async function upsertProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body
    const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k)
    const num = (v: any) => (v === '' || v == null) ? null : Number(v)

    // อัปเดตเฉพาะฟิลด์ที่ส่งมาจริง (กันการบันทึกข้ามฟีเจอร์ทับกัน เช่น risk vs สมมติฐาน)
    const INT_FIELDS = ['retirementAgeSelf', 'retirementAgeSpouse', 'lifeExpectancySelf', 'lifeExpectancySpouse', 'educationCostYear', 'riskScore', 'riskLevel']
    const FLOAT_FIELDS = ['inflationRate', 'educationInflation', 'rentInflation', 'medicalInflation', 'creditCardRate', 'cashAdvanceRate', 'personalLoanRate', 'homeLoanRate', 'carLoanRate', 'educationFundReturn', 'educationReturnDuring', 'preRetirementReturn', 'postRetirementReturn', 'expectedReturn', 'taxRate', 'pvdReturnRate', 'ssoReturnRate']
    const RAW_FIELDS = ['educationCosts', 'pvdReturnAsOf', 'ssoReturnAsOf', 'riskLabel', 'riskAnswers', 'riskAssessedAt', 'spouseRisk']

    const payload: any = {}
    for (const k of INT_FIELDS) if (has(k)) payload[k] = num(b[k])
    for (const k of FLOAT_FIELDS) if (has(k)) payload[k] = num(b[k])
    for (const k of RAW_FIELDS) if (has(k)) payload[k] = b[k] ?? null
    const data = await prisma.profile.upsert({
      where:  { userId: req.effectiveUserId! },
      update: payload,
      create: { ...payload, userId: req.effectiveUserId! },
    })
    res.json(data)
  } catch (err) {
    next(err)
  }
}

