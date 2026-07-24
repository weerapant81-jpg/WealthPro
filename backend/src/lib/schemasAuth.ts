// ── รูปร่าง request body ของ endpoint ที่ต้องล็อกอินก่อน ──
// ต่อจาก schemas.ts ที่คุมกลุ่ม "ใครก็ยิงได้" — ชุดนี้คุมกลุ่มที่ต้องมี token
//
// ⚠️ ทุกตัวใช้ z.looseObject() ไม่ใช่ z.object()
// เพราะ z.object() จะ "ตัดฟิลด์ที่ไม่ได้ประกาศทิ้ง" ซึ่งเคยทำให้ผลการเล่นเกมหายมาแล้ว
// looseObject ปล่อยฟิลด์ที่ไม่ได้ประกาศผ่านไปครบ แต่ยังตรวจชนิดของฟิลด์ที่ประกาศไว้
// และยังปฏิเสธ body ที่ไม่ใช่ object (array/string/null) ซึ่งเป็นเหตุ crash ที่พบบ่อย
import { z } from './validate'

// ── ชิ้นส่วนที่ใช้ซ้ำ ──
const txt = (max = 500) => z.string().max(max)
const rate = z.number().finite().min(-100).max(1000)   // อัตรา % ต่อปี
const age = z.number().finite().min(0).max(150)        // อายุ (ปี)
// ช่องตัวเลขในหน้าสมมติฐานที่ผู้ใช้ล้างค่าได้ (หรือลูกค้าไม่มีคู่สมรส → ช่องอายุคู่สมรสว่าง)
// ฟอร์มอาจส่ง '' หรือ null มา = "ไม่ระบุ" — แปลงเป็น undefined ก่อน ไม่ให้ช่องเดียวทำทั้งหน้าบันทึกไม่ได้
const optNum = (base: z.ZodType) => z.preprocess(v => (v === '' || v === null ? undefined : v), base.optional())
const dateish = z.union([z.string().max(40), z.date(), z.null()])
const flexNum = z.union([z.number().finite(), z.string().max(30), z.null()])  // ฟอร์มบางหน้าส่งตัวเลขมาเป็นข้อความ

/** body ที่เป็นก้อน JSON ของแผน (โครงสร้างอิสระ เก็บทั้งก้อนลง column Json)
 *  ตรวจได้แค่ว่า "ต้องเป็น object" — กัน array/string/null ที่ทำให้ controller พัง */
export const jsonBlobSchema = z.looseObject({})

// ── รายรับ / รายจ่าย / สินทรัพย์ / หนี้สิน / เป้าหมาย ──
export const incomeSchema = z.looseObject({
  name: txt(200).optional(), amount: flexNum.optional(),
  frequency: txt(20).optional(), category: txt(60).optional(), isActive: z.boolean().optional(),
})
export const expenseSchema = z.looseObject({
  name: txt(200).optional(), amount: flexNum.optional(),
  frequency: txt(20).optional(), category: txt(60).optional(),
  isFixed: z.boolean().optional(), person: txt(20).optional(),
})
export const assetSchema = z.looseObject({
  name: txt(200).optional(), value: flexNum.optional(),
  category: txt(60).optional(), returnRate: flexNum.optional(), person: txt(20).optional(),
})
export const liabilitySchema = z.looseObject({
  name: txt(200).optional(), balance: flexNum.optional(), interestRate: flexNum.optional(),
  monthlyPayment: flexNum.optional(), category: txt(60).optional(), person: txt(20).optional(),
})
export const goalSchema = z.looseObject({
  name: txt(200).optional(), targetAmount: flexNum.optional(), currentAmount: flexNum.optional(),
  targetDate: dateish.optional(), priority: flexNum.optional(), category: txt(60).optional(),
})

// ── งานของนักวางแผน ──
export const appointmentSchema = z.looseObject({
  title: txt(300).optional(), clientName: txt(200).nullable().optional(),
  date: dateish.optional(), note: txt(2000).nullable().optional(),
})
export const taskSchema = z.looseObject({
  title: txt(300).optional(), done: z.boolean().optional(), dueDate: dateish.optional(),
})
export const announcementSchema = z.looseObject({
  title: txt(300).optional(), body: txt(20000).optional(), pinned: z.boolean().optional(),
})
export const actionItemSchema = z.looseObject({
  person: txt(20).optional(), title: txt(500).optional(), category: txt(60).optional(),
  status: txt(30).optional(), owner: txt(100).optional(), priority: txt(20).optional(),
  dueDate: dateish.optional(), note: txt(4000).nullable().optional(),
  metricKey: txt(60).nullable().optional(),
  baseline: flexNum.nullable().optional(), current: flexNum.nullable().optional(), target: flexNum.nullable().optional(),
  source: txt(60).optional(), autoKey: txt(200).nullable().optional(),
})
export const planReviewDateSchema = z.looseObject({ date: dateish.optional() })

// ── ประกัน ──
export const lifeInsuranceSchema = z.looseObject({
  insuredPerson: txt(200).optional(), policyNumber: txt(100).nullable().optional(),
  policyDate: dateish.optional(), sumAssured: flexNum.nullable().optional(),
  insuranceType: txt(100).nullable().optional(), premium: flexNum.nullable().optional(),
  cashValue: flexNum.nullable().optional(), policyAge: flexNum.nullable().optional(),
  company: txt(200).nullable().optional(), notes: txt(4000).nullable().optional(),
})
export const propertyInsuranceSchema = z.looseObject({
  coverageType: txt(200).optional(), policyNumber: txt(100).nullable().optional(),
  insuranceType: txt(100).nullable().optional(), coverageAmount: flexNum.nullable().optional(),
  premium: flexNum.nullable().optional(), coveragePeriod: txt(100).nullable().optional(),
  company: txt(200).nullable().optional(), notes: txt(4000).nullable().optional(),
})

// ── ลูกค้า / วิดีโอสอน / อื่น ๆ ──
export const clientSchema = z.looseObject({
  name: txt(200).optional(), email: z.string().max(254).optional(),
})
export const tutorialSchema = z.looseObject({
  title: txt(300).optional(), url: txt(2000).optional(),
  thumbnail: txt(2000).nullable().optional(), order: flexNum.optional(),
})
export const gameLeadUpdateSchema = z.looseObject({ contacted: z.boolean().optional() })
export const consentSchema = z.looseObject({})
export const copilotChatSchema = z.looseObject({
  // จำกัดความยาวข้อความ กันยิงข้อความมหึมาเข้าโมเดล (ต้นทุนต่อ token)
  message: z.string().max(20000).optional(),
  messages: z.array(z.looseObject({})).max(100).optional(),
})
export const assetReturnSchema = z.looseObject({
  symbol: txt(50).optional(), symbols: z.array(txt(50)).max(200).optional(),
})

/** อัตราสมมติฐาน — ต้องอยู่ในช่วงที่เป็นไปได้ กันพิมพ์ผิดจนแผนเพี้ยน */
export const profileSchema = z.looseObject({
  inflationRate: optNum(rate), educationInflation: optNum(rate),
  rentInflation: optNum(rate), medicalInflation: optNum(rate),
  creditCardRate: optNum(rate), cashAdvanceRate: optNum(rate), personalLoanRate: optNum(rate),
  homeLoanRate: optNum(rate), carLoanRate: optNum(rate),
  educationFundReturn: optNum(rate), educationReturnDuring: optNum(rate),
  preRetirementReturn: optNum(rate), postRetirementReturn: optNum(rate),
  expectedReturn: optNum(rate), pvdReturnRate: optNum(rate), ssoReturnRate: optNum(rate),
  // อายุ: ยอมรับว่าง/null (ลูกค้าไม่มีคู่สมรส) และ 0 (ช่องส่ง Number('')=0 เมื่อล้างค่า)
  // ถ้าปฏิเสธค่าเหล่านี้ การบันทึกหน้าสมมติฐานทั้งหน้าจะล้มเพราะช่องเดียว
  retirementAgeSelf: optNum(age), retirementAgeSpouse: optNum(age),
  lifeExpectancySelf: optNum(age), lifeExpectancySpouse: optNum(age),
})

