// ── ประวัตินักวางแผนการเงิน ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { TEAL } from '../primitives'
import type { ReportCtx } from '../ctx'

export default function AdvisorProfile({ ctx }: { ctx: ReportCtx }) {
  const { advisor, signatures, setSignatures, secs, setText } = ctx
    // ── หน้า Profile นักวางแผน (หน้าสุดท้าย) — ข้อมูลจากตั้งค่าผู้ใช้ · ข้อความ/รูปแก้ไขได้ในหน้า ──
    const bio = (secs['advprofile']?.text ?? '') !== '' ? secs['advprofile']!.text : (advisor?.bio || '')
    const photo = signatures.advpage_photo || advisor?.photo || ''
    const onPickPhoto = (file?: File | null) => {
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          let { width, height } = img
          const max = 900
          if (width > height && width > max) { height = height * max / width; width = max }
          else if (height > max) { width = width * max / height; height = max }
          const cv = document.createElement('canvas')
          cv.width = width; cv.height = height
          cv.getContext('2d')!.drawImage(img, 0, 0, width, height)
          setSignatures(sg => ({ ...sg, advpage_photo: cv.toDataURL('image/jpeg', 0.85) }))
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    }
    const addr = advisor?.address || [advisor?.addrHouseNo, advisor?.addrSubdistrict && `ต.${advisor.addrSubdistrict}`, advisor?.addrDistrict && `อ.${advisor.addrDistrict}`, advisor?.addrProvince && `จ.${advisor.addrProvince}`, advisor?.addrZipcode].filter(Boolean).join(' ')
    const creds = [
      advisor?.licenseCFP && `คุณวุฒินักวางแผนการเงิน CFP เลขที่ ${advisor.licenseCFP}`,
      advisor?.licenseFChFP && `คุณวุฒิที่ปรึกษาการเงินมืออาชีพ (FChFP) เลขที่ ${advisor.licenseFChFP}`,
      advisor?.licenseAFPT && `คุณวุฒิที่ปรึกษาการเงิน AFPT เลขที่ ${advisor.licenseAFPT}`,
      advisor?.licenseInsurance && `ใบอนุญาตตัวแทน/นายหน้าประกันชีวิต เลขที่ ${advisor.licenseInsurance}`,
    ].filter(Boolean) as string[]
    const Contact = ({ icon, text }: { icon: string; text: string }) => (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{icon}</div>
        <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, paddingTop: 6 }}>{text}</div>
      </div>
    )
    return (
      <div style={{ margin: '-8px 0 0', display: 'flex', flexDirection: 'column', minHeight: 900 }}>
        {/* แถบ hero ด้านบน (print-safe gradient ธีม WealthPro) */}
        <div style={{ position: 'relative', height: 170, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(135deg, #0f172a 0%, #134e4a 55%, #00cfc1 130%)', marginBottom: 24 }}>
          <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(0,207,193,0.16)' }} />
          <div style={{ position: 'absolute', left: -40, bottom: -70, width: 200, height: 200, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)' }} />
          <div style={{ position: 'absolute', left: 30, bottom: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>YOUR FINANCIAL PLANNER</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginTop: 4 }}>นักวางแผนการเงินของคุณ</div>
          </div>
          <div style={{ position: 'absolute', right: 26, bottom: 22, fontSize: 15, fontWeight: 800 }}>
            <span style={{ color: '#fff' }}>Wealth</span><span style={{ color: '#00cfc1' }}>Pro</span>
          </div>
        </div>

        {/* คำแนะนำตัว (พิมพ์แก้ได้) */}
        <textarea value={bio} onChange={e => setText('advprofile', e.target.value)}
          placeholder={'พิมพ์ข้อความแนะนำตัว/ประสบการณ์ของนักวางแผนการเงิน...'}
          rows={Math.max(5, bio.split('\n').length + 1)}
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: '#1e293b', lineHeight: 2, fontStyle: 'italic', marginBottom: 8 }} />
        {creds.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {creds.map(c2 => (
              <div key={c2} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#334155', lineHeight: 1.9 }}>
                <span style={{ color: TEAL, fontWeight: 800 }}>✓</span>{c2}
              </div>
            ))}
          </div>
        )}

        {/* ชื่อ + ติดต่อ | รูป */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 36, marginTop: 'auto', paddingTop: 20 }}>
          <div>
            <div style={{ width: 190, height: 4, background: '#0f172a', marginBottom: 16 }} />
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{advisor?.fullName || 'นักวางแผนการเงิน'}{advisor?.licenseCFP ? ', CFP' : ''}</div>
            {advisor?.position && <div style={{ fontSize: 15, color: '#475569', marginTop: 4 }}>{advisor.position}</div>}
            {advisor?.company && <div style={{ fontSize: 13.5, color: '#64748b', marginTop: 2 }}>{advisor.company}</div>}
            <div style={{ marginTop: 24 }}>
              {advisor?.phone && <Contact icon="✆" text={advisor.phone} />}
              {advisor?.email && <Contact icon="✉" text={advisor.email} />}
              {addr && <Contact icon="⌂" text={addr} />}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <label style={{ cursor: 'pointer', width: '100%' }} title="คลิกเพื่อเปลี่ยนรูป">
              {photo
                ? <img src={photo} alt="" style={{ width: '100%', maxHeight: 330, objectFit: 'cover', borderRadius: 14, border: `1.5px solid ${TEAL}55` }} />
                : <div style={{ width: '100%', height: 300, borderRadius: 14, border: '1.5px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#94a3b8' }}>คลิกเพื่อใส่รูปนักวางแผน</div>}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { onPickPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {photo && <span className="no-print" style={{ fontSize: 10.5, color: '#94a3b8' }}>คลิกที่รูปเพื่อเปลี่ยน</span>}
          </div>
        </div>

        {/* แถบปิดท้าย */}
        <div style={{ height: 60, borderRadius: 14, marginTop: 28, background: 'linear-gradient(90deg, #0f172a 0%, #134e4a 60%, #00cfc1 140%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.85)' }}>WEALTHPRO · FINANCIAL PLANNING</span>
        </div>
      </div>
    )
}
