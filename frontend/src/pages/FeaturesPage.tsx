import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Wallet, TrendingUp, ShieldCheck, PiggyBank, Receipt, LayoutDashboard,
  PenLine, BarChart3, LineChart, Bot, ClipboardCheck, ArrowRight,
  Tablet, Download, Users, LogIn, RefreshCw, Headset, Check, FileText, X, Maximize2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'

type Pillar = { icon: React.ElementType; t: string; img: string }

/* หน้าฟีเจอร์ (deep-dive) สาธารณะ — ธีมมืดตามแอป · ไม่ดึง CDN ภายนอก */

const AC = 'var(--cyan)'

/* กล่องแสดงภาพตัวอย่างหน้าโปรแกรมเมื่อคลิกการ์ด — คลิกพื้นหลัง/กด Esc เพื่อปิด */
function ScreenshotModal({ img, title, onClose }: { img: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 'clamp(16px,4vw,48px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 1180 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>ตัวอย่างหน้า{title}</span>
          <button onClick={onClose} aria-label="ปิด"
            style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: '#fff' }}><X size={20} /></button>
        </div>
        <img src={img} alt={`ตัวอย่างหน้า${title}`}
          style={{ width: '100%', height: 'auto', borderRadius: 14, boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)' }} />
      </div>
    </div>
  )
}

/* สไลด์ภาพหน้าโปรแกรม — ปัดซ้าย/ขวา (นิ้วหรือเมาส์) · ปุ่มลูกศร · จุดบอกตำแหน่ง · คลิกภาพเพื่อดูเต็มจอ */
function PillarCarousel({ items, onOpen }: { items: Pillar[]; onOpen: (p: Pillar) => void }) {
  const [i, setI] = useState(0)
  const n = items.length
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; moved: boolean } | null>(null)
  const go = (idx: number) => setI(Math.max(0, Math.min(n - 1, idx)))

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !trackRef.current) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 5) d.moved = true
    trackRef.current.style.transition = 'none'
    trackRef.current.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const dx = e.clientX - d.x
    if (trackRef.current) trackRef.current.style.transition = ''
    if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1))          // ปัดเกิน 60px = เปลี่ยนสไลด์
    else { if (trackRef.current) trackRef.current.style.transform = `translateX(${-i * 100}%)`
           if (!d.moved) onOpen(items[i]) }                    // แตะเฉย ๆ = เปิดเต็มจอ
  }

  return (
    <div style={{ position: 'relative', maxWidth: 940, margin: '0 auto' }}>
      <div style={{ overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'var(--navy-950)' }}>
        <div ref={trackRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null }}
          style={{ display: 'flex', transform: `translateX(${-i * 100}%)`, transition: 'transform .38s cubic-bezier(.22,.61,.36,1)', touchAction: 'pan-y', cursor: 'grab' }}>
          {items.map(p => (
            <div key={p.t} style={{ flex: '0 0 100%', position: 'relative' }}>
              <img src={p.img} alt={`ตัวอย่างหน้า${p.t}`} draggable={false}
                style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }} />
              {/* ป้ายชื่อด้านล่างภาพ */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 20px 16px', display: 'flex', alignItems: 'center', gap: 10,
                background: 'linear-gradient(to top, rgba(10,12,16,0.9), transparent)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,207,193,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><p.icon size={18} color={AC} /></div>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{p.t}</span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}><Maximize2 size={13} /> ดูเต็มจอ</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ปุ่มลูกศร */}
      <button onClick={() => go(i - 1)} disabled={i === 0} aria-label="ก่อนหน้า"
        style={{ position: 'absolute', top: '50%', left: 10, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(10,12,16,0.7)', backdropFilter: 'blur(6px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}><ChevronLeft size={22} /></button>
      <button onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="ถัดไป"
        style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(10,12,16,0.7)', backdropFilter: 'blur(6px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: i === n - 1 ? 'default' : 'pointer', opacity: i === n - 1 ? 0.3 : 1 }}><ChevronRight size={22} /></button>

      {/* จุดบอกตำแหน่ง */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 9, marginTop: 18 }}>
        {items.map((p, idx) => (
          <button key={p.t} onClick={() => go(idx)} aria-label={p.t}
            style={{ width: idx === i ? 26 : 9, height: 9, borderRadius: 5, border: 'none', padding: 0, cursor: 'pointer', transition: 'all .25s', background: idx === i ? AC : 'rgba(255,255,255,0.22)' }} />
        ))}
      </div>
    </div>
  )
}
const glass: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18 }

function Bento({ span, icon: Icon, title, desc, wide, chips, big }: {
  span: number; icon: React.ElementType; title: string; desc?: string; wide?: boolean; chips?: string[]; big?: boolean
}) {
  return (
    <div className="lp-card" style={{ ...glass, gridColumn: `span ${span}`, padding: 28, display: 'flex', flexDirection: 'column', minHeight: 200, position: 'relative', overflow: 'hidden', ...(big ? { background: 'linear-gradient(150deg, rgba(0,207,193,0.08), transparent 70%)', border: `1px solid ${AC}44` } : {}) }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: big ? AC : 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        <Icon size={23} color={big ? '#00201d' : AC} />
      </div>
      <h3 style={{ fontSize: wide ? 21 : 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
      {desc && <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, maxWidth: 460 }}>{desc}</p>}
      {chips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {chips.map(c => <span key={c} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--navy-800)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 11px' }}>{c}</span>)}
        </div>
      )}
    </div>
  )
}

export default function FeaturesPage() {
  const navigate = useNavigate()
  const compact = useIsCompact()
  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')
  const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: compact ? '0 20px' : '0 40px' }
  const cols = compact ? 1 : 3
  const span = (n: number) => Math.min(n, cols)   // จอแคบ → span เต็มแถว

  const [shot, setShot] = useState<{ img: string; t: string } | null>(null)

  const pillars = [
    { icon: Wallet, t: 'สภาพคล่อง', img: '/features/liquidity.webp' },
    { icon: TrendingUp, t: 'การลงทุน', img: '/features/investment.webp' },
    { icon: ShieldCheck, t: 'ประกัน', img: '/features/insurance.webp' },
    { icon: PiggyBank, t: 'เกษียณ', img: '/features/retirement.webp' },
    { icon: Receipt, t: 'ภาษี', img: '/features/tax.webp' },
    { icon: LayoutDashboard, t: 'ภาพรวม', img: '/features/overview.webp' },
  ]
  const extras = [
    { icon: Tablet, t: 'รองรับการใช้งานบน iPad เต็มรูปแบบ (ติดตั้งลงหน้าจอโฮมได้)' },
    { icon: Download, t: 'ส่งออกกราฟเป็น PNG และตารางเป็น Excel ได้ทุกหน้า' },
    { icon: Users, t: 'รองรับการวางแผนแบบคู่สมรส (Joint Plan)' },
    { icon: LogIn, t: 'เข้าสู่ระบบผ่าน Google และ Apple ID' },
    { icon: RefreshCw, t: 'บันทึกข้อมูลบนคลาวด์ ซิงค์อัตโนมัติทุกอุปกรณ์' },
    { icon: Headset, t: 'ระบบ Audit log ตรวจสอบการเข้าถึงข้อมูลตาม PDPA' },
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
              <span className="lp-navlink" style={{ color: AC }}>ฟีเจอร์</span>
              <span onClick={() => navigate('/about')} className="lp-navlink">เกี่ยวกับเรา</span>
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
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '55%', height: '70%', background: AC, filter: 'blur(150px)', opacity: 0.08, borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '52px 20px 60px' : '84px 40px 90px', position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: AC, marginBottom: 16 }}>ฟีเจอร์ทั้งหมด</div>
          <h1 style={{ fontSize: compact ? 32 : 44, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 auto 20px', maxWidth: 780 }}>
            รายงานและสไลด์นำเสนอระดับพรีเมียม <span style={{ color: AC }}>จบงานได้ในแอพเดียว</span>
          </h1>
          <p style={{ fontSize: 16.5, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 620, margin: '0 auto 32px' }}>
            สร้างรายงานฉบับเต็มและสไลด์นำเสนอกว่า 20 หน้าที่สวยงามเป็นมืออาชีพ พร้อมส่งมอบให้ลูกค้าทันที — ไม่ต้องเสียเวลาทำเองใน PowerPoint หรือ Excel
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <a href="/report-sample.pdf" target="_blank" rel="noopener noreferrer" className="lp-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 12, padding: '15px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
              <FileText size={18} /> ตัวอย่างรายงาน
            </a>
            <button onClick={goRegister} className="lp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: AC, color: '#00201d', border: 'none', borderRadius: 12, padding: '15px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              ทดลองใช้ฟรี <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* 6 เสาหลักการวางแผนการเงิน */}
      <section style={{ ...wrap, padding: compact ? '56px 20px' : '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ fontSize: compact ? 26 : 32, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>วางแผนครบ 6 ด้าน ในที่เดียว</h2>
          <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto' }}>เชื่อมโยงข้อมูลทั้ง 6 ด้านเข้าด้วยกันอัตโนมัติ กรอกครั้งเดียว คำนวณให้ทั้งระบบ</p>
        </div>
        <PillarCarousel items={pillars} onOpen={p => setShot({ img: p.img, t: p.t })} />
        <p style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 14 }}>ปัดซ้าย–ขวาเพื่อดูแต่ละด้าน · แตะภาพเพื่อดูเต็มจอ</p>
      </section>

      {/* Bento features */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: compact ? '56px 20px' : '80px 40px' }}>
          <h2 style={{ fontSize: compact ? 26 : 32, fontWeight: 800, textAlign: 'center', margin: '0 0 44px', letterSpacing: '-0.02em' }}>ฟีเจอร์เด่นเพื่อที่ปรึกษามืออาชีพ</h2>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18 }}>
            <Bento span={span(2)} wide icon={PenLine} title="เซ็นสัญญา & PDPA ดิจิทัล" desc="รองรับการเซ็นชื่อบน iPad พร้อมระบบล็อกการส่งออกรายงานจนกว่าจะลงนาม + ยินยอม PDPA ครบ" />
            <Bento span={span(1)} icon={BarChart3} title="งบการเงินล่วงหน้า & ภาษี" desc="พยากรณ์กระแสเงินสดรายปีจนถึงอายุขัย แม่นยำกว่าการใช้ Excel ทั่วไป" />
            <Bento span={span(1)} icon={LineChart} title="แบบจำลองระดับสถาบัน" desc="Monte Carlo · Efficient Frontier · Sharpe Ratio ประกอบการตัดสินใจลงทุน" />
            <Bento span={span(2)} wide big icon={Bot} title="AI Copilot (Claude)" desc="ผู้ช่วย AI ที่เข้าใจข้อมูลลูกค้าของคุณ ช่วยวิเคราะห์หาโอกาสและลดความเสี่ยงเฉพาะรายลูกค้าอย่างชาญฉลาด" />
            <Bento span={span(1)} icon={ClipboardCheck} title="แผนปฏิบัติการ (Action Plan)" desc="ติดตามความคืบหน้าตามแผน รักษาความสัมพันธ์ระยะยาวกับลูกค้า" />
            <Bento span={span(2)} wide icon={ShieldCheck} title="มาตรฐานความปลอดภัยสูงสุด" chips={['PDPA Ready', 'AES-256', '2FA', 'Audit Log']} desc="ปกป้องข้อมูลลูกค้าด้วยการเข้ารหัสระดับธนาคารและระบบตรวจสอบการเข้าถึง" />
          </div>
        </div>
      </section>

      {/* ฟีเจอร์อื่น ๆ */}
      <section style={{ ...wrap, padding: compact ? '56px 20px' : '80px 40px' }}>
        <div style={{ ...glass, padding: compact ? 28 : 44, maxWidth: 900, margin: '0 auto' }}>
          <h3 style={{ fontSize: compact ? 22 : 26, fontWeight: 800, textAlign: 'center', margin: '0 0 32px' }}>และฟีเจอร์อื่น ๆ อีกมากมาย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '18px 40px' }}>
            {extras.map(e => (
              <div key={e.t} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><e.icon size={19} color={AC} /></div>
                <span style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>{e.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,207,193,0.1), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '64px 20px' : '90px 40px', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: compact ? 28 : 38, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>ยกระดับการวางแผนการเงินของคุณวันนี้</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto 30px', lineHeight: 1.7 }}>เริ่มใช้ฟรี ไม่มีค่าใช้จ่ายในการเริ่มต้น — ด้วยเครื่องมือที่ออกแบบมาเพื่อมืออาชีพตัวจริง</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <button onClick={goRegister} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 14, padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 16px 40px -12px rgba(0,207,193,0.4)' }}>ทดลองใช้ฟรี</button>
            <button onClick={() => navigate('/')} className="lp-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-primary)', borderRadius: 14, padding: '16px 40px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>กลับหน้าแรก</button>
          </div>
          <p style={{ marginTop: 22, fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={15} color={AC} /> ไม่มีค่าใช้จ่ายในการเริ่มต้น · ใช้ฟรีได้ทันที</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '32px 40px', display: 'flex', flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <div style={{ textAlign: compact ? 'center' : 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Wealth<span style={{ color: AC }}>Pro</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              บริษัท อัลติเมทไลฟ์ แอ็ดไวเซอร์ จำกัด<br />
              199/78 ซ.มิตรภาพ 4 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000<br />
              <a href="tel:0994588787" className="lp-navlink" style={{ fontSize: 12.5 }}>099-4588787</a>, <a href="mailto:info@wealthpro.cloud" className="lp-navlink" style={{ fontSize: 12.5 }}>info@wealthpro.cloud</a>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
            <a href="/privacy" className="lp-navlink">นโยบายความเป็นส่วนตัว</a>
            <a href="/terms" className="lp-navlink">ข้อกำหนดการใช้บริการ</a>
            <a href="/install" className="lp-navlink">ติดตั้งบน iPad</a>
          </div>
        </div>
      </footer>

      {shot && <ScreenshotModal img={shot.img} title={shot.t} onClose={() => setShot(null)} />}
    </div>
  )
}
