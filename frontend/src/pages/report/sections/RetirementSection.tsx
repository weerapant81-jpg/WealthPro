// ── ความต้องการทางการเงินเพื่อการเกษียณ ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, ReferenceLine } from 'recharts'
import { TEAL, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function RetirementSection({ ctx }: { ctx: ReportCtx }) {
  const { client, retR, retRSp, hasSpouse } = ctx
    const persons = [
      { name: `คุณ${client?.firstName || 'ลูกค้า'}`, r: retR, tint: TEAL },
      ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', r: retRSp, tint: '#8b5cf6' }] : []),
    ].filter(p => p.r)
    if (!persons.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลแผนเกษียณ</div>
    const Stat = ({ l, v, c }: { l: string; v: number; c: string }) => (
      <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
        <div style={{ fontSize: 14.5, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{fmt(v)}</div>
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        {persons.map(p => {
          const R3 = p.r!
          const noSaveByAge = new Map<number, number>((R3.projectionRowsNoSave ?? []).map((row: any) => [row.age, Math.round(row.phase === 'accumulation' ? (row.totalAccum ?? 0) : (row.closeBalance ?? 0))]))
          const chart = (R3.projectionRows ?? []).map((row: any) => ({
            age: row.age,
            มูลค่ารวม: Math.round(row.phase === 'accumulation' ? (row.totalAccum ?? 0) : (row.closeBalance ?? 0)),
            ไม่ออมเพิ่ม: Math.max(0, noSaveByAge.get(row.age) ?? 0),
            ค่าใช้จ่าย: row.phase === 'retirement' ? Math.round((row.withdrawalLiving ?? 0) + (row.withdrawalGoals ?? 0)) : 0,
          }))
          return (
            <div key={p.name} style={{ marginBottom: 20, breakInside: 'avoid' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.tint, borderLeft: `5px solid ${p.tint}`, paddingLeft: 10, marginBottom: 10 }}>เงินเกษียณที่ต้องการ · {p.name} (เกษียณอายุ {R3.retireAge} ปี)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
                <Stat l="เงินเกษียณที่ต้องการ" v={R3.needed} c="#0f172a" />
                <Stat l="มูลค่าสินทรัพย์ที่มี" v={R3.have} c={GREENR} />
                <Stat l="ส่วนที่ยังขาด" v={R3.gap} c={R3.gap > 0 ? REDR : GREENR} />
                <Stat l="ต้องออมเพิ่ม (เท่ากันทุกปี)" v={R3.annualSavings} c="#0284c7" />
                <Stat l="ออมเพิ่มขึ้นทุกปี (ปีแรก)" v={R3.gradFirst} c="#8b5cf6" />
              </div>
              {chart.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>การคาดการณ์มูลค่าเงินในอนาคต (สะสม → ใช้เงินหลังเกษียณ)</div>
                  <div style={{ height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                        <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={34} />
                        <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                        <Legend wrapperStyle={{ fontSize: 10.5 }} />
                        <ReferenceLine x={R3.retireAge} stroke={p.tint} strokeDasharray="4 3" />
                        <Bar isAnimationActive={false} dataKey="ค่าใช้จ่าย" barSize={4} fill="#f59e0bb0" />
                        <Line isAnimationActive={false} dataKey="ไม่ออมเพิ่ม" name="มูลค่ารวม (กรณีไม่ออมเพิ่ม)" stroke={REDR} strokeWidth={1.8} strokeDasharray="6 4" dot={false} />
                        <Line isAnimationActive={false} dataKey="มูลค่ารวม" name="มูลค่ารวม (ออมตามแผน)" stroke={p.tint} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
}
