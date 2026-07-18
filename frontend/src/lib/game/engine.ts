import { CAREERS } from './careers'
import { applyEvent, instantiateEvent, payCost } from './events'
import { mulberry32, randInt, randNorm } from './rng'
import type {
  CheckpointId, DecisionLog, EventInstance, GameState, InsightCard,
  PlanChoices, RetirementResult, ScheduledEvent,
} from './types'

/* ── Engine เกมเศรษฐี — pure + deterministic จาก seed ──────────────────
   ลำดับต่อปี: resolveYear(plan) → (ถ้ามี event) applyEventChoice
   ลำดับต่อช่วง 5 ปี: checkpoint (ถ้ามี) → ผู้เล่นตั้งแผน → เล่น 5 ปี      */

export const START_AGE = 30
export const TOTAL_YEARS = 30
export const PERIOD_YEARS = 5

export const DEFAULT_PLAN: PlanChoices = { savePct: 10, investPct: 10, risk: 'mid', healthIns: false, lifeIns: false }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const netWorth = (s: GameState) => s.cash + s.invested + s.homeValue - s.mortgageBalance - s.debt

export const periodOf = (year: number) => Math.min(5, Math.floor(year / PERIOD_YEARS))

/* ── สร้างเกมใหม่ — pre-roll ตลาด/ความผันผวนรายได้/ตารางเหตุการณ์ทั้งหมดจาก seed ── */
export function createGame(seed: number, careerId: GameState['careerId']): GameState {
  const rng = mulberry32(seed)
  const career = CAREERS[careerId]

  // ตลาดหุ้น 30 ปี: ~10% ของปีเป็น crash (-25% ถึง -38%) ที่เหลือ mean 9% sd 14%
  const eqReturns: number[] = []
  for (let t = 0; t < TOTAL_YEARS; t++) {
    const u = rng()
    eqReturns.push(u < 0.10 ? -(0.25 + rng() * 0.13) : clamp(0.09 + 0.14 * randNorm(rng), -0.20, 0.45))
  }

  // ความผันผวนรายได้ต่อปี (factor คูณเงินเดือน)
  const incomeNoise: number[] = []
  for (let t = 0; t < TOTAL_YEARS; t++) incomeNoise.push(clamp(1 + career.vol * randNorm(rng), 0.5, 1.6))

  // ตารางเหตุการณ์ (ลำดับ roll คงที่ — deterministic)
  const schedule: ScheduledEvent[] = [
    { year: randInt(rng, 2, 4), eventId: 'promo', mag: rng() },
    { year: randInt(rng, 6, 27), eventId: 'sick', mag: rng() },
    { year: randInt(rng, 8, 25), eventId: 'windfall', mag: rng() },
    { year: randInt(rng, 10, 20), eventId: 'scam', mag: rng() },
    { year: randInt(rng, 16, 27), eventId: 'parent', mag: rng() },
    { year: randInt(rng, 3, 27), eventId: 'repair', mag: rng() },
  ]
  // รายได้สะดุด (ตกงาน/ธุรกิจสะดุด) — โอกาสต่อช่วง ตามอาชีพ สูงสุด 2 ครั้ง
  let layoffs = 0
  for (let p = 1; p <= 5 && layoffs < 2; p++) {
    if (rng() < career.layoffProb) {
      schedule.push({ year: p * PERIOD_YEARS + randInt(rng, 0, 4), eventId: 'layoff', mag: rng() })
      layoffs++
    }
  }
  // ตลาด crash ครั้งแรก → เหตุการณ์สอน stay invested
  const crashYear = eqReturns.findIndex(r => r < -0.15)
  if (crashYear >= 0) schedule.push({ year: crashYear, eventId: 'crash', mag: rng() })

  // กันเหตุการณ์ชนปีเดียวกัน — crash ต้องอยู่ปีที่ตลาดตกจริงเท่านั้น จึงยึดปีก่อน แล้วเลื่อนตัวอื่นหลบ
  schedule.sort((a, b) => a.year - b.year)
  const used = new Set<number>()
  for (const ev of schedule) if (ev.eventId === 'crash') used.add(ev.year)
  for (const ev of schedule) {
    if (ev.eventId === 'crash') continue
    while (used.has(ev.year) && ev.year < TOTAL_YEARS - 1) ev.year++
    used.add(ev.year)
  }

  return {
    seed, careerId, year: 0,
    monthlyIncome: career.startMonthly, spouseIncome: 0,
    cash: 30000, invested: 0, debt: 0,
    homeValue: 0, mortgageBalance: 0, mortgageMonthly: 0,
    rentMonthly: 7000, livingMonthly: career.livingMonthly,
    married: false, hasChild: false,
    healthInsActive: false, lifeInsActive: false,
    happiness: 55, marketBoost: 0,
    checkpointsDone: [], schedule, eqReturns, incomeNoise,
    log: [], history: [],
  }
}

/* ── จำลอง 1 ปี — คืน state ใหม่ + เหตุการณ์ (ถ้าปีนี้มี) ── */
export function resolveYear(prev: GameState, plan: PlanChoices): { state: GameState; event: EventInstance | null } {
  const s = structuredClone(prev)
  const career = CAREERS[s.careerId]
  const t = s.year
  s.healthInsActive = plan.healthIns
  s.lifeInsActive = plan.lifeIns

  // ตลาด: บวก boost ช่วงฟื้นตัวหลัง crash
  const eq = s.eqReturns[t] + (s.marketBoost > 0 ? 0.10 : 0)
  if (s.marketBoost > 0) s.marketBoost--

  // รายได้ปีนี้
  const annualIncome = (s.monthlyIncome * s.incomeNoise[t] + s.spouseIncome) * 12

  // เบี้ยประกัน (สุขภาพแพงขึ้นตามอายุ · ข้าราชการรักษาฟรีไม่ต้องซื้อ)
  const healthPrem = plan.healthIns && !career.freeHealthcare ? 12000 + 600 * t : 0
  const lifePrem = plan.lifeIns ? 15000 : 0

  // หนี้ดอกแพง: ทบ 15%/ปี แล้วผ่อนด้วย 15% ของรายได้
  s.debt *= 1.15
  const debtPay = s.debt > 0 ? Math.min(s.debt, annualIncome * 0.15) : 0
  s.debt -= debtPay

  // รายจ่ายบังคับ
  const mandatory = (s.livingMonthly + s.rentMonthly + s.mortgageMonthly) * 12 + healthPrem + lifePrem + debtPay

  // จัดสรรตามแผน — ถ้าเงินไม่พอ ตัดลงทุนก่อน แล้วค่อยตัดออม
  let save = annualIncome * plan.savePct / 100
  let invest = annualIncome * plan.investPct / 100
  let leftover = annualIncome - mandatory - save - invest
  if (leftover < 0) {
    const cutI = Math.min(invest, -leftover); invest -= cutI; leftover += cutI
  }
  if (leftover < 0) {
    const cutS = Math.min(save, -leftover); save -= cutS; leftover += cutS
  }
  const discretionary = Math.max(0, leftover)
  if (leftover < 0) payCost(s, -leftover)   // รายได้ไม่พอรายจ่ายบังคับ: เงินสด → ขายพอร์ต → หนี้

  // พอร์ตลงทุน: ผลตอบแทนตามระดับความเสี่ยง (อิงตลาด eq, mean ตลาด 8%)
  const portfolioReturn = plan.risk === 'low' ? 0.025 + 0.15 * (eq - 0.08)
    : plan.risk === 'mid' ? 0.05 + 0.5 * (eq - 0.08)
    : 0.08 + 1.05 * (eq - 0.08)
  s.invested = Math.max(0, s.invested * (1 + portfolioReturn)) + invest + annualIncome * career.employerInvestPct
  s.cash = s.cash * 1.015 + save

  // บ้าน: ราคาขึ้น 3%/ปี · ผ่อนตัดต้น (ดอกบ้าน 5%)
  if (s.homeValue > 0) {
    s.homeValue *= 1.03
    if (s.mortgageBalance > 0) {
      const principal = Math.max(0, s.mortgageMonthly * 12 - s.mortgageBalance * 0.05)
      s.mortgageBalance = Math.max(0, s.mortgageBalance - principal)
      if (s.mortgageBalance === 0) s.mortgageMonthly = 0
    }
  }

  // ความสุข: เงินใช้ชีวิตอิสระ + ครอบครัว − ความเครียดหนี้/ไม่มีเงินสำรอง
  // มี hedonic adaptation ดึงกลับหาค่ากลาง — ทั้งสุขสุดและทุกข์สุดไม่ค้างถาวร
  const dr = annualIncome > 0 ? discretionary / annualIncome : 0
  let dH = dr > 0.30 ? 3 : dr > 0.15 ? 2 : dr > 0.07 ? 1 : dr > 0.03 ? -1 : -3
  if (s.married) dH += 0.5
  if (s.hasChild) dH += 0.5
  if (s.debt > annualIncome * 0.3) dH -= 3
  if (s.cash < (s.livingMonthly + s.rentMonthly + s.mortgageMonthly) * 3) dH -= 1  // กังวลเพราะไร้เงินสำรอง
  dH += (50 - s.happiness) * 0.08
  s.happiness = clamp(s.happiness + dH, 0, 100)

  // เงินเฟ้อค่าครองชีพ + รายได้โตตามอาชีพ
  s.livingMonthly *= 1.025
  if (s.rentMonthly > 0) s.rentMonthly *= 1.025
  s.monthlyIncome *= 1 + career.growth
  if (s.spouseIncome > 0) s.spouseIncome *= 1.03

  // ตลาดพัง → ตั้งช่วงฟื้นตัว 2 ปีถัดไป
  if (s.eqReturns[t] < -0.15) s.marketBoost = 2

  s.history.push({
    year: t, age: START_AGE + t, netWorth: netWorth(s),
    cash: s.cash, invested: s.invested,
    homeEquity: s.homeValue - s.mortgageBalance, debt: s.debt,
    happiness: s.happiness, annualIncome, eqReturn: s.eqReturns[t],
  })
  s.year = t + 1

  const sch = s.schedule.find(e => e.year === t)
  const event = sch ? instantiateEvent(s, sch) : null
  return { state: s, event }
}

/** ตอบเหตุการณ์ → state ใหม่ + log สำหรับโชว์ผล */
export function applyEventChoice(prev: GameState, ev: EventInstance, choiceId: string) {
  const s = structuredClone(prev)
  const logged = applyEvent(s, ev, choiceId)
  return { state: s, logged }
}

/* ── Checkpoint ชีวิต (ก่อนเริ่มช่วงใหม่) ── */

export interface CheckpointView {
  id: CheckpointId
  emoji: string
  title: string
  desc: string
  choices: { id: string; label: string; detail?: string; disabled?: boolean }[]
}

export function checkpointAt(s: GameState): CheckpointView | null {
  const mk = (id: CheckpointId): CheckpointView | null => {
    if (s.checkpointsDone.includes(id)) return null
    if (id === 'marry') return {
      id, emoji: '💍', title: 'อายุ 35 — แฟนที่คบมานานชวนแต่งงาน',
      desc: 'ค่าจัดงาน ~250,000 บาท แต่จะได้อีกหนึ่งแรงช่วยหารายได้เข้าบ้าน (และค่าใช้จ่ายบ้านก็เพิ่มขึ้นด้วย)',
      choices: [
        { id: 'yes', label: 'แต่ง! 💒', detail: 'รายได้ครัวเรือน +12,000/เดือน · รายจ่าย +6,000/เดือน · ความสุขพุ่ง' },
        { id: 'skip', label: 'ยังก่อน ขอโสดต่อ', detail: 'ชีวิตเบาๆ คนเดียวก็ดี' },
      ],
    }
    if (id === 'house') {
      const canBuy = s.cash + s.invested >= 300000
      return {
        id, emoji: '🏠', title: 'อายุ 40 — ซื้อบ้านหรือเช่าต่อ?',
        desc: 'บ้านราคา 3 ล้าน ดาวน์ 300,000 ผ่อนเดือนละ 18,000 (แทนค่าเช่าเดิม) — บ้านเป็นทรัพย์สินที่โตปีละ ~3%',
        choices: [
          { id: 'buy', label: 'ซื้อบ้าน 🏡', detail: canBuy ? 'ดาวน์ 300,000 · ผ่อน 18,000/เดือน 20 ปี' : 'เงินไม่พอดาวน์ (ต้องมี 300,000)', disabled: !canBuy },
          { id: 'rent', label: 'เช่าต่อไป', detail: 'ค่าเช่าเดินต่อ ปรับขึ้นทุกปีตามเงินเฟ้อ' },
        ],
      }
    }
    // child — ต้องแต่งงานก่อน
    if (!s.married) return null
    return {
      id, emoji: '👶', title: 'อายุ 45 — มีลูกไหม?',
      desc: 'ลูกหนึ่งคน = ค่าใช้จ่าย ~9,000/เดือนยาวถึงมหาวิทยาลัย (ค่าเทอมก้อนใหญ่รออยู่ตอนลูกโต) แลกกับความสุขที่เงินซื้อไม่ได้',
      choices: [
        { id: 'yes', label: 'มีลูก 👨‍👩‍👧', detail: 'รายจ่าย +9,000/เดือน · เตรียมค่าเทอมมหาวิทยาลัย ~300,000' },
        { id: 'skip', label: 'ไม่มีดีกว่า', detail: 'DINK life — เงินเหลือเก็บเยอะกว่า' },
      ],
    }
  }
  if (s.year === 5) return mk('marry')
  if (s.year === 10) return mk('house')
  if (s.year === 15) return mk('child')
  return null
}

export function applyCheckpoint(prev: GameState, id: CheckpointId, choiceId: string): GameState {
  const s = structuredClone(prev)
  s.checkpointsDone.push(id)
  const logIt = (title: string, moneyDelta: number, note: string) =>
    s.log.push({ year: s.year, age: START_AGE + s.year, eventId: `cp:${id}`, title, choiceId, moneyDelta, note })

  if (id === 'marry' && choiceId === 'yes') {
    payCost(s, 250000)
    s.married = true
    s.spouseIncome = 12000
    s.livingMonthly += 6000
    s.happiness = clamp(s.happiness + 10, 0, 100)
    logIt('แต่งงาน 💍', -250000, 'จัดงานแต่ง 250,000 — ครอบครัวใหม่เริ่มต้น รายได้ครัวเรือนเพิ่ม')
  }
  if (id === 'house' && choiceId === 'buy' && s.cash + s.invested >= 300000) {
    payCost(s, 300000)
    s.homeValue = 3_000_000
    s.mortgageBalance = 2_700_000
    s.mortgageMonthly = 18000
    s.rentMonthly = 0
    s.happiness = clamp(s.happiness + 8, 0, 100)
    logIt('ซื้อบ้านหลังแรก 🏡', -300000, 'ดาวน์ 300,000 — เปลี่ยนค่าเช่าเป็นการผ่อนทรัพย์สินของตัวเอง')
  }
  if (id === 'child' && choiceId === 'yes' && s.married) {
    s.hasChild = true
    s.livingMonthly += 9000
    s.happiness = clamp(s.happiness + 12, 0, 100)
    s.schedule.push({ year: 25, eventId: 'edu', mag: 0 })
    logIt('ต้อนรับสมาชิกใหม่ 👶', 0, 'ครอบครัวสมบูรณ์ — อย่าลืมเตรียมทุนการศึกษาให้ลูก')
  }
  return s
}

/* ── จบเกม: คำนวณผลเกษียณ อายุ 60 ── */
export function finishGame(s: GameState): RetirementResult {
  const career = CAREERS[s.careerId]
  // ปิดหนี้ทั้งหมดตอนเกษียณ แล้วดูเงินเหลือ (ไม่ขายบ้าน — เป็นที่อยู่)
  const assets = Math.max(0, s.cash + s.invested - s.debt - s.mortgageBalance)
  const needMonthly = (s.livingMonthly + s.rentMonthly) * 0.75
  const pensionMonthly = career.pensionPct > 0 ? s.monthlyIncome * career.pensionPct : career.ssoMonthly
  const netNeedYear = Math.max(0, needMonthly - pensionMonthly) * 12

  let fundedAge = 100
  if (netNeedYear > 0) {
    let a = assets
    for (let age = 60; age < 100; age++) {
      a = a * 1.035 - netNeedYear * Math.pow(1.025, age - 60)
      if (a < 0) { fundedAge = age; break }
    }
  }
  let moneyScore = clamp((fundedAge - 60) / 30, 0, 1) * 100
  // พึ่งบำนาญอย่างเดียวโดยไม่มีเงินก้อนของตัวเอง = เปราะบาง (ค่ารักษา/ฉุกเฉินยามชรา) — เพดานคะแนนเงิน 70
  if (assets < 1_000_000) moneyScore = Math.min(moneyScore, 70)
  const score = Math.round(0.7 * moneyScore + 0.3 * s.happiness)
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'
  return {
    fundedAge, needMonthly, pensionMonthly, assetsAtRetire: assets,
    netWorth: netWorth(s), happiness: s.happiness, score, grade,
  }
}

/* ── Replay ทั้งเกมจาก DecisionLog — ใช้ทำ counterfactual insight ── */

export interface ReplayOverrides {
  plan?: (period: number, plan: PlanChoices) => PlanChoices
  choice?: (ev: EventInstance) => string | undefined
}

export function replayGame(seed: number, log: DecisionLog, ov?: ReplayOverrides) {
  let s = createGame(seed, log.careerId)
  while (s.year < TOTAL_YEARS) {
    const cp = checkpointAt(s)
    if (cp) s = applyCheckpoint(s, cp.id, log.checkpointChoices[cp.id] ?? 'skip')
    let plan = log.plans[periodOf(s.year)] ?? log.plans[log.plans.length - 1] ?? DEFAULT_PLAN
    if (ov?.plan) plan = ov.plan(periodOf(s.year), plan)
    const r = resolveYear(s, plan)
    s = r.state
    if (r.event) {
      const cid = ov?.choice?.(r.event) ?? log.eventChoices[r.event.key] ?? r.event.choices[0].id
      applyEvent(s, r.event, cid)
    }
  }
  return { state: s, result: finishGame(s) }
}

/* ── Insight cards: "ถ้าคุณ..." จากการ replay ด้วย seed เดิม ── */
export function computeInsights(seed: number, log: DecisionLog, finalState: GameState, result: RetirementResult): InsightCard[] {
  const cards: InsightCard[] = []
  const fmtB = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} ล้านบาท` : `${Math.round(n).toLocaleString('th-TH')} บาท`

  // 1) ถ้าลงทุน ≥20% สม่ำเสมอตั้งแต่ปีแรก
  const avgInvest = log.plans.reduce((a, p) => a + p.investPct, 0) / Math.max(1, log.plans.length)
  if (avgInvest < 18) {
    const alt = replayGame(seed, log, { plan: (_p, pl) => ({ ...pl, investPct: Math.max(pl.investPct, 20), risk: pl.risk === 'low' ? 'mid' : pl.risk }) })
    const delta = netWorth(alt.state) - netWorth(finalState)
    if (delta > 200000) cards.push({
      emoji: '📈', title: 'พลังของการลงทุนสม่ำเสมอ', delta,
      body: `ถ้าคุณลงทุนอย่างน้อย 20% ของรายได้ทุกปีตั้งแต่แรก ตอนเกษียณจะมีความมั่งคั่งเพิ่มอีก ${fmtB(delta)} และเงินจะพอใช้ถึงอายุ ${alt.result.fundedAge >= 100 ? 'ตลอดชีวิต' : alt.result.fundedAge} (จากเดิมอายุ ${result.fundedAge >= 100 ? '100+' : result.fundedAge})`,
    })
  } else {
    // เล่นดีอยู่แล้ว — โชว์มูลค่าที่วินัยสร้าง (เทียบกับไม่ลงทุนเลย)
    const alt = replayGame(seed, log, { plan: (_p, pl) => ({ ...pl, investPct: 0 }) })
    const delta = netWorth(finalState) - netWorth(alt.state)
    if (delta > 200000) cards.push({
      emoji: '🏆', title: 'วินัยการลงทุนของคุณสร้างมูลค่ามหาศาล', delta,
      body: `การลงทุนสม่ำเสมอตลอด 30 ปีสร้างความมั่งคั่งให้คุณมากกว่าการฝากเงินเฉยๆ ถึง ${fmtB(delta)} — ดอกเบี้ยทบต้นคือสิ่งมหัศจรรย์อันดับ 8 ของโลกจริงๆ`,
    })
  }

  // 2) ป่วยแบบไม่มีประกัน
  const sickHits = finalState.log.filter(e => e.eventId === 'sick' && e.moneyDelta <= -100000)
  if (sickHits.length > 0) {
    const lost = sickHits.reduce((a, e) => a + -e.moneyDelta, 0)
    cards.push({
      emoji: '🛡️', title: 'ประกันสุขภาพคือเกราะของแผน', delta: lost - 20000 * sickHits.length,
      body: `เหตุป่วยตอนอายุ ${sickHits[0].age} ทำคุณเสียไป ${fmtB(lost)} — ถ้ามีประกันสุขภาพ (เบี้ยปีละหมื่นต้นๆ) คุณจะจ่ายแค่ ${fmtB(20000 * sickHits.length)}`,
    })
  }

  // 3) โดนแชร์ลูกโซ่
  const scammed = finalState.log.find(e => e.eventId === 'scam' && e.choiceId === 'invest')
  if (scammed) {
    const grown = 100000 * Math.pow(1.07, TOTAL_YEARS - scammed.year)
    cards.push({
      emoji: '⚠️', title: 'บทเรียนราคาแพง: ของฟรีไม่มีในโลก', delta: grown,
      body: `เงิน 100,000 ที่เสียให้แชร์ลูกโซ่ตอนอายุ ${scammed.age} ถ้าเอาไปลงทุนปกติ (7%/ปี) ตอนเกษียณจะกลายเป็น ${fmtB(grown)} — ผลตอบแทน "การันตี" ที่สูงผิดปกติ = โกงเสมอ`,
    })
  }

  // 4) ขายหนีตอนตลาดตก
  const panicked = finalState.log.find(e => e.eventId === 'crash' && e.choiceId === 'sellall')
  if (panicked) {
    const alt = replayGame(seed, log, { choice: ev => ev.eventId === 'crash' ? 'hold' : undefined })
    const delta = netWorth(alt.state) - netWorth(finalState)
    if (delta > 100000) cards.push({
      emoji: '🧘', title: 'ตลาดตกไม่น่ากลัวเท่า "ขายตอนตก"', delta,
      body: `ถ้าคุณถือพอร์ตต่อแทนที่จะขายหนีตอนตลาดตก ตอนเกษียณจะมีเพิ่มอีก ${fmtB(delta)} — ตลาดฟื้นเสมอ แต่คนที่ขายไปแล้วไม่ได้ฟื้นด้วย`,
    })
  }

  // 5) เงินสำรองฉุกเฉิน (ตกงานแล้วต้องกู้/ขายพอร์ต)
  const forced = finalState.log.find(e => e.eventId === 'layoff' && e.choiceId !== 'emergency')
  if (forced) {
    cards.push({
      emoji: '🚨', title: 'เงินสำรองฉุกเฉิน 6 เดือน = เส้นชีวิต',
      body: `ตอน${forced.title.replace('!', '')} คุณไม่มีเงินสำรองพอ เลยต้อง${forced.choiceId === 'loan' ? 'กู้หนี้ดอกแพง' : 'ขายพอร์ตแบบจำใจ'} — นักวางแผนการเงินแนะนำให้มีเงินสดสำรอง 6 เท่าของรายจ่ายต่อเดือนเสมอ`,
    })
  }

  // เรียงตามมูลค่า แล้วเอา 3 ใบแรก
  return cards.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 3)
}
