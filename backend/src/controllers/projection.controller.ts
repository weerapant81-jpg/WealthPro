import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'MONTHLY': return amount
    case 'QUARTERLY': return amount / 3
    case 'ANNUALLY': return amount / 12
    default: return 0
  }
}

function monteCarloSimulation(
  initialNetWorth: number,
  monthlySavings: number,
  years: number,
  expectedReturn: number,
  inflationRate: number,
  simulations = 500
): { year: number; p10: number; p50: number; p90: number }[] {
  const months = years * 12
  const monthlyReturn = expectedReturn / 100 / 12
  const monthlyInflation = inflationRate / 100 / 12

  const results: number[][] = Array.from({ length: months + 1 }, () => [])
  results[0] = Array(simulations).fill(initialNetWorth)

  for (let sim = 0; sim < simulations; sim++) {
    let value = initialNetWorth
    let savings = monthlySavings
    for (let m = 1; m <= months; m++) {
      // random return with std dev ~15% annualized
      const stdDev = 0.15 / Math.sqrt(12)
      const randomReturn = monthlyReturn + stdDev * (Math.random() + Math.random() + Math.random() + Math.random() - 2) / Math.sqrt(4 / 3)
      value = value * (1 + randomReturn) + savings
      savings *= (1 - monthlyInflation)
      results[m][sim] = value
    }
  }

  return Array.from({ length: years + 1 }, (_, y) => {
    const monthIdx = y * 12
    const vals = [...results[monthIdx]].sort((a, b) => a - b)
    const n = vals.length
    return {
      year: y,
      p10: vals[Math.floor(n * 0.1)],
      p50: vals[Math.floor(n * 0.5)],
      p90: vals[Math.floor(n * 0.9)]
    }
  })
}

export async function getProjection(req: AuthRequest, res: Response): Promise<void> {
  const years = parseInt(req.query.years as string) || 30

  const [incomes, expenses, assets, liabilities, profile] = await Promise.all([
    prisma.income.findMany({ where: { userId: req.effectiveUserId!, isActive: true } }),
    prisma.expense.findMany({ where: { userId: req.effectiveUserId!, person: { in: ['client', 'shared'] } } }),
    prisma.asset.findMany({ where: { userId: req.effectiveUserId!, person: { in: ['client', 'shared'] } } }),
    prisma.liability.findMany({ where: { userId: req.effectiveUserId!, person: { in: ['client', 'shared'] } } }),
    prisma.profile.findUnique({ where: { userId: req.effectiveUserId! } })
  ])

  const monthlyIncome = incomes.reduce((sum: number, i) => sum + toMonthly(i.amount, i.frequency), 0)
  const monthlyExpense = expenses.reduce((sum: number, e) => sum + toMonthly(e.amount, e.frequency), 0)
  const totalAssets = assets.reduce((sum: number, a) => sum + a.value, 0)
  const totalLiabilities = liabilities.reduce((sum: number, l) => sum + l.balance, 0)
  const monthlyDebt = liabilities.reduce((sum: number, l) => sum + l.monthlyPayment, 0)

  // ถ้า frontend ส่ง seed มา (จาก /financial-ratios ซึ่งเป็นแหล่ง authoritative) ให้ใช้ค่านั้น — กัน drift
  // ไม่งั้น fallback คำนวณจากตาราง (ค่าเดิม)
  const seedNW = req.query.seedNetWorth != null ? Number(req.query.seedNetWorth) : NaN
  const seedSav = req.query.seedSavings != null ? Number(req.query.seedSavings) : NaN
  const netWorth = Number.isFinite(seedNW) ? seedNW : (totalAssets - totalLiabilities)
  const monthlySavings = Number.isFinite(seedSav) ? seedSav : (monthlyIncome - monthlyExpense - monthlyDebt)

  const expectedReturn = profile?.expectedReturn ?? 7
  const inflationRate = profile?.inflationRate ?? 2.5

  const projection = monteCarloSimulation(netWorth, monthlySavings, years, expectedReturn, inflationRate)

  res.json({
    summary: { monthlyIncome, monthlyExpense, monthlyDebt, monthlySavings, netWorth, totalAssets, totalLiabilities },
    projection
  })
}

