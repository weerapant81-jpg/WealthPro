// ── วิเคราะห์ข้อมูลพื้นฐาน ──
// ย้ายมาจาก ReportPage ทั้งก้อน — JSX เหมือนเดิมทุกบรรทัด เปลี่ยนแค่รับค่าผ่าน ctx แทน closure
import { annualIncome as incAnnual, isAnnualIncome as isAnnualInc } from '../../../lib/income'
import { toNum } from '@shared/finance/math'
import { TEAL, AMBERR, REDR, GREENR } from '../primitives'
import { fmt } from '../format'
import type { ReportCtx } from '../ctx'

export default function BasicInfo({ ctx }: { ctx: ReportCtx }) {
  const { client, age, hasSpouse } = ctx
    // ── วิเคราะห์ข้อมูลพื้นฐาน: ครอบครัว + งาน/สวัสดิการ (ข้อมูลชุดเดียวกับสไลด์ family/work ของเด็ค) ──
    const spouseName2 = client?.spouseProfile?.firstName ? `คุณ${client.spouseProfile.firstName}` : 'คู่สมรส'
    const selfName2 = `คุณ${client?.firstName || 'ลูกค้า'}`
    const healthSummary = (hi: any): string => {
      if (!hi) return ''
      const cond: string[] = []
      if (hi.chronic?.has) cond.push(`โรคประจำตัว${hi.chronic.detail ? ': ' + hi.chronic.detail : ''}`)
      if (hi.severeIllness?.has) cond.push(`โรคร้ายแรง${hi.severeIllness.detail ? ': ' + hi.severeIllness.detail : ''}`)
      const base = cond.length ? cond.join(' · ') : 'สุขภาพแข็งแรง ไม่มีโรคประจำตัว'
      return [base, [hi.smoke, hi.alcohol].filter(Boolean).join(' · ')].filter(Boolean).join(' · ')
    }
    const incomeList = (sources: any, fallbackSalary = 0) => {
      const arr = (Array.isArray(sources) ? sources : []).map((r: any) => {
        const amt = toNum(r?.amount)
        const annual = incAnnual(r)
        return { label: r?.source ? `${r.label} · ${r.source}` : (r?.label || 'รายได้'), amount: amt, yearly: annual, isBonus: isAnnualInc(r) }
      }).filter((r: any) => r.amount > 0)
      if (arr.length === 0 && fallbackSalary > 0) arr.push({ label: 'เงินเดือน', amount: fallbackSalary, yearly: fallbackSalary * 12, isBonus: false })
      return arr
    }
    const hobbyOf = (hi: any): string => hi?.hobby?.has ? (hi.hobby.detail?.trim() || 'มี') : ''
    const familyCards = [
      { name: selfName2, age2: age, occ: client?.occupation || client?.jobTitle, incomes: incomeList(client?.incomeSources, toNum(client?.salary)), health: healthSummary(client?.healthInfo), hobby: hobbyOf(client?.healthInfo), tint: TEAL },
      ...(hasSpouse ? [{ name: spouseName2, age2: client?.spouseAge, occ: client?.spouseProfile?.occupation || client?.spouseOccupation || client?.spouseProfile?.jobTitle, incomes: incomeList(client?.spouseIncomeSources, toNum(client?.spouseJobs?.[0]?.salary) || toNum(client?.spouseIncome)), health: healthSummary(client?.spouseProfile?.healthInfo), hobby: hobbyOf(client?.spouseProfile?.healthInfo), tint: '#8b5cf6' }] : []),
    ].map(p2 => ({ ...p2, totalYear: p2.incomes.reduce((x: number, r: any) => x + r.yearly, 0) }))
    const parentHealth = (h: string | undefined, ch: any) => [h, ch?.has ? `โรคประจำตัว${ch.detail ? ': ' + ch.detail : ''}` : ''].filter(Boolean).join(' · ')
    const mkParents = (src: any, owner: string) => {
      const pi = src?.parentsInfo || {}
      return [
        { rel: 'บิดา', name: pi.fatherName, age2: src?.fatherAge, health: parentHealth(pi.fatherHealth, pi.fatherChronic), owner },
        { rel: 'มารดา', name: pi.motherName, age2: src?.motherAge, health: parentHealth(pi.motherHealth, pi.motherChronic), owner },
      ].filter(p2 => toNum(p2.age2) > 0 || (p2.name && p2.name.trim()))
    }
    const dependents = [...mkParents(client, selfName2), ...(hasSpouse ? mkParents(client?.spouseProfile, spouseName2) : [])]
    const careExpense = toNum(client?.parentCareExpense) + (hasSpouse ? toNum(client?.spouseProfile?.parentCareExpense) : 0)
    const workCards = [
      { name: selfName2, tint: TEAL, job: { occupation: client?.occupation, jobTitle: client?.jobTitle, company: client?.company, workYears: client?.workYears, salary: client?.salary, rate: client?.salaryIncreaseRate }, wf: client },
      ...(hasSpouse ? [{ name: spouseName2, tint: '#8b5cf6', job: (() => { const j = Array.isArray(client?.spouseJobs) ? client.spouseJobs[0] : null; return { occupation: j?.occupation || client?.spouseProfile?.occupation, jobTitle: j?.jobTitle, company: j?.company, workYears: j?.workYears, salary: j?.salary ?? client?.spouseIncome, rate: j?.salaryIncreaseRate } })(), wf: client?.spouseProfile }] : []),
    ] as any[]
    const subH3: React.CSSProperties = { fontSize: 15, fontWeight: 800, color: '#0f172a', borderLeft: `5px solid ${TEAL}`, paddingLeft: 10, margin: '18px 0 10px' }
    const cardSt: React.CSSProperties = { border: '1px solid #f1f5f9', background: '#fbfdfe', borderRadius: 14, padding: 14, breakInside: 'avoid' }
    const FRow = ({ l, v }: { l: string; v: string }) => (
      <div style={{ display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.6 }}>
        <span style={{ color: '#94a3b8', flexShrink: 0, width: 66 }}>{l}:</span>
        <span style={{ color: '#334155', fontWeight: 600 }}>{v}</span>
      </div>
    )
    return (
      <div style={{ marginBottom: 16 }}>
        {/* ครอบครัว */}
        <div style={{ ...subH3, marginTop: 0 }}>ข้อมูลพื้นฐานครอบครัว</div>
        <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 12 }}>
          {familyCards.map((p2, i2) => (
            <div key={i2} style={cardSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, background: `${p2.tint}18`, color: p2.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{p2.name.replace('คุณ', '').charAt(0)}</span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>{p2.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>อายุ {p2.age2 ?? '—'} ปี{client?.maritalStatus ? ` · ${client.maritalStatus}` : ''}</div>
                </div>
              </div>
              {p2.occ && <FRow l="อาชีพ" v={String(p2.occ)} />}
              {p2.incomes.map((inc: any, j2: number) => (
                <div key={j2} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, lineHeight: 1.7 }}>
                  <span style={{ color: '#64748b' }}>{inc.label}</span>
                  <span style={{ color: GREENR, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{fmt(inc.amount)} /{inc.isBonus ? 'ปี' : 'เดือน'}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 4, fontSize: 12.5 }}>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>รายได้รวม/ปี</span>
                <span style={{ color: '#0f172a', fontWeight: 800, fontFamily: 'monospace' }}>{fmt(p2.totalYear)} บาท</span>
              </div>
              {p2.health && <FRow l="สุขภาพ" v={p2.health} />}
              {p2.hobby && <FRow l="งานอดิเรก" v={p2.hobby} />}
            </div>
          ))}
        </div>
        {((client?.children ?? []).length > 0 || dependents.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: ((client?.children ?? []).length > 0 && dependents.length > 0) ? '1fr 1fr' : '1fr', gap: 12 }}>
            {(client?.children ?? []).length > 0 && (
              <div style={cardSt}>
                <div style={{ fontSize: 13, fontWeight: 800, color: AMBERR, marginBottom: 8 }}>บุตร</div>
                {(client?.children ?? []).map((c2: any, i2: number) => (
                  <div key={i2} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: '7px 12px', marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', display: 'block' }}>{c2.name || `บุตรคนที่ ${i2 + 1}`}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>อายุ {toNum(c2.age)} ปี{c2.school ? ` · ${c2.school}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {dependents.length > 0 && (
              <div style={cardSt}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: REDR }}>บิดา / มารดา (ในอุปการะ)</span>
                  {careExpense > 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>ค่าดูแล <b style={{ color: AMBERR }}>{fmt(careExpense)}</b>/เดือน</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {dependents.map((d, i2) => (
                    <div key={i2} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 10, padding: '7px 12px', minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.rel}{d.name ? ` · ${d.name}` : ''}{hasSpouse ? <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}> (ของ{d.owner})</span> : ''}</div>
                      <div style={{ fontSize: 10.5, color: '#94a3b8' }}>อายุ {toNum(d.age2) || '—'} ปี{d.health ? ` · ${d.health}` : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* งาน & สวัสดิการ */}
        <div style={subH3}>ข้อมูลการทำงานและสวัสดิการ</div>
        <div style={{ display: 'grid', gridTemplateColumns: hasSpouse ? '1fr 1fr' : '1fr', gap: 12 }}>
          {workCards.map(p2 => {
            const WRow = ({ l, v, strong }: { l: string; v: string; strong?: boolean }) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid #f8fafc', fontSize: 11.5 }}>
                <span style={{ color: '#64748b' }}>{l}</span>
                <span style={{ fontWeight: strong ? 800 : 700, color: '#0f172a', textAlign: 'right' }}>{v}</span>
              </div>
            )
            const Benefit = ({ label, on, detail }: { label: string; on: boolean; detail?: string }) => (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? `${GREENR}1f` : '#f1f5f9', color: on ? GREENR : '#94a3b8', fontSize: 10, fontWeight: 800 }}>{on ? '✓' : '–'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: on ? '#0f172a' : '#94a3b8' }}>{label}</div>
                  {on && detail && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{detail}</div>}
                </div>
              </div>
            )
            const salaryM = toNum(p2.job.salary)
            return (
              <div key={p2.name} style={cardSt}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: p2.tint, marginBottom: 6 }}>{p2.name}</div>
                <WRow l="อาชีพ / ตำแหน่ง" v={[p2.job.occupation, p2.job.jobTitle].filter(Boolean).join(' · ') || '—'} />
                {p2.job.company && <WRow l="สถานที่ทำงาน" v={String(p2.job.company)} />}
                {toNum(p2.job.workYears) > 0 && <WRow l="อายุงาน" v={`${toNum(p2.job.workYears)} ปี`} />}
                <WRow l="เงินเดือน" v={salaryM > 0 ? `${fmt(salaryM)} บาท/เดือน` : '—'} strong />
                <WRow l="อัตราการเพิ่มขึ้นของรายได้" v={p2.job.rate != null && p2.job.rate !== '' ? `${toNum(p2.job.rate)}% ต่อปี` : '—'} />
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: '#94a3b8', textTransform: 'uppercase', margin: '9px 0 1px' }}>สวัสดิการที่มี</div>
                <Benefit label="ประกันสังคม" on={!!p2.wf?.hasSocialSecurity}
                  detail={[toNum(p2.wf?.socialSecurityYears) > 0 ? `สมทบมาแล้ว ${toNum(p2.wf?.socialSecurityYears)} ปี` : '', toNum(p2.wf?.socialSecurityValue) > 0 ? `มูลค่ากองทุน ${fmt(toNum(p2.wf?.socialSecurityValue))} บาท` : ''].filter(Boolean).join(' · ')} />
                <Benefit label="ประกันกลุ่ม" on={!!p2.wf?.hasGroupInsurance}
                  detail={[toNum(p2.wf?.giRoomLimit) > 0 ? `ค่าห้อง ${fmt(toNum(p2.wf?.giRoomLimit))}` : '', toNum(p2.wf?.giMedicalLimit) > 0 ? `ค่ารักษา ${fmt(toNum(p2.wf?.giMedicalLimit))}` : '', toNum(p2.wf?.giOpdLimit) > 0 ? `OPD ${fmt(toNum(p2.wf?.giOpdLimit))}` : ''].filter(Boolean).join(' · ')} />
                <Benefit label="กองทุนสำรองเลี้ยงชีพ (PVD)" on={!!p2.wf?.hasPVD}
                  detail={[toNum(p2.wf?.pvdEmployeeRate) > 0 ? `สะสม ${toNum(p2.wf?.pvdEmployeeRate)}%` : '', toNum(p2.wf?.pvdEmployerRate) > 0 ? `นายจ้างสมทบ ${toNum(p2.wf?.pvdEmployerRate)}%` : '', toNum(p2.wf?.pvdCurrentValue) > 0 ? `มูลค่าปัจจุบัน ${fmt(toNum(p2.wf?.pvdCurrentValue))} บาท` : ''].filter(Boolean).join(' · ')} />
              </div>
            )
          })}
        </div>
      </div>
    )
}
