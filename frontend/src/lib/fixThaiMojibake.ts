/* ซ่อมข้อความไทยที่เพี้ยนแบบ mojibake — เกิดจากไบต์ UTF-8 ถูกตีความเป็น Windows-874 (cp874)
   แล้วบันทึกซ้ำ (double-encoding) เช่น "ไทย" กลายเป็น "เน„เธ—เธข"

   กลยุทธ์:
   1) ค่าปกติ (อักษรไทย/อังกฤษ/ตัวเลข/เว้นวรรค/เครื่องหมายพื้นฐาน) → คืนค่าเดิม ไม่แตะ
   2) ค่าที่มีอักขระแปลก (สัญญาณ mojibake) → พยายามถอด cp874 กลับ; ถ้าได้ไทยสะอาดใช้ค่านั้น
   3) ถ้าถอดไม่สำเร็จ → คืน 'ไทย' (สัญชาติเกือบทั้งหมดคือไทย และค่าที่เพี้ยนมักมาจาก default 'ไทย' เดิม) */

// อักขระที่ยอมรับว่าเป็นค่า "สะอาด" — ไทย, อังกฤษ, ตัวเลข, เว้นวรรค, - . ( ) /
const CLEAN = /^[฀-๿a-zA-Z0-9\s\-.()/]+$/

let revMap: Map<string, number> | null = null
function buildRev(): Map<string, number> {
  const map = new Map<string, number>()
  try {
    const dec = new TextDecoder('windows-874', { fatal: false })
    for (let b = 0; b <= 0xff; b++) {
      const ch = dec.decode(new Uint8Array([b]))
      if (ch && ch !== '�' && !map.has(ch)) map.set(ch, b)
    }
  } catch { /* เบราว์เซอร์ไม่รองรับ */ }
  return map
}

function tryDecodeCp874(s: string): string | null {
  if (!revMap) revMap = buildRev()
  if (revMap.size === 0) return null
  const bytes: number[] = []
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (cp < 0x80) { bytes.push(cp); continue }
    const b = revMap.get(ch)
    if (b === undefined) return null
    bytes.push(b)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
  } catch {
    return null
  }
}

export function fixThaiMojibake(input: string | null | undefined): string {
  const s = (input ?? '').trim()
  if (!s || CLEAN.test(s)) return s          // ค่าปกติ → ไม่แตะ
  const repaired = tryDecodeCp874(s)          // ลองถอด mojibake กลับ
  if (repaired && CLEAN.test(repaired)) return repaired
  return 'ไทย'                                 // ถอดไม่ได้ → default สัญชาติไทย
}
