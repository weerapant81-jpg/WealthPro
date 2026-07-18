import { CAREERS } from './careers'
import type { EventChoiceDef, EventInstance, GameState, LoggedEvent, ScheduledEvent } from './types'

/* ── เหตุการณ์สุ่มของเกม ─────────────────────────────────────────────
   เหตุการณ์เกิด "หลังจบปี" นั้นๆ (state สะท้อนผลของปีแล้ว)
   ทุกผลลัพธ์เป็น pure function: (state) → state ใหม่ (clone แบบตื้นพอ)   */

const fmt = (n: number) => Math.round(n).toLocaleString('th-TH')

/** รายจ่ายรวมต่อเดือน (ค่าครองชีพ + ที่อยู่อาศัย) — ใช้วัด "เงินสำรอง 6 เดือน" */
export function monthlyOutflow(s: GameState): number {
  return s.livingMonthly + s.rentMonthly + s.mortgageMonthly
}

/** จ่ายเงินก้อน: เงินสด → ขายพอร์ต → เป็นหนี้ดอกแพง (คืนจำนวนที่กลายเป็นหนี้) */
export function payCost(s: GameState, amount: number): number {
  const fromCash = Math.min(s.cash, amount)
  s.cash -= fromCash
  let left = amount - fromCash
  if (left > 0) {
    const fromInvest = Math.min(s.invested, left)
    s.invested -= fromInvest
    left -= fromInvest
  }
  if (left > 0) s.debt += left
  return left
}

interface EventDef {
  id: string
  emoji: string
  /** เงื่อนไขว่าจะเกิดได้ไหม ณ ปีนั้น (ไม่ผ่าน = ข้ามเงียบๆ) */
  condition?: (s: GameState) => boolean
  build: (s: GameState, mag: number) => { title: string; desc: string; choices: EventChoiceDef[] }
  apply: (s: GameState, mag: number, choiceId: string) => { moneyDelta: number; note: string; title: string }
}

const sickCost = (mag: number) => 100000 + Math.round(mag * 400000 / 10000) * 10000

export const EVENT_DEFS: Record<string, EventDef> = {

  layoff: {
    id: 'layoff', emoji: '📉',
    build: (s) => {
      const c = CAREERS[s.careerId]
      const gap = monthlyOutflow(s) * 6
      const choices: EventChoiceDef[] = []
      if (s.cash >= gap) choices.push({ id: 'emergency', label: 'ใช้เงินสำรองฉุกเฉิน', detail: `มีเงินสด ${fmt(s.cash)} — ประคองได้สบาย` })
      if (s.invested > 0) choices.push({ id: 'sell', label: 'ขายพอร์ตลงทุนมาใช้', detail: 'ขายตอนจำเป็น มักได้ราคาไม่ดี' })
      choices.push({ id: 'loan', label: 'กู้สินเชื่อดอกแพง', detail: 'ดอกเบี้ย ~15% ต่อปี ทบต้นเร็วมาก' })
      return {
        title: c.layoffTitle,
        desc: `${c.layoffDesc}\nต้องหาเงินประคองชีวิต 6 เดือน ≈ ${fmt(gap)} บาท`,
        choices,
      }
    },
    apply: (s, _mag, choiceId) => {
      const c = CAREERS[s.careerId]
      const gap = monthlyOutflow(s) * 6
      if (choiceId === 'emergency' && s.cash >= gap) {
        s.cash -= gap
        s.happiness -= 3
        return { title: c.layoffTitle, moneyDelta: -gap, note: 'เงินสำรองฉุกเฉินช่วยชีวิตไว้ — ผ่านไปได้โดยไม่เป็นหนี้ ไม่ต้องขายพอร์ต' }
      }
      if (choiceId === 'sell' && s.invested > 0) {
        const crashed = s.history.length > 0 && s.history[s.history.length - 1].eqReturn < -0.10
        const cost = gap * (crashed ? 1.3 : 1.1)   // ขายตอนจำเป็น/ตลาดตก = ขาดทุนเพิ่ม
        const sold = Math.min(s.invested, cost)
        s.invested -= sold
        const short = cost - sold
        if (short > 0) s.debt += short
        s.happiness -= 6
        return {
          title: c.layoffTitle, moneyDelta: -cost,
          note: crashed
            ? `ต้องขายพอร์ตตอนตลาดตก — ขาดทุนหนัก เสียไป ${fmt(cost)} เพื่อได้เงินใช้ ${fmt(gap)}`
            : `ขายพอร์ตแบบจำใจ เสียมูลค่า ${fmt(cost)} (แพงกว่าที่ต้องใช้จริง)`,
        }
      }
      s.debt += gap
      s.happiness -= 8
      return { title: c.layoffTitle, moneyDelta: -gap, note: `เป็นหนี้ดอกแพง ${fmt(gap)} บาท — ดอกเบี้ยจะทบต้นไปอีกหลายปี` }
    },
  },

  sick: {
    id: 'sick', emoji: '🏥',
    build: (s, mag) => {
      const cost = sickCost(mag)
      const gov = CAREERS[s.careerId].freeHealthcare
      return {
        title: 'ป่วยหนัก ต้องผ่าตัดด่วน!',
        desc: gov
          ? `ค่ารักษา ${fmt(cost)} บาท — โชคดีที่สวัสดิการข้าราชการคุ้มครองเกือบทั้งหมด`
          : `ค่ารักษาโรงพยาบาลเอกชน ${fmt(cost)} บาท`,
        choices: [{ id: 'ok', label: 'เข้ารักษา', detail: gov ? 'สวัสดิการรัฐดูแล' : undefined }],
      }
    },
    apply: (s, mag) => {
      const cost = sickCost(mag)
      const gov = CAREERS[s.careerId].freeHealthcare
      const hasIns = s.healthInsActive
      let paid: number, note: string
      if (gov) {
        paid = 10000
        note = `สวัสดิการข้าราชการจ่ายให้เกือบหมด คุณจ่ายเองแค่ ${fmt(paid)} บาท`
        s.happiness -= 2
      } else if (hasIns) {
        paid = 20000
        note = `ประกันสุขภาพคุ้มครอง! จากบิล ${fmt(cost)} คุณจ่ายส่วนแรกแค่ ${fmt(paid)} บาท`
        s.happiness -= 2
      } else {
        paid = cost
        note = `ไม่มีประกันสุขภาพ — จ่ายเองเต็มๆ ${fmt(cost)} บาท`
        s.happiness -= 6
      }
      payCost(s, paid)
      return { title: 'ป่วยหนัก ต้องผ่าตัดด่วน!', moneyDelta: -paid, note }
    },
  },

  crash: {
    id: 'crash', emoji: '🔻',
    condition: (s) => s.invested > 50000,
    build: (s) => {
      // event เกิดหลังจบปี → ปีที่เพิ่งจบคือ s.year - 1
      const pct = Math.round((s.eqReturns[s.year - 1] ?? -0.3) * 100)
      return {
        title: `ตลาดหุ้นตกหนัก ${pct}%!`,
        desc: `พอร์ตของคุณโดนไปเต็มๆ เหลือ ${fmt(s.invested)} บาท ข่าวร้ายเต็มหน้าฟีด ทุกคนแห่ขายหนี... คุณจะทำยังไง?`,
        choices: [
          { id: 'hold', label: 'ถือต่อ ไม่ขาย', detail: 'ประวัติศาสตร์บอกว่าตลาดมักฟื้นเสมอ' },
          { id: 'buydip', label: 'ช้อนซื้อเพิ่ม', detail: s.cash > 30000 ? `ใช้เงินสดครึ่งหนึ่ง (${fmt(s.cash / 2)})` : 'เงินสดน้อยไป ช้อนได้นิดเดียว' },
          { id: 'sellall', label: 'ขายทิ้งทั้งหมด!', detail: 'หนีไปถือเงินสด ตัดใจก่อนเจ็บกว่านี้' },
        ],
      }
    },
    apply: (s, _mag, choiceId) => {
      const title = 'ตลาดหุ้นตกหนัก!'
      if (choiceId === 'sellall') {
        const sold = s.invested
        s.cash += sold
        s.invested = 0
        s.happiness -= 4
        return { title, moneyDelta: 0, note: `ขายหมดพอร์ต ${fmt(sold)} บาทไปถือเงินสด — คุณจะพลาดช่วงตลาดฟื้นตัวที่กำลังมา` }
      }
      if (choiceId === 'buydip') {
        const buy = s.cash / 2
        s.cash -= buy
        s.invested += buy
        s.happiness += 2
        return { title, moneyDelta: 0, note: `ช้อนซื้อ ${fmt(buy)} บาทตอนของถูก — ถ้าตลาดฟื้น รอบนี้คุณได้เต็มๆ` }
      }
      s.happiness -= 1
      return { title, moneyDelta: 0, note: 'ใจนิ่ง ถือต่อ — นักลงทุนที่อยู่รอดคือคนที่ไม่ขายตอนตื่นตระหนก' }
    },
  },

  windfall: {
    id: 'windfall', emoji: '🎰',
    build: (s) => {
      const choices: EventChoiceDef[] = [
        { id: 'fun', label: 'ฉลองใหญ่! เที่ยวรอบโลก', detail: 'ใช้ 140,000 เก็บไว้ 60,000 — ความสุขพุ่ง' },
        { id: 'invest', label: 'เอาไปลงทุนทั้งก้อน', detail: 'ให้เงินทำงานต่อ 30 ปี' },
      ]
      if (s.debt > 0) choices.push({ id: 'paydebt', label: 'โปะหนี้', detail: `หนี้คงเหลือ ${fmt(s.debt)} — ตัดดอกแพงทิ้ง` })
      return {
        title: 'โชคก้อนใหญ่ 200,000 บาท!',
        desc: 'คุณถูกรางวัลใหญ่ + ได้โบนัสพิเศษ รวม 200,000 บาท จะทำอะไรกับเงินก้อนนี้ดี?',
        choices,
      }
    },
    apply: (s, _mag, choiceId) => {
      const title = 'โชคก้อนใหญ่ 200,000 บาท!'
      if (choiceId === 'fun') {
        s.cash += 60000
        s.happiness += 12
        return { title, moneyDelta: 60000, note: 'ทริปในฝันเติมพลังชีวิตเต็มถัง — เหลือเก็บ 60,000 บาท' }
      }
      if (choiceId === 'paydebt' && s.debt > 0) {
        const pay = Math.min(s.debt, 200000)
        s.debt -= pay
        s.cash += 200000 - pay
        s.happiness += 5
        return { title, moneyDelta: 200000, note: `โปะหนี้ ${fmt(pay)} บาท ตัดวงจรดอกเบี้ยแพงทิ้ง — การลงทุนที่ดีที่สุดคือปลดหนี้` }
      }
      s.invested += 200000
      s.happiness += 3
      return { title, moneyDelta: 200000, note: 'เข้าพอร์ตทั้งก้อน — เงิน 200,000 นี้จะทบต้นให้คุณไปจนเกษียณ' }
    },
  },

  scam: {
    id: 'scam', emoji: '🕳️',
    condition: (s) => s.cash + s.invested >= 150000,
    build: () => ({
      title: 'เพื่อนสนิทชวนลงทุน "การันตี 10% ต่อเดือน"',
      desc: 'เพื่อนโชว์สลิปผลตอบแทนทุกเดือน บอกว่า "เจ้าของโครงการเป็นคนดัง มีคนลงเป็นพันแล้ว รีบลงก่อนปิดรอบ!" ขั้นต่ำ 100,000 บาท',
      choices: [
        { id: 'invest', label: 'ลงเลย! เพื่อนยังได้เลย', detail: '10% ต่อเดือน = ปีละ 120%!?' },
        { id: 'decline', label: 'ปฏิเสธ', detail: 'ผลตอบแทนสูงผิดปกติ = สัญญาณอันตราย' },
      ],
    }),
    apply: (s, _mag, choiceId) => {
      const title = 'ชวนลงทุน "การันตี 10% ต่อเดือน"'
      if (choiceId === 'invest') {
        payCost(s, 100000)
        s.happiness -= 10
        return { title, moneyDelta: -100000, note: 'ได้ปันผล 2 เดือนแรก...แล้วโครงการหายเงียบ — แชร์ลูกโซ่! เงิน 100,000 หายไม่มีวันกลับ' }
      }
      s.happiness += 2
      return { title, moneyDelta: 0, note: 'ครึ่งปีต่อมาโครงการล่ม เพื่อนเสียเงินเกลี้ยง — คุณรอดเพราะรู้ทัน: ผลตอบแทนที่ "การันตี" สูงผิดปกติไม่มีจริง' }
    },
  },

  parent: {
    id: 'parent', emoji: '👴',
    build: () => ({
      title: 'คุณพ่อป่วย ต้องเข้าโรงพยาบาล',
      desc: 'ค่ารักษารวม 80,000 บาท ท่านไม่มีประกันสุขภาพ พี่น้องต่างก็ชักหน้าไม่ถึงหลัง',
      choices: [
        { id: 'full', label: 'ดูแลเต็มที่ 80,000', detail: 'ท่านเลี้ยงเรามา ถึงเวลาเราดูแลท่าน' },
        { id: 'partial', label: 'ช่วยครึ่งเดียว 40,000', detail: 'ขอเฉลี่ยกับพี่น้อง เก็บสภาพคล่องไว้' },
      ],
    }),
    apply: (s, _mag, choiceId) => {
      const title = 'คุณพ่อป่วยเข้าโรงพยาบาล'
      if (choiceId === 'partial') {
        payCost(s, 40000)
        s.happiness -= 3
        return { title, moneyDelta: -40000, note: 'ช่วยไป 40,000 บาท — ท่านหายดี แต่ใจเราแอบรู้สึกผิดนิดๆ' }
      }
      payCost(s, 80000)
      s.happiness += 4
      return { title, moneyDelta: -80000, note: 'จ่ายเต็ม 80,000 บาท ท่านหายดีและภูมิใจในตัวคุณมาก — นี่แหละ "sandwich generation" ของจริง' }
    },
  },

  repair: {
    id: 'repair', emoji: '🔧',
    build: () => ({
      title: 'รถพัง + บ้านรั่ว พร้อมกัน!',
      desc: 'เกียร์รถพังและหลังคารั่วในเดือนเดียว ค่าซ่อมรวม 40,000 บาท — เรื่องแบบนี้ไม่เคยเลือกเวลาเกิด',
      choices: [{ id: 'ok', label: 'จ่ายค่าซ่อม', detail: 'ชีวิตต้องเดินต่อ' }],
    }),
    apply: (s) => {
      const before = s.cash
      payCost(s, 40000)
      s.happiness -= 2
      const note = before >= 40000
        ? 'เงินสำรองเอาอยู่ — เรื่องน่ารำคาญ แต่ไม่สะเทือนแผน'
        : 'เงินสดไม่พอ ต้องดึงจากพอร์ต/เป็นหนี้ — เห็นไหมว่าเงินสำรองสำคัญแค่ไหน'
      return { title: 'รถพัง + บ้านรั่ว', moneyDelta: -40000, note }
    },
  },

  promo: {
    id: 'promo', emoji: '🚀',
    build: (s) => {
      const biz = s.careerId === 'biz'
      return {
        title: biz ? 'ธุรกิจโตก้าวกระโดด!' : 'ได้เลื่อนตำแหน่งใหญ่!',
        desc: biz ? 'สาขาใหม่ไปได้สวย กำไรพุ่ง — รายได้เพิ่ม 20%' : 'ผลงานเข้าตา รายได้เพิ่ม 15% จะใช้ชีวิตยังไงต่อ?',
        choices: [
          { id: 'keep', label: 'รายได้เพิ่ม แต่ใช้ชีวิตเท่าเดิม', detail: 'ส่วนต่างทั้งหมดไหลเข้าเงินออม/ลงทุน' },
          { id: 'upgrade', label: 'อัพเกรดไลฟ์สไตล์!', detail: 'รถใหม่ กินหรูขึ้น — ค่าใช้จ่าย +25%' },
        ],
      }
    },
    apply: (s, _mag, choiceId) => {
      const biz = s.careerId === 'biz'
      const title = biz ? 'ธุรกิจโตก้าวกระโดด!' : 'ได้เลื่อนตำแหน่งใหญ่!'
      s.monthlyIncome *= biz ? 1.20 : 1.15
      if (choiceId === 'upgrade') {
        s.livingMonthly *= 1.25
        s.happiness += 7
        return { title, moneyDelta: 0, note: 'ชีวิตดีขึ้นทันตา แต่ "lifestyle inflation" จะกินเงินเก็บคุณเงียบๆ ทุกเดือน' }
      }
      s.happiness += 3
      return { title, moneyDelta: 0, note: 'รายได้โตแต่รายจ่ายนิ่ง — ส่วนต่างคือเครื่องผลิตความมั่งคั่งชั้นดี' }
    },
  },

  edu: {
    id: 'edu', emoji: '🎓',
    condition: (s) => s.hasChild,
    build: () => ({
      title: 'ลูกสอบติดมหาวิทยาลัย!',
      desc: 'ค่าเทอม + ค่าใช้จ่าย 4 ปี รวม ~300,000 บาท ช่วงเวลาที่ภูมิใจที่สุด...และแพงที่สุด',
      choices: [{ id: 'ok', label: 'จ่ายค่าเทอม 🎓', detail: 'อนาคตของลูกคือการลงทุนที่คุ้มที่สุด' }],
    }),
    apply: (s) => {
      payCost(s, 300000)
      s.happiness += 8
      return { title: 'ลูกสอบติดมหาวิทยาลัย!', moneyDelta: -300000, note: 'จ่าย 300,000 บาทเพื่ออนาคตลูก — ครอบครัวภูมิใจสุดๆ' }
    },
  },
}

/** สร้าง EventInstance (ข้อความ + ทางเลือก) จากตารางเหตุการณ์ ณ state ปัจจุบัน */
export function instantiateEvent(s: GameState, sch: ScheduledEvent): EventInstance | null {
  const def = EVENT_DEFS[sch.eventId]
  if (!def) return null
  if (def.condition && !def.condition(s)) return null
  const built = def.build(s, sch.mag)
  return {
    key: `${sch.year}:${sch.eventId}`,
    eventId: sch.eventId, year: sch.year, mag: sch.mag,
    emoji: def.emoji, title: built.title, desc: built.desc, choices: built.choices,
  }
}

/** apply ผลของทางเลือกลง state (mutate ใน clone ที่ engine เตรียมให้) + คืน log */
export function applyEvent(s: GameState, ev: EventInstance, choiceId: string): LoggedEvent {
  const def = EVENT_DEFS[ev.eventId]
  const valid = ev.choices.some(c => c.id === choiceId) ? choiceId : ev.choices[0].id
  const r = def.apply(s, ev.mag, valid)
  s.happiness = Math.max(0, Math.min(100, s.happiness))
  const logged: LoggedEvent = {
    year: ev.year, age: 30 + ev.year, eventId: ev.eventId,
    title: r.title, choiceId: valid, moneyDelta: r.moneyDelta, note: r.note,
  }
  s.log.push(logged)
  return logged
}
