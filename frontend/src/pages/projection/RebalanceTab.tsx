import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { ChartFrame } from '../../components/exportable'
import { card } from '../../styles/dark'
import { SlidersHorizontal, Check, Info } from 'lucide-react'
import { PORTFOLIO_SETS, DEFAULT_ASSETS, DEFAULT_CORR, computePortfolio, applyMarketData, applyCorrelation } from '../../lib/portfolioReturns'
import { annualizedReturn, mulberry32, percentile, toNum } from '@shared/finance/math'

const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n))

/** จำลอง Monte Carlo → median (และ p10/p90) ราย "อายุ" */
function simulate(startValue: number, muPct: number, sdPct: number, years: number, seed: number) {
  const mu = muPct / 100, sd = sdPct / 100
  const N = 1000
  const rng = mulberry32(seed >>> 0 || 1)
  const byYear: number[][] = Array.from({ length: years + 1 }, () => [])
  for (let p = 0; p < N; p++) {
    let v = startValue
    byYear[0].push(v)
    for (let y = 1; y <= years; y++) {
      let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
      v *= Math.exp((mu - sd * sd / 2) + sd * z)
      byYear[y].push(v)
    }
  }
  return byYear.map(arr => {
    const s = arr.slice().sort((a, b) => a - b)
    return { p10: percentile(s, 0.10), p50: percentile(s, 0.50), p90: percentile(s, 0.90) }
  })
}

const W_LBL = ['ตราสารหนี้ระยะกลาง', 'หุ้นไทย', 'หุ้นโลก', 'หุ้นสหรัฐฯ']
const W_CLR = ['#22d3ee', '#10b981', '#f59e0b', '#f43f5e']

export default function RebalanceTab({ person = 'self' }: { person?: 'self' | 'spouse' }) {
  const isSelf = person === 'self'
  const qc = useQueryClient()
  const { data: invProfile } = useQuery({ queryKey: ['investment-profile'], queryFn: () => api.get('/investment-profile').then(r => r.data), retry: false })
  const { data: clientProfile } = useQuery({ queryKey: ['client-profile'], queryFn: () => api.get('/client-profile').then(r => r.data), retry: false })
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data), retry: false })
  const { data: retPlan } = useQuery({ queryKey: ['retirement-plan'], queryFn: () => api.get('/retirement-plan').then(r => r.data), retry: false })
  const { data: marketData } = useQuery({ queryKey: ['market-data'], queryFn: () => api.get('/market-data').then(r => r.data), staleTime: 5 * 60 * 1000, retry: 1 })
  const { data: rebalPlan, isFetched } = useQuery({ queryKey: ['rebalance-plan'], queryFn: () => api.get('/rebalance-plan').then(r => r.data), retry: false })

  const planKey = isSelf ? 'self' : 'spouse'
  // การเลือกพอร์ต — บันทึกลงระบบ (rebalance-plan.{self|spouse}.tier)
  const savedTier: string | null = rebalPlan?.[planKey]?.tier ?? null
  const save = useMutation({
    mutationFn: (tier: string) => api.put('/rebalance-plan', { ...(rebalPlan ?? {}), [planKey]: { tier } }).then(r => r.data),
    onSuccess: (data) => qc.setQueryData(['rebalance-plan'], data),
  })
  const selTier = save.variables ?? savedTier   // optimistic

  // ── ข้อมูลพอร์ตปัจจุบัน (ตรรกะเดียวกับแท็บมูลค่าสินทรัพย์ลงทุน) ──
  const birthDate = clientProfile?.birthDate ? new Date(clientProfile.birthDate) : null
  const selfAge = birthDate ? new Date().getFullYear() - birthDate.getFullYear() : null
  const currentAge = isSelf ? selfAge : (clientProfile?.spouseAge ?? null)
  const lifeExp = (isSelf ? profile?.lifeExpectancySelf : profile?.lifeExpectancySpouse) ?? retPlan?.[planKey]?.lifeExpectancy ?? 85
  const retireAge = (isSelf ? profile?.retirementAgeSelf : profile?.retirementAgeSpouse) ?? retPlan?.[planKey]?.retirementAge ?? 60

  const invSrc: any = isSelf ? (invProfile ?? {}) : (invProfile?.spouseData ?? {})
  const investmentAssets: any[] = invSrc?.investmentAssets ?? []
  const totalValue = investmentAssets.reduce((s: number, a: any) => s + toNum(a.currentValue), 0)
  let wr = 0, cv = 0
  investmentAssets.forEach((a: any) => {
    const val = toNum(a.currentValue)
    let r = annualizedReturn(toNum(a.investAmount), val, a.investDate)
    if (r === null) { const m = parseFloat(a.annualReturn); if (!isNaN(m)) r = m }
    if (r !== null && val > 0) { cv += val; wr += r * val }
  })
  const curReturn = cv > 0 ? wr / cv : 0
  const riskSrc = isSelf ? profile : profile?.spouseRisk
  const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
  const curSd = /สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (curReturn >= 8 ? 16 : curReturn >= 4 ? 11 : 6)

  // ── พอร์ตแนะนำ 3 ระดับ (ทางเลือก Sharpe สูงสุด · ข้อมูลตลาดล่าสุด) ──
  const ports = useMemo(() => {
    const assets = applyMarketData(DEFAULT_ASSETS, marketData)
    const { matrix } = applyCorrelation(DEFAULT_CORR, marketData)
    return PORTFOLIO_SETS.map(set => {
      const results = set.options.map(o => computePortfolio(o.weights, assets, matrix))
      const bi = results.reduce((b, r, i) => r.sharpe > results[b].sharpe ? i : b, 0)
      return { id: set.id, label: set.label, sub: set.sub, color: set.color, option: set.options[bi].label, weights: set.options[bi].weights, ...results[bi] }
    })
  }, [marketData])
  const sel = ports.find(p => p.id === selTier) ?? null

  // ── Monte Carlo เปรียบเทียบ (พอร์ตเดิม vs พอร์ตที่เลือก) ──
  const years = currentAge != null ? Math.max(0, lifeExp - currentAge) : 0
  const compare = useMemo(() => {
    if (!sel || totalValue <= 0 || years <= 0 || currentAge == null) return null
    const seedBase = (Math.round(totalValue) ^ (years << 4)) >>> 0
    const cur = simulate(totalValue, curReturn, curSd, years, seedBase ^ 0x1111)
    const nw = simulate(totalValue, sel.ret, sel.sigma, years, seedBase ^ 0x2222)
    const rows = cur.map((c, i) => ({
      age: currentAge + i,
      พอร์ตเดิม: Math.round(c.p50),
      พอร์ตใหม่: Math.round(nw[i].p50),
      band: [Math.round(nw[i].p10), Math.round(nw[i].p90)] as [number, number],
    }))
    const rIdx = Math.min(Math.max(0, retireAge - currentAge), years)
    return { rows, curAtRet: cur[rIdx], newAtRet: nw[rIdx] }
  }, [sel?.id, totalValue, years, currentAge, curReturn, curSd, retireAge])

  const label = { padding: '4px 0', fontSize: 12, color: 'var(--text-muted)' } as React.CSSProperties

  if (!isFetched) return null
  if (totalValue <= 0) return (
    <div style={{ ...card, padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>
      ยังไม่มีข้อมูลสินทรัพย์ลงทุน — กรอกที่หน้า "ข้อมูลสินทรัพย์และการลงทุน" ก่อน
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* หัว + มูลค่าตั้งต้น */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SlidersHorizontal size={19} style={{ color: 'var(--cyan)' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>การปรับสัดส่วนลงทุน</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>เลือกพอร์ตตามสมมติฐานการลงทุน แล้วเปรียบเทียบมูลค่าอนาคตกับพอร์ตปัจจุบันด้วย Monte Carlo</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {([['มูลค่าสินทรัพย์ลงทุนปัจจุบัน', `฿${fmt(totalValue)}`, 'var(--cyan)'],
           ['ผลตอบแทนพอร์ตเดิม (ต่อปี)', `${curReturn.toFixed(2)}%`, '#f59e0b'],
           ['ความผันผวนพอร์ตเดิม (SD)', `${curSd}%`, '#f59e0b'],
           ['ช่วงจำลอง', currentAge != null ? `อายุ ${currentAge} → ${lifeExp} ปี` : '—', 'var(--text-primary)']] as const).map(([l, v, c]) => (
          <div key={l} style={{ ...card, padding: '12px 16px' }}>
            <div style={label}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: 'monospace' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ① เลือกพอร์ต */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>① เลือกพอร์ตเป้าหมาย (ทางเลือกที่ Sharpe สูงสุดของแต่ละระดับ — จากหน้าสมมติฐานการลงทุน)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
        {ports.map(p => {
          const active = selTier === p.id
          return (
            <button key={p.id} onClick={() => save.mutate(p.id)}
              style={{ ...card, textAlign: 'left', cursor: 'pointer', padding: '14px 16px', position: 'relative',
                border: active ? `2px solid ${p.color}` : '1px solid var(--card-border)', background: active ? `${p.color}0d` : (card as any).background }}>
              {active && <span style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 999, background: p.color, color: '#00201d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} /></span>}
              <div style={{ fontSize: 14, fontWeight: 800, color: p.color }}>{p.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10 }}>{p.sub} · {p.option}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 10 }}>
                {p.weights.map((w, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ width: 7, height: 7, borderRadius: 999, background: W_CLR[i], margin: '0 auto 3px' }} />
                    <div style={{ fontSize: 8.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{W_LBL[i]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{w}%</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: 8 }}>
                {([['E(Rp)', `+${p.ret.toFixed(2)}%`, '#22c55e'], ['σ', `${p.sigma.toFixed(2)}%`, '#f59e0b'], ['Sharpe', p.sharpe.toFixed(2), 'var(--text-primary)']] as const).map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {!sel ? (
        <div style={{ ...card, padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          <Info size={16} style={{ color: 'var(--cyan)', flexShrink: 0 }} /> คลิกเลือกพอร์ตด้านบน เพื่อจัดสัดส่วนเงินลงทุนใหม่และจำลองเปรียบเทียบ
        </div>
      ) : (
        <>
          {/* ② จัดสัดส่วนใหม่ */}
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>② จัดสัดส่วนเงินลงทุนปัจจุบัน ฿{fmt(totalValue)} ตาม{sel.label}</div>
          <div style={{ ...card, padding: '14px 18px' }}>
            <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
              {sel.weights.map((w, i) => w > 0 && <div key={i} style={{ width: `${w}%`, background: W_CLR[i] }} />)}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                  {['สินทรัพย์', 'สัดส่วน', 'จำนวนเงินที่จัดใหม่'].map((h, i) => (
                    <th key={h} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sel.weights.map((w, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--divider)' }}>
                    <td style={{ padding: '7px 8px', color: 'var(--text-primary)' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: W_CLR[i], marginRight: 8 }} />{W_LBL[i]}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{w}%</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: W_CLR[i] }}>{fmt(totalValue * w / 100)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>รวม</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>100%</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--cyan-light)' }}>{fmt(totalValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ③ เปรียบเทียบ Monte Carlo */}
          {compare && (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-secondary)' }}>③ เปรียบเทียบมูลค่าอนาคต (Monte Carlo 1,000 ครั้ง · เส้น = ค่ากลาง · แถบ = ช่วง P10–P90 ของพอร์ตใหม่)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ ...card, padding: '12px 16px' }}>
                  <div style={label}>พอร์ตเดิม — ค่ากลาง ณ เกษียณ (อายุ {retireAge})</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#f59e0b' }}>฿{fmt(compare.curAtRet.p50)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ดี {fmt(compare.curAtRet.p90)} · แย่ {fmt(compare.curAtRet.p10)}</div>
                </div>
                <div style={{ ...card, padding: '12px 16px', border: `1px solid ${sel.color}66` }}>
                  <div style={label}>พอร์ตใหม่ ({sel.label}) — ค่ากลาง ณ เกษียณ</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: sel.color }}>฿{fmt(compare.newAtRet.p50)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>ดี {fmt(compare.newAtRet.p90)} · แย่ {fmt(compare.newAtRet.p10)}</div>
                </div>
                <div style={{ ...card, padding: '12px 16px' }}>
                  <div style={label}>ส่วนต่างค่ากลาง ณ เกษียณ</div>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: compare.newAtRet.p50 >= compare.curAtRet.p50 ? '#22c55e' : '#f43f5e' }}>
                    {compare.newAtRet.p50 >= compare.curAtRet.p50 ? '+' : '−'}฿{fmt(Math.abs(compare.newAtRet.p50 - compare.curAtRet.p50))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>เทียบพอร์ตเดิมที่ผลตอบแทน {curReturn.toFixed(2)}%/ปี</div>
                </div>
              </div>
              <ChartFrame title="เปรียบเทียบมูลค่าสินทรัพย์ลงทุนในอนาคต — พอร์ตเดิม vs พอร์ตใหม่ (บาท)" height={380}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={compare.rows} margin={{ top: 12, right: 18, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="var(--card-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="age" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v: any) => `${v} ปี`} />
                    <YAxis tickFormatter={(v: any) => `${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={54} />
                    <Tooltip
                      formatter={(v: any, name: any) => [Array.isArray(v) ? `${fmt(v[0])} – ${fmt(v[1])}` : `฿${fmt(v)}`, name === 'band' ? 'ช่วง 80% พอร์ตใหม่' : name]}
                      labelFormatter={(l: any) => `อายุ ${l} ปี`}
                      contentStyle={{ background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine x={retireAge} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: `เกษียณ ${retireAge} ปี`, position: 'insideTopLeft', fontSize: 11, fill: '#f59e0b' }} />
                    <Area dataKey="band" name="ช่วง 80% (พอร์ตใหม่)" stroke="none" fill={sel.color} fillOpacity={0.14} />
                    <Line dataKey="พอร์ตเดิม" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                    <Line dataKey="พอร์ตใหม่" stroke={sel.color} strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartFrame>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                * พอร์ตเดิมใช้ผลตอบแทนถัวเฉลี่ยจากสินทรัพย์จริง {curReturn.toFixed(2)}%/ปี ความผันผวน {curSd}% (ตามระดับความเสี่ยงจากแบบประเมิน) · พอร์ตใหม่ใช้ E(Rp) {sel.ret.toFixed(2)}%/ปี σ {sel.sigma.toFixed(2)}% จากหน้าสมมติฐานการลงทุน · เป็นการจำลองเพื่อเปรียบเทียบ ไม่ใช่การรับประกันผลตอบแทน
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
