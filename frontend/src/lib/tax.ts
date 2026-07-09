/* ภาษีเงินได้บุคคลธรรมดา (PIT) — ใช้ร่วมกันระหว่างแท็บวางแผนภาษี และงบการเงินล่วงหน้า */

export const BRACKETS = [
  { min: 0, max: 150000, rate: 0 },
  { min: 150000, max: 300000, rate: 0.05 },
  { min: 300000, max: 500000, rate: 0.10 },
  { min: 500000, max: 750000, rate: 0.15 },
  { min: 750000, max: 1000000, rate: 0.20 },
  { min: 1000000, max: 2000000, rate: 0.25 },
  { min: 2000000, max: 5000000, rate: 0.30 },
  { min: 5000000, max: 9999999999, rate: 0.35 },
]
export function calcTax(inc: number): number {
  let t = 0
  for (const b of BRACKETS) { if (inc <= b.min) break; t += (Math.min(inc, b.max) - b.min) * b.rate }
  return Math.max(0, t)
}
export function marginalRate(ni: number): number {
  let r = 0
  for (const b of BRACKETS) { if (ni > b.min) r = b.rate }
  return r * 100
}

export interface TaxState {
  income40_1: number; income40_2: number; income40_3: number
  interest: number; dividend: number
  prof40_6: number; prof40_6type: 'doctor' | 'other'
  income40_7: number; rental: number; other40: number
  maritalStatus: 'single' | 'married'; spouseIncome: boolean
  children: number; parents: number; disabled: number
  lifeIns: number; healthIns: number; parentHealthIns: number; socialSec: number
  rmf: number; annuityIns: number; pvd: number; govPension: number; nsf: number; thaiesg: number
  mortgage: number; easyReceipt: number; shopDee: number; otop: number
  donation: number; eduDonation: number; politicalDonate: number; newHome: number
  prepaid: number
}
export const defaultState = (): TaxState => ({
  income40_1: 0, income40_2: 0, income40_3: 0, interest: 0, dividend: 0,
  prof40_6: 0, prof40_6type: 'other', income40_7: 0, rental: 0, other40: 0,
  maritalStatus: 'single', spouseIncome: false,
  children: 0, parents: 0, disabled: 0,
  lifeIns: 0, healthIns: 0, parentHealthIns: 0, socialSec: 0,
  rmf: 0, annuityIns: 0, pvd: 0, govPension: 0, nsf: 0, thaiesg: 0,
  mortgage: 0, easyReceipt: 0, shopDee: 0, otop: 0,
  donation: 0, eduDonation: 0, politicalDonate: 0, newHome: 0,
  prepaid: 0,
})

export function calc(s: TaxState) {
  const ti = s.income40_1 + s.income40_2 + s.income40_3 + (s.interest + s.dividend) + s.prof40_6 + s.income40_7 + s.rental + s.other40
  const exp_123 = Math.min((s.income40_1 + s.income40_2 + s.income40_3) * 0.50, 100000)
  const exp_5 = s.rental * 0.30
  const exp_6 = s.prof40_6type === 'doctor' ? s.prof40_6 * 0.60 : s.prof40_6 * 0.40
  const exp_7 = s.income40_7 * 0.60
  const exp_8 = s.other40 * 0.60
  const expD = exp_123 + exp_5 + exp_6 + exp_7 + exp_8

  const selfD = 60000, spouseD = (s.maritalStatus === 'married' && !s.spouseIncome) ? 60000 : 0
  const childD = Math.min(s.children, 3) * 30000, parentD = s.parents * 30000, disD = s.disabled * 60000
  const perD = selfD + spouseD + childD + parentD + disD

  const lifeD = Math.min(s.lifeIns, 100000), hlthD = Math.min(s.healthIns, 25000)
  const phD = Math.min(s.parentHealthIns, 15000), ssD = Math.min(s.socialSec, 10500)
  const insD = Math.min(lifeD + hlthD, 100000) + phD + ssD

  const net1 = ti - expD
  const rmfR = Math.min(s.rmf, net1 * 0.30), annR = Math.min(s.annuityIns, Math.min(net1 * 0.15, 200000))
  const pvdR = Math.min(s.pvd, 500000), govR = Math.min(s.govPension, 500000), nsfR = Math.min(s.nsf, 30000)
  const gRaw = rmfR + annR + pvdR + govR + nsfR, rat = gRaw > 500000 ? 500000 / gRaw : 1
  const rmfD = rmfR * rat, annD = annR * rat, pvdD = pvdR * rat, govD = govR * rat, nsfD = nsfR * rat
  const esgD = Math.min(s.thaiesg, Math.min(net1 * 0.30, 300000))
  const savD = rmfD + annD + pvdD + govD + nsfD + esgD

  const spendD = Math.min(s.mortgage, 100000) + Math.min(s.easyReceipt, 50000) + Math.min(s.shopDee, 50000)
    + Math.min(s.otop, 10000) + Math.min(s.donation * 2, net1 * 0.10) + Math.min(s.eduDonation, net1 * 0.10)
    + Math.min(s.politicalDonate, 10000) + Math.min(s.newHome * 0.005, 100000)

  const allD = expD + perD + insD + savD + spendD
  const ni = Math.max(0, ti - allD)
  const tax = calcTax(ni)
  const netTax = Math.max(0, tax - s.prepaid)
  const eff = ti > 0 ? (tax / ti) * 100 : 0
  const deducts = [
    { l: 'ค่าใช้จ่าย', v: expD, c: '#6b9ee8' },
    { l: 'ส่วนตัว', v: selfD, c: '#3b6fd4' },
    { l: 'คู่สมรส', v: spouseD, c: '#2251a3' },
    { l: 'บุตร', v: childD, c: '#1e3a78' },
    { l: 'บิดามารดา', v: parentD, c: '#162c5e' },
    { l: 'ผู้พิการ', v: disD, c: '#0f2044' },
    { l: 'ประกันชีวิต', v: lifeD, c: '#f59e0b' },
    { l: 'ประกันสุขภาพ', v: hlthD, c: '#fbbf24' },
    { l: 'สุขภาพบิดามารดา', v: phD, c: '#fcd34d' },
    { l: 'ประกันสังคม', v: ssD, c: '#fb923c' },
    { l: 'RMF', v: rmfD, c: '#10b981' },
    { l: 'ประกันบำนาญ', v: annD, c: '#2dd4bf' },
    { l: 'PVD', v: pvdD, c: '#059669' },
    { l: 'กบข./GPF', v: govD, c: '#047857' },
    { l: 'กอช./NSF', v: nsfD, c: '#065f46' },
    { l: 'Thai ESG', v: esgD, c: '#34d399' },
    { l: 'กระตุ้น ศก./บริจาค', v: spendD, c: '#a78bfa' },
  ].filter(d => d.v > 0)
  return { ti, expD, perD, insD, savD, spendD, allD, ni, tax, netTax, eff, mr: marginalRate(ni), mth: netTax / 12, deducts }
}
