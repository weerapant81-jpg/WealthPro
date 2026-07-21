import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { UserCog, Camera, Check, Loader2, Trash2, ShieldCheck } from 'lucide-react'
import { useIsCompact } from '../hooks/useViewport'
import { PageHeader } from '../components/ui'

interface AdvisorProfile {
  photo: string       // base64 data URL
  fullName: string
  position: string
  phone: string
  email: string
  address: string     // (legacy) — คงไว้เผื่อข้อมูลเก่า
  // ที่อยู่แบบมีโครงสร้าง
  addrHouseNo: string; addrSubdistrict: string; addrDistrict: string; addrProvince: string; addrZipcode: string
  // ใบอนุญาตประกอบวิชาชีพ
  company: string           // สังกัดบริษัท
  licenseInsurance: string  // ตัวแทน/นายหน้าประกันชีวิต
  licenseCFP: string        // นักวางแผนการเงิน CFP
  licenseAFPT: string       // ที่ปรึกษาการเงิน AFPT
  licenseFChFP: string      // ที่ปรึกษาการเงิน FChFP
  bio: string         // ≤ 500 words
}
const defaultProfile = (): AdvisorProfile => ({ photo: '', fullName: '', position: '', phone: '', email: '', address: '', addrHouseNo: '', addrSubdistrict: '', addrDistrict: '', addrProvince: '', addrZipcode: '', company: '', licenseInsurance: '', licenseCFP: '', licenseAFPT: '', licenseFChFP: '', bio: '' })

const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '20px 22px' }
const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)', fontSize: 13.5, outline: 'none' }
const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
const lbl: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5, display: 'block' }
const sortTh = (a: string, b: string) => a.localeCompare(b, 'th')

function wordCount(t: string) { return t.trim() ? t.trim().split(/\s+/).length : 0 }

export default function UserProfilePage() {
  const compact = useIsCompact()
  const { data: saved, isFetched } = useQuery({ queryKey: ['advisor-profile'], queryFn: () => api.get('/advisor-profile').then(r => r.data), retry: false })
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.get('/auth/me').then(r => r.data), retry: false })

  const { data: addrTree } = useQuery<any>({ queryKey: ['th-address'], queryFn: () => fetch('/th-address.json').then(r => r.json()), staleTime: Infinity })
  const [p, setP] = useState<AdvisorProfile>(defaultProfile())
  const set = <K extends keyof AdvisorProfile>(k: K, v: AdvisorProfile[K]) => setP(prev => ({ ...prev, [k]: v }))

  const provinceList: string[] = addrTree ? Object.keys(addrTree).sort(sortTh) : []
  const districtList: string[] = (addrTree && p.addrProvince) ? Object.keys(addrTree[p.addrProvince] || {}).sort(sortTh) : []
  const subdistrictList: string[] = (addrTree && p.addrProvince && p.addrDistrict) ? Object.keys(addrTree[p.addrProvince]?.[p.addrDistrict] || {}).sort(sortTh) : []
  const loadedRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loadedRef.current || !isFetched) return
    if (saved && typeof saved === 'object') setP(prev => ({ ...prev, ...saved }))
    else if (me) setP(prev => ({ ...prev, fullName: me.name || '', email: me.email || '' }))
    loadedRef.current = true
  }, [isFetched, saved, me])

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const save = useMutation({
    mutationFn: (payload: any) => api.put('/advisor-profile', payload),
    onSuccess: () => { setStatus('saved'); setTimeout(() => setStatus('idle'), 2000) },
    onError: () => setStatus('idle'),
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!loadedRef.current) return
    setStatus('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save.mutate(p), 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [p])

  // resize image to max 400px and store as JPEG dataURL
  function onPhoto(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 400
        let { width, height } = img
        if (width > height && width > max) { height = height * max / width; width = max }
        else if (height > max) { width = width * max / height; height = max }
        const cv = document.createElement('canvas')
        cv.width = width; cv.height = height
        cv.getContext('2d')!.drawImage(img, 0, 0, width, height)
        set('photo', cv.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const words = wordCount(p.bio)
  const over = words > 500

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 920 }}>
      {/* Header */}
      <PageHeader icon={UserCog} title="ตั้งค่าผู้ใช้" subtitle="ข้อมูลนี้จะนำไปแสดงในเอกสารแผนการเงินที่สั่งพิมพ์"
        right={
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
            {status === 'saving' && <><Loader2 size={14} className="up-spin" color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)' }}>กำลังบันทึก...</span></>}
            {status === 'saved' && <><Check size={14} color="#4ade80" /><span style={{ color: '#4ade80' }}>บันทึกแล้ว</span></>}
          </div>
        } />
      <style>{`@keyframes up-spin{to{transform:rotate(360deg)}}.up-spin{animation:up-spin .9s linear infinite}`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Photo */}
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ width: 150, height: 150, margin: '0 auto', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--cyan)', background: 'var(--navy-900)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {p.photo
              ? <img src={p.photo} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Camera size={36} color="var(--text-muted)" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()}
            style={{ marginTop: 14, padding: '7px 16px', background: 'var(--cyan-dim)', border: '1px solid var(--cyan)', borderRadius: 8, color: 'var(--cyan)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
            {p.photo ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          </button>
          {p.photo && (
            <button onClick={() => set('photo', '')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '8px auto 0', padding: '4px 10px', background: 'none', border: 'none', color: '#f87171', fontSize: 11.5, cursor: 'pointer' }}>
              <Trash2 size={12} /> ลบรูป
            </button>
          )}
        </div>

        {/* Fields */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 14 }}>
            <div><label style={lbl}>ชื่อ-นามสกุล</label><input style={inp} value={p.fullName} onChange={e => set('fullName', e.target.value)} placeholder="ชื่อที่จะแสดงในเอกสาร" /></div>
            <div><label style={lbl}>ตำแหน่ง</label><input style={inp} value={p.position} onChange={e => set('position', e.target.value)} placeholder="เช่น นักวางแผนการเงิน / ที่ปรึกษาการเงิน" /></div>
            <div><label style={lbl}>เบอร์โทรศัพท์</label><input style={inp} value={p.phone} onChange={e => set('phone', e.target.value)} placeholder="08x-xxx-xxxx" /></div>
            <div><label style={lbl}>อีเมล</label><input style={inp} value={p.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" /></div>
          </div>
          {/* ที่อยู่แบบมีโครงสร้าง */}
          <div>
            <label style={lbl}>ที่อยู่</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={inp} value={p.addrHouseNo} onChange={e => set('addrHouseNo', e.target.value)} placeholder="เลขที่ / หมู่ / ถนน (เช่น 199/78 หมู่ 1 ถ.มิตรภาพ)" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10 }}>
                <div>
                  <label style={lbl}>จังหวัด</label>
                  <select style={sel} value={p.addrProvince}
                    onChange={e => setP(f => ({ ...f, addrProvince: e.target.value, addrDistrict: '', addrSubdistrict: '', addrZipcode: '' }))}>
                    <option value="">— เลือกจังหวัด —</option>
                    {provinceList.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>อำเภอ / เขต</label>
                  <select style={{ ...sel, opacity: p.addrProvince ? 1 : 0.5 }} value={p.addrDistrict} disabled={!p.addrProvince}
                    onChange={e => setP(f => ({ ...f, addrDistrict: e.target.value, addrSubdistrict: '', addrZipcode: '' }))}>
                    <option value="">— เลือกอำเภอ/เขต —</option>
                    {districtList.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>ตำบล / แขวง</label>
                  <select style={{ ...sel, opacity: p.addrDistrict ? 1 : 0.5 }} value={p.addrSubdistrict} disabled={!p.addrDistrict}
                    onChange={e => { const sub = e.target.value; const zip = addrTree?.[p.addrProvince]?.[p.addrDistrict]?.[sub] || ''; setP(f => ({ ...f, addrSubdistrict: sub, addrZipcode: zip })) }}>
                    <option value="">— เลือกตำบล/แขวง —</option>
                    {subdistrictList.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>รหัสไปรษณีย์</label>
                  <input style={{ ...inp, background: 'var(--navy-800)', color: 'var(--cyan)' }} value={p.addrZipcode} readOnly placeholder="อัตโนมัติ" />
                </div>
                <div>
                  <label style={lbl}>ประเทศ</label>
                  <input style={{ ...inp, background: 'var(--navy-800)', color: 'var(--text-muted)' }} value="ไทย" readOnly />
                </div>
              </div>
            </div>
          </div>

          {/* ใบอนุญาตประกอบวิชาชีพ */}
          <div>
            <label style={lbl}>ใบอนุญาตประกอบวิชาชีพ</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                <div><label style={{ ...lbl, fontSize: 11 }}>เลขที่ใบอนุญาตตัวแทน/นายหน้าประกันชีวิต</label><input style={inp} value={p.licenseInsurance} onChange={e => set('licenseInsurance', e.target.value)} placeholder="เลขที่ใบอนุญาต" /></div>
                <div><label style={{ ...lbl, fontSize: 11 }}>สังกัดบริษัท</label><input style={inp} value={p.company} onChange={e => set('company', e.target.value)} placeholder="ชื่อบริษัท/สังกัด" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
                <div><label style={{ ...lbl, fontSize: 11 }}>เลขที่ใบอนุญาตนักวางแผนการเงิน CFP</label><input style={inp} value={p.licenseCFP} onChange={e => set('licenseCFP', e.target.value)} placeholder="เลขที่ CFP" /></div>
                <div><label style={{ ...lbl, fontSize: 11 }}>เลขที่ใบอนุญาตที่ปรึกษาการเงิน AFPT</label><input style={inp} value={p.licenseAFPT} onChange={e => set('licenseAFPT', e.target.value)} placeholder="เลขที่ AFPT" /></div>
                <div><label style={{ ...lbl, fontSize: 11 }}>เลขที่ใบอนุญาตที่ปรึกษาการเงิน FChFP</label><input style={inp} value={p.licenseFChFP} onChange={e => set('licenseFChFP', e.target.value)} placeholder="เลขที่ FChFP" /></div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={lbl}>บรรยายคุณสมบัติ / ประวัติ</label>
              <span style={{ fontSize: 11, color: over ? '#f87171' : 'var(--text-muted)' }}>{words}/500 คำ</span>
            </div>
            <textarea style={{ ...inp, minHeight: 160, resize: 'vertical', borderColor: over ? '#f87171' : 'var(--card-border)' }}
              value={p.bio} onChange={e => set('bio', e.target.value)}
              placeholder="แนะนำตัว ประสบการณ์ ใบอนุญาต ความเชี่ยวชาญ ฯลฯ (สูงสุด 500 คำ) เพื่อนำไปใช้ในแผนการเงิน" />
            {over && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>เกิน 500 คำ — กรุณาตัดทอนเนื้อหา</div>}
          </div>
        </div>
      </div>

      <TwoFactorSection />
    </div>
  )
}

/* ── ความปลอดภัย: ยืนยันตัวตน 2 ชั้น (TOTP) ── */
function TwoFactorSection() {
  const qc = useQueryClient()
  const { data: st } = useQuery<{ enabled: boolean }>({ queryKey: ['2fa-status'], queryFn: () => api.get('/auth/2fa/status').then(r => r.data) })
  const enabled = !!st?.enabled
  const [setupQr, setSetupQr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [backup, setBackup] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function startSetup() {
    setBusy(true); setErr(''); setBackup(null)
    try { const { data } = await api.post('/auth/2fa/setup'); setSetupQr(data.qr) }
    catch { setErr('เริ่มตั้งค่าไม่สำเร็จ') } finally { setBusy(false) }
  }
  async function enable() {
    setBusy(true); setErr('')
    try { const { data } = await api.post('/auth/2fa/enable', { token: code.replace(/\s/g, '') }); setBackup(data.backupCodes); setSetupQr(null); setCode(''); qc.invalidateQueries({ queryKey: ['2fa-status'] }) }
    catch (e: any) { setErr(e?.response?.data?.error || 'รหัสไม่ถูกต้อง') } finally { setBusy(false) }
  }
  async function disable() {
    const token = prompt('ใส่รหัส 2FA ปัจจุบัน (6 หลัก) หรือรหัสสำรอง เพื่อปิดการใช้งาน')
    if (!token) return
    try { await api.post('/auth/2fa/disable', { token: token.replace(/\s/g, '') }); setBackup(null); qc.invalidateQueries({ queryKey: ['2fa-status'] }) }
    catch (e: any) { alert(e?.response?.data?.error || 'ปิดไม่สำเร็จ') }
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color={enabled ? '#10b981' : 'var(--text-muted)'} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>ยืนยันตัวตน 2 ชั้น (2FA)</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>เพิ่มความปลอดภัยบัญชี — ต้องใส่รหัสจากแอปตอนล็อกอิน</div>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: enabled ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.14)', color: enabled ? '#10b981' : 'var(--text-muted)' }}>
          {enabled ? 'เปิดใช้งานอยู่' : 'ปิดอยู่'}
        </span>
      </div>

      {backup && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>รหัสสำรอง (เก็บไว้ในที่ปลอดภัย — แสดงครั้งเดียว!)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6, fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)' }}>
            {backup.map(c => <span key={c} style={{ padding: '4px 8px', background: 'var(--navy-900)', borderRadius: 6, textAlign: 'center' }}>{c}</span>)}
          </div>
        </div>
      )}

      {enabled ? (
        <button onClick={disable} style={{ alignSelf: 'flex-start', padding: '9px 18px', background: 'none', border: '1px solid #fb7185', borderRadius: 8, color: '#fb7185', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>ปิดการใช้งาน 2FA</button>
      ) : setupQr ? (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <img src={setupQr} alt="QR" style={{ width: 160, height: 160, borderRadius: 8, background: '#fff', padding: 6 }} />
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>1. เปิดแอป <b>Google Authenticator</b> / Authy → สแกน QR<br />2. กรอกรหัส 6 หลักที่ได้เพื่อยืนยัน</p>
            <input value={code} onChange={e => setCode(e.target.value.replace(/\s/g, ''))} placeholder="รหัส 6 หลัก" inputMode="numeric"
              style={{ ...inp, letterSpacing: '0.2em', textAlign: 'center', fontSize: 17, maxWidth: 200 }} />
            {err && <span style={{ fontSize: 12, color: '#f87171' }}>{err}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={enable} disabled={busy || code.length < 6} style={{ padding: '9px 18px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy || code.length < 6 ? 0.5 : 1 }}>ยืนยันเปิดใช้งาน</button>
              <button onClick={() => { setSetupQr(null); setCode(''); setErr('') }} style={{ padding: '9px 14px', background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={startSetup} disabled={busy} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'var(--cyan)', border: 'none', borderRadius: 8, color: '#00201d', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <ShieldCheck size={15} /> {busy ? 'กำลังเตรียม...' : 'เปิดใช้งาน 2FA'}
        </button>
      )}
    </div>
  )
}
