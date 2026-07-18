import { useMemo, useState } from 'react'
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { CAREERS } from '../../lib/game/careers'
import { computeInsights, finishGame } from '../../lib/game/engine'
import type { DecisionLog, GameState } from '../../lib/game/types'
import { btnGhost, btnPrimary, fmtAxis, fmtTH, gradeColor, happyEmoji } from './format'

/* ── จอสรุปผลตอนอายุ 60: เกรด + insight + ฟอร์มรับคำปรึกษา (lead) ── */

export default function SummaryScreen({ state, log, onReplay }: {
  state: GameState
  log: DecisionLog
  onReplay: () => void
}) {
  const result = useMemo(() => finishGame(state), [state])
  const insights = useMemo(() => computeInsights(state.seed, log, state, result), [state, log, result])
  const career = CAREERS[state.careerId]
  const gc = gradeColor(result.grade)
  const forever = result.fundedAge >= 100

  const [lead, setLead] = useState({ name: '', contact: '' })
  const [leadStatus, setLeadStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submitLead = async () => {
    if (!lead.name.trim() || !lead.contact.trim()) return
    setLeadStatus('sending')
    try {
      await api.post('/game/lead', {
        name: lead.name.trim(), contact: lead.contact.trim(),
        career: career.name, score: result.score, grade: result.grade,
        result: { fundedAge: result.fundedAge, netWorth: Math.round(result.netWorth), happiness: Math.round(result.happiness) },
      })
      setLeadStatus('done')
    } catch {
      setLeadStatus('error')
    }
  }

  const share = async () => {
    const text = `ฉันเล่น "เกมเศรษฐี" ของ WealthPro ได้เกรด ${result.grade} — ${forever ? 'เงินพอใช้ตลอดชีวิต!' : `เงินพอใช้ถึงอายุ ${result.fundedAge}`} คุณล่ะจะเกษียณได้ไหม? ลองเล่น: ${location.origin}/game`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); alert('คัดลอกข้อความแชร์แล้ว!') }
    } catch { /* ผู้ใช้ยกเลิก */ }
  }

  const chartData = state.history.map(h => ({ age: h.age, nw: Math.round(h.netWorth) }))
  const eventDots = state.log
    .map(e => {
      const snap = state.history.find(h => h.year === e.year)
      return snap ? { age: snap.age, nw: Math.round(snap.netWorth), title: e.title } : null
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fpAppear .4s ease' }}>

      {/* เกรด hero */}
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>🎉 อายุ 60 — ถึงเวลาเกษียณแล้ว!</div>
        <div style={{
          width: 110, height: 110, borderRadius: '50%', margin: '14px auto 0',
          border: `4px solid ${gc}`, background: `${gc}18`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: gc, lineHeight: 1 }}>{result.grade}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{result.score}/100</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 14, lineHeight: 1.35 }}>
          {forever ? <>เงินของคุณพอใช้<span style={{ color: gc }}> ตลอดชีวิต</span> 🎊</>
            : <>เงินของคุณพอใช้ถึงอายุ <span style={{ color: gc, fontSize: 26 }}>{result.fundedAge}</span> ปี</>}
        </div>
        {!forever && result.fundedAge < 85 && (
          <div style={{ fontSize: 12.5, color: '#ff8080', marginTop: 4 }}>คนไทยอายุยืนเฉลี่ยถึง ~85 ปี — ยังขาดอีก {85 - result.fundedAge} ปี</div>
        )}
      </div>

      {/* ตัวเลขสรุป */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="ความมั่งคั่งสุทธิ" value={`${fmtTH(result.netWorth)} ฿`} />
        <Stat label="เงินก้อนใช้ยามเกษียณ" value={`${fmtTH(result.assetsAtRetire)} ฿`} />
        <Stat label={career.pensionPct > 0 ? 'บำนาญ/เดือน' : 'บำนาญ (ประกันสังคม)/เดือน'} value={`${fmtTH(result.pensionMonthly)} ฿`} />
        <Stat label="ความสุขบั้นปลาย" value={`${happyEmoji(result.happiness)} ${Math.round(result.happiness)}/100`} />
      </div>

      {/* กราฟชีวิต + จุดเหตุการณ์ */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '14px 8px 6px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', paddingLeft: 10 }}>เส้นทางความมั่งคั่ง 30 ปีของคุณ</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gSum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="age" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} type="number" domain={[30, 60]} tickCount={7} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={40} />
              <Tooltip
                formatter={(v) => [`${fmtTH(Number(v))} บาท`, 'ความมั่งคั่ง']}
                labelFormatter={(l) => `อายุ ${l} ปี`}
                contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="nw" stroke="var(--cyan)" strokeWidth={2} fill="url(#gSum)" isAnimationActive={false} />
              {eventDots.map((d, i) => (
                <ReferenceDot key={i} x={d.age} y={d.nw} r={4} fill="var(--gold)" stroke="var(--navy-900)" strokeWidth={1.5} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight cards — หัวใจของการเปิดบทสนทนา */}
      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>💡 สิ่งที่เกมนี้อยากบอกคุณ</div>
          {insights.map((c, i) => (
            <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderLeft: '3px solid var(--gold)', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>{c.emoji} {c.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 5 }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* ไทม์ไลน์เหตุการณ์ */}
      <details style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '12px 15px' }}>
        <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>📜 เหตุการณ์ทั้งหมดในชีวิตคุณ ({state.log.length})</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {state.log.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'baseline' }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 800, minWidth: 48 }}>อายุ {e.age}</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{e.title}</span>
              {e.moneyDelta !== 0 && (
                <span style={{ fontWeight: 700, color: e.moneyDelta > 0 ? 'var(--cyan)' : '#ff8080' }}>
                  {e.moneyDelta > 0 ? '+' : ''}{fmtTH(e.moneyDelta)}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>

      {/* Lead form */}
      <div style={{
        background: 'linear-gradient(135deg, var(--cyan-dim), transparent)', border: '1px solid var(--cyan)',
        borderRadius: 16, padding: 18,
      }}>
        {leadStatus === 'done' ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 34 }}>🤝</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>รับข้อมูลแล้ว ขอบคุณครับ!</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>ที่ปรึกษาการเงินจะติดต่อกลับโดยเร็วที่สุด</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.45 }}>
              ในเกมยังแก้ตัวได้... แต่ชีวิตจริงมีรอบเดียว
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.6 }}>
              อยากรู้ว่าชีวิตจริงของคุณจะเกษียณได้ไหม? รับการวิเคราะห์แผนการเงินส่วนตัวจากที่ปรึกษา <b>ฟรี ไม่มีค่าใช้จ่าย</b>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <input value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} placeholder="ชื่อเล่น / ชื่อที่ให้เรียก"
                style={inputStyle} maxLength={80} />
              <input value={lead.contact} onChange={e => setLead({ ...lead, contact: e.target.value })} placeholder="เบอร์โทร หรือ Line ID"
                style={inputStyle} maxLength={80} />
              <button onClick={submitLead} disabled={leadStatus === 'sending' || !lead.name.trim() || !lead.contact.trim()}
                style={{ ...btnPrimary, opacity: leadStatus === 'sending' || !lead.name.trim() || !lead.contact.trim() ? 0.55 : 1 }}>
                {leadStatus === 'sending' ? 'กำลังส่ง...' : 'รับคำปรึกษาฟรี 🎯'}
              </button>
              {leadStatus === 'error' && <div style={{ fontSize: 11.5, color: '#ff8080', textAlign: 'center' }}>ส่งไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อที่ปรึกษาของคุณโดยตรง</div>}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>ข้อมูลใช้เพื่อติดต่อกลับเท่านั้น ไม่บังคับกรอก</div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button onClick={share} style={btnGhost}>📤 แชร์ผล</button>
        <button onClick={onReplay} style={btnGhost}>🔄 เล่นอีกครั้ง</button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 10, border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '10px 13px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  )
}
