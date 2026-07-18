/* ── Types กลางของเกมเศรษฐี (จำลองชีวิตการเงิน 30 ปี อายุ 30→60) ── */

export type CareerId = 'gov' | 'corp' | 'biz' | 'free'
export type RiskLevel = 'low' | 'mid' | 'high'
export type CheckpointId = 'marry' | 'house' | 'child'

/** แผนการเงินที่ผู้เล่นตั้งต่อช่วง 5 ปี (ค้างค่าไว้จนกว่าจะแก้) */
export interface PlanChoices {
  savePct: number      // % ของรายได้ → เงินฝาก
  investPct: number    // % ของรายได้ → พอร์ตลงทุน
  risk: RiskLevel
  healthIns: boolean
  lifeIns: boolean
}

export interface EventChoiceDef {
  id: string
  label: string
  detail?: string
}

/** เหตุการณ์ที่ถูกกำหนดตาราง (pre-rolled ตอนสร้างเกม — deterministic จาก seed) */
export interface ScheduledEvent {
  year: number        // ปีของเกม (0-29) ที่เหตุการณ์เกิด (หลังจบปีนั้น)
  eventId: string
  mag: number         // ค่าสุ่ม 0-1 กำหนดความรุนแรง/ขนาดเงิน
}

/** เหตุการณ์พร้อมข้อความ+ทางเลือก ณ ตอนเกิดจริง (สร้างจาก def + state) */
export interface EventInstance {
  key: string          // `${year}:${eventId}` — ใช้เป็น key บันทึกการตัดสินใจ
  eventId: string
  year: number
  mag: number
  emoji: string
  title: string
  desc: string
  choices: EventChoiceDef[]
}

export interface LoggedEvent {
  year: number
  age: number
  eventId: string
  title: string
  choiceId: string
  moneyDelta: number   // ผลต่อเงินสุทธิ (ลบ = เสียเงิน)
  note: string         // ข้อความผลลัพธ์โชว์ผู้เล่น
}

export interface YearSnapshot {
  year: number
  age: number
  netWorth: number
  cash: number
  invested: number
  homeEquity: number
  debt: number
  happiness: number
  annualIncome: number
  eqReturn: number     // ผลตอบแทนตลาดหุ้นปีนั้น
}

export interface GameState {
  seed: number
  careerId: CareerId
  year: number             // ปีที่ "จะเล่นต่อไป" (0-based); อายุ = 30 + year
  monthlyIncome: number
  spouseIncome: number     // รายได้คู่สมรส (สุทธิเข้าบ้าน)
  cash: number
  invested: number
  debt: number             // หนี้ดอกแพง
  homeValue: number
  mortgageBalance: number
  mortgageMonthly: number
  rentMonthly: number
  livingMonthly: number    // ค่าครองชีพพื้นฐาน (ไม่รวมค่าเช่า/ผ่อนบ้าน)
  married: boolean
  hasChild: boolean
  healthInsActive: boolean // สถานะประกันตามแผนช่วงปัจจุบัน (engine อัปเดตทุกปี — ให้ event อ่านได้)
  lifeInsActive: boolean
  happiness: number        // 0-100
  marketBoost: number      // จำนวนปีที่เหลือของช่วงตลาดฟื้นหลัง crash
  checkpointsDone: CheckpointId[]
  schedule: ScheduledEvent[]
  eqReturns: number[]      // ผลตอบแทนตลาดหุ้น 30 ปี pre-rolled
  incomeNoise: number[]    // ความผันผวนรายได้ต่อปี pre-rolled (factor คูณ)
  log: LoggedEvent[]
  history: YearSnapshot[]
}

/** บันทึกการตัดสินใจทั้งเกม — ใช้ replay แบบ counterfactual */
export interface DecisionLog {
  careerId: CareerId
  plans: PlanChoices[]                       // ต่อช่วง 0..5
  eventChoices: Record<string, string>       // key = `${year}:${eventId}`
  checkpointChoices: Partial<Record<CheckpointId, string>>
}

export interface RetirementResult {
  fundedAge: number        // เงินพอใช้ถึงอายุนี้ (100 = ตลอดชีวิต)
  needMonthly: number      // รายจ่ายหลังเกษียณ/เดือน (ปีแรก)
  pensionMonthly: number
  assetsAtRetire: number   // เงินสด+พอร์ต หลังปิดหนี้
  netWorth: number
  happiness: number
  score: number            // 0-100 (เงิน 70% + ความสุข 30%)
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface InsightCard {
  emoji: string
  title: string
  body: string
  delta?: number           // มูลค่าที่ต่างกัน (บวก = โอกาสที่พลาด/สิ่งที่ได้)
}
