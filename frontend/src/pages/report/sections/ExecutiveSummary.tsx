// ── บทสรุปผู้บริหาร ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import AdviceBox from '../AdviceBox'
import type { ReportCtx } from '../ctx'

export default function ExecutiveSummary({ ctx }: { ctx: ReportCtx }) {
  const { client, ratios, retR, insR, eduR, secs, setText, setPos, sm, hasSpouse } = ctx
    // ── บทสรุปผู้บริหาร: สถานะการเงิน + เป้าหมาย + ผลวิเคราะห์ (สรุปอัตโนมัติจากข้อมูลจริง) + ช่องคอมเมนต์ ──
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.85, marginBottom: 16, textAlign: 'justify', textIndent: 28 }}>
          รายงานนี้ใช้แบบจำลองทางการเงินเพื่อแสดงภาพสถานะทางการเงินในปัจจุบันของท่าน รวมถึงแนวทางที่เป็นไปได้สำหรับอนาคต อย่างไรก็ตาม ภาวะเศรษฐกิจและตลาดในอนาคตไม่สามารถคาดการณ์ได้อย่างแน่นอนและอาจเปลี่ยนแปลงได้ สมมติฐานที่ใช้เป็นเพียงตัวแทนของสภาวะเศรษฐกิจและตลาดที่อาจเกิดขึ้น โดยมีวัตถุประสงค์เพื่อสนับสนุนการพิจารณาแนวทางที่เหมาะสมทั้งในปัจจุบันและอนาคต เพื่อให้ท่านสามารถบริหารและรักษาสถานะทางการเงินได้ภายใต้สภาวการณ์ที่เปลี่ยนแปลง
        </p>
        {/* สถานะทางการเงินในปัจจุบัน — สรุปอัตโนมัติจากข้อมูลจริง + ช่องคอมเมนต์ */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>สถานะทางการเงินในปัจจุบัน</div>
          {(() => {
            const smx: any = sm
            const liquidA = toNum(smx.liquidAssets), investA = toNum(smx.investAssets), personalA = toNum(smx.personalTotal)
            const totalA = toNum(smx.totalAssets), debtB = toNum(smx.totalDebtBalance), netW = toNum(smx.netWorth)
            const incomeY = toNum(smx.totalAnnualIncome)
            const expY = toNum(smx.totalMonthlyExp) * 12
            const saveY = toNum(smx.annualSavings)
            const netCF = incomeY - expY
            const emMonths = toNum(smx.totalMonthlyExp) > 0 ? liquidA / toNum(smx.totalMonthlyExp) : 0
            const savingsRate = toNum(smx.monthlyIncome) > 0 ? (saveY / (toNum(smx.monthlyIncome) * 12)) * 100 : 0
            const debtToAsset = totalA > 0 ? (debtB / totalA) * 100 : 0
            const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
              <div style={{ display: 'flex', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a', minWidth: 118, flexShrink: 0 }}>{label}</span>
                <span style={{ color: '#334155' }}>{children}</span>
              </div>
            )
            return (
              <div style={{ borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <Row label="สินทรัพย์ & หนี้สิน">สินทรัพย์รวม <b>{fmt(totalA)}</b> บาท (สภาพคล่อง {fmt(liquidA)} · ลงทุน {fmt(investA)} · ส่วนตัว {fmt(personalA)}) · หนี้สินรวม <b style={{ color: REDR }}>{fmt(debtB)}</b> บาท · ความมั่งคั่งสุทธิ <b style={{ color: GREENR }}>{fmt(netW)}</b> บาท</Row>
                <Row label="รายรับ & รายจ่าย">รายรับรวม <b>{fmt(incomeY)}</b> บาท/ปี · รายจ่ายรวม <b style={{ color: REDR }}>{fmt(expY)}</b> บาท/ปี · เงินออม <b>{fmt(saveY)}</b> บาท/ปี · กระแสเงินสดสุทธิ <b style={{ color: netCF >= 0 ? GREENR : REDR }}>{fmt(netCF)}</b> บาท/ปี</Row>
                <Row label="อัตราส่วนการเงิน">เงินสำรองฉุกเฉิน <b>{emMonths.toFixed(1)}</b> เดือน · หนี้สินต่อสินทรัพย์ <b>{debtToAsset.toFixed(0)}%</b> · อัตราการออม <b>{savingsRate.toFixed(0)}%</b></Row>
              </div>
            )
          })()}
        </div>
        {/* เป้าหมายของท่าน — ดึงจากหน้าเป้าหมายทางการเงินอัตโนมัติ + ช่องคอมเมนต์ */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>เป้าหมายของท่าน</div>
          {(() => {
            const GG = [
              { k: 'insurance', label: 'ความเสี่ยง & ประกัน', color: '#e11d48' },
              { k: 'education', label: 'ทุนการศึกษาบุตร', color: '#d97706' },
              { k: 'retirement', label: 'การเกษียณ', color: '#0891b2' },
              { k: 'short', label: 'ระยะสั้น', color: '#059669' },
              { k: 'medium', label: 'ระยะกลาง', color: '#0ea5e9' },
              { k: 'long', label: 'ระยะยาว', color: '#7c3aed' },
            ]
            const fg = client?.financialGoals || {}
            const selfNameG = `คุณ${client?.firstName || 'ลูกค้า'}`
            const spouseNameG = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
            const pick = (o: 'self' | 'spouse') => (fg.self || fg.spouse) ? fg[o] : (o === 'self' ? fg : null)
            const collect = (g: any, owner: string) => {
              const out: { area: string; color: string; name: string; when: string; amount: number; owner: string }[] = []
              if (!g) return out
              GG.forEach(grp => (g[grp.k] ?? []).forEach((r: any) => {
                if (!r?.name?.trim()) return
                const td = r.targetDate ? String(r.targetDate).trim() : ''
                out.push({ area: grp.label, color: grp.color, name: r.name, when: td ? (/^\d+$/.test(td) ? `ภายใน ${td} ปี` : td) : '', amount: toNum(r.targetAmount), owner })
              }))
              return out
            }
            const rows = [...collect(pick('self'), selfNameG), ...(hasSpouse ? collect(pick('spouse'), spouseNameG) : [])]
            if (rows.length === 0) return <div style={{ fontSize: 12.5, color: '#64748b', padding: '4px 0' }}>ยังไม่มีเป้าหมายที่บันทึกไว้ — กรอกที่หน้าเป้าหมายทางการเงิน</div>
            const total = rows.reduce((s, r) => s + r.amount, 0)
            return (
              <div style={{ borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, color: '#0f172a' }}><b>{r.name}</b> <span style={{ color: '#94a3b8' }}>· {r.area}{r.when ? ` · ${r.when}` : ''}{hasSpouse ? ` · ${r.owner}` : ''}</span></span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>{r.amount > 0 ? `${fmt(r.amount)} บาท` : '—'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f0fdfa', fontSize: 12.5 }}>
                  <b style={{ color: '#0f172a' }}>รวมเป้าหมายทั้งหมด</b>
                  <b style={{ fontFamily: 'monospace', color: TEAL }}>{fmt(total)} บาท</b>
                </div>
              </div>
            )
          })()}
        </div>
        {/* สรุปผลการวิเคราะห์ — จากผลวิเคราะห์จริง (สุขภาพการเงิน/เกษียณ/ประกัน/การศึกษา) + ช่องคอมเมนต์ */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>สรุปผลการวิเคราะห์</div>
          {(() => {
            const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
              <div style={{ display: 'flex', gap: 10, padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 800, color: '#0f172a', minWidth: 128, flexShrink: 0 }}>{label}</span>
                <span style={{ color: '#334155' }}>{children}</span>
              </div>
            )
            const clr = (pct: number) => pct >= 100 ? GREENR : pct >= 60 ? AMBERR : REDR
            const rows: React.ReactNode[] = []
            if (ratios?.healthScore != null)
              rows.push(<Row key="h" label="สุขภาพการเงินรวม"><b style={{ color: TEAL }}>{ratios.healthScore}/100</b>{ratios.healthLabel ? ` · ${ratios.healthLabel}` : ''}</Row>)
            if (retR)
              rows.push(<Row key="r" label="ความพร้อมเกษียณ">ความพร้อม <b style={{ color: clr(retR.readinessPct) }}>{retR.readinessPct}%</b> · ต้องการ {fmt(retR.needed)} · เตรียมแล้ว {fmt(retR.have)}{retR.gap > 0 ? <> · ยังขาด <b style={{ color: REDR }}>{fmt(retR.gap)}</b> บาท (ต้องออมเพิ่ม {fmt(retR.annualSavings)} บาท/ปี)</> : <> · <b style={{ color: GREENR }}>เพียงพอ</b></>}</Row>)
            if (insR && insR.need > 0)
              rows.push(<Row key="i" label="ความคุ้มครองประกัน">ควรมีทุน {fmt(insR.need)} · มีแล้ว {fmt(insR.have)}{insR.gap > 0 ? <> · ยังขาด <b style={{ color: REDR }}>{fmt(insR.gap)}</b> บาท</> : <> · <b style={{ color: GREENR }}>เพียงพอ</b></>}</Row>)
            if (eduR && eduR.childCount > 0)
              rows.push(<Row key="e" label="ทุนการศึกษาบุตร">ค่าเล่าเรียนรวม {fmt(eduR.totalNominal)} · เตรียมวันนี้ (PV) {fmt(eduR.totalPV)} · ต้องออม <b>{fmt(eduR.monthlySaving)}</b> บาท/เดือน</Row>)
            if (rows.length === 0) return <div style={{ fontSize: 12.5, color: '#64748b', padding: '4px 0' }}>ยังไม่มีผลวิเคราะห์เพียงพอ — กรอกข้อมูลในหน้าวางแผนการเงิน</div>
            return <div style={{ borderRadius: 8, overflow: 'hidden', background: '#fff' }}>{rows}</div>
          })()}
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', margin: '10px 0 4px' }}>ความเห็น/หมายเหตุเพิ่มเติม (ที่ปรึกษา)</div>
          <AdviceBox title="บทสรุปผู้บริหาร" heading={false} minHeight={70}
            placeholder="คลิกเพื่อพิมพ์บทสรุป/ข้อเสนอแนะภาพรวมจากการวิเคราะห์..."
            value={secs['exs2_analysis']?.text ?? ''} onSave={v => setText('exs2_analysis', v)}
            pos={secs['exs2_analysis']?.pos} onMove={p => setPos('exs2_analysis', p)} />
        </div>
      </div>
    )
}
