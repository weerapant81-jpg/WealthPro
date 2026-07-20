import { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth'
import { getStripe, stripeConfigured, priceFor, priceToPlan } from '../lib/stripe'

const frontendUrl = () => (process.env.FRONTEND_URL || 'https://wealthpro.cloud').split(',')[0].trim()

// POST /billing/checkout — สร้าง Stripe Checkout Session สำหรับสมัคร Pro/AI แล้วคืน url ให้ไปจ่าย
export async function createCheckout(req: AuthRequest, res: Response): Promise<void> {
  if (!stripeConfigured()) { res.status(503).json({ error: 'ระบบชำระเงินยังไม่พร้อมใช้งาน' }); return }
  const plan = req.body?.plan as string
  if (plan !== 'pro' && plan !== 'ai') { res.status(400).json({ error: 'plan ต้องเป็น pro | ai' }); return }
  const priceId = priceFor(plan)
  if (!priceId) { res.status(503).json({ error: 'ยังไม่ได้ตั้งค่าราคาแพ็กเกจในระบบ' }); return }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  })
  if (!user) { res.status(404).json({ error: 'ไม่พบผู้ใช้' }); return }

  const stripe = getStripe()
  let customerId = user.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } })
    customerId = customer.id
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl()}/pricing?status=success`,
    cancel_url: `${frontendUrl()}/pricing?status=cancel`,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
  })
  res.json({ url: session.url })
}

// POST /billing/portal — เปิด Stripe Customer Portal (ยกเลิก/เปลี่ยนบัตร/ดูใบเสร็จ)
export async function createPortal(req: AuthRequest, res: Response): Promise<void> {
  if (!stripeConfigured()) { res.status(503).json({ error: 'ระบบชำระเงินยังไม่พร้อมใช้งาน' }); return }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { stripeCustomerId: true } })
  if (!user?.stripeCustomerId) { res.status(400).json({ error: 'ยังไม่มีข้อมูลการชำระเงิน' }); return }
  const session = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${frontendUrl()}/pricing`,
  })
  res.json({ url: session.url })
}

/** อัปเดตแพ็กเกจของผู้ใช้จากสถานะ subscription ใน Stripe (ข้ามถ้า SUPER_ADMIN ตั้งเอง = planOverride) */
async function applySubscription(sub: any): Promise<void> {
  const priceId: string | undefined = sub?.items?.data?.[0]?.price?.id
  const plan = priceToPlan(priceId)
  const status: string = sub?.status
  const active = status === 'active' || status === 'trialing'

  // หาผู้ใช้จาก metadata.userId ก่อน แล้วค่อย fallback เป็น stripeCustomerId
  let user = sub?.metadata?.userId
    ? await prisma.user.findUnique({ where: { id: sub.metadata.userId }, select: { id: true, planOverride: true } })
    : null
  if (!user && sub?.customer) {
    user = await prisma.user.findFirst({ where: { stripeCustomerId: String(sub.customer) }, select: { id: true, planOverride: true } })
  }
  if (!user) return
  if (user.planOverride) return   // ผู้ให้บริการตั้งแพ็กเกจเอง → webhook ไม่ทับ

  const newPlan = active && plan ? plan : 'free'
  const expires = sub?.current_period_end ? new Date(sub.current_period_end * 1000) : null
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: newPlan,
      planExpiresAt: newPlan === 'free' ? null : expires,
      stripeSubscriptionId: sub?.id ?? null,
    },
  })
}

// POST /billing/webhook — รับสัญญาณจาก Stripe (ต้องใช้ raw body + verify signature)
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  if (!stripeConfigured()) { res.status(503).end(); return }
  const whsec = process.env.STRIPE_WEBHOOK_SECRET
  if (!whsec) { res.status(503).end(); return }
  const sig = req.headers['stripe-signature'] as string
  let event: any
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, whsec)
  } catch (e: any) {
    res.status(400).send(`Webhook Error: ${e.message}`)
    return
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object
        const subId = s.subscription
        if (subId) {
          const sub = await getStripe().subscriptions.retrieve(String(subId))
          // เก็บ userId จาก session ไว้ใน sub.metadata ให้ applySubscription หาเจอ
          ;(sub as any).metadata = { ...(sub as any).metadata, userId: s.metadata?.userId }
          await applySubscription(sub)
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(event.data.object)
        break
    }
  } catch (e) {
    console.error('[stripe webhook]', e)
  }
  res.json({ received: true })
}
