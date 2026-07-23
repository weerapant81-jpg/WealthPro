// ── การจัดหมวดหนี้สิน (ให้ตรงกันทั้งงบดุล งบกระแสเงินสด และอัตราส่วนทางการเงิน) ──

/** หมวดค่าใช้จ่ายที่เป็นการผ่อนที่อยู่อาศัย (จดจำนอง) */
export const HOUSING_CATS = ['fixed_house_loan', 'fixed_condo_loan']

/** หมวดค่าใช้จ่ายที่เป็น "หนี้ไม่จดจำนอง" — บัตรเครดิต/สินเชื่อส่วนบุคคล/OD/การศึกษา (ไม่รวมผ่อนบ้านและผ่อนรถ) */
export const NON_MORTGAGE_CATS = ['fixed_credit', 'fixed_edu_loan']

/** หมวดค่าใช้จ่ายที่นับเป็น "ภาระผ่อนหนี้รวม" ตามหลัก CFP */
export const DEBT_PAYMENT_CATS = [...HOUSING_CATS, 'fixed_car_loan', ...NON_MORTGAGE_CATS]

/** ประเภทหนี้ในตาราง "หนี้สินคงค้าง" ที่ถือเป็นหนี้ไม่จดจำนอง */
const NON_MORTGAGE_RE = /บัตรเครดิต|สินเชื่อส่วนบุคคล|เบิกเกินบัญชี|\bOD\b|การศึกษา|กยศ/i

export const isNonMortgageDebt = (debtType: any): boolean => NON_MORTGAGE_RE.test(String(debtType ?? ''))

/** หนี้ระยะสั้น = ครบกำหนดภายใน 1 ปี */
export const isShortTermDebt = (termYears: any): boolean => (parseFloat(String(termYears)) || 0) <= 1
