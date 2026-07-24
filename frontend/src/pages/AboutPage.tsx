import { useNavigate } from 'react-router-dom'
import {
  Award, LineChart, CheckCircle2, ArrowRight,
  ShieldCheck, Bot, PiggyBank,
} from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'

/* หน้าเกี่ยวกับเรา (About) สาธารณะ — ธีมมืดตามแอป · ไม่ดึง CDN/ภาพภายนอก */

const AC = 'var(--cyan)'
const glass: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20 }

export default function AboutPage() {
  const navigate = useNavigate()
  const compact = useIsCompact()
  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')
  const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: compact ? '0 20px' : '0 40px' }

  const stats = [
    { n: '15+', c: AC, t: 'ปีบนเส้นทางวิชาชีพ', d: 'เติบโตไปพร้อมกับอุตสาหกรรมการเงินไทย ด้วยความซื่อสัตย์และมั่นคง' },
    { n: '1,277', c: 'var(--text-primary)', t: 'ลูกค้าที่ดูแล', d: 'ดูแลเป้าหมายชีวิตและแผนการเงินให้กับลูกค้าและองค์กรทั่วประเทศ' },
    { n: '100%', c: '#a78bfa', t: 'ยึดจรรยาบรรณวิชาชีพ', d: 'ทุกขั้นตอนการให้คำปรึกษาเป็นไปตามจรรยาบรรณวิชาชีพนักวางแผนการเงิน' },
  ]

  return (
    <div style={{ background: 'var(--navy-900)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        .lp-card { transition: transform .18s ease, border-color .18s ease; }
        .lp-card:hover { transform: translateY(-4px); border-color: rgba(0,207,193,0.45) !important; }
        .lp-btn { transition: transform .12s ease, filter .15s ease; }
        .lp-btn:hover { filter: brightness(1.08); } .lp-btn:active { transform: scale(0.97); }
        .lp-navlink { color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 600; transition: color .15s; cursor: pointer; }
        .lp-navlink:hover { color: var(--cyan); }
      `}</style>

      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(19,19,21,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer' }}>Wealth<span style={{ color: AC }}>Pro</span></span>
          {!compact && (
            <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 26 }}>
              <span onClick={() => navigate('/')} className="lp-navlink">หน้าแรก</span>
              <span onClick={() => navigate('/features')} className="lp-navlink">ฟีเจอร์</span>
              <span className="lp-navlink" style={{ color: AC }}>เกี่ยวกับเรา</span>
              <span onClick={() => navigate('/tutorials')} className="lp-navlink">วิดีโอสอนการใช้งาน</span>
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={goLogin} className="lp-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
            <button onClick={goRegister} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>ทดลองใช้ฟรี</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--navy-950)' }}>
        <div style={{ position: 'absolute', top: '-25%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '80%', background: AC, filter: 'blur(160px)', opacity: 0.08, borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '56px 20px 64px' : '96px 40px 100px', textAlign: 'center', position: 'relative' }}>
          <span style={{ display: 'inline-block', padding: '6px 16px', marginBottom: 20, borderRadius: 999, border: `1px solid ${AC}44`, background: 'rgba(0,207,193,0.08)', color: AC, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em' }}>ULTIMATE LIFE ADVISOR CO., LTD.</span>
          <h1 style={{ fontSize: compact ? 32 : 46, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 auto 20px', maxWidth: 780 }}>
            กว่า 15 ปี บนเส้นทาง<br /><span style={{ color: AC }}>ที่ปรึกษาการเงินมืออาชีพ</span>
          </h1>
          <p style={{ fontSize: 16.5, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 640, margin: '0 auto' }}>
            ผู้นำด้านตัวแทนประกันชีวิตและที่ปรึกษาการเงินที่ได้รับความไว้วางใจ — เรามุ่งมั่นสร้างระบบนิเวศการเงินที่ยั่งยืนผ่านประสบการณ์จริงจากภาคสนาม
          </p>
        </div>
      </section>

      {/* Founder & Vision */}
      <section style={{ ...wrap, padding: compact ? '56px 20px' : '80px 40px' }}>
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: compact ? 28 : 34, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>ผู้ก่อตั้ง & วิสัยทัศน์</h2>
          <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', margin: 0 }}>ปรัชญา “ออกแบบเอง ใช้เอง” (Designed by Advisors, for Advisors) คือหัวใจของ WealthPro</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '2fr 1fr', gap: 20 }}>
          {/* founder card */}
          <div className="lp-card" style={{ ...glass, overflow: 'hidden', display: 'flex', flexDirection: compact ? 'column' : 'row' }}>
            <div style={{ flex: compact ? 'none' : '0 0 42%', minHeight: compact ? 320 : 460, background: 'var(--navy-950)', position: 'relative' }}>
              <img src="/founder.jpg" alt="วีระพันธ์ เต็มดวง ผู้ก่อตั้ง WealthPro"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 22%' }} />
              {/* ไล่สีทึบด้านล่าง — ให้ชื่อบนภาพอ่านออกไม่ว่าพื้นหลังรูปจะสว่างแค่ไหน */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,12,16,0.92) 0%, rgba(10,12,16,0.35) 34%, transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 18, left: 22, right: 22 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)' }}>FINANCIAL PLANNING PROFESSIONAL</div>
                <div style={{ fontSize: 21, fontWeight: 800, color: '#fff', marginTop: 4 }}>วีระพันธ์ เต็มดวง</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: AC, marginTop: 2 }}>ผู้สร้าง WealthPro</div>
              </div>
            </div>
            <div style={{ flex: 1, padding: compact ? 26 : 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.85, margin: '0 0 24px' }}>
                “ในฐานะนักวางแผนการเงิน เราพบว่าเครื่องมือที่มีอยู่มักไม่ตอบโจทย์การทำงานจริง เราจึงสร้าง WealthPro ขึ้นบนหลักการวางแผนการเงินแบบองค์รวม 6 ด้าน เพื่อให้เพื่อนที่ปรึกษาทำงานได้อย่างมืออาชีพและเข้าถึงใจลูกค้าอย่างแท้จริง”
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: AC }} />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.02em' }}>Designed by Advisors, for Advisors</span>
              </div>
            </div>
          </div>
          {/* vision cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { icon: Award, t: 'วางแผนแบบองค์รวม', d: 'สร้างบนโครงสร้างการวางแผนการเงิน 6 ด้านระดับสากล เพื่อความแม่นยำและถูกต้อง' },
              { icon: LineChart, t: 'ประสบการณ์จริง', d: 'ทุกฟีเจอร์ผ่านการใช้งานจริงกับลูกค้าจำนวนมาก ตลอด 15 ปีในภาคสนาม' },
            ].map(v => (
              <div key={v.t} className="lp-card" style={{ ...glass, padding: 26, flex: 1 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><v.icon size={23} color={AC} /></div>
                <h4 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>{v.t}</h4>
                <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: compact ? '56px 20px' : '80px 40px' }}>
          <h2 style={{ fontSize: compact ? 28 : 34, fontWeight: 800, margin: '0 0 44px', letterSpacing: '-0.02em', textAlign: compact ? 'center' : 'left' }}>ประสบการณ์กว่า 15 ปี</h2>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
            {stats.map(s => (
              <div key={s.t} className="lp-card" style={{ ...glass, padding: 30 }}>
                <div style={{ fontSize: 44, fontWeight: 800, fontFamily: 'monospace', color: s.c, marginBottom: 10 }}>{s.n}</div>
                <h4 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>{s.t}</h4>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WealthPro product */}
      <section style={{ ...wrap, padding: compact ? '56px 20px' : '90px 40px' }}>
        <div style={{ ...glass, padding: compact ? 28 : 56, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -80, top: -80, width: 260, height: 260, borderRadius: '50%', background: 'rgba(0,207,193,0.12)', filter: 'blur(90px)', pointerEvents: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 40, alignItems: 'center', position: 'relative' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: AC, marginBottom: 12, textTransform: 'uppercase' }}>The Professional Standard</div>
              <h2 style={{ fontSize: compact ? 28 : 34, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>ซอฟต์แวร์ WealthPro</h2>
              <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 24px' }}>
                เราไม่ได้สร้างเพียงซอฟต์แวร์ แต่สร้าง “เพื่อนคู่คิด” สำหรับนักวางแผนการเงิน — รวบรวมประสบการณ์ 15 ปี มาย่อยให้กลายเป็นระบบดิจิทัลที่ทำให้การวิเคราะห์แผนซับซ้อนกลายเป็นเรื่องที่เข้าใจง่ายและจับต้องได้จริง
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['คำนวณภาษีและวางแผนมรดกอย่างแม่นยำ', 'วางแผนเกษียณแบบจำลองสถานการณ์ (Monte Carlo)', 'จัดพอร์ตการลงทุนตามระดับความเสี่ยง'].map(t => (
                  <li key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14.5, color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={19} color={AC} style={{ flexShrink: 0, marginTop: 1 }} />{t}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/features')} className="lp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px solid ${AC}`, color: AC, borderRadius: 12, padding: '13px 26px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                ดูฟีเจอร์ WealthPro <ArrowRight size={17} />
              </button>
            </div>
            {/* mini feature icons panel (แทนภาพ) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { icon: PiggyBank, t: 'แผนเกษียณ' }, { icon: LineChart, t: 'พอร์ตลงทุน' },
                { icon: ShieldCheck, t: 'ประกัน & PDPA' }, { icon: Bot, t: 'AI Copilot' },
              ].map(x => (
                <div key={x.t} style={{ ...glass, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><x.icon size={21} color={AC} /></div>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{x.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,207,193,0.1), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '64px 20px' : '96px 40px', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: compact ? 28 : 38, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>เริ่มต้นวางแผนการเงินอย่างมืออาชีพ</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.7 }}>ร่วมสัมผัสประสบการณ์การวางแผนการเงินที่เหนือระดับไปกับเราและ WealthPro</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <button onClick={goRegister} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 14, padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 16px 40px -12px rgba(0,207,193,0.4)' }}>ทดลองใช้ฟรี</button>
            <button onClick={() => navigate('/')} className="lp-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-primary)', borderRadius: 14, padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>กลับหน้าแรก</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '32px 40px', display: 'flex', flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <div style={{ textAlign: compact ? 'center' : 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Wealth<span style={{ color: AC }}>Pro</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 8 }}>
              บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด<br />
              199/78 ซ.มิตรภาพ 4 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000<br />
              <a href="tel:0994588787" className="lp-navlink" style={{ fontSize: 12.5 }}>099-4588787</a>, <a href="mailto:info@wealthpro.cloud" className="lp-navlink" style={{ fontSize: 12.5 }}>info@wealthpro.cloud</a>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Ultimate Life Advisor Co., Ltd. · สงวนลิขสิทธิ์</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
            <a href="/features" className="lp-navlink">ฟีเจอร์</a>
            <a href="/privacy" className="lp-navlink">นโยบายความเป็นส่วนตัว</a>
            <a href="/terms" className="lp-navlink">ข้อกำหนดการใช้บริการ</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
