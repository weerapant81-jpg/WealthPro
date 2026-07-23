// ── การวิเคราะห์สินทรัพย์ลงทุนที่มี ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line, Area, ReferenceLine } from 'recharts'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../../../lib/portfolioReturns'
import { mulberry32, toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function InvestmentAnalysis({ kind, ctx }: { kind: string; ctx: ReportCtx }) {
  const { client, invProfile, profile, retPlan, marketData, rebalQ, age, totalInv, portRet, hasSpouse, totalInvSp, portRetSp } = ctx
    // ── การวิเคราะห์สินทรัพย์ลงทุนที่มี: พอร์ตเดิม + Monte Carlo + พอร์ตแนะนำ/เปรียบเทียบ (ตรรกะเดียวกับแท็บปรับสัดส่วน · มีเวอร์ชันคู่สมรส) ──
    const isSp = kind === 'fin_invest_sp'
    if (isSp && !hasSpouse) return null
    const invAssetsList: any[] = (isSp ? invProfile?.spouseData?.investmentAssets : invProfile?.investmentAssets) ?? []
    const totalInv2 = isSp ? totalInvSp : totalInv
    const portRet2 = isSp ? portRetSp : portRet
    if (totalInv2 <= 0) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน{isSp ? 'ของคู่สมรส' : ''}</div>
    const annRet = (a: any): number | null => {
      const cost = toNum(a.investAmount), val = toNum(a.currentValue)
      if (cost > 0 && val > 0 && a.investDate) {
        const st = new Date(a.investDate)
        if (!isNaN(st.getTime())) {
          const yrs = (Date.now() - st.getTime()) / (365.25 * 24 * 3600 * 1000)
          if (yrs >= 1 / 365.25) return (Math.pow(val / cost, 1 / yrs) - 1) * 100
        }
      }
      const m = parseFloat(a.annualReturn)
      return isNaN(m) ? null : m
    }
    const rpKey = isSp ? 'spouse' : 'self'
    const curAge = (isSp ? retPlan?.spouse?.currentAge ?? client?.spouseAge : retPlan?.self?.currentAge ?? age) ?? 45
    const lifeExp = (isSp ? profile?.lifeExpectancySpouse : profile?.lifeExpectancySelf) ?? retPlan?.[rpKey]?.lifeExpectancy ?? 85
    const retAge = (isSp ? profile?.retirementAgeSpouse : profile?.retirementAgeSelf) ?? retPlan?.[rpKey]?.retirementAge ?? 60
    const years = Math.max(1, lifeExp - curAge)
    const riskSrc2 = isSp ? profile?.spouseRisk : profile
    const riskLabel = String(riskSrc2?.riskLabel ?? riskSrc2?.riskLevel ?? '')
    const curSd = /สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (portRet2 >= 8 ? 16 : portRet2 >= 4 ? 11 : 6)
    const pctile = (arr: number[], q: number) => { const idx = (arr.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? arr[lo] : arr[lo] + (arr[hi] - arr[lo]) * (idx - lo) }
    const simulate = (mu0: number, sd0: number, seed: number) => {
      const mu = mu0 / 100, sd = sd0 / 100
      const rng = mulberry32(seed >>> 0 || 1)
      const byYear: number[][] = Array.from({ length: years + 1 }, () => [])
      for (let k2 = 0; k2 < 600; k2++) {
        let v = totalInv2
        byYear[0].push(v)
        for (let y = 1; y <= years; y++) {
          let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
          v *= Math.exp((mu - sd * sd / 2) + sd * z)
          byYear[y].push(v)
        }
      }
      return byYear.map(arr => { const so = arr.slice().sort((x, y2) => x - y2); return { p10: pctile(so, 0.1), p50: pctile(so, 0.5), p90: pctile(so, 0.9) } })
    }
    const seedB = (Math.round(totalInv2) ^ (years << 4)) >>> 0
    const curSim = simulate(portRet2, curSd, seedB ^ 0x1111)
    const curRows = curSim.map((c2, i2) => ({ age: curAge + i2, ค่ากลาง: Math.round(c2.p50), band: [Math.round(c2.p10), Math.round(c2.p90)] as [number, number] }))
    const rIdx = Math.min(Math.max(0, retAge - curAge), years)
    // พอร์ตแนะนำ + พอร์ตที่เลือกไว้ (จากแท็บการปรับสัดส่วนลงทุน)
    const assetsMk = applyMarketData(DEFAULT_ASSETS, marketData)
    const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
    const ports = PORTFOLIO_SETS.map(set => {
      const results = set.options.map(o => computePortfolio(o.weights, assetsMk, matrix))
      const bi = results.reduce((b, r, i2) => r.sharpe > results[b].sharpe ? i2 : b, 0)
      return { id: set.id, label: set.label, sub: set.sub, color: set.color, weights: set.options[bi].weights, ...results[bi] }
    })
    const selTier = rebalQ?.[rpKey]?.tier ?? null
    const selP = ports.find(p2 => p2.id === selTier) ?? null
    const newSim = selP ? simulate(selP.ret, selP.sigma, seedB ^ 0x2222) : null
    const cmpRows = newSim ? curSim.map((c2, i2) => ({ age: curAge + i2, พอร์ตเดิม: Math.round(c2.p50), พอร์ตใหม่: Math.round(newSim[i2].p50), band: [Math.round(newSim[i2].p10), Math.round(newSim[i2].p90)] as [number, number] })) : null
    const W_LBL2 = ['ตราสารหนี้', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ']
    const W_CLR2 = ['#0284c7', GREENR, AMBERR, '#f43f5e']
    const subH2: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '18px 0 10px' }
    const tdI: React.CSSProperties = { padding: '5px 10px', fontSize: 11.5, color: '#334155' }
    const StatC = ({ l, v, c }: { l: string; v: string; c: string }) => (
      <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        {/* ── 1. การจัดสัดส่วนการลงทุนเดิม ── */}
        <div style={{ ...subH2, marginTop: 0 }}>การจัดสัดส่วนการลงทุนเดิม</div>
        <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10, breakInside: 'avoid' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['สินทรัพย์', 'ประเภท', 'ผลตอบแทน/ปี', 'มูลค่าปัจจุบัน'].map((h, i2) => (
                  <th key={h} style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 >= 2 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invAssetsList.filter((a: any) => toNum(a.currentValue) > 0).map((a: any, i2: number) => {
                const r = annRet(a)
                return (
                  <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={tdI}>{a.assetName || `สินทรัพย์ที่ ${i2 + 1}`}</td>
                    <td style={{ ...tdI, color: '#94a3b8' }}>{a.assetClass || '—'}</td>
                    <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: r == null ? '#94a3b8' : r >= 0 ? GREENR : REDR }}>{r == null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}%`}</td>
                    <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(toNum(a.currentValue))}</td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                <td colSpan={3} style={{ ...tdI, fontWeight: 800, color: '#0f172a' }}>รวม</td>
                <td style={{ ...tdI, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: TEAL }}>{fmt(totalInv2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
          <StatC l="มูลค่าสินทรัพย์ลงทุน" v={`฿${fmt(totalInv2)}`} c={TEAL} />
          <StatC l="ผลตอบแทนพอร์ต (ต่อปี)" v={`${portRet2.toFixed(2)}%`} c={AMBERR} />
          <StatC l="อายุปัจจุบัน" v={`${curAge} ปี`} c="#0f172a" />
          <StatC l="อายุขัยที่คาดไว้" v={`${lifeExp} ปี`} c="#0f172a" />
        </div>
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px', breakInside: 'avoid' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>มูลค่าสินทรัพย์ลงทุนในอนาคต — Monte Carlo (เส้น = ค่ากลาง · แถบ = ช่วง P10–P90)</div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={curRows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={38} />
                <Tooltip formatter={(v: any) => Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                <ReferenceLine x={retAge} stroke={AMBERR} strokeDasharray="4 3" label={{ value: `เกษียณ ${retAge}`, position: 'insideTopLeft', fontSize: 9.5, fill: AMBERR }} />
                <Area isAnimationActive={false} dataKey="band" stroke="none" fill={TEAL} fillOpacity={0.15} />
                <Line isAnimationActive={false} dataKey="ค่ากลาง" stroke={TEAL} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '10px 0 4px' }}>
          <StatC l={`ดี (P90) ณ เกษียณ อายุ ${retAge}`} v={fmt(curSim[rIdx].p90)} c={GREENR} />
          <StatC l="ค่ากลาง (P50) ณ เกษียณ" v={fmt(curSim[rIdx].p50)} c="#0f172a" />
          <StatC l="แย่ (P10) ณ เกษียณ" v={fmt(curSim[rIdx].p10)} c={REDR} />
        </div>

        {/* ── 2. สัดส่วนการลงทุนแนะนำ ── */}
        <div style={subH2}>สัดส่วนการลงทุนแนะนำ</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          {ports.map(p2 => {
            const active = p2.id === selTier
            return (
              <div key={p2.id} style={{ border: active ? `2px solid ${p2.color}` : '1px solid #f1f5f9', background: active ? `${p2.color}0a` : 'transparent', borderRadius: 12, padding: '10px 12px', position: 'relative', breakInside: 'avoid' }}>
                {active && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9.5, fontWeight: 800, color: '#fff', background: p2.color, borderRadius: 999, padding: '2px 8px' }}>พอร์ตที่เลือก ✓</span>}
                <div style={{ fontSize: 12.5, fontWeight: 800, color: p2.color }}>{p2.label}</div>
                <div style={{ fontSize: 9.5, color: '#94a3b8', marginBottom: 6 }}>{p2.sub}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 8 }}>
                  {p2.weights.map((w, i2) => (
                    <div key={i2} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 7.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{W_LBL2[i2]}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a' }}>{w}%</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                  {([['E(Rp)', `+${p2.ret.toFixed(2)}%`, GREENR], ['σ', `${p2.sigma.toFixed(2)}%`, AMBERR], ['Sharpe', p2.sharpe.toFixed(2), '#0f172a']] as const).map(([l, v, c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8.5, color: '#94a3b8' }}>{l}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {selP && cmpRows && newSim ? (
          <>
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 12px', marginBottom: 10, breakInside: 'avoid' }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>จัดสัดส่วนเงินลงทุนปัจจุบัน ฿{fmt(totalInv2)} ตาม{selP.label}</div>
              <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                {selP.weights.map((w, i2) => w > 0 && <div key={i2} style={{ width: `${w}%`, background: W_CLR2[i2] }} />)}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  {selP.weights.map((w, i2) => (
                    <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '4px 8px', color: '#334155' }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 999, background: W_CLR2[i2], marginRight: 7 }} />{W_LBL2[i2]}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{w}%</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(totalInv2 * w / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <StatC l={`พอร์ตเดิม — ค่ากลาง ณ เกษียณ (อายุ ${retAge})`} v={`฿${fmt(curSim[rIdx].p50)}`} c={AMBERR} />
              <StatC l={`พอร์ตใหม่ (${selP.label}) — ค่ากลาง ณ เกษียณ`} v={`฿${fmt(newSim[rIdx].p50)}`} c={selP.color} />
              <StatC l="ส่วนต่างค่ากลาง ณ เกษียณ" v={`${newSim[rIdx].p50 >= curSim[rIdx].p50 ? '+' : '−'}฿${fmt(Math.abs(newSim[rIdx].p50 - curSim[rIdx].p50))}`} c={newSim[rIdx].p50 >= curSim[rIdx].p50 ? GREENR : REDR} />
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 12px 4px', breakInside: 'avoid' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>เปรียบเทียบมูลค่าอนาคต — พอร์ตเดิม vs พอร์ตใหม่ (แถบ = ช่วง P10–P90 พอร์ตใหม่)</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cmpRows} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="age" tick={{ fontSize: 9.5, fill: '#94a3b8' }} interval={4} />
                    <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 9.5, fill: '#94a3b8' }} width={38} />
                    <Tooltip formatter={(v: any) => Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `${fmt(v)} บาท`} labelFormatter={(l: any) => `อายุ ${l} ปี`} />
                    <Legend wrapperStyle={{ fontSize: 10.5 }} />
                    <ReferenceLine x={retAge} stroke={AMBERR} strokeDasharray="4 3" />
                    <Area isAnimationActive={false} dataKey="band" name="ช่วง 80% (พอร์ตใหม่)" stroke="none" fill={selP.color} fillOpacity={0.13} />
                    <Line isAnimationActive={false} dataKey="พอร์ตเดิม" stroke={AMBERR} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    <Line isAnimationActive={false} dataKey="พอร์ตใหม่" stroke={selP.color} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p style={{ fontSize: 10.5, color: '#94a3b8', lineHeight: 1.7, marginTop: 8 }}>
              * พอร์ตเดิมใช้ผลตอบแทนถัวเฉลี่ยจากสินทรัพย์จริง {portRet2.toFixed(2)}%/ปี ความผันผวน {curSd}% · พอร์ตใหม่ใช้ E(Rp) {selP.ret.toFixed(2)}%/ปี σ {selP.sigma.toFixed(2)}% · การจำลองเพื่อเปรียบเทียบ ไม่ใช่การรับประกันผลตอบแทน
            </p>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '10px 14px' }}>
            ยังไม่ได้เลือกพอร์ตเป้าหมาย — เลือกได้ที่เมนู "มูลค่าสินทรัพย์ลงทุน → การปรับสัดส่วนลงทุน" แล้วหน้านี้จะแสดงการจัดสัดส่วนใหม่และกราฟเปรียบเทียบอัตโนมัติ
          </div>
        )}
      </div>
    )
}
