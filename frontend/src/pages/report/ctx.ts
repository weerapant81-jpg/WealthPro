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
