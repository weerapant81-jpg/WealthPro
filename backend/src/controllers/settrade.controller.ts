import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { getQuote, getAnnualReturn } from '../lib/settrade'

export async function quoteSymbol(req: AuthRequest, res: Response): Promise<void> {
  const { symbol } = req.params
  if (!symbol) { res.status(400).json({ error: 'symbol required' }); return }
  try {
    const data = await getQuote((symbol as string).toUpperCase())
    res.json(data)
  } catch (err: any) {
    const status = err?.response?.status ?? 500
    const msg    = err?.response?.data?.message ?? err.message
    res.status(status).json({ error: msg })
  }
}

export async function annualReturn(req: AuthRequest, res: Response): Promise<void> {
  const { symbol } = req.params
  if (!symbol) { res.status(400).json({ error: 'symbol required' }); return }
  try {
    const value = await getAnnualReturn((symbol as string).toUpperCase())
    if (value === null) { res.status(404).json({ error: 'ไม่พบข้อมูลหรือข้อมูลไม่เพียงพอ' }); return }
    res.json({ symbol: (symbol as string).toUpperCase(), annualReturn: value })
  } catch (err: any) {
    const status = err?.response?.status ?? 500
    const msg    = err?.response?.data?.message ?? err.message
    res.status(status).json({ error: msg })
  }
}
