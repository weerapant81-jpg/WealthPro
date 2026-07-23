// ── งบการเงินเต็มรูปแบบ — งบดุล · งบกระแสเงินสด · อัตราส่วนทางการเงิน ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { monthlyIncome as incMonthly } from '../../../lib/income'
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function FinancialStatements({ kind, ctx }: { kind: string; ctx: ReportCtx }) {
  const { client, ratios, ratiosSp, invProfile, expensesQ, hasSpouse } = ctx
    // ── งบการเงินเต็มรูปแบบ 3 งบ: งบดุล · งบกระแสเงินสด · อัตราส่วนทางการเงิน (มีเวอร์ชันคู่สมรส) ──
    const isSp = kind.endsWith('_sp')
    if (isSp && !hasSpouse) return null
    const baseKind = isSp ? kind.slice(0, -3) : kind
    const R2 = isSp ? ratiosSp : ratios
    const toMonthly2 = (a: number, f: string) => f === 'QUARTERLY' ? a / 3 : f === 'ANNUALLY' ? a / 12 : a
    const inv: any = (isSp ? invProfile?.spouseData : invProfile) ?? {}
    const savRows = (inv.savingsAccounts ?? []).map((a: any, i2: number) => ({ name: a.depositType || `เงินฝากที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
    const invRows = (inv.investmentAssets ?? []).map((a: any, i2: number) => ({ name: a.assetName || `สินทรัพย์ลงทุนที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
    const perRows = (inv.personalAssets ?? []).map((a: any, i2: number) => ({ name: a.customLabel || a.assetType || `สินทรัพย์ที่ ${i2 + 1}`, v: toNum(a.currentValue) })).filter((r: any) => r.v > 0)
    const liabs: any[] = inv.liabilities ?? []
    const shortDebt = liabs.filter(l => !((parseFloat(l.termYears) || 0) > 1) && toNum(l.currentBalance) > 0).map(l => ({ name: l.debtType || 'หนี้สินระยะสั้น', note: l.creditor, v: toNum(l.currentBalance) }))
    const longDebt = liabs.filter(l => (parseFloat(l.termYears) || 0) > 1 && toNum(l.currentBalance) > 0).map(l => ({ name: l.debtType || 'หนี้สินระยะยาว', note: l.creditor, v: toNum(l.currentBalance) }))
    const sumV = (rows: { v: number }[]) => rows.reduce((x, r) => x + r.v, 0)
    const savT = sumV(savRows), invT = sumV(invRows), perT = sumV(perRows)
    const assetT = savT + invT + perT
    const shortT = sumV(shortDebt), longT = sumV(longDebt), debtT = shortT + longT
    const netWT = assetT - debtT
    // งบกระแสเงินสด — รายรับจาก incomeSources + รายจ่ายรายรายการจาก /expenses (ลูกค้า + แชร์ครึ่ง)
    const incRows = (((isSp ? client?.spouseIncomeSources : client?.incomeSources) ?? []) as any[])
      .filter(sc => toNum(sc.amount) > 0)
      .map(sc => { const m = incMonthly(sc); return { name: sc.label || 'รายรับ', note: sc.source, m, v: m * 12 } })
    const expRows = (prefix: string) => (expensesQ ?? [])
      .filter((e: any) => String(e.category).startsWith(prefix) && (e.person === (isSp ? 'spouse' : 'client') || e.person === 'shared'))
      .map((e: any) => { const m0 = toMonthly2(toNum(e.amount), e.frequency); const m = e.person === 'shared' ? m0 / 2 : m0; return { name: e.name, note: e.person === 'shared' ? 'แชร์ร่วมกัน (ครึ่งหนึ่ง)' : undefined, m, v: m * 12 } })
      .filter((r: any) => r.v > 0)
    const fixRows = expRows('fixed_'), varRows = expRows('var_'), savERows = expRows('saving_')
    const incT = sumV(incRows), fixT = sumV(fixRows), varT = sumV(varRows), savET = sumV(savERows)
    const expT = fixT + varT + savET, netCF2 = incT - expT
    // อัตราส่วน 8 ตัว
    const RM: Record<string, { name: string; std: string; unit: string }> = {
      ratio1: { name: 'อัตราส่วนสภาพคล่อง', std: '> 1 เท่า', unit: 'times' },
      ratio2: { name: 'เงินสำรองฉุกเฉิน (สภาพคล่องพื้นฐาน)', std: '3–6 เดือน', unit: 'months' },
      ratio3: { name: 'สินทรัพย์สภาพคล่องต่อความมั่งคั่งสุทธิ', std: '> 15%', unit: 'pct' },
      ratio4: { name: 'หนี้สินต่อสินทรัพย์', std: '< 50%', unit: 'pct' },
      ratio5: { name: 'การชำระคืนหนี้สินจากรายได้', std: '< 35–45%', unit: 'pct' },
      ratio6: { name: 'การชำระคืนหนี้ที่ไม่จดจำนอง', std: '< 15–20%', unit: 'pct' },
      ratio7: { name: 'อัตราการออม', std: '≥ 10%', unit: 'pct' },
      ratio8: { name: 'อัตราการลงทุน (สินทรัพย์ลงทุน/ความมั่งคั่งสุทธิ)', std: '≥ 50%', unit: 'pct' },
    }
    const stChip: Record<string, { label: string; c: string }> = {
      good: { label: 'ผ่านเกณฑ์', c: GREENR }, warning: { label: 'ควรปรับปรุง', c: AMBERR },
      danger: { label: 'ต่ำกว่าเกณฑ์', c: REDR }, nodata: { label: 'รอข้อมูล', c: '#94a3b8' },
    }
    const fmtRat = (v: number | null, unit: string) => v == null ? '—' : unit === 'times' ? `${v.toFixed(2)} เท่า` : unit === 'months' ? `${v.toFixed(1)} เดือน` : `${v.toFixed(1)}%`
    // ── ชิ้นส่วน UI ──
    const Sect = ({ title, accent, total, rows, base, monthly }: { title: string; accent: string; total: number; rows: { name: string; note?: string; m?: number; v: number }[]; base: number; monthly?: boolean }) => (
      <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, marginBottom: 10, overflow: 'hidden', breakInside: 'avoid' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: accent }}>{title}</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, fontFamily: 'monospace', color: accent }}>{fmt(total)} ฿</span>
        </div>
        {rows.length === 0
          ? <div style={{ padding: '8px 14px', fontSize: 12, color: '#94a3b8' }}>— ไม่มีรายการ —</div>
          : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>{rows.map((r, i2) => (
                <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '5px 14px', color: '#334155' }}>{r.name}{r.note && <span style={{ color: '#94a3b8', fontSize: 10.5 }}> · {r.note}</span>}</td>
                  {monthly && <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#64748b', width: 100 }}>{fmt(r.m ?? 0)}</td>}
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', width: 110 }}>{fmt(r.v)}</td>
                  <td style={{ padding: '5px 14px 5px 8px', textAlign: 'right', color: '#94a3b8', width: 56, fontSize: 11 }}>{base > 0 ? `${(r.v / base * 100).toFixed(1)}%` : ''}</td>
                </tr>
              ))}</tbody>
            </table>}
      </div>
    )
    const SumRow = ({ l, v, c, strong, sign }: { l: string; v: number; c: string; strong?: boolean; sign?: boolean }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f1f5f9', fontSize: strong ? 14 : 12.5, fontWeight: strong ? 800 : 600 }}>
        <span style={{ color: strong ? '#0f172a' : '#64748b' }}>{l}</span>
        <span style={{ fontFamily: 'monospace', color: c, fontWeight: 800 }}>{sign && v > 0 ? '+' : ''}{fmt(v)} ฿</span>
      </div>
    )
    if (baseKind === 'finance') return (
      <div style={{ marginBottom: 16 }}>
        {/* ── 1. งบดุลส่วนบุคคล ── */}
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, marginBottom: 12 }}>งบดุลส่วนบุคคล (Balance Sheet)</div>
        <Sect title="สินทรัพย์สภาพคล่อง (Liquid Assets)" accent="#0284c7" total={savT} rows={savRows} base={assetT} />
        <Sect title="สินทรัพย์เพื่อการลงทุน (Investment Assets)" accent={TEAL} total={invT} rows={invRows} base={assetT} />
        <Sect title="สินทรัพย์ส่วนตัว (Personal Assets)" accent={AMBERR} total={perT} rows={perRows} base={assetT} />
        <Sect title="หนี้สินระยะสั้น (ครบกำหนด ≤ 1 ปี)" accent={REDR} total={shortT} rows={shortDebt} base={debtT} />
        <Sect title="หนี้สินระยะยาว (ครบกำหนด > 1 ปี)" accent="#f97316" total={longT} rows={longDebt} base={debtT} />
        <div style={{ border: `1px solid ${TEAL}55`, borderRadius: 10, overflow: 'hidden', breakInside: 'avoid' }}>
          <div style={{ padding: '8px 14px', background: '#f0fdfa', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>สรุปงบดุลส่วนบุคคล</div>
          <SumRow l="สินทรัพย์รวม (1)" v={assetT} c="#0284c7" />
          <SumRow l="หนี้สินระยะสั้นรวม" v={-shortT} c={REDR} />
          <SumRow l="หนี้สินระยะยาวรวม" v={-longT} c={REDR} />
          <SumRow l="หนี้สินรวม (2)" v={-debtT} c={REDR} />
          <SumRow l="ความมั่งคั่งสุทธิ (Net Worth = 1 − 2)" v={netWT} c={netWT >= 0 ? GREENR : REDR} strong sign />
        </div>

      </div>
    )
    if (baseKind === 'fin_cf2') return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 22, fontSize: 10.5, color: '#94a3b8', margin: '0 14px 4px' }}><span>บาท/เดือน</span><span>บาท/ปี</span><span>% รายรับ</span></div>
        <Sect title="รายรับ (Income)" accent={GREENR} total={incT} rows={incRows} base={incT} monthly />
        <Sect title="รายจ่ายคงที่ (Fixed Expenses)" accent={AMBERR} total={fixT} rows={fixRows} base={incT} monthly />
        <Sect title="รายจ่ายผันแปร (Variable Expenses)" accent={REDR} total={varT} rows={varRows} base={incT} monthly />
        <Sect title="รายจ่ายเพื่อการออม/ลงทุน (Saving / Investment)" accent="#8b5cf6" total={savET} rows={savERows} base={incT} monthly />
        <div style={{ border: `1px solid ${TEAL}55`, borderRadius: 10, overflow: 'hidden', breakInside: 'avoid' }}>
          <div style={{ padding: '8px 14px', background: '#f0fdfa', fontSize: 13, fontWeight: 800, color: '#0f172a' }}>สรุปงบกระแสเงินสด (ต่อปี)</div>
          <SumRow l="รายรับรวม" v={incT} c={GREENR} sign />
          <SumRow l="รายจ่ายคงที่รวม" v={-fixT} c={AMBERR} />
          <SumRow l="รายจ่ายผันแปรรวม" v={-varT} c={REDR} />
          <SumRow l="รายจ่ายเพื่อการออม/ลงทุนรวม" v={-savET} c="#8b5cf6" />
          <SumRow l="รายจ่ายรวม" v={-expT} c={REDR} />
          <SumRow l="กระแสเงินสดสุทธิ (Net Cash Flow)" v={netCF2} c={netCF2 >= 0 ? GREENR : REDR} strong sign />
        </div>

      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
              {['อัตราส่วน', 'ค่าที่คำนวณได้', 'เกณฑ์มาตรฐาน', 'สถานะ'].map((h, i2) => (
                <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : i2 === 3 ? 'center' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{(R2?.ratios ?? []).map((e: any) => {
            const m = RM[e.key]; if (!m) return null
            const st = stChip[e.state] ?? stChip.nodata
            return (
              <tr key={e.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px', color: '#334155' }}>{m.name}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: st.c }}>{fmtRat(e.value, m.unit)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b' }}>{m.std}</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 999, background: `${st.c}14`, color: st.c, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{st.label}</span>
                </td>
              </tr>
            )
          })}</tbody>
        </table>
        {R2?.healthScore != null && (
          <div style={{ marginTop: 10, padding: '9px 14px', background: '#f0fdfa', border: `1px solid ${TEAL}55`, borderRadius: 10, fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>
            คะแนนสุขภาพทางการเงินรวม: <span style={{ fontFamily: 'monospace', fontWeight: 800, color: TEAL }}>{R2.healthScore} / 100</span>{R2.healthLabel ? ` · ${R2.healthLabel}` : ''}
          </div>
        )}
      </div>
    )
}
