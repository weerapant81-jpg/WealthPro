import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'

/* ช่องกรอกจำนวนเงิน — แสดงคั่นหลักพันด้วย , ใช้ร่วมกันทั้งแอป
   - MoneyInput    : ค่าเป็น number (เช่น หน้าภาษี / แผนเกษียณ)
   - MoneyInputStr : ค่าเป็น string (ฟอร์มที่เก็บค่าเป็น string เช่น ข้อมูลลูกค้า / สินทรัพย์) */

const DEFAULT_STYLE: CSSProperties = {
  width: 130, padding: '6px 9px', textAlign: 'right', background: 'var(--navy-900)',
  border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--cyan)',
  fontSize: 13, fontWeight: 500, fontFamily: 'monospace', outline: 'none',
}

const grp = (n: number) => n.toLocaleString('en-US')

export function MoneyInput({ value, onChange, placeholder, style }: {
  value: number; onChange: (v: number) => void; placeholder?: string; style?: CSSProperties
}) {
  const [text, setText] = useState(value ? grp(value) : '')
  useEffect(() => { setText(value ? grp(value) : '') }, [value])
  return (
    <input
      type="text" inputMode="numeric" value={text} placeholder={placeholder}
      onChange={e => {
        const raw = e.target.value.replace(/,/g, '')
        if (raw === '') { setText(''); onChange(0); return }
        if (!/^\d+$/.test(raw)) return
        const n = Number(raw); setText(grp(n)); onChange(n)
      }}
      style={style ?? DEFAULT_STYLE}
    />
  )
}

export function MoneyInputStr({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties
}) {
  const [focused, setFocused] = useState(false)
  const raw = String(value ?? '').replace(/,/g, '')
  const formatted = raw === '' || isNaN(Number(raw)) ? raw : Number(raw).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return (
    <input
      type="text" inputMode="numeric" value={focused ? raw : formatted} placeholder={placeholder}
      onChange={e => { const r = e.target.value.replace(/,/g, ''); if (r === '' || /^\d*\.?\d*$/.test(r)) onChange(r) }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={style}
    />
  )
}
