import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { ChartPie, CheckCircle, XCircle, Loader } from 'lucide-react'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('ไม่พบ token การยืนยัน')
      return
    }
    api.get(`/auth/verify-email?token=${token}`)
      .then(({ data }) => {
        setStatus('success')
        setMessage(data.message || 'ยืนยันอีเมลสำเร็จ')
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.response?.data?.error || 'Token ไม่ถูกต้องหรือหมดอายุแล้ว')
      })
  }, [params])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, background: 'var(--cyan-dim)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <ChartPie size={26} color="var(--cyan)" />
        </div>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 20, padding: 40 }}>
          {status === 'loading' && (
            <>
              <Loader size={40} color="var(--cyan)" style={{ margin: '0 auto 16px', display: 'block', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>กำลังยืนยันอีเมล...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={48} color="#22c55e" style={{ margin: '0 auto 16px', display: 'block' }} />
              <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>ยืนยันอีเมลสำเร็จ!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                {message}<br />
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>กรุณารอการอนุมัติจาก Admin ก่อนเข้าสู่ระบบ</span>
              </p>
              <Link to="/login" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--cyan)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                กลับหน้าเข้าสู่ระบบ
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px', display: 'block' }} />
              <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>ยืนยันอีเมลไม่สำเร็จ</h2>
              <p style={{ color: '#fca5a5', fontSize: 14, marginBottom: 24 }}>{message}</p>
              <Link to="/login" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>
                กลับหน้าเข้าสู่ระบบ
              </Link>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
