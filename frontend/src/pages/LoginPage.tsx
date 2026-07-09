import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser, registerUser, googleLogin, appleLogin, forgotPassword, resendVerify } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { Mail, Eye, EyeOff, ArrowRight, Activity, ShieldCheck, User, Phone } from 'lucide-react'

const field: React.CSSProperties = {
  width: '100%', height: 48, padding: '0 42px 0 14px', borderRadius: 10,
  border: '1px solid var(--card-border)', background: 'var(--navy-900)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const capLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }

/* โลโก้ Google (สีจริง) */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
)
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.96.95-2.18 2.37-3.95 2.37-1.83 0-2.31-1.34-4.52-1.34-2.21 0-2.89 1.34-4.64 1.34-1.63 0-3.03-1.69-3.99-2.91-1.95-2.48-3.45-6.99-1.42-10.43 1-1.72 2.76-2.81 4.71-2.81 1.49 0 2.91.95 3.81.95s2.54-1.15 4.31-1.15c1.83 0 3.39.95 4.39 2.29-3.64 1.94-3.04 7.24.56 8.7zm-4.32-15.34c.79-.96 1.32-2.3 1.17-3.64-1.15.04-2.54.76-3.37 1.73-.74.87-1.39 2.25-1.22 3.55 1.28.1 2.63-.68 3.42-1.64z" /></svg>
)

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [needVerify, setNeedVerify] = useState(false)
  const [twoFa, setTwoFa] = useState(false)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  // แสดงผลการยืนยันอีเมลจากลิงก์ในเมล (?verify=success|expired|invalid)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('verify')
    if (!v) return
    if (v === 'success') setInfo('ยืนยันอีเมลสำเร็จ! เมื่อผู้ให้บริการอนุมัติบัญชีแล้ว คุณจะเข้าสู่ระบบได้')
    else setError('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบเพื่อขอลิงก์ใหม่')
    window.history.replaceState({}, '', '/login')
  }, [])

  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)
  useEffect(() => {
    const onR = () => setWide(window.innerWidth >= 900)
    window.addEventListener('resize', onR)
    return () => window.removeEventListener('resize', onR)
  }, [])

  const isReg = mode === 'register'
  const isForgot = mode === 'forgot'
  const switchMode = (m: 'login' | 'register' | 'forgot') => { setMode(m); setError(''); setInfo(''); setNeedVerify(false) }

  // ── Google Identity Services ──
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const onCredRef = useRef<(credential: string) => void>(() => {})

  async function handleGoogle(credential: string) {
    setError(''); setInfo(''); setNeedVerify(false); setLoading(true)
    try {
      const user = await googleLogin(credential)
      setUser(user); navigate('/')
    } catch (err: any) {
      const d = err.response?.data
      if (d?.pending) setInfo('บัญชี Google ของคุณถูกสร้างแล้ว — กรุณารอผู้ให้บริการอนุมัติก่อนเข้าใช้งาน')
      else setError(d?.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
    } finally { setLoading(false) }
  }
  onCredRef.current = handleGoogle

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || isForgot) return
    let cancelled = false
    const render = () => {
      const g = (window as any).google
      if (cancelled || !g?.accounts?.id || !googleBtnRef.current) return
      g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r: any) => onCredRef.current(r.credential) })
      googleBtnRef.current.innerHTML = ''
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 360, logo_alignment: 'center',
      })
    }
    if (document.getElementById('gsi-script')) { render() }
    else {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true; s.defer = true; s.id = 'gsi-script'
      s.onload = render
      document.body.appendChild(s)
    }
    return () => { cancelled = true }
  }, [GOOGLE_CLIENT_ID, isForgot, mode, wide])

  // ── Sign in with Apple (JS SDK) ──
  const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined
  const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined

  useEffect(() => {
    if (!APPLE_CLIENT_ID) return
    const setup = () => {
      const A = (window as any).AppleID
      if (!A?.auth) return
      A.auth.init({ clientId: APPLE_CLIENT_ID, scope: 'name email', redirectURI: APPLE_REDIRECT_URI, usePopup: true })
    }
    if ((window as any).AppleID) { setup() }
    else if (!document.getElementById('apple-jssdk')) {
      const s = document.createElement('script')
      s.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
      s.async = true; s.id = 'apple-jssdk'
      s.onload = setup
      document.body.appendChild(s)
    } else {
      document.getElementById('apple-jssdk')!.addEventListener('load', setup)
    }
  }, [APPLE_CLIENT_ID, APPLE_REDIRECT_URI])

  async function handleApple() {
    const A = (window as any).AppleID
    if (!A?.auth) { setError('ยังโหลด Apple Sign-In ไม่เสร็จ กรุณาลองใหม่อีกครั้ง'); return }
    setError(''); setInfo(''); setNeedVerify(false)
    try {
      const resp = await A.auth.signIn()
      const idToken = resp?.authorization?.id_token
      if (!idToken) { setError('ไม่ได้รับข้อมูลยืนยันจาก Apple'); return }
      const nm = resp?.user?.name ? `${resp.user.name.firstName ?? ''} ${resp.user.name.lastName ?? ''}`.trim() : undefined
      setLoading(true)
      const user = await appleLogin(idToken, nm)
      setUser(user); navigate('/')
    } catch (err: any) {
      if (err?.error === 'popup_closed_by_user' || err?.error === 'user_cancelled_authorize') return // ผู้ใช้ปิดเอง
      const d = err.response?.data
      if (d?.pending) setInfo('บัญชี Apple ของคุณถูกสร้างแล้ว — กรุณารอผู้ให้บริการอนุมัติก่อนเข้าใช้งาน')
      else setError(d?.error || 'เข้าสู่ระบบด้วย Apple ไม่สำเร็จ')
    } finally { setLoading(false) }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo(''); setNeedVerify(false); setLoading(true)
    try {
      if (mode === 'login') {
        const res = await loginUser(email, password, twoFa ? twoFaCode : undefined)
        if (typeof res === 'object' && 'twoFactorRequired' in res) { setTwoFa(true); setLoading(false); return }
        setUser(res); navigate('/')
      } else if (mode === 'forgot') {
        const msg = await forgotPassword(email)
        setInfo(msg)
      } else {
        const result = await registerUser(name, email, password, phone)
        if (result.pending || !result.access) {
          setMode('login')
          setInfo('สมัครสำเร็จ! เราได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณ — กรุณายืนยันอีเมล จากนั้นรอผู้ให้บริการอนุมัติบัญชี')
        } else { setUser(result.user); navigate('/') }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด')
      if (err.response?.data?.needVerify) setNeedVerify(true)
    } finally { setLoading(false) }
  }

  async function doResend() {
    try { setError(''); setInfo(await resendVerify(email)); setNeedVerify(false) }
    catch { setError('ส่งอีเมลยืนยันใหม่ไม่สำเร็จ') }
  }

  const appleSoon = () => setInfo('การเข้าสู่ระบบด้วย Apple จะเปิดให้บริการเร็วๆ นี้')
  const googleNotReady = () => setInfo('ยังไม่ได้ตั้งค่า Google Sign-In (ผู้ดูแลระบบต้องกำหนด Client ID ก่อน)')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--navy-900)' }}>
      {/* ── ซ้าย: แบรนด์ (ซ่อนบนจอแคบ) ── */}
      {wide && (
        <section style={{ flex: '0 0 56%', position: 'relative', overflow: 'hidden', background: 'var(--navy-950)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 40 }}>
          <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '70%', height: '70%', background: 'var(--cyan)', filter: 'blur(120px)', opacity: 0.08, borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '55%', height: '55%', background: '#56dacc', filter: 'blur(110px)', opacity: 0.07, borderRadius: '50%', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '3px 10px' }}>ADVISOR PORTAL</span>
          </div>

          <div style={{ position: 'relative', maxWidth: 560, margin: 'auto 0' }}>
            <h1 style={{ fontSize: 42, lineHeight: 1.15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              วางแผนการเงิน<br /><span style={{ color: 'var(--cyan)' }}>อย่างมืออาชีพ</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 460, marginTop: 20, lineHeight: 1.7 }}>
              เครื่องมือวิเคราะห์พอร์ต ประเมินความเสี่ยงระดับสถาบัน และผู้ช่วยวางแผน สำหรับนักวางแผนการเงินยุคใหม่
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16, marginTop: 40 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                <Activity size={20} color="var(--cyan)" />
                <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 10 }}>99.9%</div>
                <div style={{ ...capLabel, marginTop: 2 }}>ความมั่นคงของระบบ</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
                <ShieldCheck size={20} color="var(--cyan)" />
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 10, letterSpacing: '-0.01em' }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></div>
                <div style={{ ...capLabel, marginTop: 4, lineHeight: 1.5 }}>© {new Date().getFullYear()} Ultimate Life Advisor Co., Ltd.<br />All rights reserved.</div>
              </div>
            </div>
          </div>
          <div />
        </section>
      )}

      {/* ── ขวา: ฟอร์ม ── */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: wide ? 48 : 24, background: 'var(--navy-900)' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {!wide && <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></div>}

          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isForgot ? 'ลืมรหัสผ่าน' : isReg ? 'สมัครเป็นนักวางแผน' : 'ยินดีต้อนรับกลับ'}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>{isForgot ? 'กรอกอีเมลของคุณ เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้' : isReg ? 'กรอกข้อมูลเพื่อขอเข้าใช้งาน (รอผู้ให้บริการอนุมัติ)' : 'กรอกข้อมูลเพื่อเข้าสู่พอร์ทัลนักวางแผน'}</p>

          {/* Social (mockup) — ซ่อนในโหมดลืมรหัสผ่าน */}
          {!isForgot && <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            {GOOGLE_CLIENT_ID
              ? <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
              : <button type="button" onClick={googleNotReady}
                  style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  <GoogleIcon /> เข้าสู่ระบบด้วย Google
                </button>}
            <button type="button" onClick={APPLE_CLIENT_ID ? handleApple : appleSoon}
              style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', background: '#000', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              <AppleIcon /> เข้าสู่ระบบด้วย Apple
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
            <span style={{ ...capLabel, fontSize: 10, letterSpacing: '0.15em' }}>หรือเข้าด้วยอีเมล</span>
            <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
          </div>
          </>}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: isForgot ? 24 : 0 }}>
            {isReg && (
              <>
                <Wrap icon={<User size={16} />}><input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อ-นามสกุล" required style={field} /></Wrap>
                <Wrap icon={<Phone size={16} />}><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)" style={field} /></Wrap>
              </>
            )}
            <div>
              <label style={capLabel}>อีเมล</label>
              <Wrap icon={<Mail size={16} />} mt>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@firm.com" required style={field} />
              </Wrap>
            </div>
            {!isForgot && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={capLabel}>รหัสผ่าน</label>
                {!isReg && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', cursor: 'pointer' }} onClick={() => switchMode('forgot')}>ลืมรหัสผ่าน?</span>}
              </div>
              <Wrap icon={<button type="button" onClick={() => setShowPass(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>} mt>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} style={field} />
              </Wrap>
            </div>
            )}

            {/* 2FA — แสดงเมื่อบัญชีเปิดใช้ยืนยัน 2 ชั้น */}
            {!isForgot && !isReg && twoFa && (
              <div>
                <label style={capLabel}>รหัสยืนยันตัวตน (2FA)</label>
                <input value={twoFaCode} onChange={e => setTwoFaCode(e.target.value.replace(/\s/g, ''))} placeholder="รหัส 6 หลักจากแอป หรือรหัสสำรอง" inputMode="numeric" autoFocus
                  style={{ ...field, marginTop: 6, letterSpacing: '0.2em', textAlign: 'center', fontSize: 18 }} />
                <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>เปิดแอป Authenticator แล้วกรอกรหัส 6 หลัก</p>
              </div>
            )}

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>{error}</div>}
            {needVerify && (
              <button type="button" onClick={doResend} style={{ padding: '9px 14px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--cyan)', fontWeight: 600, cursor: 'pointer' }}>
                ส่งอีเมลยืนยันอีกครั้ง
              </button>
            )}
            {info && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13, color: '#6ee7b7', lineHeight: 1.5 }}>{info}</div>}

            <button type="submit" disabled={loading}
              style={{ height: 52, marginTop: 4, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(6,182,212,0.4)' : 'var(--cyan)', color: '#00201d', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'กำลังดำเนินการ...' : isForgot ? 'ส่งลิงก์ตั้งรหัสผ่าน' : isReg ? 'ขอเข้าใช้งาน' : 'เข้าสู่ระบบ'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 22 }}>
            {isForgot ? 'จำรหัสผ่านได้แล้ว? ' : isReg ? 'มีบัญชีอยู่แล้ว? ' : 'นักวางแผนใหม่? '}
            <span style={{ color: 'var(--cyan)', fontWeight: 700, cursor: 'pointer' }} onClick={() => switchMode(isForgot ? 'login' : isReg ? 'login' : 'register')}>
              {isForgot ? 'เข้าสู่ระบบ' : isReg ? 'เข้าสู่ระบบ' : 'ขอเข้าใช้งาน'}
            </span>
          </p>
        </div>
      </section>
    </div>
  )
}

function Wrap({ icon, children, mt }: { icon: React.ReactNode; children: React.ReactNode; mt?: boolean }) {
  return (
    <div style={{ position: 'relative', marginTop: mt ? 6 : 0 }}>
      {children}
      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>{icon}</span>
    </div>
  )
}
