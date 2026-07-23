// ── สมมติฐานที่ใช้ในการวางแผน + ตารางค่าใช้จ่ายด้านการศึกษา ──
// ย้ายออกจาก ReportPage มาทั้งก้อน (JSX เหมือนเดิมทุกบรรทัด) — รับค่าที่เคยอ่านจาก closure ผ่าน props แทน
import { toNum } from '@shared/finance/math'
import { TEAL } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function Assumptions({ ctx }: { ctx: ReportCtx }) {
  const { profile, client, retPlan, portRet, eduInf, eduRet, eduCosts } = ctx
  const pc = (v: any, suffix = '%') => v == null || v === '' ? '—' : `${v}${suffix}`
  const rows: [string, string][] = [
    ['อัตราเงินเฟ้อทั่วไป', pc(profile?.inflationRate ?? 3)],
    ['อัตราเงินเฟ้อค่าการศึกษา', pc(eduInf)],
    ['ผลตอบแทนกองทุนเพื่อการศึกษา', pc(eduRet)],
    ['อายุเกษียณ (ลูกค้า)', pc(profile?.retirementAgeSelf ?? 60, ' ปี')],
    ['อายุขัยที่ใช้วางแผน (ลูกค้า)', pc(profile?.lifeExpectancySelf ?? 85, ' ปี')],
    ...(client?.spouseProfile?.firstName ? [
      ['อายุเกษียณ (คู่สมรส)', pc(profile?.retirementAgeSpouse ?? 60, ' ปี')] as [string, string],
      ['อายุขัยที่ใช้วางแผน (คู่สมรส)', pc(profile?.lifeExpectancySpouse ?? 85, ' ปี')] as [string, string],
    ] : []),
    ['ผลตอบแทนคาดหวังก่อนเกษียณ', pc(retPlan?.self?.preRetirementReturn ?? 8)],
    ['ผลตอบแทนคาดหวังหลังเกษียณ', pc(retPlan?.self?.postRetirementReturn ?? 5)],
    ['อัตราการเติบโตของรายได้', pc(retPlan?.self?.savingsGrowthRate ?? 0)],
    ['ผลตอบแทนพอร์ตลงทุนปัจจุบัน (ถัวเฉลี่ย)', `${portRet.toFixed(1)}%`],
  ]
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 12 }}>การคำนวณทั้งหมดในรายงานฉบับนี้ตั้งอยู่บนสมมติฐานต่อไปนี้ การเปลี่ยนแปลงของสมมติฐานแม้เพียงเล็กน้อยอาจส่งผลต่อผลลัพธ์อย่างมีนัยสำคัญ</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>{rows.map(([l, v], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fbfdfe' : 'transparent' }}>
            <td style={{ padding: '8px 10px', color: '#475569' }}>{l}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{v}</td>
          </tr>
        ))}</tbody>
      </table>
      <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.7 }}>* สมมติฐานปรับแก้ได้ที่หน้า "สมมติฐาน" ของโปรแกรม และควรทบทวนร่วมกันอย่างน้อยปีละ 1 ครั้ง</p>
      {/* ค่าใช้จ่ายด้านการศึกษา (มูลค่าปัจจุบัน) */}
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '22px 0 10px' }}>ค่าใช้จ่ายด้านการศึกษา (มูลค่าปัจจุบัน ณ ปี พ.ศ. {new Date().getFullYear() + 543})</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
            {['ระดับการศึกษา', 'สถาบันรัฐ (บาท/ปี)', 'สถาบันเอกชน (บาท/ปี)', 'สถาบันนานาชาติ (บาท/ปี)'].map((h, i2) => (
              <th key={h} style={{ padding: '7px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textAlign: i2 === 0 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{([['kindergarten', 'อนุบาล 1–3'], ['primary', 'ประถม 1–6'], ['secondary', 'มัธยม 1–6'], ['bachelor', 'ปริญญาตรี (ปีแรก)'], ['master', 'ปริญญาโท (ปีแรก)']] as const).map(([k2, lbl], i2) => (
          <tr key={k2} style={{ borderBottom: '1px solid #f1f5f9', background: i2 % 2 ? '#fbfdfe' : 'transparent' }}>
            <td style={{ padding: '7px 10px', color: '#475569' }}>{lbl}</td>
            {(['public', 'private', 'international'] as const).map(t2 => (
              <td key={t2} style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: toNum(eduCosts?.[k2]?.[t2]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                {toNum(eduCosts?.[k2]?.[t2]) > 0 ? fmt(toNum(eduCosts[k2][t2])) : '—'}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
