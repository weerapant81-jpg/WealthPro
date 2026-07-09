import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, X, Loader } from 'lucide-react'
import { useRetirementReadiness } from '../hooks/useRetirementReadiness'
import { useInsuranceReadiness } from '../hooks/useInsuranceReadiness'
import { useEducationReadiness } from '../hooks/useEducationReadiness'
import { useInsuranceCoverage } from './InsuranceCoverageSummary'

const fmtB = (n?: number | null) => n == null ? '-' : new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Math.round(n))

/** ป้อนตัวเลข readiness ที่คำนวณไว้แล้ว (จาก hooks เดียวกับหน้าจอ) ขึ้นไปให้ widget ส่งให้ AI
 *  แยกเป็น component เพื่อให้ hooks รันเฉพาะตอนเปิดกล่อง (mount เมื่อ open) */
function SnapshotFeeder({ onReady }: { onReady: (s: string) => void }) {
  const retSelf = useRetirementReadiness('client')
  const retSpouse = useRetirementReadiness('spouse')
  const insSelf = useInsuranceReadiness('client')
  const insSpouse = useInsuranceReadiness('spouse')
  const edu = useEducationReadiness()
  const cov = useInsuranceCoverage('self')
  useEffect(() => {
    const L: string[] = []
    const ret = (r: any, who: string) => { if (r) L.push(`ความพร้อมเกษียณ (${who}): ${r.readinessPct}% · ต้องการ ${fmtB(r.needed)} · มี ${fmtB(r.have)} · ขาด ${fmtB(r.gap)} · ต้องออม ${fmtB(r.annualSavings)}/ปี`) }
    ret(retSelf, 'ลูกค้า'); ret(retSpouse, 'คู่สมรส')
    const ins = (r: any, who: string) => { if (r) L.push(`ความคุ้มครองชีวิต (${who}): ${r.coveragePct}% · ทุนที่ควรมี ${fmtB(r.need)} · มี ${fmtB(r.have)} · ขาด ${fmtB(r.gap)}`) }
    ins(insSelf, 'ลูกค้า'); ins(insSpouse, 'คู่สมรส')
    if (cov?.hasPolicies) L.push(`คะแนนความคุ้มครองรวม (ลูกค้า): ${cov.avg}/100`)
    if (edu?.childCount) L.push(`ทุนการศึกษาบุตร: มูลค่าปัจจุบันที่ต้องเตรียม ${fmtB(edu.totalPV)} · ต้องออม ${fmtB(edu.monthlySaving)}/เดือน (บุตร ${edu.childCount} คน)`)
    onReady(L.join('\n'))
  }, [retSelf, retSpouse, insSelf, insSpouse, edu, cov, onReady])
  return null
}

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'สรุปสถานะการเงินของลูกค้ารายนี้',
  'ลูกค้ามีความเสี่ยงด้านไหนที่ควรจัดการก่อน',
  'ช่วยร่างคำแนะนำเรื่องการเกษียณ',
  'ประเมินความพร้อมด้านประกันชีวิต',
]

export default function CopilotWidget() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const snapshotRef = useRef('')
  const setSnap = useCallback((s: string) => { snapshotRef.current = s }, [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // คลิกนอกกล่อง → หุบกล่อง
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', content: q }]
    setMsgs([...next, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = localStorage.getItem('access_token')
      if (token) headers.Authorization = `Bearer ${token}`
      const clientId = sessionStorage.getItem('selected_client_id')
      if (clientId) headers['X-Client-Id'] = clientId

      const res = await fetch('/api/copilot/chat', { method: 'POST', headers, body: JSON.stringify({ messages: next, computed: snapshotRef.current }) })
      if (!res.ok || !res.body) {
        let err = 'เกิดข้อผิดพลาด'
        try { err = (await res.json()).error || err } catch { /* not json */ }
        setMsgs(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: `⚠️ ${err}` }; return c })
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setMsgs(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc }; return c })
      }
    } catch (e: any) {
      setMsgs(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: `⚠️ เชื่อมต่อ AI ไม่สำเร็จ: ${e?.message || ''}` }; return c })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* ปุ่มลอย */}
      {!open && (
        <button onClick={() => setOpen(true)} title="WealthPro Copilot"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 900, width: 56, height: 56, borderRadius: 18,
            border: 'none', cursor: 'pointer', background: 'var(--cyan)', color: '#00201d',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(6,182,212,0.4)',
          }}>
          <Sparkles size={26} />
        </button>
      )}

      {/* แผงแชท */}
      {open && (
        <div ref={panelRef} style={{
          position: 'fixed', right: 22, bottom: 22, zIndex: 900, width: 'min(400px, calc(100vw - 32px))',
          height: 'min(600px, calc(100vh - 44px))', display: 'flex', flexDirection: 'column',
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <SnapshotFeeder onReady={setSnap} />
          {/* หัว */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--card-border)', background: 'var(--navy-950)' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--cyan-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} style={{ color: 'var(--cyan)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Wealth<span style={{ color: 'var(--cyan)' }}>Pro</span> Copilot</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ผู้ช่วยนักวางแผนการเงิน · อ้างอิงข้อมูลลูกค้าที่กำลังดู</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><X size={18} /></button>
          </div>

          {/* ข้อความ */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.length === 0 && (
              <div style={{ margin: 'auto 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Sparkles size={30} style={{ color: 'var(--cyan)', opacity: 0.7 }} />
                <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 10, marginBottom: 16, lineHeight: 1.6 }}>สอบถามข้อมูลลูกค้า ขอคำแนะนำ<br />หรือให้ช่วยร่างคอมเมนต์ได้เลย</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} style={{
                      textAlign: 'left', fontSize: 12.5, color: 'var(--text-primary)', background: 'var(--hover)',
                      border: '1px solid var(--card-border)', borderRadius: 10, padding: '9px 12px', cursor: 'pointer',
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  padding: '9px 13px', borderRadius: 13,
                  background: m.role === 'user' ? 'var(--cyan)' : 'var(--hover)',
                  color: m.role === 'user' ? '#00201d' : 'var(--text-primary)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--card-border)',
                  borderBottomRightRadius: m.role === 'user' ? 4 : 13,
                  borderBottomLeftRadius: m.role === 'user' ? 13 : 4,
                }}>
                  {m.content || (busy && i === msgs.length - 1 ? <Loader size={15} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} /> : '')}
                </div>
              </div>
            ))}
          </div>

          {/* กล่องพิมพ์ */}
          <div style={{ padding: 12, borderTop: '1px solid var(--card-border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="พิมพ์คำถาม… (Enter เพื่อส่ง)"
              style={{
                flex: 1, resize: 'none', maxHeight: 120, minHeight: 40, padding: '10px 12px', borderRadius: 11,
                border: '1px solid var(--card-border)', background: 'var(--navy-900)', color: 'var(--text-primary)',
                fontSize: 13.5, fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
              }} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} title="ส่ง"
              style={{
                width: 40, height: 40, borderRadius: 11, border: 'none', flexShrink: 0,
                cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                background: busy || !input.trim() ? 'var(--card-border)' : 'var(--cyan)',
                color: '#00201d', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {busy ? <Loader size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={17} />}
            </button>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </>
  )
}
