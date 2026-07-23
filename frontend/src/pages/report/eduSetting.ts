import type { ChildSetting } from '../EducationPlanPage'

// เติมค่าเริ่มต้นให้การตั้งค่าทุนการศึกษาของบุตรแต่ละคน ก่อนส่งเข้า computeChildPlan
// (ใช้สูตรตัวเดียวกับหน้าทุนการศึกษา — คิดระดับชั้นที่ตัดออก + เงินออมที่โตตามอัตราขึ้นเงินเดือน)
export const eduSettingOf = (setting: any): ChildSetting => ({
  type: setting?.type ?? 'private',
  savingYears: setting?.savingYears ?? 10,
  includeMaster: setting?.includeMaster ?? false,
  excludedLevels: setting?.excludedLevels ?? [],
})
