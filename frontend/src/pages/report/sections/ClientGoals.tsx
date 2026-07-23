// ── เป้าหมายทางการเงินของลูกค้า ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { toNum } from '@shared/finance/math'
import { TEAL } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function ClientGoals({ ctx }: { ctx: ReportCtx }) {
  const { client, hasSpouse } = ctx
    // ── เป้าหมายทางการเงินที่ลูกค้ากรอก: 3 ด้าน (ประกัน/การศึกษา/เกษียณ) + 3 ระยะเวลา ──
    const GG = [
      { k: 'insurance',  label: 'ความเสี่ยง & ประกัน', color: '#e11d48' },
      { k: 'education',  label: 'ทุนการศึกษาบุตร',      color: '#d97706' },
      { k: 'retirement', label: 'การเกษียณ',            color: '#0891b2' },
      { k: 'short',      label: 'ระยะสั้น (≤3 ปี)',     color: '#059669' },
      { k: 'medium',     label: 'ระยะกลาง (3–7 ปี)',    color: '#0ea5e9' },
      { k: 'long',       label: 'ระยะยาว (>7 ปี)',      color: '#7c3aed' },
    ]
    const fg = client?.financialGoals || {}
    const pick = (o: 'self' | 'spouse') => (fg.self || fg.spouse) ? fg[o] : (o === 'self' ? fg : null)
    const collect = (g: any) => {
      const out: { area: string; color: string; name: string; when: string; amount: number }[] = []
      if (!g) return out
      GG.forEach(grp => (g[grp.k] ?? []).forEach((r: any) => {
        if (!r?.name?.trim()) return
        const td = r.targetDate ? String(r.targetDate).trim() : ''
        out.push({ area: grp.label, color: grp.color, name: r.name, when: td ? (/^\d+$/.test(td) ? `ภายใน ${td} ปี` : td) : '—', amount: toNum(r.targetAmount) })
      }))
      return out
    }
    const selfNameG = `คุณ${client?.firstName || 'ลูกค้า'}`
    const spouseNameG = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
    const ppl = [{ name: selfNameG, rows: collect(pick('self')) }, ...(hasSpouse ? [{ name: spouseNameG, rows: collect(pick('spouse')) }] : [])].filter(p2 => p2.rows.length)
    const th: React.CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 700, color: '#64748b', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }
    const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: '#1e293b', borderBottom: '1px solid #f1f5f9' }
    if (ppl.length === 0) return <div style={{ fontSize: 13, color: '#64748b' }}>ยังไม่มีเป้าหมายที่บันทึกไว้ — กรอกที่หน้าเป้าหมายทางการเงิน</div>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {ppl.map((p2, idx) => {
          const total = p2.rows.reduce((s, r) => s + r.amount, 0)
          return (
            <div key={idx}>
              {hasSpouse && <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>เป้าหมายของ {p2.name}</div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                <thead><tr style={{ background: '#f8fafc' }}>
                  <th style={th}>ด้าน / ระยะเวลา</th>
                  <th style={th}>เป้าหมาย</th>
                  <th style={th}>ระยะเวลาที่ต้องการ</th>
                  <th style={{ ...th, textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                </tr></thead>
                <tbody>
                  {p2.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: r.color, marginRight: 7 }} />{r.area}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                      <td style={{ ...td, color: '#64748b' }}>{r.when}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0fdfa' }}>
                    <td style={{ ...td, fontWeight: 800, color: '#0f172a', borderBottom: 'none' }} colSpan={3}>รวมเป้าหมายทั้งหมด</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: TEAL, borderBottom: 'none' }}>{fmt(total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    )
}
