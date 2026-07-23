// ── การวิเคราะห์ภาษีเงินได้ ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { calc as calcTaxCalc, defaultState as defaultTaxState, expenseFor, BRACKETS, type TaxState } from '../../../lib/tax'
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function TaxSection({ ctx }: { ctx: ReportCtx }) {
  const { client, taxPlanQ, hasSpouse } = ctx
    // ── การวิเคราะห์ภาษีเงินได้ — จำลองหน้าวางแผนภาษีต่อคน ──
    const persons = [
      { name: `คุณ${client?.firstName || 'ลูกค้า'}`, st: taxPlanQ?.self, tint: TEAL },
      ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', st: taxPlanQ?.spouse, tint: '#8b5cf6' }] : []),
    ].filter(p2 => p2.st)
    if (!persons.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลแผนภาษี — กรอกที่หน้า "วางแผนภาษี" ก่อน</div>
    const INC_ROWS: { l: string; sec: string; k: string; expKey?: string }[] = [
      { l: 'เงินเดือน/ค่าจ้าง', sec: '40(1)', k: 'income40_1', expKey: 'income40_1' },
      { l: 'ค่าจ้าง/คอมมิชชั่น', sec: '40(2)', k: 'income40_2', expKey: 'income40_2' },
      { l: 'ค่าลิขสิทธิ์/Goodwill', sec: '40(3)', k: 'income40_3', expKey: 'income40_3' },
      { l: 'ดอกเบี้ย', sec: '40(4)', k: 'interest' },
      { l: 'เงินปันผล', sec: '40(4)', k: 'dividend' },
      { l: 'วิชาชีพอิสระ', sec: '40(6)', k: 'prof40_6', expKey: 'prof40_6' },
      { l: 'รับเหมา (มีค่าของ)', sec: '40(7)', k: 'income40_7', expKey: 'income40_7' },
      { l: 'ค่าเช่าทรัพย์สิน', sec: '40(5)', k: 'rental', expKey: 'rental' },
      { l: 'เงินได้อื่นๆ', sec: '40(8)', k: 'other40', expKey: 'other40' },
    ]
    const tdT: React.CSSProperties = { padding: '5px 8px', fontSize: 11.5, color: '#334155' }
    return (
      <div style={{ marginBottom: 16 }}>
        {persons.map(p2 => {
          const st = { ...defaultTaxState(), ...(p2.st as TaxState) }
          const c = calcTaxCalc(st)
          const incRows = INC_ROWS
            .map(r => ({ ...r, inc: toNum((st as any)[r.k]), exp: r.expKey ? expenseFor(st, r.expKey as any) : 0 }))
            .filter(r => r.inc > 0)
          // ภาษีแต่ละขั้นจากเงินได้สุทธิ
          const brRows = BRACKETS.map(b => ({
            label: b.rate === 0 ? `ยกเว้น · 0–${fmt(b.max)}` : `${b.rate * 100}% · ${fmt(b.min)}–${b.max > 9e9 ? 'ขึ้นไป' : fmt(b.max)}`,
            amt: c.ni > b.min ? (Math.min(c.ni, b.max) - b.min) * b.rate : null,
          })).filter(b => b.amt !== null)
          return (
            <div key={p2.name} style={{ marginBottom: 22, breakInside: 'avoid' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: p2.tint, borderLeft: `5px solid ${p2.tint}`, paddingLeft: 10, marginBottom: 10 }}>{p2.name} · ปีภาษี {new Date().getFullYear() + 543}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14 }}>
                {/* ซ้าย: เงินได้พึงประเมิน + ภาษีแต่ละขั้น */}
                <div>
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>เงินได้พึงประเมิน</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          {['ประเภทเงินได้', 'เงินได้', 'ค่าใช้จ่าย', 'หลังหักค่าใช้จ่าย'].map((h, i2) => (
                            <th key={h} style={{ padding: '4px 8px', fontSize: 9.5, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {incRows.map(r => (
                          <tr key={r.k} style={{ borderBottom: '1px solid #f8fafc' }}>
                            <td style={tdT}>{r.l} <span style={{ fontSize: 9, color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '1px 5px' }}>{r.sec}</span></td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(r.inc)}</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', color: AMBERR }}>{r.exp > 0 ? `−${fmt(r.exp)}` : '—'}</td>
                            <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>{fmt(r.inc - r.exp)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                          <td style={{ ...tdT, fontWeight: 800, color: '#0f172a' }}>รวม</td>
                          <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>{fmt(c.ti)}</td>
                          <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: AMBERR }}>−{fmt(c.expD)}</td>
                          <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>{fmt(c.ti - c.expD)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>ภาษีแต่ละขั้น (เงินได้สุทธิ {fmt(c.ni)} บาท)</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>{brRows.map(b => (
                        <tr key={b.label} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={tdT}>{b.label}</td>
                          <td style={{ ...tdT, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(b.amt as number)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
                {/* ขวา: ภาษีสุทธิ + สรุป + รายการลดหย่อน */}
                <div>
                  <div style={{ border: `1px solid ${p2.tint}55`, background: '#f0fdfa', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>ภาษีที่ต้องชำระ (สุทธิ)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: p2.tint }}>{fmt(c.netTax)} <span style={{ fontSize: 12 }}>บาท</span></div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>≈ {fmt(c.mth)} บาท/เดือน{st.prepaid > 0 ? ` · ภาษีก่อนหัก ณ ที่จ่าย ${fmt(c.tax)}` : ''}</div>
                  </div>
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>สรุป</div>
                    {([
                      ['เงินได้พึงประเมินรวม', fmt(c.ti), '#0f172a'],
                      ['หักค่าใช้จ่าย', `−${fmt(c.expD)}`, AMBERR],
                      ['หักค่าลดหย่อนรวม', `−${fmt(c.allD - c.expD)}`, AMBERR],
                      ['เงินได้สุทธิ (ฐานภาษี)', fmt(c.ni), TEAL],
                      ['อัตราภาษีขั้นสูงสุด', `${c.mr.toFixed(0)}%`, AMBERR],
                      ['อัตราภาษีเฉลี่ย', `${c.eff.toFixed(2)}%`, AMBERR],
                    ] as const).map(([l, v, col]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #f8fafc', fontSize: 11 }}>
                        <span style={{ color: '#64748b' }}>{l}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: col }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>รายการลดหย่อน</div>
                    {c.deducts.map(d => (
                      <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 10.5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: d.c, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: '#475569' }}>{d.l}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(d.v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
}
