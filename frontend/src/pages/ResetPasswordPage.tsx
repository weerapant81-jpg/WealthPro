import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resetPassword } from '../lib/auth'
import { Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react'

const field: React.CSSProperties = {
  width: '100%', height: 48, padding: '0 42px 0 14px', borderRadius: 10,
  border: '1px solid var(--card-border)', background: 'var(--navy-900)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const capLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (pw !== pw2) { setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return }
    setLoading(true)
    try {
      await resetPassword(token, pw)
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24 }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span></div>
        <div style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: 12, background: 'rgba(6,182,212,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <KeyRound size={22} color="var(--cyan)" />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>ตั้งรหัสผ่านใหม่</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>กรอกรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>

        {!token ? (
          <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>
            ลิงก์ไม่ถูกต้อง — กรุณาขอลิงก์ตั้งรหัสผ่านใหม่จากหน้าเข้าสู่ระบบ
          </div>
        ) : done ? (
          <div style={{ marginTop: 24, padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 13, color: '#6ee7b7', lineHeight: 1.5 }}>
            ตั้งรหัสผ่านใหม่สำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ...
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
            <div>
              <label style={capLabel}>รหัสผ่านใหม่</label>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" required style={field} />
                <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <div>
              <label style={capLabel}>ยืนยันรหัสผ่านใหม่</label>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} placeholder="พิมพ์รหัสผ่านอีกครั้ง" required style={field} />
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontSize: 13, color: '#fca5a5' }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ height: 52, marginTop: 4, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(6,182,212,0.4)' : 'var(--cyan)', color: '#00201d', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', marginTop: 22 }}>
          <span style={{ color: 'var(--cyan)', fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/login')}>กลับไปหน้าเข้าสู่ระบบ</span>
        </p>
      </div>
    </div>
  )
}
