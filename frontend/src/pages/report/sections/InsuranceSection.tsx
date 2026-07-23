// ── การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function InsuranceSection({ ctx }: { ctx: ReportCtx }) {
  const { client, insR, insRSp, covSelf, covSp, secs, setText, hasSpouse } = ctx
    // ── การวิเคราะห์ความเสี่ยงภัยและความต้องการด้านการประกันภัย (ตามเอกสารตัวอย่าง) ──
    const persons = [
      { name: `คุณ${client?.firstName || 'ลูกค้า'}`, cov: covSelf, ins: insR, tint: TEAL },
      ...(hasSpouse ? [{ name: client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส', cov: covSp, ins: insRSp, tint: '#8b5cf6' }] : []),
    ]
    const subH: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '20px 0 10px' }
    // ตารางแนะนำแบบประกัน (พิมพ์ได้ · เก็บใน secs.ins_reco เป็นบรรทัด "แบบ|คุ้มครอง|เบี้ย")
    const recoLines = (secs['ins_reco']?.text || '').split('\n')
    const recoRow = (i2: number): string[] => (recoLines[i2] || '').split('|')
    const setReco = (i2: number, c: number, v: string) => {
      const rows = Array.from({ length: 5 }, (_, k) => recoRow(k))
      rows[i2][c] = v
      setText('ins_reco', rows.map(r => [r[0] || '', r[1] || '', r[2] || ''].join('|')).join('\n'))
    }
    const recoInp: React.CSSProperties = { width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12.5, color: '#1e293b', padding: '2px 0' }
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...subH, marginTop: 0 }}>ความคุ้มครองที่มี</div>
        <div style={{ display: 'grid', gridTemplateColumns: persons.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
          {persons.map(p => (
            <div key={p.name} style={{ border: '1px solid #f1f5f9', borderRadius: 12, padding: '12px 14px', breakInside: 'avoid' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: p.tint, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, height: 170 }}>
                  {p.cov.hasPolicies ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={p.cov.radarData} outerRadius="68%">
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: '#64748b' }} />
                        <Radar isAnimationActive={false} name="ความคุ้มครองที่มี" dataKey="actual" stroke={p.tint} strokeWidth={2} fill={p.tint} fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: '#94a3b8' }}>ยังไม่มีกรมธรรม์</div>}
                </div>
                <div style={{ width: 118, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ textAlign: 'center', background: '#f8fafc', borderRadius: 8, padding: '6px 4px' }}>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>คะแนนคุ้มครอง</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: p.cov.avg >= 70 ? GREENR : p.cov.avg >= 40 ? AMBERR : REDR }}>{p.cov.avg}</div>
                  </div>
                  {p.ins && ([['ทุนที่ควรมี', p.ins.need, AMBERR], ['มีอยู่', p.ins.have, GREENR], ['ยังขาด', p.ins.gap, p.ins.gap > 0 ? REDR : GREENR]] as const).map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: c }}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
              {p.cov.radarData.some((d: any) => toNum(d.amount) > 0) && (
                <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', marginBottom: 3 }}>ความคุ้มครองที่มี (แยกประเภท)</div>
                  {p.cov.radarData.filter((d: any) => toNum(d.amount) > 0).map((d: any) => (
                    <div key={d.subject} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#475569', padding: '2px 0' }}>
                      <span>{d.subject}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(toNum(d.amount))} บาท</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={subH}>ทุนประกันที่ควรทำเพิ่ม</div>
        <div style={{ display: 'grid', gridTemplateColumns: persons.length > 1 ? '1fr 1fr' : '1fr', gap: 16 }}>
          {persons.map(p => p.ins && (
            <div key={p.name} style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', breakInside: 'avoid' }}>
              <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12.5, fontWeight: 800, color: p.tint }}>{p.name}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['วิธีคำนวณ', 'ทุนที่ควรมี', 'มีอยู่', 'ยังขาด'].map((h, i2) => (
                      <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Human Life Value', p.ins.hlvNeed, p.ins.hlvGap, p.ins.method === 'hlv'],
                    ['Need Base Analysis', p.ins.needsNeed, p.ins.needsGap, p.ins.method !== 'hlv'],
                    ['ทุนทุพพลภาพ', p.ins.disNeed, p.ins.disGap, false],
                  ] as const).map(([l, need, gap, sel]) => (
                    <tr key={String(l)} style={{ borderBottom: '1px solid #f8fafc', background: sel ? '#f0fdfa' : 'transparent' }}>
                      <td style={{ padding: '6px 8px', color: sel ? '#0f172a' : '#64748b', fontWeight: sel ? 800 : 400 }}>{sel ? '☑ ' : ''}{l}{sel ? ' (วิธีที่เลือก)' : ''}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: AMBERR, fontWeight: 700 }}>{fmt(need as number)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: GREENR, fontWeight: 700 }}>{fmt(l === 'ทุนทุพพลภาพ' ? p.ins!.disHave : p.ins!.have)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: (gap as number) > 0 ? REDR : GREENR, fontWeight: 800 }}>{fmt(gap as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div style={subH}>แบบประกันและเบี้ยประกันที่แนะนำ</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
              <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'left' }}>แบบประกัน</th>
              <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'right', width: 150 }}>ความคุ้มครอง</th>
              <th style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: 'right', width: 160 }}>เบี้ยประกันโดยประมาณ</th>
            </tr>
          </thead>
          <tbody>{Array.from({ length: 5 }, (_, i2) => (
            <tr key={i2} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[0] || ''} onChange={e => setReco(i2, 0, e.target.value)} placeholder="พิมพ์ชื่อแบบประกัน..." style={recoInp} /></td>
              <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[1] || ''} onChange={e => setReco(i2, 1, e.target.value)} style={{ ...recoInp, textAlign: 'right', fontFamily: 'monospace' }} /></td>
              <td style={{ padding: '4px 10px' }}><input value={recoRow(i2)[2] || ''} onChange={e => setReco(i2, 2, e.target.value)} style={{ ...recoInp, textAlign: 'right', fontFamily: 'monospace' }} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    )
}
