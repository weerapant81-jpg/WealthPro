// ── ชิ้นส่วนดีไซน์ของรายงาน (สไตล์มืออาชีพ) ──
// เดิมประกาศไว้ "ข้างใน" คอมโพเนนต์ ReportPage ทำให้ทุกครั้งที่ state เปลี่ยน (เช่น พิมพ์คอมเมนต์ 1 ตัวอักษร)
// React มองว่าเป็นคอมโพเนนต์ชนิดใหม่ แล้ว unmount/remount ทั้งซับทรีทิ้ง — ย้ายมาไว้ระดับโมดูลเพื่อให้เป็นตัวเดิมเสมอ
// หน้าตา/สไตล์เหมือนเดิมทุกจุด ย้ายมาอย่างเดียว ไม่ได้แก้อะไร

export const TEAL = '#00cfc1'
export const AMBERR = '#d97706'
export const REDR = '#dc2626'
export const GREENR = '#059669'

export type Tone = 'good' | 'warn' | 'bad'

export const Chip = ({ label, tone }: { label: string; tone: Tone }) => {
  const c = tone === 'good' ? GREENR : tone === 'warn' ? AMBERR : REDR
  return <span style={{ padding: '3px 10px', borderRadius: 6, background: `${c}14`, color: c, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
}

export const PBar = ({ pct, tone }: { pct: number; tone: Tone }) => (
  <div style={{ width: '100%', height: 6, borderRadius: 999, background: '#f1f5f9', margin: '10px 0 12px', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.max(3, Math.min(100, pct))}%`, borderRadius: 999, background: tone === 'good' ? TEAL : tone === 'warn' ? '#f59e0b' : '#ef4444' }} />
  </div>
)

export const MiniRow = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px', borderBottom: '1px solid #f8fafc', fontSize: 12.5 }}>
    <span style={{ color: '#64748b' }}>{l}</span>
    <span style={{ fontWeight: strong ? 800 : 700, color: '#0f172a', fontFamily: 'monospace' }}>{v}</span>
  </div>
)

export const DomainCard = ({ no, title, status, pct, rows, advice }: {
  no: number; title: string; status: { label: string; tone: Tone }; pct: number; rows: [string, string][]; advice?: string
}) => (
  <div style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '16px 18px', breakInside: 'avoid' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
        <span style={{ color: TEAL, marginRight: 6 }}>{no}.</span>{title}
      </div>
      <Chip label={status.label} tone={status.tone} />
    </div>
    <PBar pct={pct} tone={status.tone} />
    {rows.map(([l, v], i) => <MiniRow key={i} l={l} v={v} strong={i === rows.length - 1} />)}
    {advice && <div style={{ fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.6, fontStyle: 'italic' }}>“{advice}”</div>}
  </div>
)
