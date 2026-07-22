import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, X, GraduationCap, Clock, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useIsCompact } from '../hooks/useViewport'
import { api } from '../lib/api'

/* ศูนย์เรียนรู้ — รวมคลิปสอนการใช้งาน WealthPro (YouTube)
 * รายการคลิปเก็บในฐานข้อมูล · SUPER_ADMIN เพิ่ม/แก้/ลบ ได้เองในหน้านี้
 * ใช้ได้ทั้งสาธารณะ (จาก landing) และในแอป */

type Video = { id: string; title: string; description: string; category: string; provider?: string; youtubeId: string; duration?: string; order: number }

const CATS = ['เริ่มต้นใช้งาน', 'จัดการลูกค้า', 'วางแผนการเงิน', 'รายงาน', 'ผู้ช่วย AI', 'ความปลอดภัย'] as const

const AC = 'var(--cyan)'
const prov = (v: Video) => v.provider || 'youtube'
/** ภาพปก — YouTube มีภาพอัตโนมัติ · Vimeo/ไฟล์ตรง ใช้พื้นหลังแทน */
const thumb = (v: Video) => prov(v) === 'youtube' ? `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg` : ''
/** ลิงก์ฝังสำหรับ iframe (YouTube / Vimeo) — ไฟล์ตรงใช้ <video> แทน */
const embed = (v: Video) => prov(v) === 'vimeo'
  ? `https://player.vimeo.com/video/${v.youtubeId}?autoplay=1`
  : `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0`
/** ลิงก์เดิมสำหรับเติมในฟอร์มแก้ไข */
const sourceUrl = (v: Video) => prov(v) === 'vimeo' ? `https://vimeo.com/${v.youtubeId}`
  : prov(v) === 'file' ? v.youtubeId
  : `https://youtu.be/${v.youtubeId}`

type FormState = { id?: string; title: string; description: string; category: string; youtube: string; duration: string; order: string }
const emptyForm = (): FormState => ({ title: '', description: '', category: CATS[0], youtube: '', duration: '', order: '' })

export default function TutorialsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const compact = useIsCompact()
  const qc = useQueryClient()
  const isSuper = user?.role === 'SUPER_ADMIN'

  const [cat, setCat] = useState<string>('ทั้งหมด')
  const [playing, setPlaying] = useState<Video | null>(null)
  const [form, setForm] = useState<FormState | null>(null)   // null = ปิดฟอร์ม
  const [err, setErr] = useState('')

  const { data: videos = [], isLoading } = useQuery<Video[]>({
    queryKey: ['tutorials'],
    queryFn: () => api.get('/tutorials').then(r => r.data),
  })

  const save = useMutation({
    mutationFn: (f: FormState) => f.id
      ? api.patch(`/tutorials/${f.id}`, f)
      : api.post('/tutorials', f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tutorials'] }); setForm(null); setErr('') },
    onError: (e: any) => setErr(e?.response?.data?.error || 'บันทึกไม่สำเร็จ'),
  })
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/tutorials/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tutorials'] }),
  })

  const list = cat === 'ทั้งหมด' ? videos : videos.filter(v => v.category === cat)

  const openEdit = (v: Video) => { setErr(''); setForm({ id: v.id, title: v.title, description: v.description, category: v.category, youtube: sourceUrl(v), duration: v.duration || '', order: String(v.order) }) }

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1040 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cyan-dim)', border: `1px solid ${AC}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <GraduationCap size={22} color={AC} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>ศูนย์เรียนรู้ · วิดีโอสอนการใช้งาน</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0' }}>เรียนรู้วิธีใช้ WealthPro ทีละขั้น ตั้งแต่เริ่มต้นจนส่งมอบรายงาน</p>
        </div>
        {isSuper && (
          <button onClick={() => { setErr(''); setForm(emptyForm()) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: AC, color: '#00201d', fontSize: 13, fontWeight: 800 }}>
            <Plus size={16} /> เพิ่มวิดีโอ
          </button>
        )}
      </div>

      {!isLoading && videos.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--cyan-dim)', border: `1px solid ${AC}55`, borderRadius: 10, padding: '10px 14px' }}>
          {isSuper ? 'ยังไม่มีวิดีโอ — กด "เพิ่มวิดีโอ" เพื่อเริ่มเพิ่มคลิปสอนการใช้งาน' : 'คลิปวิดีโอกำลังทยอยอัปโหลด เร็ว ๆ นี้ครับ'}
        </div>
      )}

      {/* category filter */}
      {videos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['ทั้งหมด', ...CATS] as string[]).map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding: '7px 15px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${cat === c ? AC : 'var(--card-border)'}`,
                background: cat === c ? 'var(--cyan-dim)' : 'transparent',
                color: cat === c ? 'var(--cyan-light)' : 'var(--text-secondary)' }}>{c}</button>
          ))}
        </div>
      )}

      {/* video grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
        {list.map(v => (
          <div key={v.id}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s', display: 'flex', flexDirection: 'column', position: 'relative' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--cyan)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}>
            {/* thumbnail 16:9 */}
            <div onClick={() => setPlaying(v)} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'var(--navy-950)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}>
              {thumb(v)
                ? <img src={thumb(v)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(140deg, #123a4a, var(--navy-950))' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: AC, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
                  <Play size={24} color="#00201d" fill="#00201d" style={{ marginLeft: 3 }} />
                </div>
              </div>
              {v.duration && (
                <span style={{ position: 'absolute', bottom: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.7)', borderRadius: 6, padding: '2px 7px' }}><Clock size={11} />{v.duration}</span>
              )}
            </div>
            {/* meta */}
            <div style={{ padding: '13px 15px', flex: 1 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', color: AC, textTransform: 'uppercase', marginBottom: 5 }}>{v.category}</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: 5 }}>{v.title}</div>
              {v.description && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{v.description}</div>}
            </div>
            {/* admin controls */}
            {isSuper && (
              <div style={{ display: 'flex', gap: 6, padding: '0 15px 13px' }}>
                <button onClick={() => openEdit(v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}><Pencil size={13} /> แก้ไข</button>
                <button onClick={() => { if (confirm(`ลบวิดีโอ "${v.title}"?`)) del.mutate(v.id) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}><Trash2 size={13} /> ลบ</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
        มีคำถามเพิ่มเติม? ติดต่อผู้ให้บริการ · WealthPro โดย Ultimate Life Advisor Co., Ltd.
      </p>

      {/* player modal */}
      {playing && (
        <div onClick={() => setPlaying(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{playing.title}</span>
              <button onClick={() => setPlaying(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={22} /></button>
            </div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              {prov(playing) === 'file'
                ? <video src={playing.youtubeId} controls autoPlay playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' }} />
                : <iframe src={embed(playing)} title={playing.title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />}
            </div>
          </div>
        </div>
      )}

      {/* add/edit form modal (SUPER_ADMIN) */}
      {form && (
        <div onClick={() => setForm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', background: 'var(--navy-900)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{form.id ? 'แก้ไขวิดีโอ' : 'เพิ่มวิดีโอ'}</h2>
              <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="ชื่อหัวข้อ *">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inp} placeholder="เช่น สร้างลูกค้าใหม่และกรอกข้อมูล" />
              </Field>
              <Field label="ลิงก์วิดีโอ *">
                <input value={form.youtube} onChange={e => setForm({ ...form, youtube: e.target.value })} style={inp} placeholder="https://youtu.be/xxxx · https://vimeo.com/123456789 · https://.../video.mp4" />
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  รองรับ <b>YouTube</b> · <b>Vimeo</b> · <b>ลิงก์ไฟล์วิดีโอตรง</b> (mp4 — โฮสต์เอง / Cloudflare Stream / Bunny) ระบบตรวจให้อัตโนมัติ
                </div>
              </Field>
              <Field label="คำอธิบาย">
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="อธิบายสั้น ๆ ว่าคลิปนี้สอนอะไร" />
              </Field>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="หมวด" flex>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="ความยาว">
                  <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} style={{ ...inp, width: 90 }} placeholder="5:30" />
                </Field>
                <Field label="ลำดับ">
                  <input value={form.order} onChange={e => setForm({ ...form, order: e.target.value })} style={{ ...inp, width: 70 }} placeholder="0" inputMode="numeric" />
                </Field>
              </div>
              {err && <div style={{ fontSize: 12.5, color: '#ef4444', fontWeight: 600 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setForm(null)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
                <button onClick={() => save.mutate(form)} disabled={save.isPending}
                  style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: AC, color: '#00201d', fontSize: 13, fontWeight: 800, cursor: save.isPending ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ล็อกอินอยู่ = อยู่ในแอป (มี sidebar จาก Layout) → แสดงเนื้อหาอย่างเดียว
  if (user) return content

  // guest (จาก landing) → ครอบด้วยเมนูการตลาด + footer เหมือนหน้าอื่น
  const wrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: compact ? '0 20px' : '0 40px' }
  return (
    <div style={{ background: 'var(--navy-900)', color: 'var(--text-primary)', minHeight: '100vh', fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        .lp-navlink { color: var(--text-secondary); text-decoration: none; font-size: 14px; font-weight: 600; transition: color .15s; cursor: pointer; background: none; border: none; font-family: inherit; }
        .lp-navlink:hover { color: var(--cyan); }
        .lp-btn { transition: transform .12s ease, filter .15s ease; } .lp-btn:hover { filter: brightness(1.08); } .lp-btn:active { transform: scale(0.97); }
      `}</style>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(19,19,21,0.82)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ ...wrap, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer' }}>Wealth<span style={{ color: AC }}>Pro</span></span>
          {!compact && (
            <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 26 }}>
              <span onClick={() => navigate('/')} className="lp-navlink">หน้าแรก</span>
              <span onClick={() => navigate('/features')} className="lp-navlink">ฟีเจอร์</span>
              <span onClick={() => navigate('/about')} className="lp-navlink">เกี่ยวกับเรา</span>
              <span onClick={() => navigate('/#pricing')} className="lp-navlink">ราคา</span>
              <span className="lp-navlink" style={{ color: AC }}>วิดีโอสอนการใช้งาน</span>
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/login')} className="lp-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>เข้าสู่ระบบ</button>
            <button onClick={() => navigate('/login?mode=register')} className="lp-btn" style={{ background: AC, color: '#00201d', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>ทดลองใช้ฟรี</button>
          </div>
        </div>
      </header>
      <div style={{ ...wrap, padding: compact ? '28px 20px 64px' : '36px 40px 72px' }}>{content}</div>
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--navy-950)' }}>
        <div style={{ ...wrap, padding: '32px 40px', display: 'flex', flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Wealth<span style={{ color: AC }}>Pro</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center' }}>
            <a href="/features" className="lp-navlink">ฟีเจอร์</a>
            <a href="/privacy" className="lp-navlink">นโยบายความเป็นส่วนตัว</a>
            <a href="/terms" className="lp-navlink">ข้อกำหนดการใช้บริการ</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div style={{ flex: flex ? 1 : undefined }}>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
