import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CAREERS } from '../../lib/game/careers'
import {
  DEFAULT_PLAN, PERIOD_YEARS, START_AGE, TOTAL_YEARS,
  applyCheckpoint, applyEventChoice, checkpointAt, netWorth, periodOf, resolveYear,
  type CheckpointView,
} from '../../lib/game/engine'
import type { DecisionLog, EventInstance, GameState, LoggedEvent, PlanChoices, RiskLevel } from '../../lib/game/types'
import { btnGhost, btnPrimary, fmtAxis, fmtTH, happyEmoji } from './format'

/* ── จอเล่นเกม: ตั้งแผน → จำลองรายปี (animate) → เหตุการณ์/checkpoint ── */

type Phase =
  | { kind: 'plan' }
  | { kind: 'checkpoint'; view: CheckpointView }
  | { kind: 'anim' }
  | { kind: 'event'; ev: EventInstance }
  | { kind: 'result'; emoji: string; title: string; logged: LoggedEvent }

const TICK_MS = 620

export default function PlayScreen({ initState, initLog, onPersist, onFinish }: {
  initState: GameState
  initLog: DecisionLog
  onPersist: (state: GameState, log: DecisionLog) => void
  onFinish: (state: GameState, log: DecisionLog) => void
}) {
  const [game, setGame] = useState(initState)
  const logRef = useRef<DecisionLog>(initLog)
  const [plan, setPlan] = useState<PlanChoices>(
    initLog.plans[periodOf(initState.year)] ?? initLog.plans[initLog.plans.length - 1] ?? DEFAULT_PLAN,
  )
  const [phase, setPhase] = useState<Phase>(() => {
    const cp = checkpointAt(initState)
    return cp ? { kind: 'checkpoint', view: cp } : { kind: 'plan' }
  })
  const career = CAREERS[game.careerId]
  const age = START_AGE + game.year

  /** เดินเกมต่อหลังปิด modal/จบ tick: จบเกม → ครบช่วง → เล่นปีถัดไป */
  const continueFlow = (s: GameState) => {
    if (s.year >= TOTAL_YEARS) { onFinish(s, logRef.current); return }
    if (s.year % PERIOD_YEARS === 0) {
      onPersist(s, logRef.current)
      const cp = checkpointAt(s)
      setPhase(cp ? { kind: 'checkpoint', view: cp } : { kind: 'plan' })
      return
    }
    setPhase({ kind: 'anim' })
  }

  // animation loop: จำลองทีละปีจนกว่าจะเจอเหตุการณ์/ครบช่วง/จบเกม
  useEffect(() => {
    if (phase.kind !== 'anim') return
    const t = setTimeout(() => {
      const { state: ns, event } = resolveYear(game, plan)
      setGame(ns)
      if (event) { setPhase({ kind: 'event', ev: event }); return }
      continueFlow(ns)
    }, TICK_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game])

  const startPeriod = () => {
    const p = periodOf(game.year)
    for (let i = 0; i <= p; i++) if (!logRef.current.plans[i]) logRef.current.plans[i] = plan
    logRef.current.plans[p] = plan
    onPersist(game, logRef.current)
    setPhase({ kind: 'anim' })
  }

  const chooseEvent = (ev: EventInstance, choiceId: string) => {
    logRef.current.eventChoices[ev.key] = choiceId
    const { state: ns, logged } = applyEventChoice(game, ev, choiceId)
    setGame(ns)
    onPersist(ns, logRef.current)
    setPhase({ kind: 'result', emoji: ev.emoji, title: logged.title, logged })
  }

  const chooseCheckpoint = (view: CheckpointView, choiceId: string) => {
    logRef.current.checkpointChoices[view.id] = choiceId
    const ns = applyCheckpoint(game, view.id, choiceId)
    setGame(ns)
    onPersist(ns, logRef.current)
    setPhase({ kind: 'plan' })
  }

  /* พรีวิวแผน: เหลือใช้อิสระ/เดือนโดยประมาณ */
  const incomeM = game.monthlyIncome + game.spouseIncome
  const healthPremM = plan.healthIns && !career.freeHealthcare ? (12000 + 600 * game.year) / 12 : 0
  const lifePremM = plan.lifeIns ? 15000 / 12 : 0
  const mandatoryM = game.livingMonthly + game.rentMonthly + game.mortgageMonthly + healthPremM + lifePremM
  const freeM = incomeM * (1 - (plan.savePct + plan.investPct) / 100) - mandatoryM

  const chartData = game.history.map(h => ({ age: h.age, nw: Math.round(h.netWorth) }))
  if (chartData.length === 0) chartData.push({ age: START_AGE, nw: Math.round(netWorth(game)) })

  const periodEndAge = Math.min(60, START_AGE + (periodOf(game.year) + 1) * PERIOD_YEARS)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fpAppear .3s ease' }}>

      {/* แถบสถานะบน */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: 'var(--cyan-dim)', borderRadius: 12, padding: '8px 14px', textAlign: 'center', minWidth: 64 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cyan)', lineHeight: 1 }}>{age}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>อายุ (ปี)</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ความมั่งคั่งสุทธิ</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: netWorth(game) >= 0 ? 'var(--text-primary)' : '#ff5d5d', lineHeight: 1.15 }}>
            {fmtTH(netWorth(game))} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>บาท</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20 }}>{happyEmoji(game.happiness)}</div>
          <div style={{ width: 52, height: 5, borderRadius: 3, background: 'var(--input-bg)', marginTop: 3 }}>
            <div style={{ width: `${game.happiness}%`, height: '100%', borderRadius: 3, background: 'var(--gold)' }} />
          </div>
        </div>
      </div>

      {/* ไทม์ไลน์อายุ 30→60 */}
      <div style={{ height: 5, borderRadius: 3, background: 'var(--input-bg)', overflow: 'hidden' }}>
        <div style={{ width: `${(game.year / TOTAL_YEARS) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--cyan-light))', transition: 'width .5s ease' }} />
      </div>

      {/* ชิปเงิน */}
      <div style={{ display: 'grid', gridTemplateColumns: game.debt > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 8 }}>
        <Chip label="💵 เงินสด" value={fmtTH(game.cash)} />
        <Chip label="📈 พอร์ตลงทุน" value={fmtTH(game.invested)} />
        {game.debt > 0 && <Chip label="🔥 หนี้" value={fmtTH(game.debt)} color="#ff5d5d" />}
      </div>

      {/* กราฟความมั่งคั่ง */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 6px 4px', height: 168 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gNW" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="age" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[START_AGE, 60]} type="number" tickCount={7} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={38} />
            <Tooltip
              formatter={(v) => [`${fmtTH(Number(v))} บาท`, 'ความมั่งคั่ง']}
              labelFormatter={(l) => `อายุ ${l} ปี`}
              contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="nw" stroke="var(--cyan)" strokeWidth={2} fill="url(#gNW)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* โซนล่าง: แผน หรือสถานะกำลังเล่น */}
      {phase.kind === 'plan' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>วางแผนช่วงอายุ {age}–{periodEndAge}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
              รายได้ครัวเรือน ~{fmtTH(incomeM)} บาท/เดือน · รายจ่ายจำเป็น ~{fmtTH(mandatoryM)} บาท/เดือน
            </div>
          </div>

          <SliderRow label="🏦 ออมเงินฝาก" value={plan.savePct} onChange={v => setPlan({ ...plan, savePct: v })} />
          <SliderRow label="📈 ลงทุน" value={plan.investPct} onChange={v => setPlan({ ...plan, investPct: v })} />

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>ระดับความเสี่ยงพอร์ต</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {([['low', 'ต่ำ', 'ฝาก/พันธบัตร'], ['mid', 'กลาง', 'ผสมสมดุล'], ['high', 'สูง', 'หุ้นล้วน']] as [RiskLevel, string, string][]).map(([id, name, sub]) => (
                <button key={id} onClick={() => setPlan({ ...plan, risk: id })} style={{
                  padding: '8px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${plan.risk === id ? 'var(--cyan)' : 'var(--input-border)'}`,
                  background: plan.risk === id ? 'var(--cyan-dim)' : 'var(--input-bg)',
                  color: plan.risk === id ? 'var(--cyan)' : 'var(--text-secondary)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{name}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.85 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {career.freeHealthcare ? (
              <div style={{ fontSize: 11.5, color: 'var(--cyan)', background: 'var(--cyan-dim)', borderRadius: 10, padding: '10px 12px', fontWeight: 600 }}>
                🏥 สวัสดิการรัฐ — รักษาฟรี
              </div>
            ) : (
              <ToggleRow label="🛡️ ประกันสุขภาพ" sub={`เบี้ย ~${fmtTH(12000 + 600 * game.year)}/ปี`} on={plan.healthIns} onToggle={() => setPlan({ ...plan, healthIns: !plan.healthIns })} />
            )}
            <ToggleRow label="👨‍👩‍👧 ประกันชีวิต" sub="เบี้ย 15,000/ปี" on={plan.lifeIns} onToggle={() => setPlan({ ...plan, lifeIns: !plan.lifeIns })} />
          </div>

          <div style={{
            fontSize: 12.5, fontWeight: 700, borderRadius: 10, padding: '10px 12px', textAlign: 'center',
            background: freeM < 0 ? 'rgba(255,93,93,0.12)' : 'var(--input-bg)',
            color: freeM < 0 ? '#ff8080' : 'var(--text-secondary)',
          }}>
            {freeM < 0
              ? `แผนตึงเกินรายได้ ~${fmtTH(-freeM)}/เดือน — เกมจะลดส่วนลงทุน/ออมให้อัตโนมัติ`
              : `เหลือเงินใช้ชีวิตอิสระ ~${fmtTH(freeM)} บาท/เดือน`}
          </div>

          <button onClick={startPeriod} style={btnPrimary}>ใช้แผนนี้ — ใช้ชีวิต 5 ปี ▶</button>
        </div>
      )}

      {phase.kind === 'anim' && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
          <div style={{ fontSize: 26 }}>⏳</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>อายุ {age} ปี — กำลังใช้ชีวิต...</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>ออม {plan.savePct}% · ลงทุน {plan.investPct}% ({plan.risk === 'low' ? 'เสี่ยงต่ำ' : plan.risk === 'mid' ? 'เสี่ยงกลาง' : 'เสี่ยงสูง'})</div>
        </div>
      )}

      {/* Modal เหตุการณ์ / ผลลัพธ์ / checkpoint */}
      {(phase.kind === 'event' || phase.kind === 'result' || phase.kind === 'checkpoint') && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18,
            padding: 22, maxWidth: 420, width: '100%', maxHeight: '86vh', overflowY: 'auto',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.8)', animation: 'fpAppear .25s ease',
          }}>
            {phase.kind === 'event' && (
              <>
                <div style={{ textAlign: 'center', fontSize: 44 }}>{phase.ev.emoji}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', display: 'block', marginBottom: 4 }}>อายุ {30 + phase.ev.year} ปี — เหตุการณ์!</span>
                  {phase.ev.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10, whiteSpace: 'pre-line', textAlign: 'center' }}>{phase.ev.desc}</div>
                <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                  {phase.ev.choices.map(c => (
                    <button key={c.id} onClick={() => chooseEvent(phase.ev, c.id)} style={{ ...btnGhost, textAlign: 'left', padding: '12px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</div>
                      {c.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.detail}</div>}
                    </button>
                  ))}
                </div>
              </>
            )}
            {phase.kind === 'result' && (
              <>
                <div style={{ textAlign: 'center', fontSize: 44 }}>{phase.emoji}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginTop: 6 }}>{phase.title}</div>
                {phase.logged.moneyDelta !== 0 && (
                  <div style={{
                    textAlign: 'center', marginTop: 10, fontSize: 18, fontWeight: 800,
                    color: phase.logged.moneyDelta > 0 ? 'var(--cyan)' : '#ff5d5d',
                  }}>
                    {phase.logged.moneyDelta > 0 ? '+' : ''}{fmtTH(phase.logged.moneyDelta)} บาท
                  </div>
                )}
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 10, textAlign: 'center' }}>{phase.logged.note}</div>
                <button onClick={() => continueFlow(game)} style={{ ...btnPrimary, marginTop: 16 }}>ไปต่อ ▶</button>
              </>
            )}
            {phase.kind === 'checkpoint' && (
              <>
                <div style={{ textAlign: 'center', fontSize: 44 }}>{phase.view.emoji}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', display: 'block', marginBottom: 4 }}>จุดเปลี่ยนของชีวิต</span>
                  {phase.view.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: 10, textAlign: 'center' }}>{phase.view.desc}</div>
                <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
                  {phase.view.choices.map(c => (
                    <button key={c.id} disabled={c.disabled} onClick={() => chooseCheckpoint(phase.view, c.id)}
                      style={{ ...btnGhost, textAlign: 'left', padding: '12px 14px', opacity: c.disabled ? 0.45 : 1, cursor: c.disabled ? 'not-allowed' : 'pointer' }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{c.label}</div>
                      {c.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.detail}</div>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: color ?? 'var(--text-primary)', marginTop: 1 }}>{value}</div>
    </div>
  )
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--cyan)' }}>{value}% ของรายได้</span>
      </div>
      <input type="range" min={0} max={40} step={5} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--cyan)', height: 26 }} />
    </div>
  )
}

function ToggleRow({ label, sub, on, onToggle }: { label: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      border: `1.5px solid ${on ? 'var(--cyan)' : 'var(--input-border)'}`,
      background: on ? 'var(--cyan-dim)' : 'var(--input-bg)',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? 'var(--cyan)' : 'var(--text-secondary)' }}>{label} {on ? '✓' : ''}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>
    </button>
  )
}
