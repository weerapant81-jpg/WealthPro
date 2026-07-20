import { ReceiptText } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card } from '../styles/dark'

const UPDATED = '20 กรกฎาคม 2569'

function Section({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...card }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px', display: 'flex', gap: 8 }}>
        <span style={{ color: 'var(--cyan)' }}>{no}</span>{title}
      </h2>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.85 }}>{children}</div>
    </div>
  )
}
const Li = ({ children }: { children: React.ReactNode }) => <li style={{ marginBottom: 4 }}>{children}</li>

export default function RefundPolicyPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
      <PageHeader icon={ReceiptText} title="นโยบายการคืนเงิน" subtitle={`Refund Policy · ปรับปรุงล่าสุด ${UPDATED}`} />

      <div style={{ ...card, background: 'var(--cyan-dim)', border: '1px solid var(--cyan)' }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.8, margin: 0 }}>
          นโยบายนี้อธิบายเงื่อนไขการเรียกเก็บเงิน การยกเลิก และการคืนเงินสำหรับบริการแบบสมัครสมาชิก (subscription)
          ของ <b>WealthPro</b> ให้บริการโดย <b>บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด</b> การสมัครแพ็กเกจแบบชำระเงินถือว่าท่านยอมรับนโยบายฉบับนี้
        </p>
      </div>

      <Section no="1." title="รูปแบบการเรียกเก็บเงิน">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>แพ็กเกจแบบชำระเงิน (Pro / AI) เป็นการ<b>สมัครสมาชิกรายเดือน</b> เรียกเก็บผ่าน<b>บัตรเครดิต/เดบิต</b> แบบ<b>ตัดอัตโนมัติทุกรอบบิล</b></Li>
          <Li>ระบบจะตัดเงินล่วงหน้าในวันเริ่มรอบบิลแต่ละเดือนโดยอัตโนมัติ จนกว่าท่านจะยกเลิก</Li>
          <Li>ราคาที่แสดงเป็นราคาต่อเดือน (สกุลเงินบาท) แพ็กเกจ <b>Free ไม่มีค่าใช้จ่าย</b></Li>
          <Li>การชำระเงินดำเนินการผ่านผู้ให้บริการรับชำระเงินที่ได้มาตรฐานความปลอดภัย (PCI-DSS) บริษัทไม่จัดเก็บเลขบัตรของท่าน</Li>
        </ul>
      </Section>

      <Section no="2." title="การยกเลิกสมาชิก">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>ท่านสามารถ<b>ยกเลิกได้ทุกเมื่อ</b>ผ่านหน้าจัดการการชำระเงินในบัญชีของท่าน</Li>
          <Li>เมื่อยกเลิก ท่านยัง<b>ใช้งานแพ็กเกจได้จนสิ้นสุดรอบบิลปัจจุบัน</b>ที่ชำระไว้แล้ว หลังจากนั้นบัญชีจะปรับกลับเป็นแพ็กเกจ Free โดยอัตโนมัติ</Li>
          <Li>การยกเลิกจะ<b>หยุดการตัดเงินรอบถัดไป</b> — จะไม่มีการเรียกเก็บเพิ่มหลังยกเลิก</Li>
        </ul>
      </Section>

      <Section no="3." title="นโยบายการคืนเงิน">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>เนื่องจากเป็นบริการดิจิทัลที่เข้าถึงได้ทันทีหลังชำระเงิน โดยทั่วไป<b>ค่าบริการที่ชำระไปแล้วในรอบบิลปัจจุบันจะไม่มีการคืนเงินตามสัดส่วน (no pro-rated refund)</b> ท่านยังใช้งานได้จนครบรอบ</Li>
          <Li>บริษัท<b>จะคืนเงินเต็มจำนวน</b>ในกรณีต่อไปนี้:
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              <Li>มีการ<b>เรียกเก็บซ้ำซ้อน</b>หรือถูกตัดเงินผิดพลาดจากข้อผิดพลาดทางเทคนิคของระบบ</Li>
              <Li>ถูกเรียกเก็บ<b>หลังจากยกเลิก</b>ไปแล้วเรียบร้อย</Li>
              <Li>ระบบ<b>ไม่สามารถให้บริการได้ตลอดทั้งรอบบิล</b>อันเนื่องมาจากความผิดพลาดของบริษัท</Li>
            </ul>
          </Li>
          <Li>กรณีมีข้อพิพาทหรือสถานการณ์พิเศษ บริษัทจะพิจารณาคืนเงินตามความเหมาะสมเป็นรายกรณีด้วยความเป็นธรรม</Li>
        </ul>
      </Section>

      <Section no="4." title="วิธีขอคืนเงินและระยะเวลาดำเนินการ">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>ส่งคำขอมาที่ <span style={{ color: 'var(--cyan)' }}>info@wealthpro.cloud</span> พร้อมระบุอีเมลบัญชี วันที่ถูกเรียกเก็บ และเหตุผล</Li>
          <Li>บริษัทจะติดต่อกลับภายใน <b>7 วันทำการ</b></Li>
          <Li>หากอนุมัติคืนเงิน เงินจะคืนเข้า<b>บัตร/ช่องทางเดิม</b>ที่ใช้ชำระ ภายใน <b>5–14 วันทำการ</b> (ขึ้นกับรอบของธนาคาร/ผู้ออกบัตร)</Li>
        </ul>
      </Section>

      <Section no="5." title="การเปลี่ยนแปลงราคาและแพ็กเกจ">
        บริษัทอาจปรับราคา ฟีเจอร์ หรือเงื่อนไขแพ็กเกจในอนาคต โดยจะ<b>แจ้งให้ทราบล่วงหน้า</b>ผ่านอีเมลหรือภายในแอป
        การเปลี่ยนแปลงราคาจะมีผลกับรอบบิลถัดไป — หากท่านไม่ประสงค์ใช้ต่อในราคาใหม่ สามารถยกเลิกก่อนถึงรอบบิลถัดไปได้
      </Section>

      <Section no="6." title="ติดต่อเรา">
        <b>บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด</b> (Ultimate Life Advisor Co., Ltd.)<br />
        เลขทะเบียนนิติบุคคล: 0305560003856<br />
        ที่อยู่: 199/78 ซ.มิตรภาพ 4 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000<br />
        อีเมล: <span style={{ color: 'var(--cyan)' }}>info@wealthpro.cloud</span> · โทร: 099-458-8787
      </Section>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 8px' }}>
        © {new Date().getFullYear()} Ultimate Life Advisor Co., Ltd. · All rights reserved.
      </p>
    </div>
  )
}
