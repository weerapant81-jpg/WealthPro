import { CAREER_LIST } from '../../lib/game/careers'
import type { CareerId } from '../../lib/game/types'
import { btnGhost, fmtTH } from './format'

/* ── จอเริ่มเกม: เลือกอาชีพ ── */

export default function IntroScreen({ onStart, onResume, hasSave }: {
  onStart: (careerId: CareerId) => void
  onResume: () => void
  hasSave: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fpAppear .4s ease' }}>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>
          <span style={{ color: 'var(--text-primary)' }}>Wealth</span><span style={{ color: 'var(--cyan)' }}>Pro</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: 6, letterSpacing: 2, fontSize: 9 }}>FINANCIAL PLANNING</span>
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', marginTop: 14, lineHeight: 1.15 }}>
          เกมเศรษฐี <span style={{ fontSize: 30 }}>🎲</span>
        </div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
          จำลองชีวิตการเงิน 30 ปี — อายุ 30 ถึงเกษียณ 60<br />
          เลือกอาชีพ รับมือเหตุการณ์ไม่คาดฝัน แล้วดูว่า...<br />
          <b style={{ color: 'var(--cyan)' }}>คุณจะเกษียณได้จริงไหม?</b>
        </div>
      </div>

      {hasSave && (
        <button onClick={onResume} style={{ ...btnGhost, borderColor: 'var(--cyan)', color: 'var(--cyan)', fontWeight: 700 }}>
          ▶ เล่นต่อจากเกมที่ค้างไว้
        </button>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', marginTop: 2 }}>
        เริ่มต้นชีวิตวัย 30 — คุณคือใคร?
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {CAREER_LIST.map(c => (
          <button key={c.id} onClick={() => onStart(c.id)} style={{
            textAlign: 'left', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 16, padding: 16, cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: 'var(--shadow)', transition: 'transform .12s ease, border-color .12s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--cyan)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 30 }}>{c.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.tagline}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--cyan)' }}>{fmtTH(c.startMonthly)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>บาท/เดือน</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
              {c.perks.map(p => (
                <span key={p} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: 'var(--cyan-dim)', color: 'var(--cyan)', fontWeight: 600 }}>✓ {p}</span>
              ))}
              {c.cons.map(p => (
                <span key={p} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,93,93,0.12)', color: '#ff8080', fontWeight: 600 }}>✕ {p}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6, marginBottom: 8 }}>
        เกมนี้เป็นการจำลองเพื่อการเรียนรู้ ตัวเลขถูกทำให้ง่ายกว่าชีวิตจริง<br />
        พัฒนาโดย WealthPro — เครื่องมือวางแผนการเงินสำหรับคนไทย
      </div>
    </div>
  )
}
