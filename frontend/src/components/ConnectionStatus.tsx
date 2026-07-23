// ── แถบแจ้งเตือนเมื่อเน็ตหลุดหรือต่อเซิร์ฟเวอร์ไม่ได้ ──
// เดิมถ้า API ล่มหรือเน็ตหลุด หน้าจะค้างอยู่กับข้อมูลเก่าโดยไม่บอกอะไรเลย
// ผู้ใช้จะพิมพ์ต่อไปเรื่อย ๆ โดยไม่รู้ว่าที่กรอกไปไม่ได้ถูกบันทึก
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { WifiOff, RefreshCw } from 'lucide-react'

/** error ที่เกิดจาก "ติดต่อเซิร์ฟเวอร์ไม่ได้" ไม่ใช่เซิร์ฟเวอร์ตอบว่าผิด */
const isNetworkError = (e: any) =>
  !!e && !e.response && (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.message === 'Network Error')

export default function ConnectionStatus() {
  const qc = useQueryClient()
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [apiDown, setApiDown] = useState(false)

  // เน็ตของเครื่องหลุด
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // เน็ตมีแต่ยิง API ไม่ถึง (เซิร์ฟเวอร์ล่ม / โดน block / timeout)
  useEffect(() => {
    return qc.getQueryCache().subscribe(() => {
      const qs = qc.getQueryCache().getAll()
      const failing = qs.some(q => q.state.status === 'error' && isNetworkError(q.state.error))
      const recovered = qs.some(q => q.state.status === 'success' && q.state.dataUpdatedAt > Date.now() - 15_000)
      setApiDown(failing && !recovered)
    })
  }, [qc])

  if (!offline && !apiDown) return null

  return (
    <div role="status" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: offline ? '#7f1d1d' : '#78350f', color: '#fff',
      padding: '10px 16px', fontSize: 13.5, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 10, flexWrap: 'wrap', textAlign: 'center',
    }}>
      {offline ? <WifiOff size={16} /> : <RefreshCw size={16} />}
      <span>
        {offline
          ? 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต — สิ่งที่แก้ไขค้างไว้จะยังไม่ถูกบันทึกจนกว่าจะกลับมาออนไลน์'
          : 'ติดต่อเซิร์ฟเวอร์ไม่ได้ชั่วคราว — ระบบกำลังลองใหม่อัตโนมัติ อย่าเพิ่งปิดหน้านี้'}
      </span>
      <button
        onClick={() => qc.refetchQueries()}
        style={{
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff',
          borderRadius: 8, padding: '4px 12px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}>
        ลองใหม่ตอนนี้
      </button>
    </div>
  )
}
