// ── การเดินยอดเงินกองทุนการศึกษารายปี ──
// ใช้ร่วมกันระหว่างตาราง "มูลค่าเงินกองทุน" กับกราฟ "เงินออมสะสมเพื่อทุนการศึกษา"
// เพื่อให้สองที่นี้แสดงตัวเลขชุดเดียวกันเสมอ (เดิมเขียนลูปเดินยอดซ้ำกันคนละที่)

export type FundFee = { yfn: number; amount: number }   // yfn = จำนวนปีนับจากปีนี้

/**
 * ลำดับเหตุการณ์ในแต่ละปี (ตามที่ใช้มาแต่เดิม):
 *   1) จ่ายค่าเล่าเรียนของปีนั้น
 *   2) ผลตอบแทนทบต้น (ยกเว้นปีแรก ซึ่งยังไม่ทันได้ผลตอบแทน)
 *   3) เติมเงินออมของปีนั้น — ออมปีแรก annualSaving แล้วเพิ่มปีละ g
 * คืนยอดคงเหลือ ณ สิ้นปีที่ t สำหรับ t = 0..horizon
 */
export function fundBalanceSeries({ fees, annualSaving, r, g, savingYears, horizon }: {
  fees: FundFee[]
  annualSaving: number
  r: number            // ผลตอบแทนต่อปี (ทศนิยม เช่น 0.05)
  g: number            // อัตราเพิ่มของเงินออมต่อปี (ทศนิยม)
  savingYears: number  // จำนวนปีที่ออม
  horizon: number      // เดินยอดถึงปีที่เท่าไร (นับจากปีนี้)
}): number[] {
  const out: number[] = []
  let bal = 0
  for (let t = 0; t <= horizon; t++) {
    bal -= fees.reduce((s, f) => (f.yfn === t ? s + f.amount : s), 0)
    if (t > 0) bal *= (1 + r)
    if (t < savingYears) bal += annualSaving * Math.pow(1 + g, t)
    out.push(bal)
  }
  return out
}
