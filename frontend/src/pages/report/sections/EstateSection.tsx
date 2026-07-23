// ── แนวทางการจัดการทรัพย์สินและมรดก ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function EstateSection({ ctx }: { ctx: ReportCtx }) {
  const { client, ratios, ratiosSp, estatePlanQ, hasSpouse } = ctx
    // ── วางแผนมรดก: จำลองการแบ่งมรดก + ภาษีมรดก + สภาพคล่อง (สูตรเดียวกับหน้าวางแผนมรดก/deck) ──
    const selfName2 = `คุณ${client?.firstName || 'ลูกค้า'}`
    const spouseName2 = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
    const build = (who: 'self' | 'spouse') => {
      const inputs: any = estatePlanQ?.[who] ?? {}
      const R4 = who === 'self' ? ratios : ratiosSp
      const netWorth = toNum(R4?.summary?.netWorth)
      const liquid = toNum(R4?.summary?.liquidAssets)
      const debt = toNum(R4?.summary?.totalDebtBalance)
      const married = /สมรส/.test(String(client?.maritalStatus ?? '')) || hasSpouse
      const survivorName = who === 'self' ? spouseName2 : selfName2
      const spouseIsHeir = !!inputs.spouseAlive && married
      const spouseHalf = spouseIsHeir ? netWorth * (toNum(inputs.maritalAssetPct ?? 100) / 100) / 2 : 0
      const estateVal = Math.max(0, netWorth - spouseHalf)
      const kids: any[] = client?.children ?? []
      const parentsAlive = (inputs.fatherAlive ? 1 : 0) + (inputs.motherAlive ? 1 : 0)
      const wishes: any[] = inputs.wishes ?? []
      const wishTotal = wishes.reduce((x, w) => x + (Number(w.pct) || 0), 0)
      const useWill = !!inputs.hasWill && wishes.length > 0 && wishTotal > 0
      const THRESH = 100_000_000
      const heirTax = (share: number, rel: string) => rel === 'spouse' ? 0 : Math.max(0, share - THRESH) * (rel === 'lineal' ? 0.05 : 0.10)
      let heirs: { name: string; share: number; rel: string; note: string }[]
      if (useWill) {
        heirs = wishes.filter(w => (Number(w.pct) || 0) > 0).map(w => ({ name: w.name || 'ผู้รับ', share: estateVal * (Number(w.pct) || 0) / 100, rel: w.rel || 'lineal', note: `ตามพินัยกรรม ${Number(w.pct) || 0}%` }))
      } else {
        const shares = kids.length + (spouseIsHeir ? 1 : 0) + parentsAlive
        const each = shares > 0 ? estateVal / shares : estateVal
        heirs = []
        if (spouseIsHeir) heirs.push({ name: survivorName, share: each, rel: 'spouse', note: 'คู่สมรส (รับส่วนเท่าบุตร)' })
        kids.forEach((c2, i2) => heirs.push({ name: c2.name || `บุตรคนที่ ${i2 + 1}`, share: each, rel: 'lineal', note: 'บุตร (ผู้สืบสันดาน)' }))
        if (inputs.fatherAlive) heirs.push({ name: 'บิดา', share: each, rel: 'lineal', note: 'บิดา (ม.1630 ว.2)' })
        if (inputs.motherAlive) heirs.push({ name: 'มารดา', share: each, rel: 'lineal', note: 'มารดา (ม.1630 ว.2)' })
      }
      const totalTax = heirs.reduce((x, h) => x + heirTax(h.share, h.rel), 0)
      const needLiquid = totalTax + debt
      return { netWorth, liquid, debt, spouseIsHeir, spouseHalf, estateVal, useWill, heirs, totalTax, needLiquid, hasWill: !!inputs.hasWill, willType: inputs.willType, survivorName, heirTax }
    }
    const cases = [
      { title: `กรณี ${selfName2} เสียชีวิต`, e: build('self'), tint: TEAL },
      ...(hasSpouse ? [{ title: `กรณี ${spouseName2} เสียชีวิต`, e: build('spouse'), tint: '#8b5cf6' }] : []),
    ]
    const relLabel = (rel: string) => rel === 'spouse' ? 'คู่สมรส (ยกเว้นภาษี)' : rel === 'lineal' ? 'บุพการี/ผู้สืบสันดาน (5%)' : 'อื่น ๆ (10%)'
    const Card = ({ l, v, c, note }: { l: string; v: string; c: string; note?: string }) => (
      <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '8px 12px' }}>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>{l}</div>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
        {note && <div style={{ fontSize: 9.5, color: '#cbd5e1' }}>{note}</div>}
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 }}>
          ประมาณการการแบ่งมรดกตามประมวลกฎหมายแพ่งและพาณิชย์ บรรพ 6 · ภาษีมรดกตาม พ.ร.บ.ภาษีการรับมรดก 2558 (ผู้รับสุทธิเกิน 100 ล้าน: ผู้สืบสันดาน/บุพการี 5% · อื่น 10% · คู่สมรสยกเว้น) — เป็นเครื่องมือประกอบการวางแผนเท่านั้น การจัดทำพินัยกรรมจริงควรปรึกษาทนายความ
        </p>
        {cases.map(({ title, e, tint }) => (
          <div key={title} style={{ marginBottom: 22, breakInside: 'avoid' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: tint, borderLeft: `5px solid ${tint}`, paddingLeft: 10, marginBottom: 10 }}>{title}</div>
            {/* กองมรดกสุทธิ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <Card l="ความมั่งคั่งสุทธิ (สินทรัพย์ − หนี้สิน)" v={fmt(e.netWorth)} c="#0f172a" note="ดึงจากงบดุล" />
              <Card l="คู่สมรสรับก่อน (½ สินสมรส)" v={e.spouseIsHeir ? fmt(e.spouseHalf) : '—'} c="#0284c7" note={e.spouseIsHeir ? 'ไม่ถือเป็นมรดก' : 'ไม่มีคู่สมรสที่มีชีวิตอยู่'} />
              <Card l="กองมรดกสุทธิ (นำมาแบ่ง)" v={fmt(e.estateVal)} c={tint} />
            </div>
            {/* การแบ่งมรดก */}
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                การแบ่งมรดก{e.useWill ? 'ตามพินัยกรรม' : 'ตามกฎหมาย (กรณีไม่มีพินัยกรรม · ทายาทโดยธรรม ม.1629, 1635)'}
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: e.hasWill ? GREENR : AMBERR, background: e.hasWill ? `${GREENR}14` : `${AMBERR}14`, borderRadius: 999, padding: '2px 9px' }}>
                  {e.hasWill ? `มีพินัยกรรมแล้ว${e.willType ? ` · ${e.willType}` : ''}` : 'ยังไม่มีพินัยกรรม — ควรจัดทำ'}
                </span>
              </div>
              {e.heirs.length === 0
                ? <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>— ยังไม่มีข้อมูลทายาท (กรอกที่หน้า "วางแผนมรดก") —</div>
                : e.heirs.map((h, i2) => {
                    const pctSh = e.estateVal > 0 ? h.share / e.estateVal * 100 : 0
                    return (
                      <div key={i2} style={{ padding: '7px 12px', borderBottom: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{h.name} <span style={{ fontSize: 10.5, fontWeight: 400, color: '#94a3b8' }}>· {h.note}</span></span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: tint }}>{fmt(h.share)} <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>({pctSh.toFixed(1)}%)</span></span>
                        </div>
                        <div style={{ height: 5, borderRadius: 999, background: '#f1f5f9', marginTop: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.max(2, pctSh)}%`, borderRadius: 999, background: tint }} />
                        </div>
                        {h.rel === 'spouse' && e.spouseHalf > 0 && (
                          <div style={{ fontSize: 10, color: '#0284c7', marginTop: 3 }}>+ ½ สินสมรส {fmt(e.spouseHalf)} → รับรวม {fmt(h.share + e.spouseHalf)} บาท</div>
                        )}
                      </div>
                    )
                  })}
            </div>
            {/* ภาษีมรดก & สภาพคล่อง */}
            <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 800, color: '#0f172a' }}>ภาษีมรดก & สภาพคล่อง</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <tbody>
                  {e.heirs.map((h, i2) => {
                    const tx = e.heirTax(h.share, h.rel)
                    return (
                      <tr key={i2} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '5px 12px', color: '#334155' }}>{h.name}</td>
                        <td style={{ padding: '5px 12px', color: '#94a3b8', fontSize: 10.5 }}>{relLabel(h.rel)}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(h.share)}</td>
                        <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: tx > 0 ? REDR : GREENR, width: 90 }}>{tx > 0 ? fmt(tx) : 'ยกเว้น'}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                    <td colSpan={3} style={{ padding: '6px 12px', fontWeight: 800, color: '#0f172a' }}>ภาษีมรดกรวม{e.totalTax === 0 ? ' — ผู้รับแต่ละรายได้รับไม่เกิน 100 ล้านบาท จึงไม่มีภาษีมรดก' : ''}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: e.totalTax > 0 ? REDR : GREENR }}>{fmt(e.totalTax)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, padding: '10px 12px', background: '#fffbf5' }}>
                <Card l="ต้องใช้ (ภาษี + หนี้สินตกทอด)" v={fmt(e.needLiquid)} c={AMBERR} note={`ภาษี ${fmt(e.totalTax)} + หนี้ ${fmt(e.debt)}`} />
                <Card l="สินทรัพย์สภาพคล่อง" v={fmt(e.liquid)} c="#0284c7" />
                <Card l={e.liquid >= e.needLiquid ? 'สภาพคล่องเพียงพอ (คงเหลือ)' : 'ขาดสภาพคล่อง'} v={fmt(Math.abs(e.liquid - e.needLiquid))} c={e.liquid >= e.needLiquid ? GREENR : REDR} note={e.liquid >= e.needLiquid ? undefined : 'แนะนำทำประกันชีวิต (ระบุผู้รับผลประโยชน์) เพื่อเติมสภาพคล่อง'} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
}
