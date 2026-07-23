// ── เป้าหมายทางการเงินเพื่อการศึกษาบุตร ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { toNum } from '@shared/finance/math'
import { computeChildPlan, levelForAge } from '../../EducationPlanPage'
import { eduSettingOf } from '../eduSetting'
import { TEAL, AMBERR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function EducationSection({ ctx }: { ctx: ReportCtx }) {
  const { client, eduPlan, eduCosts, eduInf, eduRet, children } = ctx
    if (!children.length) return <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>ยังไม่มีข้อมูลบุตร</div>
    const nowYearBE = new Date().getFullYear() + 543
    const eduGrowth = toNum(client?.salaryIncreaseRate)
    const planOf = (c: any, i2: number) => computeChildPlan(toNum(c.age), eduSettingOf(eduPlan?.[i2]), eduCosts, eduInf, eduRet, eduGrowth)
    const totalAll = children.reduce((acc, c, i2) => {
      const e = planOf(c, i2)
      return { nominal: acc.nominal + e.totalNominal, pv: acc.pv + e.totalPV, monthly: acc.monthly + e.monthlySaving }
    }, { nominal: 0, pv: 0, monthly: 0 })
    const Stat = ({ l, v, c, unit = 'บาท' }: { l: string; v: string; c: string; unit?: string }) => (
      <div style={{ border: '1px solid #f1f5f9', borderLeft: `4px solid ${c}`, borderRadius: 10, padding: '10px 14px' }}>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{l}</div>
        <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'monospace', color: c, marginTop: 2 }}>{v}</div>
        <div style={{ fontSize: 10, color: '#cbd5e1' }}>{unit}</div>
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, marginBottom: 12 }}>ทุนการศึกษาบุตรที่ต้องการ</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
          <Stat l="จำนวนบุตร" v={String(children.length)} c="#0f172a" unit="คน" />
          <Stat l="ค่าเล่าเรียนรวม (อนาคต)" v={fmt(totalAll.nominal)} c={AMBERR} />
          <Stat l="เงินก้อนวันนี้ (PV)" v={fmt(totalAll.pv)} c={TEAL} />
          <Stat l="ต้องออม/เดือน" v={fmt(totalAll.monthly)} c={GREENR} />
        </div>
        {children.map((c, ci) => {
          const setting = eduSettingOf(eduPlan?.[ci])
          const type = setting.type
          const includeMaster = setting.includeMaster
          const ageNow = toNum(c.age)
          // แสดงเฉพาะระดับชั้นที่เลือกไว้ในหน้าทุนการศึกษา (ที่ตัดออกไม่นับทั้งในตารางและยอดรวม)
          const rows: { age: number; year: number; lvl: string; cur: number; fut: number }[] = []
          for (let a = Math.max(ageNow, 3); a <= 23; a++) {
            const lvl = levelForAge(a); if (!lvl) continue
            if (lvl.key === 'master' && !includeMaster) continue
            if (setting.excludedLevels?.includes(lvl.key)) continue
            const base = toNum(eduCosts?.[lvl.key]?.[type]); if (base <= 0) continue
            rows.push({ age: a, year: nowYearBE + (a - ageNow), lvl: lvl.label, cur: base, fut: base * Math.pow(1 + eduInf / 100, a - ageNow) })
          }
          if (!rows.length) return null
          const tdE: React.CSSProperties = { padding: '4px 10px', fontSize: 11.5, color: '#334155' }
          return (
            <div key={ci} style={{ border: '1px solid #f1f5f9', borderRadius: 12, overflow: 'hidden', marginBottom: 12, breakInside: 'avoid' }}>
              <div style={{ padding: '7px 12px', background: '#f8fafc', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                {c.name || `บุตรคนที่ ${ci + 1}`} · อายุปัจจุบัน {ageNow} ปี <span style={{ color: '#94a3b8', fontWeight: 600 }}>({type === 'private' ? 'เอกชน' : type === 'inter' ? 'นานาชาติ' : 'รัฐบาล'}{includeMaster ? ' · รวมปริญญาโท' : ''})</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['อายุ', 'ปี พ.ศ.', 'ระดับ', 'ค่าเล่าเรียน (ปัจจุบัน)', 'ปรับเงินเฟ้อแล้ว'].map((h, i2) => (
                      <th key={h} style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#64748b', textAlign: i2 >= 3 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.age} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={tdE}>{r.age}</td>
                      <td style={tdE}>{r.year}</td>
                      <td style={tdE}>{r.lvl}</td>
                      <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace' }}>{fmt(r.cur)}</td>
                      <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>{fmt(r.fut)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1.5px solid #cbd5e1' }}>
                    <td colSpan={4} style={{ ...tdE, fontWeight: 800, color: '#0f172a' }}>รวม (ตามราคาอนาคต)</td>
                    <td style={{ ...tdE, textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: AMBERR }}>{fmt(rows.reduce((x, r) => x + r.fut, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7 }}>* เงินเฟ้อค่าการศึกษา {eduInf}% ต่อปี · ผลตอบแทนกองทุนเพื่อการศึกษา {eduRet}% ต่อปี (จากหน้าสมมติฐาน)</p>
      </div>
    )
}
