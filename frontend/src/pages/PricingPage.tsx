import { Check, Crown, Sparkles, Lock } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { usePlan } from '../hooks/usePlan'

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
    feats: ['แดชบอร์ด + จัดการข้อมูลลูกค้า', 'ไม่จำกัดจำนวนลูกค้า', 'ประเมินความเสี่ยงเบื้องต้น'] },
  { key: 'pro', name: 'Pro', sub: 'ทุกเมนูวางแผน (ไม่รวม AI)', price: '฿590', unit: '/เดือน', icon: Crown,
    feats: ['ทุกเมนูวางแผน 6 ด้าน', 'งบการเงินล่วงหน้า + วางแผนภาษี', 'รายงานฉบับเต็ม + สไลด์นำเสนอ', 'เซ็น PDPA + ส่งออก PDF'] },
  { key: 'ai', name: 'AI', sub: 'ทุกเมนู + ผู้ช่วย AI', price: '฿890', unit: '/เดือน', popular: true, icon: Sparkles,
    feats: ['ทุกฟีเจอร์ในแพ็กเกจ Pro', 'AI Copilot ผู้ช่วยวางแผน', 'วิเคราะห์เชิงลึกรายลูกค้า', 'อัปเดตฟีเจอร์ใหม่ก่อนใคร'] },
]

const RANK = { free: 0, pro: 1, ai: 2 }

export default function PricingPage() {
  const { plan } = usePlan()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1040 }}>
      <PageHeader icon={Crown} title="แพ็กเกจการใช้งาน" subtitle="อัปเกรดเพื่อปลดล็อกทุกเมนูวางแผนและ AI Copilot" />

      <div style={{ borderRadius: 14, border: '1px solid var(--cyan)', background: 'var(--cyan-dim)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Lock size={16} style={{ color: AC }} />
        <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
          แพ็กเกจปัจจุบันของคุณคือ <b style={{ color: AC }}>{plan === 'ai' ? 'AI' : plan === 'pro' ? 'Pro' : 'Free'}</b>
          {plan === 'free' && ' — เมนูวางแผนถูกล็อกไว้ อัปเกรดเพื่อเปิดใช้งาน'}
        </span>
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
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, marginBottom: 18 }}>
                {t.feats.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    <Check size={15} style={{ color: AC, flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
              </div>
              {isCurrent
                ? <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>แพ็กเกจปัจจุบัน</div>
                : t.key === 'free'
                  ? <div style={{ textAlign: 'center', padding: '10px', borderRadius: 10, border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: 13 }}>{isDowngrade ? 'รวมอยู่ในแพ็กเกจของคุณ' : '—'}</div>
                  : <button
                      onClick={() => { window.location.href = `mailto:info@wealthpro.cloud?subject=${encodeURIComponent('ขออัปเกรดแพ็กเกจ WealthPro — ' + t.name)}` }}
                      style={{ padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800,
                        background: t.popular ? AC : 'transparent', color: t.popular ? '#00201d' : 'var(--text-primary)',
                        outline: t.popular ? 'none' : '1px solid var(--card-border)' }}>
                      อัปเกรดเป็น {t.name}
                    </button>}
            </div>
          )
        })}
      </div>

      <div style={{ ...card_, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3 }}>Enterprise — สำหรับทีม/องค์กร</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>รวม AI · 5–10 คน 690 · 11–20 คน 590 · มากกว่า 20 คน 490 ฿/คน/เดือน · ช่วยตั้งค่า/อบรมให้ทีม</div>
        </div>
        <button onClick={() => { window.location.href = 'mailto:info@wealthpro.cloud?subject=' + encodeURIComponent('สอบถามแพ็กเกจ Enterprise WealthPro') }}
          style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--cyan)', background: 'transparent', color: AC, fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ติดต่อสอบถาม
        </button>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 }}>
        ระบบชำระเงินออนไลน์กำลังจะเปิดให้บริการเร็ว ๆ นี้ · ระหว่างนี้กรุณาติดต่อผู้ดูแลระบบเพื่ออัปเกรดแพ็กเกจ
      </p>
    </div>
  )
}

const card_: React.CSSProperties = {
  background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: '18px 22px',
}
