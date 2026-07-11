import { useState } from 'react'
import {
  BookOpen, ChevronDown, Users, ClipboardList, Target, Sparkles, FileText,
  ShieldCheck, Calculator, Settings, Rocket,
} from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card } from '../styles/dark'

type Item = { q: string; a: React.ReactNode }
type Group = { icon: any; title: string; items: Item[] }

const B = ({ children }: { children: React.ReactNode }) => <b style={{ color: 'var(--text-primary)' }}>{children}</b>
const Steps = ({ children }: { children: React.ReactNode }) => <ol style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.9 }}>{children}</ol>
const Ul = ({ children }: { children: React.ReactNode }) => <ul style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.9 }}>{children}</ul>

const GROUPS: Group[] = [
  {
    icon: Rocket, title: 'เริ่มต้นใช้งาน', items: [
      { q: 'ภาพรวมการทำงาน', a: <>WealthPro ช่วยนักวางแผนการเงินตั้งแต่ <B>เก็บข้อมูลลูกค้า → วิเคราะห์ → วางแผนแต่ละด้าน → จัดทำรายงานนำเสนอ</B> · ลำดับแนะนำ: (1) สร้าง/เลือกลูกค้า (2) กรอกข้อมูลลูกค้าให้ครบ (3) วางแผนแต่ละด้าน (4) สร้างรายงาน</> },
      { q: 'การสลับลูกค้า/คู่สมรส', a: <>ปุ่ม <B>"เปลี่ยนลูกค้า"</B> บนแถบบนสุดเพื่อเลือกลูกค้ารายอื่น · ในหน้าวางแผนมีปุ่มสลับ <B>ลูกค้า ↔ คู่สมรส</B> มุมขวาบน เพื่อวางแผนแยกรายบุคคล</> },
    ],
  },
  {
    icon: Users, title: 'จัดการลูกค้า', items: [
      { q: 'สร้างลูกค้าใหม่', a: <Steps><li>เมนู "เลือกลูกค้า" → กรอกชื่อ-นามสกุล อีเมล เบอร์โทร → <B>สร้างลูกค้า</B></li><li>ระบบพาไปหน้ากรอกข้อมูลทันที</li></Steps> },
      { q: 'ค้นหา / แก้ไข / ลบ', a: <>พิมพ์ชื่อหรืออีเมลในช่องค้นหา · ปุ่มดินสอ = แก้ไข · ปุ่มถังขยะ = ลบ (ลบข้อมูลทั้งหมดถาวรตามสิทธิ์ PDPA)</> },
    ],
  },
  {
    icon: ClipboardList, title: 'กรอกข้อมูลลูกค้า', items: [
      { q: 'หัวข้อข้อมูลที่ต้องกรอก', a: <Ul><li><B>ข้อมูลส่วนบุคคล</B> — ชื่อ วันเกิด เลขบัตร (เข้ารหัสอัตโนมัติ) ที่อยู่</li><li><B>ข้อมูลครอบครัว</B> — คู่สมรส บุตร บิดามารดา (การ์ดคู่สมรสจะแสดงเมื่อสถานะ "สมรส")</li><li><B>ข้อมูลการประกัน</B> — กรมธรรม์ที่มี</li><li><B>สินทรัพย์-หนี้สิน</B> · <B>งบการเงินส่วนบุคคล</B> — รายได้/รายจ่าย</li><li><B>เป้าหมายทางการเงิน</B> · <B>ประเมินความเสี่ยง</B></li></Ul> },
      { q: 'ข้อมูลบันทึกที่ไหน / บันทึกอัตโนมัติ', a: <>กรอกแล้ว<B>บันทึกอัตโนมัติ</B> (เห็นสถานะ "บันทึกแล้ว") · ข้อมูลเก็บในฐานข้อมูลที่เข้ารหัส ปลอดภัยระดับธนาคาร</> },
    ],
  },
  {
    icon: Target, title: 'วางแผนการเงิน (เมนู "วางแผนการเงิน")', items: [
      { q: 'แต่ละแท็บทำอะไร', a: <Ul><li><B>มูลค่าสินทรัพย์ลงทุน</B> — คาดการณ์พอร์ตอนาคต (Monte Carlo)</li><li><B>กองทุนประกันสังคม / สำรองเลี้ยงชีพ / เงินชดเชย</B> — เงินก้อนตอนเกษียณ</li><li><B>ทุนการศึกษาบุตร</B> — คำนวณเงินที่ต้องเตรียม</li><li><B>วางแผนประกัน</B> — ทุนประกันที่ควรมี (HLV / Needs-Based / ทุพพลภาพ)</li><li><B>วางแผนเกษียณ</B> — พอ/ขาดเท่าไร</li><li><B>วางแผนมรดก</B> — ทายาท พินัยกรรม ภาษี</li></Ul> },
      { q: 'ค่า "auto" ในช่องกรอก', a: <>ช่องที่มีป้าย <B>auto</B> = ระบบดึงค่าจากข้อมูลที่กรอกไว้แล้วอัตโนมัติ · พิมพ์ทับได้ถ้าต้องการปรับ</> },
    ],
  },
  {
    icon: Calculator, title: 'เครื่องมือเสริม', items: [
      { q: 'แผนปฏิบัติการ · วางแผนภาษี · งบการเงินล่วงหน้า', a: <Ul><li><B>แผนปฏิบัติการ</B> — สิ่งที่ต้องทำตามแผน พร้อมกำหนดการ ติดตามความคืบหน้า</li><li><B>วางแผนภาษี</B> — คำนวณภาษีเงินได้ + ค่าลดหย่อน</li><li><B>งบการเงินล่วงหน้า</B> — ประมาณการรายรับ-รายจ่ายรายปีจนเกษียณ</li></Ul> },
      { q: 'เครื่องคิดเลข', a: <>คำนวณ <B>หนี้บ้าน/หนี้รถ/หนี้บัตร</B> และ <B>มูลค่าเงินตามเวลา</B> — ใช้ประกอบการให้คำปรึกษาได้ทันที</> },
    ],
  },
  {
    icon: Sparkles, title: 'ผู้ช่วย AI (Copilot)', items: [
      { q: 'ใช้ยังไง', a: <>กดปุ่มลอย <B>✨ มุมขวาล่าง</B> ทุกหน้า → ถามเกี่ยวกับข้อมูลลูกค้าที่กำลังดู เช่น "ลูกค้ารายนี้ควรทำประกันเพิ่มไหม" · AI ตอบโดยอ้างอิงตัวเลขจริงบนหน้าจอ</> },
    ],
  },
  {
    icon: FileText, title: 'รายงาน', items: [
      { q: 'สร้างรายงาน', a: <Steps><li>เมนู "รายงานแผนการเงิน"</li><li>เลือกโหมด <B>ฉบับเต็ม</B> (A4) หรือ <B>นำเสนอ</B> (สไลด์ 16:9)</li><li>กด <B>"ดาวน์โหลด PDF"</B> (แนะนำ · ชัวร์ทุกอุปกรณ์รวม iPad) หรือ "พิมพ์"</li></Steps> },
      { q: 'โหมดนำเสนอ — แก้สไลด์', a: <>กด <B>"แก้ไขสไลด์"</B> เพื่อเพิ่มคอมเมนต์ที่ปรึกษา ซ่อนสไลด์ที่ไม่ใช้ หรือเพิ่มสไลด์เอง</> },
    ],
  },
  {
    icon: ShieldCheck, title: 'ความปลอดภัย & PDPA', items: [
      { q: 'ความยินยอม / Export / ลบข้อมูล', a: <>ในหน้า "เลือกลูกค้า" แต่ละราย มีปุ่ม: <B>🛡️ ความยินยอม</B> (บันทึก/ถอน) · <B>⬇️ ดาวน์โหลดข้อมูล</B> (สิทธิ์เข้าถึงของลูกค้า) · <B>🗑️ ลบ</B> (สิทธิ์ลบข้อมูล)</> },
      { q: 'บันทึกการเข้าถึง (Audit Log)', a: <>เมนูโปรไฟล์ (รูปมุมขวาบน) → <B>"บันทึกการเข้าถึงข้อมูล"</B> — ดูว่าใครดู/แก้/ลบ ข้อมูลลูกค้าเมื่อไหร่</> },
      { q: 'เปิด 2FA (ยืนยัน 2 ชั้น)', a: <>หน้า "ตั้งค่าผู้ใช้" → การ์ด <B>ยืนยันตัวตน 2 ชั้น</B> → สแกน QR ด้วยแอป Authenticator → เก็บรหัสสำรองไว้ · แนะนำเปิดเพื่อความปลอดภัยบัญชี</> },
    ],
  },
  {
    icon: Settings, title: 'ตั้งค่า', items: [
      { q: 'สมมติฐาน & โปรไฟล์', a: <Ul><li><B>สมมติฐาน</B> — ตั้งค่าเงินเฟ้อ ผลตอบแทน อายุเกษียณ ฯลฯ ที่ใช้ในทุกการคำนวณ</li><li><B>ปรับแต่งข้อมูลผู้ใช้</B> — ชื่อ รูป ใบอนุญาต ที่จะแสดงในรายงาน + ตั้งค่า 2FA</li></Ul> },
    ],
  },
]

function Accordion({ g, open, onToggle }: { g: Group; open: boolean; onToggle: () => void }) {
  const Icon = g.icon
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color="var(--cyan)" />
        </div>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{g.title}</span>
        <ChevronDown size={18} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {g.items.map((it, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--divider)', paddingTop: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cyan-light)', marginBottom: 3 }}>{it.q}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>{it.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function UserGuidePage() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
      <PageHeader icon={BookOpen} title="คู่มือการใช้งาน" subtitle="วิธีใช้ WealthPro ตั้งแต่เริ่มต้นจนออกรายงาน" />
      {GROUPS.map((g, i) => (
        <Accordion key={i} g={g} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
      ))}
      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
        มีคำถามเพิ่มเติม? ติดต่อผู้ให้บริการ · WealthPro โดย Ultimate Life Advisor Co., Ltd.
      </p>
    </div>
  )
}
