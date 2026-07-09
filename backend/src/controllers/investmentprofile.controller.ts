import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'

export async function getInvestmentProfile(req: AuthRequest, res: Response): Promise<void> {
  const data = await prisma.investmentProfile.findUnique({ where: { userId: req.effectiveUserId! } })
  res.json(data ?? {})
}

export async function upsertInvestmentProfile(req: AuthRequest, res: Response): Promise<void> {
  const { savingsAccounts, personalAssets, investmentAssets, liabilities, unwantedTypes, preferredTypes, constraints, assumptions, spouseData } = req.body
  const result = await prisma.investmentProfile.upsert({
    where: { userId: req.effectiveUserId! },
    update: { savingsAccounts, personalAssets, investmentAssets, liabilities, unwantedTypes, preferredTypes, constraints, assumptions, spouseData },
    create: { userId: req.effectiveUserId!, savingsAccounts, personalAssets, investmentAssets, liabilities, unwantedTypes, preferredTypes, constraints, assumptions, spouseData },
  })
  res.json(result)
}

