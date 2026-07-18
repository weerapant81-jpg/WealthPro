import type { CareerId } from './types'

/* ── นิยามอาชีพ 4 แบบ — ต่างกันที่รายได้ / ความเสี่ยง / สวัสดิการ ── */

export interface Career {
  id: CareerId
  name: string
  emoji: string
  tagline: string
  perks: string[]          // จุดเด่นโชว์บนการ์ดเลือกอาชีพ
  cons: string[]           // จุดด้อย
  startMonthly: number     // เงินเดือนเริ่มต้น
  growth: number           // โต/ปี
  vol: number              // sd ความผันผวนรายได้ (0 = นิ่ง)
  layoffProb: number       // โอกาสรายได้สะดุดต่อช่วง 5 ปี
  layoffTitle: string
  layoffDesc: string
  freeHealthcare: boolean  // ข้าราชการ — รักษาฟรี
  pensionPct: number       // บำนาญ % ของเงินเดือนสุดท้าย
  ssoMonthly: number       // เงินบำนาญประกันสังคมโดยประมาณ/เดือน ตอนเกษียณ
  employerInvestPct: number// PVD นายจ้างสมทบ (% รายได้ เข้าพอร์ตให้ฟรี)
  livingMonthly: number    // ค่าครองชีพพื้นฐานเริ่มต้น
}

export const CAREERS: Record<CareerId, Career> = {
  gov: {
    id: 'gov', name: 'ข้าราชการ', emoji: '🏛️',
    tagline: 'มั่นคงที่สุด รายได้ไม่หวือหวา',
    perks: ['บำนาญตลอดชีพ', 'รักษาพยาบาลฟรี', 'แทบไม่มีทางตกงาน'],
    cons: ['เงินเดือนเริ่มต้นต่ำ', 'โตช้า'],
    startMonthly: 25000, growth: 0.045, vol: 0, layoffProb: 0.004,
    layoffTitle: 'ถูกย้ายหน่วยงาน', layoffDesc: 'ถูกย้ายไปหน่วยงานต่างจังหวัด มีค่าใช้จ่ายย้ายบ้านก้อนหนึ่ง',
    freeHealthcare: true, pensionPct: 0.5, ssoMonthly: 0, employerInvestPct: 0.03,
    livingMonthly: 15000,
  },
  corp: {
    id: 'corp', name: 'พนักงานเอกชน', emoji: '💼',
    tagline: 'สมดุลรายได้กับความมั่นคง',
    perks: ['กองทุนสำรองเลี้ยงชีพ (PVD) นายจ้างสมทบ', 'ประกันสังคม + ประกันกลุ่ม'],
    cons: ['มีโอกาสถูกเลิกจ้าง', 'รายได้โตตามโครงสร้าง'],
    startMonthly: 35000, growth: 0.055, vol: 0.03, layoffProb: 0.05,
    layoffTitle: 'บริษัทปรับโครงสร้าง — ตกงาน!', layoffDesc: 'คุณถูกเลิกจ้าง ใช้เวลาหางานใหม่ราว 6 เดือน รายจ่ายยังเดินทุกเดือน',
    freeHealthcare: false, pensionPct: 0, ssoMonthly: 5500, employerInvestPct: 0.04,
    livingMonthly: 18000,
  },
  biz: {
    id: 'biz', name: 'เจ้าของธุรกิจ', emoji: '🏪',
    tagline: 'เพดานรายได้สูง แต่เหวี่ยงแรง',
    perks: ['รายได้เฉลี่ยสูงสุด', 'โอกาสโตก้าวกระโดด'],
    cons: ['รายได้แกว่ง ±40%', 'ไม่มีสวัสดิการใดๆ', 'ธุรกิจสะดุดได้'],
    startMonthly: 60000, growth: 0.07, vol: 0.25, layoffProb: 0.10,
    layoffTitle: 'ธุรกิจสะดุดหนัก!', layoffDesc: 'ยอดขายทรุด ขาดสภาพคล่องราว 6 เดือน ต้องหาเงินหมุนมาประคองกิจการและบ้าน',
    freeHealthcare: false, pensionPct: 0, ssoMonthly: 0, employerInvestPct: 0,
    livingMonthly: 25000,
  },
  free: {
    id: 'free', name: 'ฟรีแลนซ์', emoji: '🎨',
    tagline: 'อิสระเต็มที่ รายได้ตามงาน',
    perks: ['เวลายืดหยุ่น', 'รับงานได้หลายทาง'],
    cons: ['รายได้แกว่ง ±30%', 'ไม่มีสวัสดิการ', 'งานหดได้ทุกเมื่อ'],
    startMonthly: 40000, growth: 0.05, vol: 0.18, layoffProb: 0.09,
    layoffTitle: 'งานหด — ลูกค้าหลักถอนตัว', layoffDesc: 'ลูกค้ารายใหญ่เลิกจ้าง รายได้หายไปราว 6 เดือนกว่าจะหางานทดแทนได้',
    freeHealthcare: false, pensionPct: 0, ssoMonthly: 3000, employerInvestPct: 0,
    livingMonthly: 18000,
  },
}

export const CAREER_LIST = Object.values(CAREERS)
