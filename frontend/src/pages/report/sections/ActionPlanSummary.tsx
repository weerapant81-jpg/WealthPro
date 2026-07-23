// ── สรุปแผนดำเนินการ ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { toNum } from '@shared/finance/math'
import { AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function ActionPlanSummary({ ctx }: { ctx: ReportCtx }) {
  const { actionItems } = ctx
    // ── สรุปแผนดำเนินการ (หน้าใหม่) + ไทม์ไลน์ — ดึงจากแผนปฏิบัติการ ──
    const ownerTh = (o: string) => o === 'client' ? 'ลูกค้า' : o === 'advisor' ? 'ที่ปรึกษา' : o === 'spouse' ? 'คู่สมรส' : (o || '')
    const PR_LBL: Record<string, string> = { high: 'สูง', medium: 'กลาง', low: 'ต่ำ' }
    type Ln = { plan: string; amount: number; schedule: string; owner: string; priority: string; done: boolean }
    const lines: Ln[] = []
    for (const it of actionItems) {
      const rows: any[] = Array.isArray(it.subPlan) ? it.subPlan : []
      const done = it.status === 'done' || !!it.completedAt
      if (!rows.length) { lines.push({ plan: it.title, amount: toNum(it.target), schedule: it.dueDate || '', owner: ownerTh(it.owner), priority: PR_LBL[it.priority] ?? '', done }); continue }
      for (const r of rows) {
        const plan = String(r?.desc || r?.method || r?.who || '').trim()
        const amount = toNum(r?.amount ?? r?.premium)
        if (!plan && amount <= 0 && !r?.schedule) continue
        lines.push({ plan: plan || it.title, amount, schedule: r?.schedule || '', owner: String(r?.owner || '').trim() || ownerTh(it.owner), priority: String(r?.priority || '') || (PR_LBL[it.priority] ?? ''), done: !!r?.done || done })
      }
    }
    const PR_ORD: Record<string, number> = { 'สูง': 0, 'กลาง': 1, 'ต่ำ': 2 }
    const PR_CLR: Record<string, string> = { 'สูง': REDR, 'กลาง': AMBERR, 'ต่ำ': '#64748b' }
    lines.sort((a, b) => (PR_ORD[a.priority] ?? 3) - (PR_ORD[b.priority] ?? 3))
    const fmtDate = (x: string) => { const d = new Date(x); return isNaN(d.getTime()) ? x : d.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) }
    const thS: React.CSSProperties = { padding: '5px 8px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textAlign: 'left' }
    const tdS: React.CSSProperties = { padding: '6px 8px', fontSize: 12, color: '#1e293b' }
    // ไทม์ไลน์: sub-plan ทุกรายการที่มี "กำหนดการ" เรียงตามวันที่
    const CAT_ACCENT: Record<string, string> = { liquidity: '#06b6d4', insurance: '#3b82f6', retirement: '#00cfc1', education: '#f59e0b', estate: '#8b5cf6' }
    const CAT_LABEL: Record<string, string> = { liquidity: 'สภาพคล่อง', insurance: 'ประกัน', retirement: 'เกษียณ', education: 'การศึกษา', estate: 'มรดก' }
    const tl: { date: Date; title: string; desc: string; amount: number; accent: string; cat: string }[] = []
    for (const a of actionItems) {
      const rows: any[] = Array.isArray(a.subPlan) ? a.subPlan : []
      for (const r of rows) {
        if (!r?.schedule) continue
        const d = new Date(r.schedule); if (isNaN(d.getTime())) continue
        tl.push({ date: d, title: a.title, desc: String(r.desc || r.method || r.who || '').trim(), amount: toNum(r.amount ?? r.premium ?? r.sumInsured ?? 0), accent: CAT_ACCENT[a.category] ?? '#64748b', cat: CAT_LABEL[a.category] ?? (a.category || '') })
      }
    }
    tl.sort((x, y) => x.date.getTime() - y.date.getTime())
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* ตารางสรุป */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>สรุปแผนดำเนินการ</div>
          {lines.length === 0
            ? <div style={{ fontSize: 12, color: '#94a3b8' }}>ยังไม่มีรายการในแผนปฏิบัติการ</div>
            : <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    <th style={{ ...thS, width: 24 }} />
                    <th style={thS}>แผนดำเนินการ</th>
                    <th style={{ ...thS, textAlign: 'right' }}>จำนวนเงิน</th>
                    <th style={thS}>กำหนดการ</th>
                    <th style={thS}>ผู้รับผิดชอบ</th>
                    <th style={thS}>ความสำคัญ</th>
                  </tr>
                </thead>
                <tbody>{lines.map((l, i2) => (
                  <tr key={i2} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdS, fontSize: 13, color: l.done ? GREENR : '#94a3b8' }}>{l.done ? '☑' : '☐'}</td>
                    <td style={{ ...tdS, color: l.done ? '#94a3b8' : '#1e293b', textDecoration: l.done ? 'line-through' : 'none' }}>{l.plan}</td>
                    <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: l.amount > 0 ? '#0f172a' : '#94a3b8' }}>{l.amount > 0 ? fmt(l.amount) : '—'}</td>
                    <td style={{ ...tdS, color: '#475569' }}>{l.schedule ? fmtDate(l.schedule) : '—'}</td>
                    <td style={{ ...tdS, color: '#475569' }}>{l.owner || '—'}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: PR_CLR[l.priority] || '#94a3b8' }}>{l.priority || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>}
        </div>
        {/* ไทม์ไลน์แผนดำเนินการ */}
        {tl.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>ไทม์ไลน์แผนดำเนินการ</div>
            <div>
              {tl.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  {/* เส้น + จุด */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 999, background: t.accent, marginTop: 3, boxShadow: `0 0 0 3px ${t.accent}22` }} />
                    {i < tl.length - 1 && <div style={{ width: 2, flex: 1, background: '#e2e8f0', margin: '2px 0' }} />}
                  </div>
                  {/* เนื้อหา */}
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: i < tl.length - 1 ? 14 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: t.accent }}>{t.date.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' })} · {t.cat}</span>
                      {t.amount > 0 && <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(t.amount)} บาท</span>}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginTop: 1 }}>{t.title}</div>
                    {t.desc && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1, overflowWrap: 'anywhere' }}>{t.desc}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
}
