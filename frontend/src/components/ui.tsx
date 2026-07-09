import type { CSSProperties, ReactNode, ElementType } from 'react'

/* ── WealthPro shared UI kit ───────────────────────────────────────────
   ภาษาการออกแบบเดียวกันทั้งแอป (ธีม Pro Wealth Dark)
   ใช้ inline styles + CSS variables · ไม่มี Tailwind
   นำเข้า: import { PageHeader, Card, SectionTitle, appearKeyframes } from '../components/ui'
------------------------------------------------------------------------- */

export const appearKeyframes = `@keyframes fpAppear{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`

/** หัวหน้าเพจ: ไอคอนในกล่องสี + ชื่อ + คำบรรยาย + ช่องขวา (เช่น ปุ่ม/สลับคน) */
export function PageHeader({ icon: Icon, title, subtitle, accent = 'var(--cyan)', right }: {
  icon: ElementType; title: string; subtitle?: ReactNode; accent?: string; right?: ReactNode
}) {
  const soft = accent === 'var(--cyan)' ? 'var(--cyan-dim)' : `${accent}22`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={21} style={{ color: accent }} />
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

/** การ์ดมาตรฐาน */
export function Card({ children, style, accent, className }: { children: ReactNode; style?: CSSProperties; accent?: string; className?: string }) {
  return (
    <div className={className} style={{
      position: 'relative', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 14, padding: 20, boxShadow: 'var(--shadow)', overflow: 'hidden', ...style,
    }}>
      {accent && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />}
      {children}
    </div>
  )
}

/** หัวข้อย่อยในการ์ด: ไอคอน + ชื่อ + คำอธิบาย */
export function SectionTitle({ icon: Icon, title, sub, accent = 'var(--cyan)' }: {
  icon: ElementType; title: string; sub?: string; accent?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${accent === 'var(--cyan)' ? 'var(--cyan-dim)' : accent + '1f'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color: accent }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  )
}

/** ป้ายเล็ก uppercase สำหรับหัวข้อโซน */
export const microLabel: CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-muted)' }
