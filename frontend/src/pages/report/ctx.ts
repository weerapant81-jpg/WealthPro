// ── ข้อมูลที่หัวข้อต่าง ๆ ของรายงานใช้ร่วมกัน ──
// เดิมทุกหัวข้ออ่านค่าเหล่านี้จาก closure ของ ReportPage โดยตรง (ฟังก์ชันเดียวยาว 2,000 บรรทัด)
// พอแยกหัวข้อออกเป็นคอมโพเนนต์ จึงรวบค่าที่ต้องใช้เป็นก้อนเดียวส่งผ่าน prop `ctx`
// ชนิดเป็น any ตามข้อมูลดิบที่ได้จาก API อยู่แล้ว — ไม่ได้ลดความปลอดภัยลงจากเดิม
export type ReportCtx = {
  // ข้อมูลหลัก
  client: any
  advisor: any
  profile: any
  clientName: string
  today: string
  age: number | null
  hasSpouse: boolean
  children: any[]

  // แผนรายด้าน
  eduPlan: any
  eduCosts: any
  eduInf: number
  eduRet: number
  retR: any
  retRSp: any
  insR: any
  insRSp: any
  eduR: any
  covSelf: any
  covSp: any

  // งบ/อัตราส่วน/ข้อมูลตลาด
  ratios: any
  ratiosSp: any
  sm: any
  taxPlanQ: any
  estatePlanQ: any
  marketData: any
  rebalQ: any
  expensesQ: any[]
  domainAdvice: Record<string, string>

  // สินทรัพย์ลงทุน
  invProfile: any
  retPlan: any
  allocation: { rows: { name: string; value: number }[]; total: number }
  PIE_COLORS: string[]
  totalInv: number
  portRet: number
  invAssetsSp: any[]
  totalInvSp: number
  portRetSp: number

  // สถานะเอกสาร
  title: string
  secs: Record<string, { include: boolean; text: string }>
  setText: (k: string, v: string) => void
  signatures: Record<string, string>
  setSignatures: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setSigning: (k: string | null) => void

  // แผนปฏิบัติการ
  actionItems: any[]
}
