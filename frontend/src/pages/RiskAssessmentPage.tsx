import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ChevronRight, RotateCcw, Save, User, Users, ArrowRight } from 'lucide-react'
import * as s from '../styles/dark'
import { PageHeader } from '../components/ui'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ChartFrame } from '../components/exportable'
import { hasSpouseInfo } from '../lib/spouse'

// ─── Chart Q7 ─────────────────────────────────────────────────────────────────
function ReturnChart() {
  const groups = [
    { label: '1', profit: 2.5, loss: 0, profitColor: '#94a3b8', lossColor: 'transparent' },
    { label: '2', profit: 7, loss: -1, profitColor: '#94a3b8', lossColor: '#ef4444' },
    { label: '3', profit: 15, loss: -5, profitColor: '#94a3b8', lossColor: '#ef4444' },
    { label: '4', profit: 25, loss: -15, profitColor: '#ef4444', lossColor: '#ef4444' },
  ]
  const maxProfit = 30
  const maxLoss = 20
  const chartH = 200
  const barW = 48
  const gap = 28
  const zeroY = (maxProfit / (maxProfit + maxLoss)) * chartH
  const totalW = groups.length * (barW + gap) + gap

  return (
    <div style={{ margin: '16px 0 8px', padding: '16px', background: 'var(--divider)', borderRadius: 10, border: '1px solid var(--grid)' }}>
      <svg width="100%" viewBox={`0 0 ${totalW} ${chartH + 40}`} style={{ display: 'block', maxWidth: 380, margin: '0 auto' }}>
        {/* Y grid lines */}
        {[30, 20, 10, 0, -10, -20].map(v => {
          const y = ((maxProfit - v) / (maxProfit + maxLoss)) * chartH
          return (
            <g key={v}>
              <line x1={0} y1={y} x2={totalW} y2={y} stroke="var(--divider)" strokeWidth={1} />
              <text x={2} y={y - 3} fontSize={9} fill="var(--text-muted)">{v}%</text>
            </g>
          )
        })}
        {/* Zero line */}
        <line x1={0} y1={zeroY} x2={totalW} y2={zeroY} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />

        {/* Bars */}
        {groups.map((g, i) => {
          const x = gap + i * (barW + gap)
          const profitH = (g.profit / (maxProfit + maxLoss)) * chartH
          const lossH = (Math.abs(g.loss) / (maxProfit + maxLoss)) * chartH
          const profitY = zeroY - profitH
          return (
            <g key={g.label}>
              {/* Profit bar */}
              <rect x={x} y={profitY} width={barW} height={profitH} fill={g.profitColor} opacity={0.85} rx={2} />
              {profitH > 10 && (
                <text x={x + barW / 2} y={profitY + profitH / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600}>{g.profit}%</text>
              )}
              {/* Loss bar */}
              {g.loss < 0 && (
                <>
                  <rect x={x} y={zeroY} width={barW} height={lossH} fill={g.lossColor} opacity={0.8} rx={2} />
                  <text x={x + barW / 2} y={zeroY + lossH / 2 + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600}>{g.loss}%</text>
                </>
              )}
              {/* Label */}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={12} fill="rgba(255,255,255,0.6)">{g.label}</text>
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(${gap}, ${chartH + 26})`}>
          <rect x={0} y={0} width={12} height={10} fill="#94a3b8" rx={2} />
          <text x={16} y={9} fontSize={10} fill="rgba(255,255,255,0.5)">กำไร Profit</text>
          <rect x={90} y={0} width={12} height={10} fill="#ef4444" rx={2} />
          <text x={106} y={9} fontSize={10} fill="rgba(255,255,255,0.5)">ขาดทุน Loss</text>
        </g>
      </svg>
    </div>
  )
}

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 1,
    text: '1. ปัจจุบันท่านอายุ',
    multi: false,
    options: [
      { label: '1. ตั้งแต่อายุ 60 ปีขึ้นไป', score: 1 },
      { label: '2. 45 – 59 ปี', score: 2 },
      { label: '3. 35 – 45 ปี', score: 3 },
      { label: '4. น้อยกว่า 35 ปี', score: 4 },
    ],
  },
  {
    id: 2,
    text: '2. ปัจจุบันท่านมีภาระทางการเงินและค่าใช้จ่ายประจำ เช่น ค่าผ่อนบ้าน รถ ค่าใช้จ่ายส่วนตัว และค่าเลี้ยงดูครอบครัว เป็นสัดส่วนเท่าใด',
    multi: false,
    options: [
      { label: '1. มากกว่าร้อยละ 75 ของรายได้ทั้งหมด', score: 1 },
      { label: '2. ระหว่างร้อยละ 50 ถึงร้อยละ 75 ของรายได้ทั้งหมด', score: 2 },
      { label: '3. ตั้งแต่ร้อยละ 25 แต่น้อยกว่าร้อยละ 50 ของรายได้ทั้งหมด', score: 3 },
      { label: '4. น้อยกว่าร้อยละ 25 ของรายได้ทั้งหมด', score: 4 },
    ],
  },
  {
    id: 3,
    text: '3. ท่านมีสถานภาพทางการเงินเป็นอย่างไร',
    multi: false,
    options: [
      { label: '1. มีทรัพย์สินน้อยกว่าหนี้สิน', score: 1 },
      { label: '2. มีทรัพย์สินเท่ากับหนี้สิน', score: 2 },
      { label: '3. มีทรัพย์สินมากกว่าหนี้สิน', score: 3 },
      { label: '4. มีความมั่นใจว่ามีเงินออมหรือเงินลงทุนเพียงพอสำหรับการใช้ชีวิตหลังเกษียณ', score: 4 },
    ],
  },
  {
    id: 4,
    text: '4. ท่านเคยมีประสบการณ์หรือมีความรู้ในการลงทุนในทรัพย์สินกลุ่มใดต่อไปนี้บ้าง',
    multi: true,
    options: [
      { label: '1. เงินฝากธนาคาร', score: 1 },
      { label: '2. พันธบัตรรัฐบาล หรือกองทุนรวมพันธบัตรรัฐบาล', score: 2 },
      { label: '3. หุ้นกู้หรือกองทุนรวมตราสารหนี้', score: 3 },
      { label: '4. หุ้นสามัญ หรือกองทุนรวมหุ้น หรือสินทรัพย์อื่นที่มีความเสี่ยงสูง', score: 4 },
    ],
  },
  {
    id: 5,
    text: '5. ระยะเวลาที่ท่านคาดว่าจะไม่มีความจำเป็นต้องใช้เงินลงทุนนี้',
    multi: false,
    options: [
      { label: '1. ไม่เกิน 1 ปี', score: 1 },
      { label: '2. ตั้งแต่ 2 ปีแต่น้อยกว่า 3 ปี', score: 2 },
      { label: '3. ตั้งแต่ 3 ปีถึง 5 ปี', score: 3 },
      { label: '4. มากกว่า 5 ปี', score: 4 },
    ],
  },
  {
    id: 6,
    text: '6. ความสามารถในการรับความเสี่ยงของท่าน คือ',
    multi: false,
    options: [
      { label: '1. เน้นเงินต้นต้องปลอดภัยและได้รับผลตอบแทนสม่ำเสมอ แต่ต่ำได้', score: 1 },
      { label: '2. เน้นโอกาสได้รับผลตอบแทนที่สม่ำเสมอ แต่อาจเสี่ยงที่จะสูญเสียเงินต้นได้บ้าง', score: 2 },
      { label: '3. เน้นโอกาสได้รับผลตอบแทนสูงขึ้น แต่อาจเสี่ยงที่จะสูญเสียเงินต้นได้มากขึ้น', score: 3 },
      { label: '4. เน้นผลตอบแทนสูงสุดในระยะยาว แต่อาจเสี่ยงที่จะสูญเสียเงินต้นส่วนใหญ่ได้', score: 4 },
    ],
  },
  {
    id: 7,
    text: '7. เมื่อพิจารณารูปแสดงตัวอย่างผลตอบแทนของกลุ่มการลงทุนที่อาจเกิดขึ้นด้านล่าง ท่านเต็มใจที่จะลงทุนในกลุ่มการลงทุนใดมากที่สุด',
    multi: false,
    chart: true,
    options: [
      { label: '1. กลุ่มการลงทุนที่ 1 มีโอกาสได้รับผลตอบแทน 2.5% โดยไม่ขาดทุนเลย', score: 1 },
      { label: '2. กลุ่มการลงทุนที่ 2 มีโอกาสได้รับผลตอบแทน 7% แต่อาจมีผลขาดทุนได้ถึง 1%', score: 2 },
      { label: '3. กลุ่มการลงทุนที่ 3 มีโอกาสได้รับผลตอบแทน 15% แต่อาจมีผลขาดทุนได้ถึง 5%', score: 3 },
      { label: '4. กลุ่มการลงทุนที่ 4 มีโอกาสได้รับผลตอบแทน 25% แต่อาจมีผลขาดทุนได้ถึง 15%', score: 4 },
    ],
  },
  {
    id: 8,
    text: '8. ถ้าท่านเลือกลงทุนในสินทรัพย์ที่มีโอกาสได้รับผลตอบแทนมาก แต่มีโอกาสขาดทุนสูงด้วยเช่นกัน ท่านจะรู้สึกอย่างไร',
    multi: false,
    options: [
      { label: '1. กังวลและตื่นตระหนก กลัวขาดทุน', score: 1 },
      { label: '2. ไม่สบายใจแต่พอเข้าใจได้บ้าง', score: 2 },
      { label: '3. เข้าใจและรับความผันผวนได้ในระดับหนึ่ง', score: 3 },
      { label: '4. ไม่กังวลกับโอกาสขาดทุนสูง และหวังกับผลตอบแทนที่อาจจะได้รับสูงขึ้น', score: 4 },
    ],
  },
  {
    id: 9,
    text: '9. ท่านจะรู้สึกกังวล/รับไม่ได้ เมื่อมูลค่าเงินลงทุนของท่านมีการปรับตัวลดลง ในสัดส่วนเท่าใด',
    multi: false,
    options: [
      { label: '1. 5% หรือน้อยกว่า', score: 1 },
      { label: '2. มากกว่า 5% - 10%', score: 2 },
      { label: '3. มากกว่า 10% - 20%', score: 3 },
      { label: '4. มากกว่า 20% ขึ้นไป', score: 4 },
    ],
  },
  {
    id: 10,
    text: '10. หากปีที่แล้วท่านลงทุนไป 100,000 บาท ปีนี้ท่านพบว่า มูลค่าเงินลงทุนลดลงเหลือ 85,000 บาท ท่านจะทำอย่างไร',
    multi: false,
    options: [
      { label: '1. ตกใจ และต้องการขายการลงทุนที่เหลือทิ้ง', score: 1 },
      { label: '2. กังวลใจ และจะปรับเปลี่ยนการลงทุนบางส่วนไปในสินทรัพย์ที่เสี่ยงน้อยลง', score: 2 },
      { label: '3. อดทนถือต่อไปได้และรอผลตอบแทนปรับตัวกลับมา', score: 3 },
      { label: '4. ยังมั่นใจ เพราะเข้าใจว่าต้องลงทุนระยะยาว และจะเพิ่มเงินลงทุนในแบบเดิมเพื่อเฉลี่ยต้นทุน', score: 4 },
    ],
  },
]

const EXTRA_QUESTIONS = [
  {
    id: 11,
    text: '11. หากการลงทุนในสัญญาซื้อขายล่วงหน้า (อนุพันธ์) และหุ้นกู้ที่มีอนุพันธ์แฝงประสบความสำเร็จ ท่านจะได้รับผลตอบแทนในอัตราที่สูงมาก แต่หากการลงทุนล้มเหลว ท่านอาจจะสูญเงินลงทุนทั้งหมด และอาจต้องลงเงินชดเชยเพิ่มบางส่วน ท่านยอมรับได้เพียงใด',
    note: '(ใช้เฉพาะที่จะมีการลงทุนในสัญญาซื้อขายล่วงหน้าและหุ้นกู้ที่มีอนุพันธ์แฝง)',
    options: [{ label: '1. ไม่ได้' }, { label: '2. ได้' }],
  },
  {
    id: 12,
    text: '12. นอกเหนือจากความเสี่ยงในการลงทุนแล้ว ท่านสามารถรับความเสี่ยงด้านอัตราแลกเปลี่ยนได้เพียงใด',
    note: '(ใช้เฉพาะที่จะมีการลงทุนในต่างประเทศ)',
    options: [{ label: '1. ไม่ได้' }, { label: '2. ได้' }],
  },
]

// ─── Risk levels (5-level) ────────────────────────────────────────────────────
const RISK_LEVELS = [
  { level: 1, label: 'เสี่ยงต่ำ', en: 'Conservative Investor', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', min: 0, max: 14 },
  { level: 2, label: 'เสี่ยงปานกลางค่อนข้างต่ำ', en: '', color: '#84cc16', bg: 'rgba(132,204,22,0.1)', border: 'rgba(132,204,22,0.3)', min: 15, max: 21 },
  { level: 3, label: 'เสี่ยงปานกลางค่อนข้างสูง', en: 'Moderate Investor', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', min: 22, max: 29 },
  { level: 4, label: 'เสี่ยงสูง', en: '', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', min: 30, max: 36 },
  { level: 5, label: 'เสี่ยงสูงมาก', en: 'Aggressive Investor', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', min: 37, max: 40 },
]

const INVESTOR_TYPES = [
  { range: '6 – 15', type: 'ต่ำ', en: 'Conservative Investor', color: '#22c55e', policyIdx: 0,
    desc: 'คุณเป็นบุคคลที่ยอมรับความเสี่ยงได้น้อย หรือแทบจะไม่ได้เลย ดังนั้นวัตถุประสงค์การลงทุนของคุณจึงมุ่งไปที่การพยายามรักษาเงินลงทุน (เงินต้น) ให้มีความมั่นคงปลอดภัย และมีสภาพคล่องสูงเป็นหลัก โดยคุณสามารถยอมรับอัตราผลตอบแทนไม่สูงมากได้' },
  { range: '16 – 31', type: 'กลาง', en: 'Moderate Investor', color: '#f59e0b', policyIdx: 1,
    desc: 'คุณเป็นบุคคลที่สามารถยอมรับความเสี่ยงได้ปานกลาง เพื่อให้ได้รับผลตอบแทนที่สูงขึ้น และมุ่งหวังให้เงินลงทุนบางส่วนมีการเติบโตเพิ่มมูลค่ามากขึ้น' },
  { range: '32 – 42', type: 'สูง', en: 'Aggressive Investor', color: '#ef4444', policyIdx: 2,
    desc: 'คุณเป็นบุคคลที่สามารถยอมรับความผันผวน หรือความเสี่ยงจากการลงทุนได้สูง โดยคุณหวังที่จะได้รับผลตอบแทนที่สูงมากขึ้น รวมถึงโอกาสที่เงินลงทุนจะเติบโตเพิ่มมากขึ้นในการลงทุน' },
]

// Asset allocation for 3 policies (from pie charts in PDF)
const POLICIES = [
  { name: 'นโยบายที่ 1', subtitle: 'ความเสี่ยงต่ำ',
    data: [{ name: 'หุ้น', value: 20, color: '#1d6fa4' }, { name: 'ตราสารหนี้', value: 40, color: '#00b8a9' }, { name: 'เงินฝากธนาคาร', value: 30, color: '#86c440' }, { name: 'สินทรัพย์ทางเลือก', value: 10, color: '#f5c518' }] },
  { name: 'นโยบายที่ 2', subtitle: 'ความเสี่ยงปานกลาง',
    data: [{ name: 'หุ้น', value: 40, color: '#1d6fa4' }, { name: 'ตราสารหนี้', value: 30, color: '#00b8a9' }, { name: 'เงินฝากธนาคาร', value: 20, color: '#86c440' }, { name: 'สินทรัพย์ทางเลือก', value: 10, color: '#f5c518' }] },
  { name: 'นโยบายที่ 3', subtitle: 'ความเสี่ยงสูง',
    data: [{ name: 'หุ้น', value: 70, color: '#1d6fa4' }, { name: 'ตราสารหนี้', value: 10, color: '#00b8a9' }, { name: 'เงินฝากธนาคาร', value: 10, color: '#86c440' }, { name: 'สินทรัพย์ทางเลือก', value: 10, color: '#f5c518' }] },
]

function getRiskLevel(score: number) {
  return RISK_LEVELS.find(r => score >= r.min && score <= r.max) || RISK_LEVELS[0]
}
function getInvestorType(score: number) {
  if (score <= 15) return INVESTOR_TYPES[0]
  if (score <= 31) return INVESTOR_TYPES[1]
  return INVESTOR_TYPES[2]
}

type Answers = Record<number, number[]>

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RiskAssessmentPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Answers>({})
  const [extraAnswers, setExtraAnswers] = useState<Record<number, number>>({})
  const [step, setStep] = useState<'quiz' | 'result'>('quiz')
  const [saved, setSaved] = useState(false)
  const [person, setPerson] = useState<'client' | 'spouse'>('client')

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => { const { data } = await api.get('/profile'); return data },
  })
  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => api.get('/client-profile').then(r => r.data),
  })
  const clientName = clientProfile?.firstName ? `คุณ${clientProfile.firstName}` : 'ลูกค้า'
  const spouseName = clientProfile?.spouseProfile?.firstName ? `คุณ${clientProfile.spouseProfile.firstName}` : 'คู่สมรส'
  const showSpouse = hasSpouseInfo(clientProfile)
  useEffect(() => { if (!showSpouse && person === 'spouse') setPerson('client') }, [showSpouse, person])

  // ผลล่าสุดของบุคคลที่เลือก (client = ฟิลด์หลัก, spouse = spouseRisk JSON)
  const lastResult = person === 'client'
    ? profile
    : (profile?.spouseRisk ?? null)

  // โหลดคำตอบที่บันทึกไว้กลับมาแสดง (ต่อคน) จนกว่าจะแก้ไข
  const hydratedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!profile) return
    if (hydratedFor.current === person) return
    hydratedFor.current = person
    const savedAnswers = (lastResult?.riskAnswers ?? null) as Answers | null
    if (savedAnswers && Object.keys(savedAnswers).length) {
      setAnswers(savedAnswers)
      setSaved(true)
    } else {
      setAnswers({})
      setSaved(false)
    }
    setExtraAnswers({})
    setStep('quiz')
  }, [profile, person, lastResult])

  const PersonSwitch = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 16 }}>
      <div style={{ display: 'inline-flex', gap: 4, background: 'var(--navy-950)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 4 }}>
        {([['client', clientName], ['spouse', spouseName]] as const).filter(([val]) => showSpouse || val === 'client').map(([val, label]) => (
          <button key={val} onClick={() => { if (val !== person) setPerson(val) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: person === val ? 600 : 400,
              background: person === val ? 'var(--cyan-dim)' : 'transparent',
              color: person === val ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>
            {val === 'client' ? <User size={14} /> : <Users size={14} />}{label}
          </button>
        ))}
      </div>
    </div>
  )

  const saveRisk = useMutation({
    mutationFn: (body: object) => api.put('/profile', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setSaved(true) },
  })

  function getScore(q: typeof QUESTIONS[0], selected: number[]): number {
    if (!selected.length) return 0
    if (q.multi) return Math.max(...selected.map(i => q.options[i].score))
    return q.options[selected[0]].score
  }

  function totalScore() {
    return QUESTIONS.reduce((sum, q) => sum + getScore(q, answers[q.id] ?? []), 0)
  }

  function isComplete() {
    return QUESTIONS.every(q => (answers[q.id]?.length ?? 0) > 0)
  }

  function toggleOption(qId: number, idx: number, multi: boolean) {
    setAnswers(prev => {
      const cur = prev[qId] ?? []
      if (multi) return { ...prev, [qId]: cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx] }
      return { ...prev, [qId]: [idx] }
    })
  }

  function handleSubmit() {
    if (!isComplete()) return
    setStep('result')
    setSaved(false)
  }

  function handleSave() {
    const score = totalScore()
    const risk = getRiskLevel(score)
    const result = {
      riskScore: score, riskLevel: risk.level, riskLabel: risk.label,
      riskAnswers: answers, riskAssessedAt: new Date().toISOString(),
    }
    saveRisk.mutate(person === 'client' ? result : { spouseRisk: result })
  }

  function handleReset() {
    setAnswers({}); setExtraAnswers({}); setStep('quiz'); setSaved(false)
  }

  const score = totalScore()
  const risk = getRiskLevel(score)
  const investor = getInvestorType(score)
  const answered = Object.keys(answers).length
  const policy = POLICIES[investor.policyIdx]

  // ── Result ───────────────────────────────────────────────────────────────────
  if (step === 'result') {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        {PersonSwitch}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={s.h2}>ผลการประเมินความเสี่ยง</h1>
            <p style={s.muted}>แบบวัดระดับความเสี่ยงที่ยอมรับได้ในการลงทุน (Risk Tolerance) — {person === 'client' ? clientName : spouseName}</p>
          </div>
          <button onClick={handleReset} style={{ ...s.btnGhost, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RotateCcw size={14} /> ทำใหม่
          </button>
        </div>

        {/* Score + Level */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16, marginBottom: 16 }}>
          <div style={{ ...s.card, textAlign: 'center', background: risk.bg, border: `1px solid ${risk.border}`, padding: '28px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>คะแนนรวม (ข้อ 1-10)</div>
            <div style={{ fontSize: 56, fontWeight: 800, color: risk.color, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>คะแนน</div>
          </div>
          <div style={{ ...s.card, textAlign: 'center', background: risk.bg, border: `1px solid ${risk.border}`, padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ShieldCheck size={28} color={risk.color} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ระดับ {risk.level} — ประเภทนักลงทุน</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: risk.color }}>{risk.label}</div>
            {investor.en && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{investor.en}</div>}
          </div>
        </div>

        {/* Score Range Bar */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>ระดับความเสี่ยงทั้งหมด</div>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 10, marginBottom: 10 }}>
            {RISK_LEVELS.map(r => (
              <div key={r.level} style={{ flex: 1, background: r.level === risk.level ? r.color : 'var(--grid)' }} />
            ))}
          </div>
          <div style={{ display: 'flex' }}>
            {RISK_LEVELS.map(r => (
              <div key={r.level} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: r.level === risk.level ? r.color : 'var(--text-muted)', fontWeight: r.level === risk.level ? 700 : 400, lineHeight: 1.3 }}>
                  {r.label.replace('เสี่ยง', '')}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {r.min === 0 ? '<15' : r.max >= 40 ? '37+' : `${r.min}-${r.max}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investor Type Description */}
        <div style={{ ...s.card, marginBottom: 16, border: `1px solid ${investor.color}40`, background: `${investor.color}0d` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: investor.color }}>
              นักลงทุนประเภท: {investor.type} ({investor.en})
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--grid)', padding: '2px 10px', borderRadius: 999 }}>คะแนน {investor.range}</div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{investor.desc}</p>
        </div>

        {/* Asset Allocation Pie Charts */}
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
            รูปแบบการจัดสรรน้ำหนักการลงทุนเบื้องต้น
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>คำแนะนำสำหรับประเภทนักลงทุน: <span style={{ color: investor.color, fontWeight: 600 }}>{investor.type} ({investor.en})</span></p>

          {/* All 3 pie charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 8 }}>
            {POLICIES.map((pol) => {
              const isSelected = pol === policy
              return (
                <div key={pol.name} style={{ border: `1.5px solid ${isSelected ? investor.color : 'var(--grid)'}`, borderRadius: 12, padding: '12px 8px', background: isSelected ? `${investor.color}0d` : 'var(--hover)', position: 'relative' }}>
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, background: investor.color, color: '#fff', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>แนะนำ</div>
                  )}
                  <div style={{ textAlign: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? investor.color : 'var(--text-primary)' }}>{pol.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pol.subtitle}</div>
                  </div>
                  <ChartFrame title={pol.name} filename={`allocation-${pol.name}`} height={160}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pol.data} cx="50%" cy="50%" outerRadius={60} dataKey="value" labelLine={false}
                        label={({ cx, cy, midAngle = 0, outerRadius: or, value }) => {
                          const RADIAN = Math.PI / 180
                          const rx = (cx as number) + ((or as number) + 12) * Math.cos(-midAngle * RADIAN)
                          const ry = (cy as number) + ((or as number) + 12) * Math.sin(-midAngle * RADIAN)
                          return value > 5 ? <text x={rx} y={ry} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="#fff">{value}%</text> : null
                        }}>
                        {pol.data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  </ChartFrame>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                    {pol.data.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-muted)', flex: 1 }}>{d.name}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{d.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Save */}
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          {saved ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ color: '#22c55e', fontSize: 14 }}>✓ บันทึกผลการประเมินแล้ว</div>
              <button onClick={() => navigate('/settings')}
                style={{ ...s.btn(), padding: '12px 32px', fontSize: 14, gap: 8 }}>
                เริ่มต้นวางแผนการเงิน <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleSave} disabled={saveRisk.isPending}
              style={{ ...s.btn(), padding: '12px 32px', fontSize: 14, gap: 8 }}>
              <Save size={16} />
              {saveRisk.isPending ? 'กำลังบันทึก...' : 'บันทึกผลการประเมิน'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {PersonSwitch}
      <div style={{ marginBottom: 24 }}>
        <PageHeader icon={ShieldCheck} title="แบบประเมินความเสี่ยง" subtitle="ส่วนที่ 5 แบบวัดระดับความเสี่ยงที่ยอมรับได้ในการลงทุน (Risk Tolerance)" />
        {lastResult?.riskScore && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', borderRadius: 8, fontSize: 13, color: 'var(--cyan-light)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>ผลล่าสุด ({person === 'client' ? clientName : spouseName}): <strong>ระดับ {lastResult.riskLevel} — {lastResult.riskLabel}</strong> (คะแนน {lastResult.riskScore})</span>
            {lastResult.riskAssessedAt && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>ประเมินเมื่อ {new Date(lastResult.riskAssessedAt).toLocaleDateString('th-TH')}</span>}
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>ตอบแล้ว {answered}/10 ข้อ</span>
          <span>{Math.round((answered / 10) * 100)}%</span>
        </div>
        <div style={{ height: 5, background: 'var(--grid)', borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${(answered / 10) * 100}%`, background: 'var(--cyan)', borderRadius: 999, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Main Questions 1-10 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {QUESTIONS.map((q, qi) => {
          const sel = answers[q.id] ?? []
          const isAnswered = sel.length > 0
          return (
            <div key={q.id} style={{ ...s.card, border: `1px solid ${isAnswered ? 'var(--cyan)' : 'var(--card-border)'}`, transition: 'border-color 0.15s' }}>
              <div style={{ display: 'flex', gap: 11, marginBottom: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, background: isAnswered ? 'var(--cyan)' : 'var(--navy-800)', color: isAnswered ? '#00201d' : 'var(--text-muted)' }}>{qi + 1}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.6, paddingTop: 2 }}>{q.text}</div>
              </div>
              {(q as any).multi && (
                <div style={{ fontSize: 11, color: 'var(--cyan)', marginBottom: 10 }}>★ เลือกได้มากกว่า 1 ข้อ — คะแนนจะใช้ข้อที่สูงสุด</div>
              )}
              {(q as any).chart && <ReturnChart />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {q.options.map((opt, idx) => {
                  const isSelected = sel.includes(idx)
                  return (
                    <button key={idx} onClick={() => toggleOption(q.id, idx, !!(q as any).multi)}
                      style={{
                        padding: '10px 14px', borderRadius: 8,
                        border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--card-border)'}`,
                        background: isSelected ? 'var(--cyan-dim)' : 'var(--hover)',
                        color: isSelected ? 'var(--cyan-light)' : 'var(--text-secondary)',
                        fontSize: 13, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                      <div style={{ width: 18, height: 18, borderRadius: (q as any).multi ? 4 : '50%', border: `2px solid ${isSelected ? 'var(--cyan)' : 'var(--navy-500)'}`, background: isSelected ? 'var(--cyan)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <div style={{ width: (q as any).multi ? 10 : 8, height: (q as any).multi ? 10 : 8, background: '#fff', borderRadius: (q as any).multi ? 2 : '50%' }} />}
                      </div>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Extra Q11-12 */}
      <div style={{ marginTop: 20, padding: '16px 20px', background: 'var(--hover)', border: '1px solid var(--card-border)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 500, marginBottom: 14 }}>
          คำถามข้อ 11-12 ใช้เป็นข้อมูลเพิ่มเติมเพื่อประกอบการให้คำแนะนำ (ไม่นำมาคิดคะแนน)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {EXTRA_QUESTIONS.map(q => (
            <div key={q.id}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.6 }}>{q.text}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{q.note}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {q.options.map((opt, idx) => {
                  const isSelected = extraAnswers[q.id] === idx
                  return (
                    <button key={idx} onClick={() => setExtraAnswers(p => ({ ...p, [q.id]: idx }))}
                      style={{
                        padding: '8px 20px', borderRadius: 8,
                        border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--card-border)'}`,
                        background: isSelected ? 'var(--cyan-dim)' : 'transparent',
                        color: isSelected ? 'var(--cyan-light)' : 'var(--text-muted)',
                        fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {!isComplete() && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            ยังไม่ได้ตอบ {10 - answered} ข้อ
          </span>
        )}
        <button onClick={handleSubmit} disabled={!isComplete()}
          style={{ ...s.btn(), padding: '12px 28px', fontSize: 14, opacity: isComplete() ? 1 : 0.4, cursor: isComplete() ? 'pointer' : 'not-allowed' }}>
          ดูผลการประเมิน <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
