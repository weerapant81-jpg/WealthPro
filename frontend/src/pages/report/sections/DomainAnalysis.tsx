// ── บทวิเคราะห์และการดำเนินการ 6 ด้าน ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { calc as calcTaxCalc, defaultState as defaultTaxState } from '../../../lib/tax'
import { toNum } from '@shared/finance/math'
import { DomainCard } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function DomainAnalysis({ kind, ctx }: { kind: string; ctx: ReportCtx }) {
  const { client, profile, taxPlanQ, domainAdvice, retR, insR, eduR, retRSp, insRSp, ratiosSp, sm, totalInv, portRet, hasSpouse, totalInvSp, portRetSp } = ctx
    const isSp = kind === 'domains_spouse'
    if (isSp && !hasSpouse) return null
    const s2 = isSp ? (ratiosSp?.summary ?? {}) : sm
    const iR = isSp ? insRSp : insR
    const rR = isSp ? retRSp : retR
    const tInv = isSp ? totalInvSp : totalInv
    const pRet = isSp ? portRetSp : portRet
    const adv: Record<string, string> = isSp ? {} : domainAdvice
    const tp = isSp ? taxPlanQ?.spouse : taxPlanQ?.self
    const tc = tp ? calcTaxCalc({ ...defaultTaxState(), ...tp }) : null
    const emMonths = s2.totalMonthlyExp > 0 ? s2.liquidAssets / s2.totalMonthlyExp : 0
    const savingsRate = s2.monthlyIncome > 0 ? (s2.annualSavings / (s2.monthlyIncome * 12)) * 100 : 0
    const debtToAsset = s2.totalAssets > 0 ? (s2.totalDebtBalance / s2.totalAssets) * 100 : 0
    const liqOk = emMonths >= 6 && debtToAsset <= 50 && savingsRate >= 10
    return (
      <div style={{ marginBottom: 16 }}>
        {isSp && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>สรุปสถานะการวางแผนการเงินของ{client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'} (คู่สมรส)</p>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DomainCard no={1} advice={adv.liquidity} title="การบริหารสภาพคล่อง/หนี้สิน"
          status={liqOk ? { label: 'เพียงพอ', tone: 'good' } : { label: 'ควรปรับปรุง', tone: 'warn' }}
          pct={Math.min(100, emMonths / 6 * 100)}
          rows={[['เงินสำรองฉุกเฉิน (เดือน)', `${emMonths.toFixed(1)} / 6.0`], ['อัตราการออม', `${savingsRate.toFixed(0)}%`], ['หนี้สินต่อสินทรัพย์', `${debtToAsset.toFixed(0)}%`]]} />
        <DomainCard no={2} advice={adv.investment} title="การวางแผนการลงทุน/เป้าหมาย"
          status={tInv > 0 ? { label: 'ดำเนินการอยู่', tone: 'good' } : { label: 'เริ่มวางแผน', tone: 'warn' }}
          pct={tInv > 0 ? 80 : 15}
          rows={[['สินทรัพย์ลงทุนรวม', `${fmt(tInv)} ฿`], ['ผลตอบแทนพอร์ต (เฉลี่ย)', `${pRet.toFixed(1)}%`]]} />
        {eduR && eduR.childCount > 0 && (
          <DomainCard no={3} advice={adv.education} title="ทุนการศึกษาบุตร"
            status={{ label: `บุตร ${eduR.childCount} คน`, tone: 'good' }}
            pct={eduR.totalNominal > 0 ? Math.min(100, (eduR.totalPV / eduR.totalNominal) * 100) : 0}
            rows={[['ค่าเล่าเรียนรวมที่ต้องเตรียม', `${fmt(eduR.totalNominal)} ฿`], ['มูลค่าปัจจุบัน (เงินก้อนวันนี้)', `${fmt(eduR.totalPV)} ฿`], ['ต้องออม/เดือน', `${fmt(eduR.monthlySaving)} ฿`]]} />
        )}
        <DomainCard no={eduR && eduR.childCount > 0 ? 4 : 3} advice={adv.insurance} title="การวางแผนประกัน & ความเสี่ยง"
          status={iR ? (iR.gap > 0 ? { label: `ขาด ${fmt(iR.gap)} ฿`, tone: 'warn' } : { label: 'เพียงพอ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
          pct={iR && iR.need > 0 ? iR.have / iR.need * 100 : 0}
          rows={[['ทุนประกันที่แนะนำ', iR ? `${fmt(iR.need)} ฿` : '—'], ['ความคุ้มครองที่มี', iR ? `${fmt(iR.have)} ฿` : '—'], ['ส่วนที่ยังขาด', iR && iR.gap > 0 ? `${fmt(iR.gap)} ฿` : 'เพียงพอ']]} />
        <DomainCard no={eduR && eduR.childCount > 0 ? 5 : 4} advice={adv.retirement} title="การวางแผนเกษียณอายุ"
          status={rR ? (rR.gap > 0 ? { label: `ขาด ${fmt(rR.gap)} ฿`, tone: 'warn' } : { label: 'พร้อมเกษียณ', tone: 'good' }) : { label: 'รอข้อมูล', tone: 'warn' }}
          pct={rR?.readinessPct ?? 0}
          rows={[['ทุนเกษียณที่ต้องการ', rR ? `${fmt(rR.needed)} ฿` : '—'], ['ทรัพย์สินที่เตรียมแล้ว', rR ? `${fmt(rR.have)} ฿` : '—'], ['ต้องออมเพิ่ม/ปี', rR && rR.gap > 0 ? `${fmt(rR.annualSavings)} ฿` : '—']]} />
        <DomainCard no={eduR && eduR.childCount > 0 ? 6 : 5} advice={adv.tax} title="การวางแผนภาษี"
          status={tc ? { label: 'วางแผนแล้ว', tone: 'good' } : { label: 'ยังไม่วางแผน', tone: 'warn' }}
          pct={tc ? 75 : 10}
          rows={[['เงินได้สุทธิ', tc ? `${fmt(tc.ni)} ฿` : '—'], ['ภาษีที่ต้องชำระ', tc ? `${fmt(tc.netTax)} ฿` : '—'], ['อัตราภาษีที่แท้จริง', tc ? `${tc.eff.toFixed(1)}%` : '—']]} />
        <DomainCard no={eduR && eduR.childCount > 0 ? 7 : 6} advice={adv.estate} title="การวางแผนส่งมอบมรดก"
          status={profile?.estatePlan ? { label: 'มีแผนแล้ว', tone: 'good' } : { label: 'ควรจัดทำ', tone: 'warn' }}
          pct={profile?.estatePlan ? 70 : 15}
          rows={[['ความมั่งคั่งสุทธิ (กองมรดก)', `${fmt(toNum(s2.netWorth))} ฿`], ['สถานะแผนมรดก/พินัยกรรม', profile?.estatePlan ? 'จัดทำแล้ว' : 'ยังไม่จัดทำ']]} />
        </div>
      </div>
    )
}
