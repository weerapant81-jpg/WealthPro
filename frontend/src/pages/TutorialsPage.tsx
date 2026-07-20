import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, X, GraduationCap, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsCompact } from '../hooks/useViewport'

/* ศูนย์เรียนรู้ — รวมคลิปสอนการใช้งาน WealthPro (YouTube unlisted)
 * ใช้ได้ทั้งสาธารณะ (จาก landing) และในแอป · จัดการรายการคลิปในโค้ด (MVP)
 * วิธีเพิ่มคลิป: ใส่ videoId (ส่วนท้าย URL YouTube เช่น https://youtu.be/XXXXXXXX → 'XXXXXXXX')
 *   ถ้ายังไม่มีคลิป เว้น videoId = '' ระบบจะแสดงป้าย "เร็ว ๆ นี้" ให้อัตโนมัติ */

type Clip = { cat: string; title: string; desc: string; videoId: string; duration?: string }

const CATS = ['เริ่มต้นใช้งาน', 'จัดการลูกค้า', 'วางแผนการเงิน', 'รายงาน', 'ผู้ช่วย AI', 'ความปลอดภัย'] as const

const CLIPS: Clip[] = [
  { cat: 'เริ่มต้นใช้งาน', title: 'ภาพรวม WealthPro & การเข้าใช้งานครั้งแรก', desc: 'สมัคร ยืนยันอีเมล และทัวร์เมนูหลักทั้งหมด', videoId: '', duration: '' },
  { cat: 'เริ่มต้นใช้งาน', title: 'ติดตั้งลงหน้าจอโฮม iPad (PWA)', desc: 'ใช้งานเต็มจอเหมือนแอปจริง', videoId: '', duration: '' },
  { cat: 'จัดการลูกค้า', title: 'สร้างลูกค้าใหม่ & กรอกข้อมูลส่วนบุคคล', desc: 'ข้อมูลครอบครัว รายรับ-รายจ่าย สินทรัพย์-หนี้สิน', videoId: '', duration: '' },
  { cat: 'จัดการลูกค้า', title: 'สลับดูข้อมูลระหว่างลูกค้า', desc: 'เลือกลูกค้าและดูภาพรวมพอร์ต', videoId: '', duration: '' },
  { cat: 'วางแผนการเงิน', title: 'วางแผนเกษียณ & งบการเงินล่วงหน้า', desc: 'ตั้งสมมติฐาน คำนวณความพร้อมเกษียณ พยากรณ์กระแสเงินสด', videoId: '', duration: '' },
  { cat: 'วางแผนการเงิน', title: 'วางแผนภาษี ประกัน และการลงทุน', desc: 'เปรียบเทียบก่อน-หลังวางแผน + Monte Carlo', videoId: '', duration: '' },
  { cat: 'รายงาน', title: 'สร้างรายงาน & สไลด์นำเสนอ + ส่งออก PDF', desc: 'สลับฉบับเต็ม/นำเสนอ เซ็น PDPA และดาวน์โหลด', videoId: '', duration: '' },
  { cat: 'ผู้ช่วย AI', title: 'ใช้งาน AI Copilot', desc: 'ถาม-ตอบเชิงลึกเฉพาะรายลูกค้า', videoId: '', duration: '' },
  { cat: 'ความปลอดภัย', title: 'เปิด 2FA & จัดการข้อมูลตาม PDPA', desc: 'ความปลอดภัยบัญชีและสิทธิ์ข้อมูลลูกค้า', videoId: '', duration: '' },
]

const AC = 'var(--cyan)'
const thumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`
const embed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`

export default function TutorialsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const compact = useIsCompact()
  const [cat, setCat] = useState<string>('ทั้งหมด')
  const [playing, setPlaying] = useState<Clip | null>(null)
  const list = cat === 'ทั้งหมด' ? CLIPS : CLIPS.filter(c => c.cat === cat)
  const ready = CLIPS.filter(c => c.videoId).length

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1040 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cyan-dim)', border: `1px solid ${AC}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap size={22} color={AC} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ศูนย์เรียนรู้ · วิดีโอสอนการใช้งาน</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>เรียนรู้วิธีใช้ WealthPro ทีละขั้น ตั้งแต่เริ่มต้นจนส่งมอบรายงาน</p>
        </div>
      </div>

      {ready === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--cyan-dim)', border: `1px solid ${AC}55`, borderRadius: 10, padding: '10px 14px' }}>
          คลิปวิดีโอกำลังทยอยอัปโหลด — หัวข้อด้านล่างคือสิ่งที่กำลังจะมี เร็ว ๆ นี้ครับ
        </div>
      )}

      {/* category filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['ทั้งหมด', ...CATS] as string[]).map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: '7px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${cat === c ? AC : 'var(--card-border)'}`,
              background: cat === c ? 'var(--cyan-dim)' : 'transparent',
              color: cat === c ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{c}</button>
        ))}
      </div>

      {/* video grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
        {list.map((c, i) => {
          const has = !!c.videoId
          return (
            <div key={i} onClick={() => has && setPlaying(c)}
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', cursor: has ? 'pointer' : 'default', transition: 'border-color .15s', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={e => { if (has) e.currentTarget.style.borderColor = 'var(--cyan)' }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}>
              {/* thumbnail 16:9 */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {has ? (
                  <>
                    <img src={thumb(c.videoId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
                        <Play size={24} color="#00201d" fill="#00201d" style={{ marginLeft: 3 }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', border: '1px dashed var(--card-border)', borderRadius: 999, padding: '5px 14px' }}>เร็ว ๆ นี้</span>
                )}
                {c.duration && has && (
                  <span style={{ position: 'absolute', bottom: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 7px' }}><Clock size={11} />{c.duration}</span>
                )}
              </div>
              {/* meta */}
              <div style={{ padding: '13px 15px', flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: AC, textTransform: 'uppercase', marginBottom: 5 }}>{c.cat}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 5 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{c.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
        มีคำถามเพิ่มเติม? ติดต่อผู้ให้บริการ · WealthPro โดย Ultimate Life Advisor Co., Ltd.
      </p>

      {/* player modal */}
      {playing && (
        <div onClick={() => setPlaying(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{playing.title}</span>
              <button onClick={() => setPlaying(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={22} /></button>
            </div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <iframe src={embed(playing.videoId)} title={playing.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ล็อกอินอยู่ = อยู่ในแอป (มี sidebar จาก Layout) → แสดงเนื้อหาอย่างเดียว
  if (user) return content

  // guest (จาก landing) → ครอบด้วยเมนูการตลาด + footer เหมือนหน้าอื่น
  const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: compact ? '0 20px' : '0 40px' }
  return (
    <div style={{ background: 'var(--navy-900)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        .lp-navlink { color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 600; transition: color .15s; cursor: pointer; background: none; border: none; font-family: inherit; }
        .lp-navlink:hover { color: var(--cyan); }
        .lp-btn { transition: transform .12s ease, filter .15s ease; } .lp-btn:hover { filter: brightness(1.08); } .lp-btn:active { transform: scale(0.97); }
      `}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(19,19,21,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer' }}>Wealth<span style={{ color: AC }}>Pro</span></span>
          {!compact && (
            <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 26 }}>
              <span onClick={() => navigate('/')} className="lp-navlink">หน้าแรก</span>
              <span onClick={() => navigate('/features')} className="lp-navlink">ฟีเจอร์</span>
              <span onClick={() => navigate('/about')} className="lp-navlink">เกี่ยวกับเรา</span>
              <span onClick={() => navigate('/#pricing')} className="lp-navlink">ราคา</span>
              <span className="lp-navlink" style={{ color: AC }}>วิดีโอสอนการใช้งาน</span>
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/login')} className="lp-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
            <button onClick={() => navigate('/login?mode=register')} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>ทดลองใช้ฟรี</button>
          </div>
        </div>
      </header>
      <div style={{ ...wrap, padding: compact ? '28px 20px 64px' : '36px 40px 72px' }}>{content}</div>
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '32px 40px', display: 'flex', flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Wealth<span style={{ color: AC }}>Pro</span></div>
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
