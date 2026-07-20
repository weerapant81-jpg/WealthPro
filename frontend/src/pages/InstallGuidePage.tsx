import { useNavigate } from 'react-router-dom'
import { Share, Plus, CheckCircle2, ArrowLeft, Smartphone } from 'lucide-react'

/* หน้าสอนติดตั้ง PWA ลงหน้าจอโฮม (iPad/iPhone Safari) — สาธารณะ */

const AC = 'var(--cyan)'
const isStandalone = () =>
  (typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true))

function Step({ n, icon: Icon, title, desc }: { n: number; icon: React.ElementType; title: string; desc: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '22px 24px' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', background: AC, color: '#00201d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, fontFamily: 'monospace', flexShrink: 0 }}>{n}</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}<Icon size={18} color={AC} />
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{desc}</p>
      </div>
    </div>
  )
}

export default function InstallGuidePage() {
  const navigate = useNavigate()
  const installed = isStandalone()

  return (
    <div style={{ background: 'var(--navy-900)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 80px' }}>
        {/* header */}
        <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 28 }}>
          <ArrowLeft size={16} /> กลับหน้าแรก
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Smartphone size={26} color="#00201d" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>ติดตั้งลงหน้าจอโฮม</h1>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 32px' }}>
          เพิ่ม WealthPro ลงหน้าจอโฮมของ iPad/iPhone เพื่อเปิดใช้งานเต็มจอเหมือนแอปจริง ไม่มีแถบเบราว์เซอร์ — เหมาะกับการนำเสนอกับลูกค้า
        </p>

        {installed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 16, padding: '20px 24px', marginBottom: 28 }}>
            <CheckCircle2 size={26} color="#22c55e" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>ติดตั้งเรียบร้อยแล้ว ✓</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 2 }}>คุณกำลังเปิดจากแอปที่ติดตั้งบนหน้าจอโฮม</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>บน iPad / iPhone (Safari)</div>
            <Step n={1} icon={Share} title="กดปุ่มแชร์"
              desc={<>แตะไอคอน <b style={{ color: 'var(--text-primary)' }}>แชร์</b> (รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบด้านบนหรือด้านล่างของ Safari</>} />
            <Step n={2} icon={Plus} title="เลือก “เพิ่มลงในหน้าจอโฮม”"
              desc={<>เลื่อนหาเมนู <b style={{ color: 'var(--text-primary)' }}>“เพิ่มลงในหน้าจอโฮม” (Add to Home Screen)</b> → แตะ <b style={{ color: 'var(--text-primary)' }}>เพิ่ม</b> มุมขวาบน — เสร็จแล้วจะมีไอคอน WealthPro บนหน้าจอโฮม</>} />
          </div>
        )}

        {/* หมายเหตุ Android */}
        <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Android / Chrome</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>แตะเมนู <b style={{ color: 'var(--text-primary)' }}>⋮</b> มุมขวาบน → เลือก <b style={{ color: 'var(--text-primary)' }}>“ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”</b></div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/login')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: AC, color: '#00201d', border: 'none', borderRadius: 12, padding: '13px 26px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
          <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-primary)', borderRadius: 12, padding: '13px 26px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>กลับหน้าแรก</button>
        </div>
      </div>
    </div>
  )
}
