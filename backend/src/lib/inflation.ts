// ── อัตราเงินเฟ้ออ้างอิงของไทย (CPI) จาก World Bank ──
// ใช้เป็น "ข้อมูลอ้างอิง" ให้ที่ปรึกษาดูประกอบการตั้งสมมติฐานเท่านั้น ไม่เขียนทับค่าที่ตั้งไว้เอง
// หมายเหตุสำคัญ: ค่า "ปีล่าสุด" ใช้วางแผนระยะยาวไม่ได้ (ไทยเคยติดลบ) จึงคืนค่าเฉลี่ยย้อนหลังมาด้วย
import axios from 'axios'

const WB_URL = 'https://api.worldbank.org/v2/country/THA/indicator/FP.CPI.TOTL.ZG'
const CACHE_MS = 24 * 60 * 60 * 1000   // ข้อมูลอัปเดตปีละครั้ง — cache 1 วันเหลือเฟือ
const TIMEOUT_MS = 8000

export type InflationRef = {
  source: string
  sourceUrl: string
  lastUpdated: string | null
  latest: { year: number; value: number } | null
  averages: { years: number; from: number; to: number; value: number }[]
  fetchedAt: string
}

let cache: { at: number; data: InflationRef } | null = null

const round2 = (n: number) => Math.round(n * 100) / 100

/** ดึงอัตราเงินเฟ้ออ้างอิง — คืน null ถ้าดึงไม่ได้ (หน้าเว็บจะไม่แสดงบรรทัดอ้างอิง) */
export async function getThaiInflationRef(): Promise<InflationRef | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
  try {
    const res = await axios.get(WB_URL, {
      params: { format: 'json', per_page: 60, date: `${new Date().getFullYear() - 30}:${new Date().getFullYear()}` },
      timeout: TIMEOUT_MS,
    })
    const meta = Array.isArray(res.data) ? res.data[0] : null
    const rows = Array.isArray(res.data) ? res.data[1] : null
    if (!Array.isArray(rows)) return cache?.data ?? null

    // เรียงจากปีใหม่ → เก่า และตัดปีที่ยังไม่มีข้อมูลออก
    const series = rows
      .filter((r: any) => r && r.value != null)
      .map((r: any) => ({ year: Number(r.date), value: Number(r.value) }))
      .filter(r => Number.isFinite(r.year) && Number.isFinite(r.value))
      .sort((a, b) => b.year - a.year)
    if (!series.length) return cache?.data ?? null

    const averages = [5, 10, 20]
      .filter(n => series.length >= n)
      .map(n => {
        const slice = series.slice(0, n)
        return {
          years: n,
          from: slice[slice.length - 1].year,
          to: slice[0].year,
          value: round2(slice.reduce((s, r) => s + r.value, 0) / n),
        }
      })

    const data: InflationRef = {
      source: 'World Bank · Inflation, consumer prices (annual %) — Thailand',
      sourceUrl: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=TH',
      lastUpdated: meta?.lastupdated ?? null,
      latest: { year: series[0].year, value: round2(series[0].value) },
      averages,
      fetchedAt: new Date().toISOString(),
    }
    cache = { at: Date.now(), data }
    return data
  } catch {
    return cache?.data ?? null   // ดึงไม่ได้ → ใช้ของเดิมที่ cache ไว้ (ถ้ามี)
  }
}
