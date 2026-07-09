import { Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { computeFinancialSummary } from './finance.controller'

const MODEL = 'claude-sonnet-5'

// สร้าง client แบบ lazy — อ่าน ANTHROPIC_API_KEY ตอน request แรก (หลัง dotenv.config() ทำงานแล้ว)
// กันบั๊กลำดับ import: index.ts import routes ก่อนเรียก dotenv.config() → ถ้าอ่าน env ตอน module load จะได้ค่าว่าง
let _client: Anthropic | null | undefined
function getAnthropic(): Anthropic | null {
  if (_client === undefined) {
    const key = process.env.ANTHROPIC_API_KEY
    _client = key ? new Anthropic({ apiKey: key }) : null
  }
  return _client
}

const SYSTEM_PROMPT = `คุณคือ "WealthPro Copilot" ผู้ช่วยของนักวางแผนการเงิน (Financial Advisor) ในแอปวางแผนการเงินส่วนบุคคลของไทย

บทบาทของคุณ:
- ตอบคำถามเกี่ยวกับข้อมูลลูกค้าที่กำลังดูอยู่ โดยอ้างอิงจาก "ข้อมูลลูกค้า" ที่ให้ไว้ด้านล่างเท่านั้น
- ให้คำแนะนำเชิงกลยุทธ์ทางการเงินตามหลัก CFP (6 ขั้นตอน) — งบดุล/กระแสเงินสด, บริหารความเสี่ยง/ประกัน, ภาษี, การลงทุน, เกษียณ, มรดก
- ช่วยร่างข้อความ/คอมเมนต์ที่ปรึกษาสำหรับรายงานหรือแผนดำเนินการเมื่อถูกขอ

รูปแบบการตอบ (สำคัญมากที่สุด — สั้นที่สุดเท่าที่ได้ใจความ):
- ตอบให้สั้นที่สุด: ค่าเริ่มต้น 1–3 ประโยค หรือ bullet ไม่เกิน 3 ข้อ (ข้อละ 1 บรรทัดสั้นๆ)
- ขึ้นต้นด้วยคำตอบเลย ห้ามเกริ่นนำ ห้ามทวนคำถาม ห้ามสรุปซ้ำท้าย
- ใส่เฉพาะตัวเลข/ประเด็นที่ตอบคำถามโดยตรง ตัดบริบทที่ไม่จำเป็นและคำฟุ่มเฟือยทิ้ง
- ถ้าตอบได้ด้วยประโยคเดียว ให้ตอบประโยคเดียว · รายละเอียดเพิ่มรอผู้ใช้ถามต่อ

หลักการ:
- **ใช้ตัวเลขจาก "ข้อมูลลูกค้า" และ "ตัวเลขที่คำนวณไว้แล้ว" มาตอบโดยตรง — ห้ามคำนวณเอง ห้ามแสดงขั้นตอน/สูตรการคำนวณ** เพราะระบบคำนวณให้แล้วและตรงกับหน้าจอ
- ถ้าตัวเลขที่ต้องใช้ไม่มีในข้อมูล ให้บอกสั้นๆ ว่ายังไม่มี + ดูได้ที่หน้าไหน (อย่าเดา/อย่าประมาณเอง)
- ตอบเป็นภาษาไทย เป็นมืออาชีพแต่เข้าใจง่าย · อย่าให้คำมั่นเรื่องผลตอบแทน
- คุณคุยกับ "นักวางแผน" ไม่ใช่ลูกค้าโดยตรง — โทนเพื่อนร่วมงานมืออาชีพ
- คุณช่วยแนะนำเท่านั้น การตัดสินใจเป็นของนักวางแผน`

const toNum = (v: any) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
const fmt = (n: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

/** สร้าง context ข้อมูลลูกค้าปัจจุบัน (effectiveUserId) แบบกระชับ ป้อนให้โมเดล */
export async function buildClientContext(userId: string): Promise<string> {
  const [cp, profile, lifeIns, invProfile, fin] = await Promise.all([
    prisma.clientProfile.findUnique({ where: { userId }, include: { children: true } }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.lifeInsurancePolicy.findMany({ where: { userId } }),
    prisma.investmentProfile.findUnique({ where: { userId } }),
    // ใช้ตัวคำนวณเดียวกับหน้ารายงาน/แดชบอร์ด (financial-ratios) เพื่อให้ตัวเลขตรงกับหน้าจอเป๊ะ
    computeFinancialSummary(userId, false).catch(() => null),
  ])

  if (!cp && !profile) return 'ยังไม่มีข้อมูลลูกค้ารายนี้ในระบบ (ยังไม่ได้กรอกข้อมูลส่วนบุคคล)'

  const lines: string[] = []
  const age = cp?.birthDate ? new Date().getFullYear() - new Date(cp.birthDate).getFullYear() : (profile?.age ?? null)
  const name = [cp?.firstName, cp?.lastName].filter(Boolean).join(' ') || 'ลูกค้า'

  lines.push('== ข้อมูลส่วนบุคคล ==')
  lines.push(`ชื่อ: ${name}${cp?.nickname ? ` (${cp.nickname})` : ''}`)
  if (age != null) lines.push(`อายุ: ${age} ปี`)
  if (cp?.maritalStatus) lines.push(`สถานภาพ: ${cp.maritalStatus}`)
  if (cp?.occupation || cp?.jobTitle) lines.push(`อาชีพ: ${[cp?.occupation, cp?.jobTitle].filter(Boolean).join(' · ')}`)
  if (cp?.salary) lines.push(`เงินเดือน: ${fmt(toNum(cp.salary))} บาท/เดือน`)
  const children = cp?.children ?? []
  if (children.length) lines.push(`บุตร ${children.length} คน: ${children.map(c => `${c.name || 'บุตร'} (${c.age ?? '-'} ปี)`).join(', ')}`)
  if (cp?.spouseProfile || cp?.spouseName) lines.push(`คู่สมรส: ${cp?.spouseName || (cp?.spouseProfile as any)?.firstName || 'มี'}${cp?.spouseAge ? ` อายุ ${cp.spouseAge} ปี` : ''}`)
  if (cp?.healthInfo) {
    const h: any = cp.healthInfo
    const cond = [h?.chronic?.has ? `โรคประจำตัว${h.chronic.detail ? ': ' + h.chronic.detail : ''}` : '', h?.severeIllness?.has ? 'มีโรคร้ายแรง' : ''].filter(Boolean)
    if (cond.length) lines.push(`สุขภาพ: ${cond.join(' · ')}`)
  }

  // งบดุล + กระแสเงินสด + สุขภาพการเงิน (จาก computeFinancialSummary — ตรงกับหน้ารายงาน/แดชบอร์ด)
  const sm = fin?.summary
  if (sm && (sm.totalAssets > 0 || sm.totalDebtBalance > 0)) {
    lines.push('\n== งบดุล ==')
    lines.push(`สินทรัพย์รวม: ${fmt(sm.totalAssets)} บาท (สภาพคล่อง ${fmt(sm.liquidAssets)} · ลงทุน ${fmt(sm.investAssets)} · ส่วนตัว ${fmt(sm.personalTotal)})`)
    lines.push(`หนี้สินรวม: ${fmt(sm.totalDebtBalance)} บาท`)
    lines.push(`ความมั่งคั่งสุทธิ: ${fmt(sm.netWorth)} บาท`)
  }
  if (sm && (sm.totalAnnualIncome > 0 || sm.totalMonthlyExp > 0)) {
    lines.push('\n== กระแสเงินสด (ต่อเดือน) ==')
    lines.push(`รายได้รวม: ${fmt(sm.monthlyIncome)} บาท · รายจ่ายรวม: ${fmt(sm.totalMonthlyExp)} บาท · กระแสเงินสดสุทธิ: ${fmt(sm.netAnnualCashFlow / 12)} บาท/เดือน`)
    lines.push(`รายได้รวมทั้งปี: ${fmt(sm.totalAnnualIncome)} บาท · เงินออม/ลงทุนต่อปี: ${fmt(sm.annualSavings)} บาท`)
  }
  if (sm && fin?.healthScore != null) lines.push(`\nคะแนนสุขภาพการเงิน: ${fin.healthScore}/100 (${fin.healthLabel})`)

  // ── การลงทุน (พอร์ต) ── จาก investment-profile
  const inv: any = invProfile
  if (inv) {
    const invAssets: any[] = inv.investmentAssets ?? []
    const byClass: Record<string, number> = {}
    invAssets.forEach(a => { const v = toNum(a.currentValue); if (v > 0) byClass[a.assetClass || 'อื่นๆ'] = (byClass[a.assetClass || 'อื่นๆ'] || 0) + v })
    const portTotal = Object.values(byClass).reduce((s, v) => s + v, 0)
    if (portTotal > 0) {
      lines.push('\n== พอร์ตการลงทุน ==')
      lines.push(`มูลค่ารวม: ${fmt(portTotal)} บาท`)
      lines.push('สัดส่วน: ' + Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v)} (${Math.round(v / portTotal * 100)}%)`).join(' · '))
    }
    const savings: any[] = inv.savingsAccounts ?? []
    const savTotal = savings.reduce((s, a) => s + toNum(a.currentValue), 0)
    if (savTotal > 0) lines.push(`เงินฝาก/สภาพคล่อง: ${fmt(savTotal)} บาท (${savings.length} บัญชี)`)
  }
  if (profile?.riskLabel) lines.push(`ระดับความเสี่ยงที่ยอมรับได้: ${profile.riskLabel}`)

  // ── ประกัน & ความคุ้มครอง ──
  lines.push('\n== ประกัน & ความคุ้มครอง ==')
  if (lifeIns.length) {
    const totalSA = lifeIns.reduce((s, p) => s + toNum(p.sumAssured), 0)
    const totalPrem = lifeIns.reduce((s, p) => s + toNum(p.premium), 0)
    lines.push(`ประกันชีวิตที่มี: ${lifeIns.length} กรมธรรม์ · ทุนประกันรวม ${fmt(totalSA)} บาท · เบี้ยรวม ${fmt(totalPrem)} บาท/ปี`)
    const types = [...new Set(lifeIns.map(p => p.insuranceType).filter(Boolean))]
    if (types.length) lines.push(`ประเภท: ${types.join(', ')}`)
  } else lines.push('ยังไม่มีกรมธรรม์ประกันชีวิต')
  const welfare: string[] = []
  if (cp?.hasSocialSecurity) welfare.push(`ประกันสังคม (${cp.socialSecurityYears ?? '-'} ปี)`)
  if (cp?.hasGroupInsurance) welfare.push(`ประกันกลุ่ม (ห้อง ${fmt(toNum(cp.giRoomLimit))} · ผู้ป่วยนอก ${fmt(toNum(cp.giOpdLimit))})`)
  if (cp?.hasPVD) welfare.push('กองทุนสำรองเลี้ยงชีพ (PVD)')
  if (welfare.length) lines.push('สวัสดิการ: ' + welfare.join(' · '))
  const ip: any = (profile?.insurancePlan as any)?.self
  if (ip) {
    const hlv = [
      toNum(ip.income) > 0 ? `คุ้มครองรายได้ ${fmt(toNum(ip.income))} บาท/ปี × ${ip.years ?? '-'} ปี` : '',
      toNum(ip.debts) > 0 ? `หนี้ ${fmt(toNum(ip.debts))}` : '',
      toNum(ip.education) > 0 ? `ทุนการศึกษาบุตร ${fmt(toNum(ip.education))}` : '',
      toNum(ip.finalExpense) > 0 ? `ค่าใช้จ่ายสุดท้าย ${fmt(toNum(ip.finalExpense))}` : '',
    ].filter(Boolean)
    if (hlv.length) lines.push('สมมติฐานทุนที่ควรมี (HLV): ' + hlv.join(' · '))
  }

  // ── แผนเกษียณ (เป้าหมาย/สมมติฐาน) ──
  const rp: any = (profile?.retirementPlan as any)?.self
  if (rp) {
    lines.push('\n== แผนเกษียณ ==')
    lines.push(`เกษียณอายุ ${rp.retirementAge ?? profile?.retirementAgeSelf ?? '-'} · คาดอายุขัย ${rp.lifeExpectancy ?? profile?.lifeExpectancySelf ?? '-'} · ปัจจุบัน ${rp.currentAge ?? age ?? '-'} ปี`)
    const living = toNum(rp.monthlyLiving), health = toNum(rp.monthlyHealth)
    if (living || health) lines.push(`ต้องการหลังเกษียณ: ค่าครองชีพ ${fmt(living)} + สุขภาพ ${fmt(health)} = ${fmt(living + health)} บาท/เดือน`)
    if (toNum(rp.legacy)) lines.push(`มรดกที่อยากทิ้งไว้: ${fmt(toNum(rp.legacy))} บาท`)
    lines.push(`สมมติฐานผลตอบแทน: ก่อนเกษียณ ${rp.preRetirementReturn ?? '-'}% · หลังเกษียณ ${rp.postRetirementReturn ?? '-'}% · เงินเฟ้อ ${rp.inflationRate ?? '-'}%`)
    if (Array.isArray(rp.goals) && rp.goals.length) lines.push('เป้าหมายก้อนช่วงเกษียณ: ' + rp.goals.map((g: any) => `${g.name || '-'} ${fmt(toNum(g.amount))}`).join(', '))
  }
  const retSrc: string[] = []
  if (profile?.pvdPlan) retSrc.push('PVD'); if (profile?.ssoPlan) retSrc.push('บำนาญประกันสังคม'); if (profile?.severancePlan) retSrc.push('เงินชดเชยเกษียณ')
  if (retSrc.length) lines.push('แหล่งเงินเกษียณที่มี: ' + retSrc.join(', '))

  // ── แผนการศึกษาบุตร ──
  const ec: any = profile?.educationCosts
  if (children.length && ec) {
    lines.push('\n== แผนการศึกษาบุตร ==')
    const levels: [string, string][] = [['kindergarten', 'อนุบาล'], ['primary', 'ประถม'], ['secondary', 'มัธยม'], ['bachelor', 'ป.ตรี'], ['master', 'ป.โท']]
    const num = (x: any) => typeof x === 'number' ? x : (x && typeof x === 'object' ? toNum((x as any).private ?? (x as any).public ?? Object.values(x)[0]) : toNum(x))
    const cost = levels.map(([k, l]) => { const v = num(ec[k]); return v > 0 ? `${l} ~${fmt(v)}/ปี` : '' }).filter(Boolean).join(' · ')
    if (cost) lines.push('ค่าเล่าเรียนโดยประมาณ: ' + cost)
    lines.push(`สมมติฐาน: เงินเฟ้อการศึกษา ${profile?.educationInflation ?? '-'}% · ผลตอบแทนกองทุนการศึกษา ${profile?.educationFundReturn ?? '-'}%`)
  }

  // ── ภาษีเงินได้ (ข้อมูลที่กรอก) ──
  const tp: any = (profile?.taxPlan as any)?.self
  if (tp) {
    lines.push('\n== ภาษีเงินได้ (ข้อมูลที่กรอกไว้) ==')
    const incLabel: Record<string, string> = { income40_1: 'เงินเดือน', income40_2: 'รับจ้างทั่วไป', income40_3: 'ค่าลิขสิทธิ์', income40_7: 'รับเหมา' }
    const inc = Object.entries(incLabel).map(([k, l]) => toNum(tp[k]) > 0 ? `${l} ${fmt(toNum(tp[k]))}` : '').filter(Boolean)
    if (inc.length) lines.push('เงินได้: ' + inc.join(' · '))
    // ลดหย่อนที่เป็นจำนวนเงิน (บาท) — ไม่รวม children/parents/disabled ที่เก็บเป็น "จำนวนคน"
    const dedLabel: Record<string, string> = { lifeIns: 'ประกันชีวิต', healthIns: 'ประกันสุขภาพ', annuityIns: 'ประกันบำนาญ', rmf: 'RMF', thaiesg: 'ThaiESG/SSF', pvd: 'PVD', nsf: 'กอช.', socialSec: 'ประกันสังคม', donation: 'บริจาค', eduDonation: 'บริจาคศึกษา', mortgage: 'ดอกเบี้ยบ้าน', parentHealthIns: 'ปกส.สุขภาพบิดามารดา', prepaid: 'เบี้ยประกันสุขภาพตนเอง', easyReceipt: 'Easy e-Receipt' }
    const ded = Object.entries(dedLabel).map(([k, l]) => toNum(tp[k]) > 0 ? `${l} ${fmt(toNum(tp[k]))}` : '').filter(Boolean)
    if (ded.length) lines.push('ค่าลดหย่อนที่ใช้ (บาท): ' + ded.join(' · '))
    const counts = [toNum(tp.children) > 0 ? `บุตร ${toNum(tp.children)} คน` : '', toNum(tp.parents) > 0 ? `อุปการะบิดามารดา ${toNum(tp.parents)} คน` : ''].filter(Boolean)
    if (counts.length) lines.push('ลดหย่อนตามจำนวน: ' + counts.join(' · '))
    lines.push('(ภาษีสุทธิคำนวณที่หน้าวางแผนภาษี — ส่วนนี้แสดงเฉพาะข้อมูลที่กรอก)')
  }

  // ── แผนมรดก ──
  const es: any = (profile?.estatePlan as any)?.self
  if (es) {
    lines.push('\n== แผนมรดก ==')
    if (sm) lines.push(`กองมรดก (ประมาณจากความมั่งคั่งสุทธิ): ${fmt(sm.netWorth)} บาท`)
    const heirs = [es.spouseAlive ? 'คู่สมรส' : '', es.fatherAlive ? 'บิดา' : '', es.motherAlive ? 'มารดา' : '', toNum(es.siblingsCount) > 0 ? `พี่น้อง ${es.siblingsCount} คน` : '', children.length ? `บุตร ${children.length} คน` : ''].filter(Boolean)
    if (heirs.length) lines.push('ทายาทที่มีชีวิต: ' + heirs.join(', '))
    if (es.hasWill) lines.push('มีพินัยกรรมแล้ว')
    if (es.maritalAssetPct != null) lines.push(`สัดส่วนสินสมรส: ${es.maritalAssetPct}%`)
  }

  // ── เป้าหมายทางการเงิน ──
  const goals: any = cp?.financialGoals ?? profile?.financialGoals
  if (goals) {
    const list = Array.isArray(goals?.self) ? goals.self : (Array.isArray(goals) ? goals : [])
    if (list.length) {
      lines.push('\n== เป้าหมายทางการเงิน ==')
      list.slice(0, 12).forEach((g: any) => lines.push(`- ${g.name || g.title || 'เป้าหมาย'}${g.amount ? ` : ${fmt(toNum(g.amount))} บาท` : ''}${g.years || g.timeframe ? ` ภายใน ${g.years || g.timeframe} ปี` : ''}`))
    }
  }

  const ctx = lines.join('\n')
  return ctx.length > 12000 ? ctx.slice(0, 12000) + '\n…(ตัดทอน)' : ctx
}

type ChatMsg = { role: 'user' | 'assistant'; content: string }

export async function chatCopilot(req: AuthRequest, res: Response): Promise<void> {
  const anthropic = getAnthropic()
  if (!anthropic) {
    res.status(503).json({ error: 'ระบบ AI Copilot ยังไม่ได้ตั้งค่า (ต้องกำหนด ANTHROPIC_API_KEY)' })
    return
  }
  const messages: ChatMsg[] = Array.isArray(req.body?.messages) ? req.body.messages : []
  if (messages.length === 0) {
    res.status(400).json({ error: 'ไม่มีข้อความ' })
    return
  }
  // กันข้อความยาวเกิน + คงเฉพาะ role ที่ถูกต้อง
  const cleaned = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-16)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
  if (cleaned.length === 0 || cleaned[0].role !== 'user') {
    res.status(400).json({ error: 'ข้อความไม่ถูกต้อง' })
    return
  }

  let clientContext = 'ไม่สามารถโหลดข้อมูลลูกค้าได้'
  try { clientContext = await buildClientContext(req.effectiveUserId!) } catch { /* ใช้ค่า default */ }

  // ตัวเลข readiness ที่ frontend คำนวณไว้แล้ว (ความพร้อมเกษียณ/ประกัน/การศึกษา) — ส่งมาให้ AI ใช้ตรงๆ ไม่ต้องคำนวณใหม่
  const computed = typeof req.body?.computed === 'string' ? req.body.computed.slice(0, 4000).trim() : ''
  const contextText = `===== ข้อมูลลูกค้าที่กำลังดูอยู่ =====\n${clientContext}`
    + (computed ? `\n\n===== ตัวเลขที่คำนวณไว้แล้ว (ตรงกับหน้าจอ ใช้ตอบได้ทันที ห้ามคำนวณใหม่) =====\n${computed}` : '')

  // แยกเป็น 2 บล็อก: SYSTEM_PROMPT (คงที่) + context ลูกค้า (คงที่ตลอดบทสนทนา)
  // ใส่ cache_control ที่บล็อกท้าย → cache ทั้ง system ไว้ เทิร์นถัดไปในบทสนทนาเดียวจ่าย cache-read ~0.1x
  const system = [
    { type: 'text' as const, text: SYSTEM_PROMPT },
    { type: 'text' as const, text: contextText, cache_control: { type: 'ephemeral' as const } },
  ]

  // สตรีมข้อความกลับเป็น text/plain (frontend อ่านทีละ chunk)
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 500, // จำกัดความยาว — เน้นตอบสั้นได้ใจความ (ถ้าผู้ใช้อยากละเอียดค่อยถามต่อ)
      thinking: { type: 'disabled' }, // แชทตอบไว ไม่ต้องคิดยาว (ลด token/latency)
      system,
      messages: cleaned,
    })
    stream.on('text', (delta: string) => { res.write(delta) })
    const final = await stream.finalMessage()
    const u = final.usage
    // log ไว้ดูว่า caching ทำงาน (cacheR > 0 ในเทิร์นที่ 2 เป็นต้นไป)
    console.log(`[copilot] in=${u.input_tokens} cacheWrite=${u.cache_creation_input_tokens ?? 0} cacheRead=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}`)
    res.end()
  } catch (e: any) {
    // ถ้ายังไม่ได้ส่ง header สถานะ (ไม่น่าเกิดเพราะ setHeader ไปแล้ว) — เขียนข้อความ error ต่อท้าย
    if (!res.headersSent) res.status(500)
    res.write(`\n\n[เกิดข้อผิดพลาดในการเรียก AI: ${e?.message || 'ไม่ทราบสาเหตุ'}]`)
    res.end()
  }
}
