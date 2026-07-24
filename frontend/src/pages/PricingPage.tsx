import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Crown, Sparkles, Lock, Loader2, CreditCard } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { usePlan } from '../hooks/usePlan'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

const AC = 'var(--cyan)'

type Tier = {
  key: 'free' | 'pro' | 'ai'
  name: string
  sub: string
  price: string
  unit: string
  feats: string[]
  popular?: boolean
  icon?: any
}

const TIERS: Tier[] = [
  { key: 'free', name: 'Free', sub: 'สำหรับเริ่มต้นใช้งาน', price: '฿0', unit: '/เดือน',
    feats: ['แดชบอร์ด + จัดการข้อมูลลูกค้า', 'ลูกค้าสูงสุด 5 คน', 'ประเมินความเสี่ยงเบื้องต้น'] },
  { key: 'pro', name: 'Pro', sub: 'ทุกเมนูวางแผน (ไม่รวม AI)', price: '฿490', unit: '/เดือน', icon: Crown,
    feats: ['ทุกเมนูวางแผน 6 ด้าน', 'งบการเงินล่วงหน้า + วางแผนภาษี', 'รายงานฉบับเต็ม + สไลด์นำเสนอ', 'เซ็น PDPA + ส่งออก PDF'] },
  { key: 'ai', name: 'AI', sub: 'ทุกเมนู + ผู้ช่วย AI', price: '฿690', unit: '/เดือน', popular: true, icon: Sparkles,
    feats: ['ทุกฟีเจอร์ในแพ็กเกจ Pro', 'AI Copilot ผู้ช่วยวางแผน', 'วิเคราะห์เชิงลึกรายลูกค้า', 'อัปเดตฟีเจอร์ใหม่ก่อนใคร'] },
]

const RANK = { free: 0, pro: 1, ai: 2 }

export default function PricingPage() {
  const { plan } = usePlan()
  const { user, setUser } = useAuth()
  const promoActive = !!user?.promoActive
  const promoUntilTh = user?.promoFreeUntil
    ? new Date(user.promoFreeUntil).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null)

  const paidUser = plan === 'pro' || plan === 'ai'

  // กลับมาจาก Stripe Checkout — ดึงแพ็กเกจใหม่ (webhook อาจอัปเดตช้ากว่า redirect เล็กน้อย → poll สั้น ๆ)
  useEffect(() => {
    const status = params.get('status')
    if (status === 'success') {
      setMsg({ type: 'ok', text: 'ชำระเงินสำเร็จ! กำลังอัปเดตแพ็กเกจ…' })
      let tries = 0
      const poll = async () => {
        try {
          const { data } = await api.get('/auth/me')
          setUser(data)
          if (data?.plan && data.plan !== 'free') { setMsg({ type: 'ok', text: 'อัปเกรดแพ็กเกจเรียบร้อยแล้ว 🎉' }); return }
        } catch { /* ignore */ }
        if (++tries < 6) setTimeout(poll, 1500)
        else setMsg({ type: 'ok', text: 'ชำระเงินสำเร็จ — หากแพ็กเกจยังไม่อัปเดต กรุณารีเฟรชอีกครั้งในสักครู่' })
      }
      poll()
      params.delete('status'); setParams(params, { replace: true })
    } else if (status === 'cancel') {
      setMsg({ type: 'info', text: 'ยกเลิกการชำระเงินแล้ว — ยังไม่มีการเรียกเก็บเงิน' })
      params.delete('status'); setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function upgrade(target: 'pro' | 'ai') {
    setBusy(target); setMsg(null)
    try {
      const { data } = await api.post('/billing/checkout', { plan: target })
      window.location.href = data.url
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.response?.data?.error || 'เริ่มการชำระเงินไม่สำเร็จ' })
      setBusy(null)
    }
  }

  async function openPortal() {
    setBusy('portal'); setMsg(null)
    try {
      const { data } = await api.post('/billing/portal')
      window.location.href = data.url
    } catch (e: any) {
      setMsg({ type: 'err', text: e?.response?.data?.error || 'เปิดหน้าจัดการการชำระเงินไม่สำเร็จ' })
      setBusy(null)
    }
  }

  const msgColor = msg?.type === 'ok' ? '#059669' : msg?.type === 'err' ? '#dc2626' : 'var(--text-secondary)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1040 }}>
      <PageHeader icon={Crown} title="แพ็กเกจการใช้งาน" subtitle="อัปเกรดเพื่อปลดล็อกทุกเมนูวางแผนและ AI Copilot" />

      {msg && (
        <div style={{ borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: msgColor,
          background: msg.type === 'err' ? 'rgba(220,38,38,0.08)' : msg.type === 'ok' ? 'rgba(5,150,105,0.08)' : 'var(--card-bg)',
          border: `1px solid ${msg.type === 'err' ? 'rgba(220,38,38,0.3)' : msg.type === 'ok' ? 'rgba(5,150,105,0.3)' : 'var(--card-border)'}` }}>
          {msg.text}
        </div>
      )}

      {promoActive && (
        <div style={{ borderRadius: 14, border: '1px solid #059669', background: 'rgba(5,150,105,0.08)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Sparkles size={17} style={{ color: '#059669' }} />
          <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
            🎉 <b>ช่วงเปิดตัว</b> — เปิดให้ใช้งาน<b>ทุกเมนูฟรี</b>ถึงวันที่ <b style={{ color: '#059669' }}>{promoUntilTh || '30 กันยายน 2569'}</b> · หลังจากนั้นจะเริ่มระบบแพ็กเกจตามปกติ
          </span>
        </div>
      )}

      <div style={{ borderRadius: 14, border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lock size={16} style={{ color: AC }} />
          แพ็กเกจปัจจุบันของคุณคือ <b style={{ color: AC }}>{plan === 'ai' ? 'AI' : plan === 'pro' ? 'Pro' : 'Free'}</b>
          {plan === 'free' && ' — เมนูวางแผนถูกล็อกไว้ อัปเกรดเพื่อเปิดใช้งาน'}
        </span>
        {paidUser && !promoActive && (
          <button onClick={openPortal} disabled={busy === 'portal'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--cyan)', background: 'transparent', color: AC, fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
            {busy === 'portal' ? <Loader2 size={14} className="spin" /> : <CreditCard size={14} />} จัดการการชำระเงิน
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 16 }}>
        {TIERS.map(t => {
          const isCurrent = plan === t.key
          const isDowngrade = RANK[t.key as keyof typeof RANK] < RANK[plan as keyof typeof RANK]
          const Icon = t.icon
          return (
            <div key={t.key} style={{
              position: 'relative', borderRadius: 16, padding: 26, display: 'flex', flexDirection: 'column',
              background: 'var(--card-bg)',
              border: t.popular ? `1.5px solid ${AC}` : '1px solid var(--card-border)',
              boxShadow: t.popular ? '0 8px 30px rgba(0,207,193,0.12)' : 'none',
            }}>
              {t.popular && <div style={{ position: 'absolute', top: 0, right: 0, background: AC, color: '#00201d', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', padding: '5px 14px', borderBottomLeftRadius: 12, textTransform: 'uppercase' }}>แนะนำ</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                {Icon && <Icon size={18} style={{ color: t.popular ? AC : 'var(--text-secondary)' }} />}
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{t.name}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{t.sub}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: t.popular ? AC : 'var(--text-primary)', fontFamily: 'monospace' }}>{t.price}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}> {t.unit}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>{t.key === 'free' ? '' : 'ราคารวม VAT แล้ว'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginBottom: 18 }}>
                {t.feats.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <Check size={15} style={{ color: AC, flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
              </div>
              {promoActive
                ? <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 12.5 }}>{t.key === 'free' ? '—' : 'ใช้ได้ฟรีในช่วงเปิดตัว'}</div>
                : isCurrent
                ? <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>แพ็กเกจปัจจุบัน</div>
                : t.key === 'free'
                  ? <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 13 }}>{isDowngrade ? 'ปรับลดผ่าน "จัดการการชำระเงิน"' : '—'}</div>
                  : paidUser
                    ? <button onClick={openPortal} disabled={!!busy}
                        style={{ padding: '11px', borderRadius: 10, border: '1px solid var(--card-border)', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, background: 'transparent', color: 'var(--text-primary)' }}>
                        เปลี่ยนเป็น {t.name}
                      </button>
                    : <button onClick={() => upgrade(t.key as 'pro' | 'ai')} disabled={!!busy}
                        style={{ padding: '11px', borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          background: t.popular ? AC : 'transparent', color: t.popular ? '#00201d' : 'var(--text-primary)',
                          outline: t.popular ? 'none' : '1px solid var(--card-border)', opacity: busy && busy !== t.key ? 0.6 : 1 }}>
                        {busy === t.key && <Loader2 size={15} className="spin" />} อัปเกรดเป็น {t.name}
                      </button>}
            </div>
          )
        })}
      </div>

      <div style={{ ...card_, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>Enterprise — สำหรับทีม/องค์กร</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>ได้ทุกฟีเจอร์ในแพ็กเกจ AI (รวม AI Copilot) สำหรับทั้งทีม · จัดการผู้ใช้หลายคน · ช่วยตั้งค่าและอบรมให้ทีม · ราคาพิเศษสำหรับองค์กร ติดต่อสอบถาม</div>
        </div>
        <button onClick={() => { window.location.href = 'mailto:info@wealthpro.cloud?subject=' + encodeURIComponent('สอบถามแพ็กเกจ Enterprise WealthPro') }}
          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--cyan)', background: 'transparent', color: AC, fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ติดต่อสอบถาม
        </button>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
        ชำระเงินปลอดภัยด้วยบัตรเครดิต/เดบิตผ่าน Stripe · ตัดค่าบริการอัตโนมัติทุกเดือน · ยกเลิกได้ทุกเมื่อผ่าน "จัดการการชำระเงิน"
      </p>

      <style>{`.spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const card_: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 22px',
}
