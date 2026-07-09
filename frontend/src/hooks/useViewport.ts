import { useState, useEffect } from 'react'

/**
 * ติดตามความกว้าง viewport แบบ reactive (SSR-safe)
 * ใช้กับหน้าที่ต้องสลับเลย์เอาต์ตามจอ เช่น ฟอร์ม|ผลลัพธ์ ที่ auto-fit เอาไม่อยู่
 */
export function useViewportWidth(): number {
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vw
}

/**
 * true = จอแคบ (มือถือ + iPad แนวตั้ง) → ควรวางเลย์เอาต์แบบซ้อนกัน (คอลัมน์เดียว)
 * false = จอกว้าง (iPad แนวนอน + เดสก์ท็อป) → วางเคียงข้างได้
 * เกณฑ์ 900px: iPad แนวตั้ง (768/834) = compact, iPad แนวนอน (1024+) = wide
 */
export function useIsCompact(breakpoint = 900): boolean {
  return useViewportWidth() < breakpoint
}
