// ── ข้อตกลงในการให้บริการ + ลายเซ็น ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { TEAL, GREENR } from '../primitives'
import type { ReportCtx } from '../ctx'

export default function ServiceAgreement({ ctx }: { ctx: ReportCtx }) {
  const { client, advisor, signatures, setSignatures, setSigning, clientName, today } = ctx
    // หนังสือข้อตกลงการให้บริการ (Letter of Engagement) — บีบให้จบ 1 หน้า A4 พอดี
    const now = new Date()
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueTh = dueDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    const Blank = ({ w = 120, v }: { w?: number; v?: string }) => v
      ? <span style={{ fontWeight: 700, color: '#0f172a', borderBottom: '1px dotted #94a3b8', padding: '0 6px' }}>{v}</span>
      : <span style={{ display: 'inline-block', minWidth: w, borderBottom: '1px dotted #94a3b8', verticalAlign: 'bottom' }}>&nbsp;</span>
    const clause = (no: number, title: string, body: string) => (
      <div key={no} style={{ marginBottom: 7 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{no}. {title} — </span>
        <span style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.6 }}>{body}</span>
      </div>
    )
    const box = '☐'
    return (
      <div style={{ fontSize: 11.5, lineHeight: 1.6 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>หนังสือข้อตกลงการให้บริการวางแผนการเงิน</div>
          <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.5 }}>Letter of Engagement for Financial Planning Services</div>
        </div>
        {/* คู่สัญญา 2 คอลัมน์ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, marginBottom: 6 }}>ผู้ให้บริการ (นักวางแผนการเงิน)</div>
            <div style={{ fontSize: 11.5, color: '#334155', display: 'grid', gap: 4 }}>
              <div>ชื่อ: <Blank w={150} v={advisor?.fullName} /></div>
              <div>ใบอนุญาต/ใบรับรอง: <Blank w={100} v={advisor?.licenseCFP || advisor?.licenseInsurance} /></div>
              <div>บริษัท/สังกัด: <Blank w={120} v={advisor?.company} /></div>
              <div>โทรศัพท์: <Blank w={70} v={advisor?.phone} /> อีเมล: <Blank w={80} v={advisor?.email} /></div>
            </div>
          </div>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: TEAL, marginBottom: 6 }}>ผู้รับบริการ (ลูกค้า)</div>
            <div style={{ fontSize: 11.5, color: '#334155', display: 'grid', gap: 4 }}>
              <div>ชื่อ: <Blank w={150} v={clientName !== 'ลูกค้า' ? `คุณ${clientName}` : undefined} /></div>
              <div>เลขบัตรประชาชน: <Blank w={110} v={client?.nationalId} /></div>
              <div>ที่อยู่: <Blank w={160} v={client?.address} /></div>
              <div>โทรศัพท์: <Blank w={70} v={client?.phone} /> อีเมล: <Blank w={80} v={client?.contactEmail} /></div>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: '#334155', marginBottom: 9 }}>
          คู่สัญญาทั้งสองฝ่ายตกลงทำหนังสือข้อตกลงการให้บริการวางแผนการเงินฉบับนี้ขึ้น ณ วันที่ <Blank w={30} v={String(now.getDate())} /> เดือน <Blank w={80} v={now.toLocaleDateString('th-TH', { month: 'long' })} /> พ.ศ. <Blank w={45} v={String(now.getFullYear() + 543)} /> โดยมีรายละเอียดดังต่อไปนี้
        </p>
        {clause(1, 'ขอบเขตการให้บริการ', 'ผู้ให้บริการตกลงจัดทำแผนการเงินส่วนบุคคลให้แก่ผู้รับบริการ ครอบคลุมการวิเคราะห์ฐานะทางการเงิน การวางแผนเกษียณอายุ การวางแผนภาษี การวางแผนประกันชีวิตและสุขภาพ รวมถึงการวางแผนการลงทุน ทั้งนี้ตามข้อมูลที่ผู้รับบริการให้ไว้เท่านั้น')}
        <div style={{ marginBottom: 7 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>2. ระยะเวลาและการส่งมอบ — </span>
          <span style={{ fontSize: 11.5, color: '#334155' }}>ผู้ให้บริการจะส่งมอบแผนการเงินฉบับสมบูรณ์ภายใน <Blank w={35} v="7" /> วัน นับจากวันทำสัญญา (ภายในวันที่ <Blank w={90} v={dueTh} />) พร้อมนัดหมายนำเสนอแผนและตอบข้อซักถาม จำนวน 1 ครั้ง</span>
        </div>
        {clause(3, 'ความรับผิดชอบและข้อจำกัด', 'แผนการเงินที่จัดทำขึ้นเป็นเพียงคำแนะนำบนพื้นฐานข้อมูลที่ผู้รับบริการให้ไว้ ณ วันที่จัดทำ มิใช่การรับประกันผลตอบแทนหรือการรับประกันความสำเร็จทางการเงิน ผู้ให้บริการไม่รับผิดชอบต่อความเสียหายอันเกิดจากการตัดสินใจของผู้รับบริการ หรือจากการเปลี่ยนแปลงของสภาวะตลาดและกฎหมายที่เกิดขึ้นภายหลัง')}
        {clause(4, 'การรักษาความลับและคุ้มครองข้อมูลส่วนบุคคล', 'ผู้ให้บริการตกลงเก็บรักษาข้อมูลของผู้รับบริการไว้เป็นความลับ และจะใช้ข้อมูลดังกล่าวเพื่อวัตถุประสงค์ในการจัดทำแผนการเงินเท่านั้น สอดคล้องกับพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ผู้รับบริการมีสิทธิขอตรวจสอบ แก้ไข หรือลบข้อมูลของตนได้ตลอดเวลา')}
        {clause(5, 'การยกเลิกสัญญา', 'คู่สัญญาฝ่ายใดฝ่ายหนึ่งมีสิทธิบอกเลิกสัญญาได้โดยแจ้งเป็นลายลักษณ์อักษรล่วงหน้าไม่น้อยกว่า 7 วัน')}
        {clause(6, 'การรับทราบและข้อจำกัดของรายงาน', 'ข้อเสนอแนะในรายงานจัดทำขึ้นจากข้อมูลที่ผู้รับบริการให้ไว้และสมมติฐานที่ระบุในหัวข้อ "สมมติฐานที่ใช้ในการวางแผน" หากข้อมูลส่วนบุคคล สถานการณ์ทางการเงิน หรือภาวะตลาดเปลี่ยนแปลงไป ข้อเสนอแนะอาจเปลี่ยนแปลงตาม จึงควรทบทวนแผนอย่างน้อยปีละ 1 ครั้ง ประมาณการต่าง ๆ (รวมถึงผลการจำลอง Monte Carlo) เป็นเพียงการคาดการณ์ตามสมมติฐาน ไม่ใช่การรับประกันผลตอบแทน ผลการดำเนินงานในอดีตไม่ได้ยืนยันถึงผลการดำเนินงานในอนาคต และรายงานนี้ไม่ถือเป็นคำแนะนำด้านกฎหมาย บัญชี หรือภาษีเฉพาะกรณี คู่สัญญาได้อ่านและรับทราบสมมติฐานและข้อจำกัดข้างต้นแล้ว')}
        <div style={{ border: `1px solid ${TEAL}55`, background: '#f0fdfa', borderRadius: 10, padding: '8px 12px', margin: '10px 0' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>การยินยอมใช้ข้อมูลส่วนบุคคล (PDPA Consent)</div>
          <div onClick={() => setSignatures(s => s.pdpa_consent ? (() => { const n = { ...s }; delete n.pdpa_consent; return n })() : { ...s, pdpa_consent: '1' })}
            title="คลิกเพื่อติ๊ก/ยกเลิกความยินยอม" style={{ fontSize: 11.5, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
            <span style={{ fontWeight: 800, color: signatures.pdpa_consent ? GREENR : '#334155' }}>{signatures.pdpa_consent ? '☑' : box}</span> ข้าพเจ้าให้ความยินยอมในการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้าเพื่อวัตถุประสงค์ในการจัดทำแผนการเงินเท่านั้น และรับทราบสิทธิของข้าพเจ้าตาม PDPA แล้ว
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: '#334155', marginBottom: 12 }}>คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในหนังสือข้อตกลงฉบับนี้โดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นหลักฐาน</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 6 }}>
          {([['sig_advisor', 'ผู้ให้บริการ / นักวางแผนการเงิน', advisor?.fullName || ''], ['sig_client', 'ผู้รับบริการ / ลูกค้า', clientName !== 'ลูกค้า' ? `คุณ${clientName}` : '']] as const).map(([k, role, name]) => (
            <div key={k} style={{ textAlign: 'center', fontSize: 11.5, color: '#334155' }}>
              <div onClick={() => setSigning(k)} title="คลิกเพื่อลงนามบนหน้าจอ"
                style={{ height: 54, margin: '0 auto 4px', maxWidth: 230, borderBottom: '1px dotted #94a3b8', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'pointer' }}>
                {signatures[k]
                  ? <img src={signatures[k]} alt="" style={{ maxHeight: 52, maxWidth: '100%' }} />
                  : <span className="no-print" style={{ fontSize: 10, color: '#cbd5e1', paddingBottom: 4 }}>คลิกเพื่อลงนาม</span>}
              </div>
              <div>ลงชื่อ {name ? <span style={{ fontWeight: 700, color: '#0f172a' }}>({name})</span> : '(.................................................)'}</div>
              <div style={{ marginTop: 3 }}>({role})</div>
              <div style={{ marginTop: 3 }}>วันที่ {today}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
          <span>พยาน: ลงชื่อ</span>
          <span onClick={() => setSigning('sig_witness')} title="คลิกเพื่อลงนามบนหน้าจอ"
            style={{ display: 'inline-flex', alignItems: 'flex-end', justifyContent: 'center', width: 150, height: 38, borderBottom: '1px dotted #94a3b8', cursor: 'pointer' }}>
            {signatures.sig_witness
              ? <img src={signatures.sig_witness} alt="" style={{ maxHeight: 36, maxWidth: '100%' }} />
              : <span className="no-print" style={{ fontSize: 10, color: '#cbd5e1', paddingBottom: 3 }}>คลิกเพื่อลงนาม</span>}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'flex-end' }}>
            (<input value={signatures.witness_name || ''} onChange={e => setSignatures(s => ({ ...s, witness_name: e.target.value }))}
              placeholder="พิมพ์ชื่อพยาน" title="พิมพ์ชื่อ-นามสกุลพยาน"
              style={{ width: 170, border: 'none', borderBottom: '1px dotted #94a3b8', outline: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontFamily: 'inherit', color: '#0f172a', fontWeight: 700, padding: '0 2px' }} />)
          </span>
          <span>วันที่ {today}</span>
        </div>
      </div>
    )
}
