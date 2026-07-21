// ── ประเภทเงินได้ตามมาตรา 40 (1)–(8) + helper คำนวณรายเดือน/รายปี ──
// ใช้ร่วมกันทุกหน้าที่อ่าน incomeSources เพื่อให้ตัวเลข/การจัดหมวดตรงกัน

export type IncomeFreq = 'รายเดือน' | 'รายปี'

export type IncomeSource = {
  label: string
  source: string
  amount: string
  freq?: IncomeFreq   // ความถี่ (default รายเดือน) — แทน convention เดิมที่ใช้ 'โบนัส' = รายปี
  auto?: boolean      // true = แถวเงินเดือนที่ดึงจากข้อมูลการทำงานอัตโนมัติ (แก้ไม่ได้)
}

export const INCOME_40 = [
  { code: '1', label: '40(1) เงินเดือน/ค่าจ้าง/โบนัส', desc: 'เงินได้จากการจ้างแรงงาน เช่น เงินเดือน โบนัส ค่าจ้าง เบี้ยเลี้ยง' },
  { code: '2', label: '40(2) ค่านายหน้า/เบี้ยประชุม', desc: 'เงินได้จากตำแหน่งงานหรือหน้าที่งาน เช่น ค่านายหน้า ค่าธรรมเนียม เบี้ยประชุม' },
  { code: '3', label: '40(3) ค่าลิขสิทธิ์/สิทธิบัตร', desc: 'ค่าลิขสิทธิ์ สิทธิบัตร กู๊ดวิลล์ หรือเงินปี' },
  { code: '4', label: '40(4) ดอกเบี้ย/เงินปันผล', desc: 'ผลตอบแทนทางการเงิน เช่น ดอกเบี้ย เงินปันผล กำไรจากการลงทุน' },
  { code: '5', label: '40(5) ค่าเช่าทรัพย์สิน', desc: 'ให้เช่าทรัพย์สิน เช่น ค่าเช่าบ้าน ค่าเช่าที่ดิน' },
  { code: '6', label: '40(6) วิชาชีพอิสระ', desc: 'แพทย์ ทนายความ สถาปนิก วิศวกร ผู้สอบบัญชี' },
  { code: '7', label: '40(7) รับเหมา', desc: 'การรับเหมาที่ต้องจัดหาสัมภาระหรือเครื่องมือเอง' },
  { code: '8', label: '40(8) ธุรกิจ/พาณิชย์/เกษตร', desc: 'ธุรกิจ พาณิชย์ การเกษตร หรืออื่นๆ ที่ไม่เข้าข่าย 1-7' },
] as const

export const INCOME_40_LABELS = INCOME_40.map(c => c.label)
export const INCOME_FREQS: IncomeFreq[] = ['รายเดือน', 'รายปี']

/** ดึงเลขหมวด 40(x) จาก label เช่น "40(4) ..." → "4" */
export function taxCodeOf(label?: string): string | null {
  const m = String(label || '').match(/40\((\d)\)/)
  return m ? m[1] : null
}

/** แปลง label เก่า (ก่อนใช้หมวด 40) → หมวด 40 ที่ใกล้เคียง เพื่อความต่อเนื่องของข้อมูลเดิม */
export function migrateIncomeLabel(label?: string): string {
  const l = String(label || '')
  if (INCOME_40_LABELS.includes(l as any)) return l
  if (l === 'เงินเดือน' || l === 'โบนัส') return INCOME_40[0].label            // 40(1)
  if (l === 'เงินปันผล' || l === 'รายได้จากการลงทุน') return INCOME_40[3].label // 40(4)
  if (l === 'รายได้จากค่าเช่า') return INCOME_40[4].label                       // 40(5)
  if (l === 'รายได้จากอาชีพเสริม') return INCOME_40[7].label                    // 40(8)
  return ''  // 'อื่นๆ'/ว่าง → ให้ผู้ใช้เลือกเอง
}

/** รายการนี้เป็น "รายปี" หรือไม่ (freq ใหม่ · เผื่อ backward-compat กับ 'โบนัส' เดิม) */
export function isAnnualIncome(row: { freq?: string; label?: string }): boolean {
  if (row.freq === 'รายปี') return true
  if (row.freq === 'รายเดือน') return false
  return String(row.label || '').includes('โบนัส')   // ข้อมูลเก่าที่ยังไม่มี freq
}

/** จำนวนต่อเดือน (สำหรับสรุปกระแสเงินสด) */
export function monthlyIncome(row: { freq?: string; label?: string; amount?: any }): number {
  const amt = parseFloat(row.amount) || 0
  return isAnnualIncome(row) ? amt / 12 : amt
}

/** จำนวนทั้งปี */
export function annualIncome(row: { freq?: string; label?: string; amount?: any }): number {
  const amt = parseFloat(row.amount) || 0
  return isAnnualIncome(row) ? amt : amt * 12
}
