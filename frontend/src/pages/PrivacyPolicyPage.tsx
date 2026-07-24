import { ScrollText } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { card } from '../styles/dark'

const UPDATED = '9 กรกฎาคม 2569'

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
const Li = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: 4 }}>{children}</li>
)

export default function PrivacyPolicyPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 860 }}>
      <PageHeader icon={ScrollText} title="นโยบายความเป็นส่วนตัว" subtitle={`Privacy Policy · ปรับปรุงล่าสุด ${UPDATED}`} />

      <div style={{ ...card, background: 'var(--cyan-dim)', border: '1px solid var(--cyan)' }}>
        <p style={{ fontSize: 13.5, color: 'var(--text-primary)', lineHeight: 1.8, margin: 0 }}>
          WealthPro ให้บริการโดย <b>บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด (Ultimate Life Advisor Co., Ltd.)</b> ("บริษัท")
          เราเคารพความเป็นส่วนตัวและคุ้มครองข้อมูลส่วนบุคคลของท่านตาม
          <b> พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</b>
        </p>
      </div>

      <Section no="1." title="ข้อมูลที่เราเก็บรวบรวม">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li><b>ข้อมูลระบุตัวตน:</b> ชื่อ-นามสกุล วันเกิด เลขบัตรประชาชน ที่อยู่ เบอร์โทร อีเมล</Li>
          <Li><b>ข้อมูลครอบครัว:</b> ข้อมูลคู่สมรส บุตร บิดามารดา และผู้อยู่ในอุปการะ</Li>
          <Li><b>ข้อมูลทางการเงิน:</b> รายได้ รายจ่าย สินทรัพย์ หนี้สิน การลงทุน ประกัน ภาษี และเป้าหมายทางการเงิน</Li>
          <Li><b>ข้อมูลสุขภาพ</b> (ในขอบเขตที่จำเป็นต่อการวางแผนประกัน)</Li>
          <Li><b>ข้อมูลการใช้งาน:</b> บันทึกการเข้าถึง (log) หมายเลข IP และเวลาการใช้งาน</Li>
        </ul>
      </Section>

      <Section no="2." title="วัตถุประสงค์และฐานทางกฎหมาย">
        เราเก็บและใช้ข้อมูลเพื่อ <b>ให้บริการวางแผนและให้คำปรึกษาทางการเงิน</b> การวิเคราะห์ จัดทำรายงาน และติดตามแผน
        โดยอาศัย <b>ความยินยอม (Consent)</b> ของเจ้าของข้อมูลเป็นฐานทางกฎหมายหลัก
        ท่านสามารถถอนความยินยอมได้ทุกเมื่อ
      </Section>

      <Section no="3." title="การเปิดเผยและการส่งข้อมูลไปต่างประเทศ">
        เราไม่ขายข้อมูลของท่าน และเปิดเผยเท่าที่จำเป็นต่อผู้ให้บริการที่ช่วยดำเนินการระบบ ได้แก่:
        <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          <Li><b>ผู้ให้บริการโครงสร้างพื้นฐาน:</b> ฐานข้อมูล (Neon – สิงคโปร์), เซิร์ฟเวอร์ (Render), เว็บโฮสติ้ง (Vercel)</Li>
          <Li><b>ผู้ช่วย AI:</b> เมื่อใช้ฟีเจอร์ผู้ช่วยอัจฉริยะ ข้อมูลสรุปจะถูกส่งไปประมวลผลที่ Anthropic (สหรัฐอเมริกา) โดยไม่นำไปฝึกโมเดล</Li>
        </ul>
        <p style={{ margin: '6px 0 0' }}>การส่งข้อมูลไปต่างประเทศดำเนินการภายใต้มาตรการคุ้มครองที่เหมาะสมตาม PDPA</p>
      </Section>

      <Section no="4." title="ระยะเวลาการเก็บรักษาข้อมูล (Data Retention)">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>เราเก็บข้อมูลส่วนบุคคลของท่าน <b>ตลอดระยะเวลาที่ยังเป็นลูกค้า/รับบริการ</b></Li>
          <Li>เมื่อยุติความสัมพันธ์ เราจะเก็บข้อมูลต่ออีกไม่เกิน <b>10 ปี</b> เพื่อปฏิบัติตามกฎหมายที่เกี่ยวข้อง (เช่น ภาษี การเงิน การประกันภัย) หรือเพื่อการก่อตั้ง/ใช้สิทธิเรียกร้องตามกฎหมาย</Li>
          <Li>เมื่อพ้นกำหนดหรือเมื่อท่านใช้สิทธิขอลบ เราจะ <b>ลบหรือทำให้ข้อมูลไม่สามารถระบุตัวตนได้</b></Li>
        </ul>
      </Section>

      <Section no="5." title="สิทธิของเจ้าของข้อมูล">
        ท่านมีสิทธิตาม PDPA ดังนี้ — <b>เข้าถึง</b>และขอสำเนา · <b>ขอแก้ไข</b>ให้ถูกต้อง · <b>ขอลบ</b>หรือทำลาย ·
        <b> ขอโอน</b>ข้อมูล · <b>คัดค้าน/ระงับ</b>การใช้ · และ <b>ถอนความยินยอม</b>
        โดยติดต่อผ่านที่ปรึกษาการเงินของท่าน หรือช่องทางในข้อ 7
      </Section>

      <Section no="6." title="มาตรการรักษาความปลอดภัย">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <Li>เข้ารหัสข้อมูลระหว่างส่ง (HTTPS/TLS) และขณะจัดเก็บ (AES-256)</Li>
          <Li><b>เข้ารหัสระดับฟิลด์</b>สำหรับข้อมูลอ่อนไหว เช่น เลขบัตรประชาชน</Li>
          <Li>ควบคุมการเข้าถึงด้วยรหัสผ่าน (เข้ารหัสทางเดียว) และ <b>การยืนยันตัวตน 2 ชั้น (2FA)</b></Li>
          <Li><b>บันทึกการเข้าถึง (Audit Log)</b> ว่าใครเข้าถึง/แก้ไข/ลบข้อมูลเมื่อใด</Li>
        </ul>
      </Section>

      <Section no="7." title="ติดต่อเรา">
        หากมีคำถามหรือต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล ติดต่อ<br />
        <b>บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด</b><br />
        อีเมล: <span style={{ color: 'var(--cyan)' }}>privacy@wealthpro.cloud</span>
      </Section>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 8px' }}>
        © {new Date().getFullYear()} Ultimate Life Advisor Co., Ltd. · All rights reserved.
      </p>
    </div>
  )
}
