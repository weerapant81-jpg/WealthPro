// ── พอร์ตการลงทุนที่แนะนำ ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid } from 'recharts'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../../../lib/portfolioReturns'
import { AMBERR, GREENR } from '../primitives'
import type { ReportCtx } from '../ctx'

export default function PortfolioReco({ ctx }: { ctx: ReportCtx }) {
  const { marketData } = ctx
    // พอร์ตแนะนำ 3 ระดับความเสี่ยง — ทางเลือกที่ Sharpe สูงสุดของแต่ละชุด (ข้อมูลตลาดล่าสุดถ้ามี)
    const assets = applyMarketData(DEFAULT_ASSETS, marketData)
    const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
    const W_LBL = ['ตราสารหนี้', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ']
    // จุดทุกทางเลือก (9 จุด) สำหรับ Efficient Frontier + ไฮไลต์พอร์ตแนะนำ (Sharpe สูงสุดของแต่ละชุด)
    const frontier = PORTFOLIO_SETS.flatMap(set => {
      const results = set.options.map(o => computePortfolio(o.weights, assets, matrix))
      const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
      return results.map((r, i2) => ({ x: +r.sigma.toFixed(2), y: +r.ret.toFixed(2), color: set.color, best: i2 === bi, name: `${set.label} · ${set.options[i2].label}` }))
    })
    return (
      <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {PORTFOLIO_SETS.map(set => {
          const results = set.options.map(o => computePortfolio(o.weights, assets, matrix))
          const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
          const best = results[bi], w = set.options[bi].weights
          return (
            <div key={set.id} style={{ border: `1px solid ${set.color}44`, borderRadius: 12, padding: '12px 14px', breakInside: 'avoid' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: set.color }}>{set.label}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>{set.sub} · {set.options[bi].label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                {w.map((wt, i2) => (
                  <div key={i2} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{W_LBL[i2]}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{wt}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                {([['ผลตอบแทน', `+${best.ret.toFixed(2)}%`, GREENR], ['ความผันผวน σ', `${best.sigma.toFixed(2)}%`, AMBERR], ['Sharpe', best.sharpe.toFixed(2), '#0f172a']] as const).map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#94a3b8' }}>{l}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* สมมติฐานผลตอบแทนและความเสี่ยง */}
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: '6px 0 8px' }}>สมมติฐานผลตอบแทนและความเสี่ยง (ย้อนหลัง 10 ปี)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
              {['ประเภทสินทรัพย์', 'CAGR (%)', 'SD (%)'].map((h, i2) => (
                <th key={h} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{assets.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '5px 8px', color: '#334155' }}>{a.name}{a.live && <span style={{ marginLeft: 5, fontSize: 8.5, fontWeight: 800, color: GREENR, background: `${GREENR}14`, borderRadius: 4, padding: '1px 5px' }}>LIVE</span>}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: GREENR }}>{a.cagr.toFixed(2)}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: AMBERR }}>{a.sd > 0 ? a.sd.toFixed(2) : '—'}</td>
            </tr>
          ))}</tbody>
        </table>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', marginBottom: 4 }}>ค่าสัมประสิทธิ์สหสัมพันธ์ (Correlation)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
            <thead>
              <tr>{[''].concat(W_LBL).map((h, i2) => <th key={i2} style={{ padding: '3px 5px', fontSize: 9, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>)}</tr>
            </thead>
            <tbody>{W_LBL.map((rl, ri) => (
              <tr key={rl} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '3px 5px', fontWeight: 700, color: '#475569' }}>{rl}</td>
                {W_LBL.map((_, ci) => (
                  <td key={ci} style={{ padding: '3px 5px', textAlign: 'right', fontFamily: 'monospace', color: ci > ri ? '#e2e8f0' : Math.abs(matrix[ri][ci]) >= 0.5 && ri !== ci ? AMBERR : '#334155', fontWeight: ri === ci ? 800 : 600 }}>
                    {ci > ri ? '—' : matrix[ri][ci].toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {/* Efficient Frontier */}
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>Efficient Frontier</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>ผลตอบแทนคาดหวัง vs ความเสี่ยง — จุดใหญ่คือพอร์ตแนะนำของแต่ละระดับ (Sharpe สูงสุด)</div>
      <div style={{ height: 230, background: '#f8fafc', borderRadius: 12, padding: '8px 8px 0' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="ความเสี่ยง σ" unit="%" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis type="number" dataKey="y" name="ผลตอบแทน" unit="%" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
            <Tooltip content={({ payload }: any) => payload?.length ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{payload[0].payload.name}</div>
                <div style={{ color: '#475569' }}>ผลตอบแทน {payload[0].payload.y}% · σ {payload[0].payload.x}%</div>
              </div>
            ) : null} />
            <Scatter isAnimationActive={false} data={frontier}>
              {frontier.map((pt, i2) => <Cell key={i2} fill={pt.color} stroke={pt.best ? '#0f172a' : 'none'} strokeWidth={pt.best ? 2 : 0} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, fontSize: 10.5, color: '#64748b' }}>
        {PORTFOLIO_SETS.map(set => <span key={set.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: set.color }} />{set.label}</span>)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid #0f172a' }} />พอร์ตแนะนำ</span>
      </div>
      </div>
    )
}
