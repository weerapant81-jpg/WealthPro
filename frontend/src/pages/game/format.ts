import type { CSSProperties } from 'react'

/* ── helpers ร่วมของหน้าจอเกมเศรษฐี ── */

/** เงินแบบไทยอ่านง่าย: 1,250,000 → "1.25 ล้าน" · 45,000 → "45,000" */
export function fmtTH(n: number): string {
  const neg = n < 0
  const v = Math.abs(n)
  const s = v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)} ล้าน`
    : Math.round(v).toLocaleString('th-TH')
  return (neg ? '-' : '') + s
}

/** แกนกราฟแบบสั้น: 2500000 → "2.5ล." */
export const fmtAxis = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}ล.`
  : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`

export const gradeColor = (g: string) =>
  g === 'A' ? 'var(--cyan)' : g === 'B' ? '#5fd68a' : g === 'C' ? 'var(--gold)' : g === 'D' ? '#ff9f43' : '#ff5d5d'

export const happyEmoji = (h: number) => h >= 75 ? '😄' : h >= 55 ? '🙂' : h >= 40 ? '😐' : h >= 25 ? '😟' : '😣'

/* ปุ่มมาตรฐานของเกม */
export const btnPrimary: CSSProperties = {
  padding: '13px 20px', background: 'var(--cyan)', border: 'none', borderRadius: 12,
  color: '#00201d', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
}
export const btnGhost: CSSProperties = {
  padding: '12px 20px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 12,
  color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
}
