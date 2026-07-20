import { useNavigate } from 'react-router-dom'
import {
  Landmark, FileText, TrendingUp, Bot, PenLine, ShieldCheck,
  Check, ArrowRight, ChevronDown, Sparkles, Smartphone,
} from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'

/* หน้า landing สาธารณะ — ธีมมืดตามแอป (navy + teal) · ไม่ดึง CDN ภายนอก */

const AC = 'var(--cyan)'            // teal accent
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, padding: '7px 16px' }}>{children}</span>
  )
}

function Feature({ icon: Icon, title, desc, highlight, badge }: { icon: React.ElementType; title: string; desc: string; highlight?: boolean; badge?: string }) {
  return (
    <div className="lp-card" style={{
      ...glass, padding: 26,
      ...(highlight ? { border: `1px solid ${AC}55`, background: 'linear-gradient(160deg, rgba(0,207,193,0.08), transparent)' } : {}),
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: highlight ? AC : 'var(--navy-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={23} color={highlight ? '#00201d' : AC} />
        </div>
        {badge && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#00201d', background: AC, borderRadius: 6, padding: '4px 9px', textTransform: 'uppercase' }}>{badge}</span>}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  )
}

function PriceCol({ name, sub, price, unit, note, feats, cta, ctaAction, popular, disabled }: {
  name: string; sub: string; price: string; unit?: string; note?: string; feats: string[]
  cta: string; ctaAction?: () => void; popular?: boolean; disabled?: boolean
}) {
  return (
    <div style={{ ...glass, padding: 34, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', ...(popular ? { border: `1px solid ${AC}` } : {}) }}>
      {popular && <div style={{ position: 'absolute', top: 0, right: 0, background: AC, color: '#00201d', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', padding: '5px 14px', borderBottomLeftRadius: 12, textTransform: 'uppercase' }}>แนะนำ</div>}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{name}</h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{sub}</p>
      </div>
      <div style={{ marginBottom: 22, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 38, fontWeight: 800, color: popular ? AC : 'var(--text-primary)', fontFamily: 'monospace' }}>{price}</span>
        {unit && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {note && <div style={{ fontSize: 11.5, color: AC, marginTop: -14, marginBottom: 18, fontWeight: 700 }}>{note}</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {feats.map(f => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: 'var(--text-secondary)' }}>
            <Check size={17} color={AC} style={{ flexShrink: 0, marginTop: 1 }} />{f}
          </li>
        ))}
      </ul>
      <button onClick={ctaAction} disabled={disabled}
        className={disabled ? undefined : 'lp-btn'}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
          border: popular ? 'none' : '1px solid rgba(255,255,255,0.14)',
          background: disabled ? 'var(--navy-800)' : popular ? AC : 'transparent',
          color: disabled ? 'var(--text-muted)' : popular ? '#00201d' : 'var(--text-primary)',
          fontFamily: 'inherit',
        }}>{cta}</button>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details style={{ ...glass, padding: '18px 22px', cursor: 'pointer' }}>
      <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', listStyle: 'none' }}>
        {q}<ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </summary>
      <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{a}</p>
    </details>
  )
}

/* mockup แดชบอร์ดจำลองด้วย CSS/SVG (แทนภาพภายนอก) */
function DashboardMock() {
  return (
    <div style={{ ...glass, padding: 12, boxShadow: `0 30px 80px -20px rgba(0,207,193,0.18)`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,207,193,0.10), transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ background: 'var(--navy-950)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: '#ff5f57' }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: '#febc2e' }} />
          <span style={{ width: 10, height: 10, borderRadius: 999, background: '#28c840' }} />
          <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>WealthPro · แผนเกษียณ</span>
        </div>
        <div style={{ display: 'flex' }}>
          {/* sidebar */}
          <div style={{ width: 52, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            {[Landmark, TrendingUp, ShieldCheck, FileText].map((I, i) => <I key={i} size={17} color={i === 0 ? AC : 'var(--text-muted)'} />)}
          </div>
          {/* content */}
          <div style={{ flex: 1, padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[['ส่วนที่ขาด', '19.3M', '#f43f5e'], ['เป้าเกษียณ', '27.1M', AC], ['ออม/ปี', '740K', '#22c55e']].map(([l, v, c]) => (
                <div key={l} style={{ background: 'var(--navy-900)', borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c as string, fontFamily: 'monospace', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* area chart */}
            <svg viewBox="0 0 320 110" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="lpArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00cfc1" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#00cfc1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,95 C40,88 60,70 100,60 C140,50 160,30 200,26 C240,22 270,16 320,8 L320,110 L0,110 Z" fill="url(#lpArea)" />
              <path d="M0,95 C40,88 60,70 100,60 C140,50 160,30 200,26 C240,22 270,16 320,8" fill="none" stroke="#00cfc1" strokeWidth="2.5" />
              {[[100, 60], [200, 26], [320, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#00cfc1" />)}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const compact = useIsCompact()
  const goRegister = () => navigate('/login?mode=register')
  const goLogin = () => navigate('/login')

  const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: compact ? '0 20px' : '0 40px' }

  return (
    <div style={{ background: 'var(--navy-900)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        .lp-card { transition: transform .18s ease, border-color .18s ease; }
        .lp-card:hover { transform: translateY(-4px); border-color: rgba(0,207,193,0.45) !important; }
        .lp-btn { transition: transform .12s ease, filter .15s ease; }
        .lp-btn:hover { filter: brightness(1.08); }
        .lp-btn:active { transform: scale(0.97); }
        .lp-navlink { color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 600; transition: color .15s; }
        .lp-navlink:hover { color: var(--cyan); }
        details > summary::-webkit-details-marker { display: none; }
        @keyframes lpFade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .lp-fade { animation: lpFade .6s ease both; }
      `}</style>

      {/* ── Nav ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(19,19,21,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer' }}>Wealth<span style={{ color: AC }}>Pro</span></span>
          {!compact && (
            <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 26, alignItems: 'center' }}>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="lp-navlink" style={{ background: 'none', border: 'none', fontFamily: 'inherit', color: 'var(--cyan)' }}>หน้าแรก</button>
              <button onClick={() => navigate('/features')} className="lp-navlink" style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}>ฟีเจอร์</button>
              <button onClick={() => navigate('/about')} className="lp-navlink" style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}>เกี่ยวกับเรา</button>
              <a href="#pricing" className="lp-navlink">ราคา</a>
              <button onClick={() => navigate('/tutorials')} className="lp-navlink" style={{ background: 'none', border: 'none', fontFamily: 'inherit' }}>วิดีโอสอนการใช้งาน</button>
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={goLogin} className="lp-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
            <button onClick={goRegister} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>ทดลองใช้ฟรี</button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '55%', height: '70%', background: AC, filter: 'blur(150px)', opacity: 0.09, borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '48px 20px 60px' : '80px 40px 100px', display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 48, alignItems: 'center', position: 'relative' }}>
          <div className="lp-fade">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'var(--navy-800)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: AC, marginBottom: 22 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: AC }} />มาตรฐานวิชาชีพ CFP®
            </div>
            <h1 style={{ fontSize: compact ? 34 : 46, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0 0 20px' }}>
              โปรแกรมวางแผนการเงินครบวงจร<br /><span style={{ color: AC }}>สำหรับนักวางแผนการเงินไทย</span>
            </h1>
            <p style={{ fontSize: 16.5, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 520, margin: '0 0 32px' }}>
              วิเคราะห์ครบ 6 ด้านตามหลัก CFP · ส่งมอบรายงานได้ 2 รูปแบบ (ฉบับเต็ม + สไลด์นำเสนอ) · พร้อม AI Copilot ช่วยวางแผน — ยกระดับการให้คำปรึกษาให้แม่นยำและมืออาชีพ
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <button onClick={goRegister} className="lp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: AC, color: '#00201d', border: 'none', borderRadius: 12, padding: '15px 28px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                ทดลองใช้ฟรี <ArrowRight size={18} />
              </button>
              <a href="#features" className="lp-btn" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--text-primary)', borderRadius: 12, padding: '15px 28px', fontSize: 15, fontWeight: 800, textDecoration: 'none' }}>
                ดูฟีเจอร์ทั้งหมด
              </a>
            </div>
          </div>
          <div className="lp-fade" style={{ animationDelay: '.1s' }}><DashboardMock /></div>
        </div>
      </section>

      {/* ── แถบ 6 ด้าน CFP ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '28px 40px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 8 }}>วางแผน 6 ด้าน</span>
          {['สภาพคล่อง', 'การลงทุน', 'ประกัน & ความเสี่ยง', 'เกษียณอายุ', 'ภาษี', 'มรดก'].map(t => <Chip key={t}>{t}</Chip>)}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ ...wrap, padding: compact ? '60px 20px' : '90px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: compact ? 28 : 36, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>ฟีเจอร์ที่ออกแบบเพื่อมืออาชีพ</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto' }}>ครบทุกมิติของการวางแผนการเงิน พร้อมเทคโนโลยีที่ช่วยลดเวลาทำงานของคุณ</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
          <Feature icon={Landmark} title="วิเคราะห์ 6 ด้านตามหลัก CFP" desc="ครอบคลุมสภาพคล่อง การลงทุน ประกัน เกษียณ ภาษี และมรดก อย่างเป็นระบบตามมาตรฐานวิชาชีพ" />
          <Feature icon={FileText} title="รายงาน & สไลด์นำเสนอ" desc="สร้างรายงาน PDF ระดับมืออาชีพและสไลด์นำเสนออัตโนมัติ พร้อมโปรไฟล์และแบรนด์ของคุณ" />
          <Feature icon={TrendingUp} title="งบการเงินล่วงหน้า + วางแผนภาษี" desc="จำลองกระแสเงินสดรายปีถึงอายุขัย พร้อมวางแผนภาษีเปรียบเทียบก่อน–หลังอย่างแม่นยำ" />
          <Feature icon={Bot} title="AI Copilot" desc="ผู้ช่วยอัจฉริยะวิเคราะห์เชิงลึกและให้คำแนะนำเฉพาะรายลูกค้า grounded บนข้อมูลจริง" highlight badge="AI" />
          <Feature icon={PenLine} title="เซ็นเอกสารบนจอ + PDPA" desc="เซ็นข้อตกลง/ความยินยอมบนหน้าจอ ส่งออก PDF ได้ทันที ไร้กระดาษ ปลอดภัยตามข้อบังคับ" />
          <Feature icon={ShieldCheck} title="ความปลอดภัยระดับธนาคาร" desc="เข้ารหัสข้อมูล AES-256 · 2FA · Audit log · จัดการข้อมูลตาม PDPA อย่างเคร่งครัด" />
        </div>
      </section>

      {/* ── 4 ขั้นตอน ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: compact ? '60px 20px' : '90px 40px' }}>
          <h2 style={{ fontSize: compact ? 28 : 36, fontWeight: 800, textAlign: 'center', margin: '0 0 56px', letterSpacing: '-0.02em' }}>เริ่มวางแผนใน 4 ขั้นตอน</h2>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(4, 1fr)', gap: 32 }}>
            {(() => {
              const steps = [
                { t: 'กรอกข้อมูลลูกค้า', d: 'บันทึกข้อมูลส่วนตัว รายรับ-รายจ่าย สินทรัพย์-หนี้สิน และเป้าหมายผ่านระบบที่ใช้งานง่าย' },
                { t: 'วิเคราะห์อัตโนมัติ', d: 'ระบบคำนวณตามหลักการเงินสากลทันที — Monte Carlo, Efficient Frontier, ความพร้อมเกษียณ พร้อมกราฟชัดเจน' },
                { t: 'จัดทำแผนการเงิน', d: 'วางแผน 6 ด้านตามเป้าหมายลูกค้า พร้อมข้อเสนอแนะและแนวทางปรับปรุงจากที่ปรึกษา' },
                { t: 'ส่งมอบรายงาน', d: 'ได้แผนการเงินฉบับสมบูรณ์ ในรูปแบบรายงานฉบับเต็มหรือสไลด์นำเสนอ (PDF)' },
              ]
              return steps.map((s, i) => {
                const n = i + 1, last = n === steps.length
                return (
                  <div key={n} style={{ textAlign: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: last ? '#00201d' : (n === 1 ? 'var(--text-primary)' : AC), background: last ? AC : 'var(--navy-800)', border: last ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>{n}</div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px' }}>{s.t}</h3>
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{s.d}</p>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ ...wrap, padding: compact ? '60px 20px' : '90px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: compact ? 28 : 36, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.02em' }}>แพ็กเกจที่เหมาะกับคุณ</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>เริ่มใช้ฟรีได้ทันที — แพ็กเกจแบบชำระเงินจะเปิดให้บริการเร็ว ๆ นี้</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 20, maxWidth: 380, margin: '0 auto' }}>
          <PriceCol name="Free" sub="สำหรับเริ่มต้นใช้งาน" price="฿0" unit="/เดือน"
            feats={['แดชบอร์ด + จัดการข้อมูลลูกค้า', 'ลูกค้าสูงสุด 5 คน', 'ประเมินความเสี่ยงเบื้องต้น']}
            cta="ทดลองใช้ฟรี" ctaAction={goRegister} />
          {/* Pro / AI แพ็กเกจ — ซ่อนไว้ก่อน ค่อยเปิดเมื่อระบบชำระเงินพร้อม
          <PriceCol name="Pro" sub="ทุกเมนู (ไม่รวม AI)" price="฿590" unit="/เดือน" note="เปิดให้บริการเร็ว ๆ นี้"
            feats={['ทุกเมนูวางแผน 6 ด้าน', 'งบการเงินล่วงหน้า + วางแผนภาษี', 'รายงานฉบับเต็ม + สไลด์นำเสนอ', 'เซ็น PDPA + ส่งออก PDF']}
            cta="เร็ว ๆ นี้" disabled />
          <PriceCol name="AI" sub="ทุกเมนู + ผู้ช่วย AI" price="฿890" unit="/เดือน" note="เปิดให้บริการเร็ว ๆ นี้" popular
            feats={['ทุกฟีเจอร์ในแพ็กเกจ Pro', 'AI Copilot ผู้ช่วยวางแผน', 'วิเคราะห์เชิงลึกรายลูกค้า', 'อัปเดตฟีเจอร์ใหม่ก่อนใคร']}
            cta="เร็ว ๆ นี้" disabled />
          */}
          {/* Enterprise — ซ่อนไว้ก่อน ค่อยเปิดเมื่อพร้อม
          <PriceCol name="Enterprise" sub="สำหรับทีม/องค์กร (รวม AI)" price="690–490" unit="฿/คน/เดือน" note="ยิ่งทีมใหญ่ ยิ่งถูกต่อคน"
            feats={['ทุกฟีเจอร์ + AI Copilot', '5–10 คน · 690 ฿/คน', '11–20 คน · 590 ฿/คน', 'มากกว่า 20 คน · 490 ฿/คน', 'ช่วยตั้งค่า/อบรมให้ทีม']}
            cta="ติดต่อสอบถาม" ctaAction={() => { window.location.href = 'mailto:info@wealthpro.cloud?subject=สอบถามแพ็กเกจ Enterprise WealthPro' }} />
          */}
        </div>
      </section>

      {/* ── ติดตั้งบน iPad (PWA) ── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: compact ? '48px 20px' : '64px 40px' }}>
          <div style={{ ...glass, padding: compact ? 28 : 40, display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: 'center', gap: 24, textAlign: compact ? 'center' : 'left', background: 'linear-gradient(120deg, rgba(0,207,193,0.07), transparent)' }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Smartphone size={28} color="#00201d" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 6px' }}>ใช้งานบน iPad เหมือนแอปจริง</h3>
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>เพิ่ม WealthPro ลงหน้าจอโฮม เปิดเต็มจอ ไม่มีแถบเบราว์เซอร์ — พร้อมนำเสนอกับลูกค้าแบบมืออาชีพ</p>
            </div>
            <button onClick={() => navigate('/install')} className="lp-btn" style={{ background: 'transparent', border: `1px solid ${AC}`, color: AC, borderRadius: 12, padding: '13px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
              วิธีติดตั้ง
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" style={{ ...wrap, padding: compact ? '60px 20px' : '90px 40px', maxWidth: 780 }}>
        <h2 style={{ fontSize: compact ? 28 : 36, fontWeight: 800, textAlign: 'center', margin: '0 0 44px', letterSpacing: '-0.02em' }}>คำถามที่พบบ่อย</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Faq q="WealthPro อ้างอิงมาตรฐาน CFP หรือไม่?" a="ระบบพัฒนาโดยอ้างอิงหลักเกณฑ์การวางแผนการเงิน 6 ด้านตามมาตรฐานวิชาชีพ CFP® ทั้งการวิเคราะห์สภาพคล่อง การลงทุน ประกัน เกษียณ ภาษี และมรดก" />
          <Faq q="ข้อมูลลูกค้าปลอดภัยแค่ไหน?" a="เข้ารหัสข้อมูลระดับสถาบันการเงิน (AES-256) รองรับ 2FA และ Audit log พร้อมจัดการข้อมูลตามข้อบังคับ PDPA อย่างเคร่งครัด — รวมถึงการขอเข้าถึง/ลบข้อมูลของลูกค้า" />
          <Faq q="ใช้บน iPad ได้ไหม?" a="ได้เต็มรูปแบบ WealthPro เป็น Progressive Web App ติดตั้งลงหน้าจอโฮม iPad ได้ เปิดเต็มจอเหมือนแอป เหมาะกับการนำเสนอกับลูกค้าแบบเจอหน้า" />
          <Faq q="เริ่มใช้งานอย่างไร?" a="สมัครด้วยอีเมล / Google / Apple → ยืนยันอีเมล → รอผู้ให้บริการอนุมัติบัญชี จากนั้นเริ่มสร้างลูกค้าและวางแผนได้ทันที" />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,207,193,0.10), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ ...wrap, padding: compact ? '64px 20px' : '96px 40px', textAlign: 'center', position: 'relative' }}>
          <Sparkles size={30} color={AC} style={{ marginBottom: 18 }} />
          <h2 style={{ fontSize: compact ? 30 : 40, fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.02em' }}>เริ่มต้นวางแผนอย่างมืออาชีพวันนี้</h2>
          <p style={{ fontSize: 16.5, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.7 }}>สมัครฟรี พร้อมเครื่องมือวางแผน 6 ด้านและรายงานมาตรฐาน CFP® ครบทุกมิติ</p>
          <button onClick={goRegister} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 14, padding: '17px 44px', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 16px 40px -12px rgba(0,207,193,0.4)' }}>สมัครสมาชิกฟรี</button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '36px 40px', display: 'flex', flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: compact ? 'center' : 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Wealth<span style={{ color: AC }}>Pro</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} Ultimate Life Advisor Co., Ltd. · สงวนลิขสิทธิ์</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
            <a href="/privacy" className="lp-navlink">นโยบายความเป็นส่วนตัว</a>
            <a href="/terms" className="lp-navlink">ข้อกำหนดการใช้บริการ</a>
            <a href="/refund" className="lp-navlink">นโยบายการคืนเงิน</a>
            <a href="/install" className="lp-navlink">ติดตั้งบน iPad</a>
            <button onClick={goLogin} className="lp-navlink" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
