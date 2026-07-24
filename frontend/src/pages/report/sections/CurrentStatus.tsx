// ── สถานะทางการเงินปัจจุบัน ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { mulberry32, toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import AdviceBox from '../AdviceBox'
import type { ReportCtx } from '../ctx'

export default function CurrentStatus({ kind, ctx }: { kind: string; ctx: ReportCtx }) {
  const { client, ratios, profile, retPlan, expensesQ, ratiosSp, secs, setText, age, allocation, PIE_COLORS, totalInv, portRet, hasSpouse, invAssetsSp, totalInvSp, portRetSp } = ctx
    // ── บทสรุปผู้บริหารตามเอกสารตัวอย่าง: 4 ส่วน ซ้าย=ภาพข้อมูล (จากงานนำเสนอ) ขวา=กล่องข้อเสนอแนะ · มีเวอร์ชันคู่สมรส ──
    const isSp = kind === 'exec_spouse'
    if (isSp && !hasSpouse) return null
    const R = isSp ? ratiosSp : ratios
    const sm2 = R?.summary ?? {}
    const kSuf = isSp ? '_sp' : ''
    const pKey = isSp ? 'spouse' : 'client'
    const tInv = isSp ? totalInvSp : totalInv
    const pRet = isSp ? portRetSp : portRet
    const alloc = isSp ? (() => {
      const groups: Record<string, number> = {}
      invAssetsSp.forEach(a => { const v = toNum(a.currentValue); if (v > 0) groups[a.assetClass || 'อื่นๆ'] = (groups[a.assetClass || 'อื่นๆ'] || 0) + v })
      return { rows: Object.entries(groups).map(([name, value]) => ({ name, value })), total: Object.values(groups).reduce((x, v) => x + v, 0) }
    })() : allocation
    const toMonthly = (a: number, f: string) => f === 'QUARTERLY' ? a / 3 : f === 'ANNUALLY' ? a / 12 : a
    const expAnnualR = (prefix: string, exclude?: string) => (expensesQ ?? [])
      .filter((e: any) => String(e.category).startsWith(prefix) && e.category !== exclude && (e.person === pKey || e.person === 'shared'))
      .reduce((sum: number, e: any) => { const m = toMonthly(toNum(e.amount), e.frequency) * 12; return sum + (e.person === 'shared' ? m / 2 : m) }, 0)
    const liquid = toNum(sm2.liquidAssets), invest = toNum(sm2.investAssets), personal = toNum(sm2.personalTotal)
    const totalA = toNum(sm2.totalAssets), debt = toNum(sm2.totalDebtBalance), netW = toNum(sm2.netWorth)
    const income = toNum(sm2.totalAnnualIncome)
    const fixedE = expAnnualR('fixed_'), varE = expAnnualR('var_'), saveE = expAnnualR('saving_') || toNum(sm2.annualSavings)
    const totalE = fixedE + varE + saveE, netCF = income - totalE
    const pctOf = (v: number, t: number) => t > 0 ? `${Math.round(v / t * 100)}%` : ''
    // Monte Carlo มูลค่าพอร์ต ณ เกษียณ (ตรรกะเดียวกับสไลด์ลงทุน)
    const mcInv = (() => {
      const curAge = (isSp ? retPlan?.spouse?.currentAge ?? client?.spouseAge : retPlan?.self?.currentAge ?? age)
      const retAge = (isSp ? profile?.retirementAgeSpouse ?? retPlan?.spouse?.retirementAge : profile?.retirementAgeSelf ?? retPlan?.self?.retirementAge) ?? 60
      const years = curAge != null ? Math.max(0, retAge - curAge) : 0
      if (tInv <= 0 || years <= 0 || pRet <= 0) return null
      const riskSrc = isSp ? profile?.spouseRisk : profile
      const riskLabel = String(riskSrc?.riskLabel ?? riskSrc?.riskLevel ?? '')
      const sigma = (/สูง/.test(riskLabel) ? 16 : /กลาง|ปานกลาง/.test(riskLabel) ? 11 : /ต่ำ/.test(riskLabel) ? 6 : (pRet >= 8 ? 16 : pRet >= 4 ? 11 : 6)) / 100
      const mu = pRet / 100
      const rng = mulberry32((Math.round(tInv) ^ (years << 5) ^ 0x51ed) >>> 0)
      const finals: number[] = []
      for (let i = 0; i < 500; i++) {
        let v = tInv
        for (let y = 0; y < years; y++) {
          let u1 = rng(); if (u1 < 1e-12) u1 = 1e-12
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng())
          v *= Math.exp((mu - sigma * sigma / 2) + sigma * z)
        }
        finals.push(v)
      }
      finals.sort((a, b) => a - b)
      const pc = (q: number) => { const idx = (finals.length - 1) * q, lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? finals[lo] : finals[lo] + (finals[hi] - finals[lo]) * (idx - lo) }
      return { p10: pc(0.1), p50: pc(0.5), p90: pc(0.9), retAge }
    })()
    const RATIO_META: Record<string, { name: string; unit: string }> = {
      ratio1: { name: 'สภาพคล่อง', unit: 'times' }, ratio2: { name: 'เงินสำรองฉุกเฉิน', unit: 'months' },
      ratio3: { name: 'สภาพคล่อง/ความมั่งคั่ง', unit: 'pct' }, ratio4: { name: 'หนี้สินต่อสินทรัพย์', unit: 'pct' },
      ratio5: { name: 'ชำระหนี้ต่อรายได้', unit: 'pct' }, ratio6: { name: 'หนี้ไม่จดจำนอง', unit: 'pct' },
      ratio7: { name: 'การออม', unit: 'pct' }, ratio8: { name: 'การลงทุน', unit: 'pct' },
    }
    const stateCol: Record<string, string> = { good: GREENR, warning: AMBERR, danger: REDR, nodata: '#94a3b8' }
    const fmtRatio = (v: number | null, unit: string) => v == null ? '—' : unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(0)}%`
    const score: number | null = R?.healthScore ?? null
    const circ = 2 * Math.PI * 42
    const MiniTable = ({ rows, total }: { rows: [string, number, string, boolean?][]; total?: number }) => (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>{rows.map(([l, v, c, strong], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', fontWeight: strong ? 800 : 400 }}>
            <td style={{ padding: '6px 4px', color: strong ? '#0f172a' : '#64748b' }}>{l}</td>
            <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: c }}>{fmt(v)}</td>
            <td style={{ padding: '6px 4px', textAlign: 'right', color: '#94a3b8', width: 40, fontSize: 11 }}>{total != null ? pctOf(v, total) : ''}</td>
          </tr>
        ))}</tbody>
      </table>
    )

    const Row = ({ title, adviceKey, children }: { title: string; adviceKey: string; children: React.ReactNode }) => (
      <div style={{ marginBottom: 24, breakInside: 'avoid' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 18, alignItems: 'stretch' }}>
          <div>{children}</div>
          <AdviceBox title={title} value={secs[adviceKey]?.text ?? ''} onSave={v => setText(adviceKey, v)} />
        </div>
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>ข้อสังเกตสำคัญ (Key Observations){isSp ? ` — ${client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'}` : ''}</div>
        <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 18px' }}>จากการทบทวนข้อมูลเบื้องต้น เรามีข้อสังเกตและข้อเสนอแนะสำคัญดังต่อไปนี้</p>
        <Row title="ความมั่งคั่งสุทธิ (Net Worth)" adviceKey={`exec_nw${kSuf}`}>
          <MiniTable total={totalA} rows={[
            ['สินทรัพย์สภาพคล่อง', liquid, '#0284c7'], ['สินทรัพย์ลงทุน', invest, TEAL], ['สินทรัพย์ส่วนตัว', personal, AMBERR],
            ['รวมสินทรัพย์', totalA, '#0f172a', true], ['หนี้สินรวม', debt, REDR], ['ความมั่งคั่งสุทธิ', netW, netW >= 0 ? GREENR : REDR, true],
          ]} />
        </Row>
        <Row title="กระแสเงินสด (Cash Flow)" adviceKey={`exec_cf${kSuf}`}>
          <MiniTable total={income} rows={[
            ['กระแสเงินสดรับ', income, GREENR], ['ค่าใช้จ่ายคงที่', fixedE, AMBERR], ['ค่าใช้จ่ายผันแปร', varE, REDR],
            ['ค่าใช้จ่ายเพื่อการออม/ลงทุน', saveE, '#8b5cf6'], ['ค่าใช้จ่ายรวม', totalE, REDR, true], ['กระแสเงินสดสุทธิ', netCF, netCF >= 0 ? TEAL : REDR, true],
          ]} />
        </Row>
        <Row title="สถานะสุขภาพทางการเงิน (Financial Health)" adviceKey={`exec_health${kSuf}`}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
              <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={50} cy={50} r={42} fill="none" stroke="#e2e8f0" strokeWidth={8} />
                <circle cx={50} cy={50} r={42} fill="none" stroke={TEAL} strokeWidth={8} strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, score ?? 0)) / 100)} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{score ?? '—'}</span>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>/ 100</span>
                {R?.healthLabel && <span style={{ fontSize: 9.5, fontWeight: 700, color: TEAL }}>{R.healthLabel}</span>}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {(R?.ratios ?? []).map((e: any) => {
                const m = RATIO_META[e.key]; if (!m) return null
                const col = stateCol[e.state] ?? '#94a3b8'
                return (
                  <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: col, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 11, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: col }}>{fmtRatio(e.value, m.unit)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Row>
        <Row title="การออม/ลงทุน (Investment Portfolio)" adviceKey={`exec_inv${kSuf}`}>
          {alloc.total > 0 ? (
            <div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '6px 8px 2px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>สัดส่วนสินทรัพย์ลงทุน</div>
                <div style={{ height: 130 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie isAnimationActive={false} data={alloc.rows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={50} label={(e: any) => `${(e.percent * 100).toFixed(0)}%`} labelLine={false}>
                        {alloc.rows.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${fmt(v)} บาท`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', textAlign: 'center', paddingBottom: 6 }}>
                  รวม {fmt(alloc.total)} บาท · ผลตอบแทน ~{pRet.toFixed(1)}%/ปี
                </div>
              </div>
              {mcInv && (
                <div style={{ marginTop: 8, background: '#f8fafc', borderRadius: 10, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>มูลค่า ณ เกษียณ (อายุ {mcInv.retAge} ปี) · Monte Carlo</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {([['ดี (P90)', mcInv.p90, GREENR], ['ค่ากลาง (P50)', mcInv.p50, '#0f172a'], ['แย่ (P10)', mcInv.p10, REDR]] as const).map(([l, v, c]) => (
                      <div key={l} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{l}</div>
                        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: c }}>{fmt(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : <div style={{ fontSize: 12, color: '#94a3b8' }}>ยังไม่มีข้อมูลสินทรัพย์ลงทุน</div>}
        </Row>
      </div>
    )
}
