// ── อัตราเงินเฟ้ออ้างอิงของไทย (CPI) ──
// แหล่งหลัก: สนค. กระทรวงพาณิชย์ (MOC Open Data) — เจ้าของข้อมูล CPI ตัวจริง เปิดให้ใช้ฟรี ไม่ต้องมี API key
//            ให้ CPI แยกรายหมวดได้ตรงกับช่องสมมติฐานทั้ง 4 ช่อง
// สำรอง:   World Bank — มีเฉพาะเงินเฟ้อทั่วไป ใช้เมื่อ สนค. ล่ม
//
// ใช้เป็น "ข้อมูลอ้างอิง" ให้ที่ปรึกษาดูประกอบการตั้งสมมติฐานเท่านั้น ไม่เขียนทับค่าที่ตั้งไว้เอง
// หมายเหตุสำคัญ: ค่า "ปีล่าสุด" ใช้วางแผนระยะยาวไม่ได้ (ไทยเคยติดลบ) จึงคืนค่าเฉลี่ยย้อนหลังมาด้วย
import axios from 'axios'

const MOC_URL = 'https://dataapi.moc.go.th/cpig-indexes'
const MOC_REGION_COUNTRY = 5          // 5 = ทั้งประเทศ (0=กทม.&ปริมณฑล 1=กลาง 2=อีสาน 3=เหนือ 4=ใต้)
const WB_URL = 'https://api.worldbank.org/v2/country/THA/indicator/FP.CPI.TOTL.ZG'

const CACHE_MS = 24 * 60 * 60 * 1000  // CPI ออกเดือนละครั้ง — cache 1 วันเหลือเฟือ
const TIMEOUT_MS = 12000
const YEARS_BACK = 20

// รหัสหมวดดัชนี (16 หลัก) — ยืนยันชื่อหมวดจาก API จริงแล้ว
export const CPI_CATEGORIES = [
  { key: 'general',   indexId: '0000000000000000', label: 'ทั่วไป',              mocLabel: 'รวมทุกรายการ' },
  { key: 'education', indexId: '6200000000000000', label: 'การศึกษา',           mocLabel: 'การศึกษา' },
  { key: 'rent',      indexId: '3100000000000000', label: 'ค่าเช่าที่อยู่อาศัย',  mocLabel: 'ค่าที่พักอาศัย' },
  { key: 'medical',   indexId: '4000000000000000', label: 'ค่ารักษาพยาบาล',      mocLabel: 'หมวดการตรวจรักษาและบริการส่วนบุคคล' },
] as const

export type CpiKey = typeof CPI_CATEGORIES[number]['key']

export type CategoryRef = {
  key: CpiKey
  label: string
  seriesName: string
  latest: { year: number; value: number } | null
  averages: { years: number; from: number; to: number; value: number }[]
}

export type InflationRef = {
  source: string
  sourceUrl: string
  categories: CategoryRef[]
  fetchedAt: string
}

let cache: { at: number; data: InflationRef } | null = null

const round2 = (n: number) => Math.round(n * 100) / 100
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** ค่าเฉลี่ย 5/10/20 ปี จาก series รายปี (เรียงปีใหม่ → เก่า) */
function averagesOf(series: { year: number; value: number }[]) {
  return [5, 10, 20]
    .filter(n => series.length >= n)
    .map(n => {
      const s = series.slice(0, n)
      return {
        years: n,
        from: s[s.length - 1].year,
        to: s[0].year,
        value: round2(s.reduce((a, r) => a + r.value, 0) / n),
      }
    })
}

/**
 * เงินเฟ้อรายปีของหมวดหนึ่งจาก สนค.
 * API คืนรายเดือน — แถวเดือน 12 ของแต่ละปี ฟิลด์ aoa = อัตราเงินเฟ้อเฉลี่ยทั้งปีเทียบปีก่อน
 * (ตรงกับตัวเลขที่ประกาศเป็น "เงินเฟ้อทั้งปี" และตรงกับ World Bank)
 */
async function fetchMocCategory(indexId: string, fromYear: number, toYear: number) {
  const res = await axios.get(MOC_URL, {
    params: { region_id: MOC_REGION_COUNTRY, index_id: indexId, from_year: fromYear, to_year: toYear },
    timeout: TIMEOUT_MS,
  })
  const rows = res.data
  if (!Array.isArray(rows) || !rows.length) return null
  const series = rows
    .filter((r: any) => Number(r?.month) === 12 && r?.aoa != null)
    .map((r: any) => ({ year: Number(r.year), value: Number(r.aoa) }))
    .filter(r => Number.isFinite(r.year) && Number.isFinite(r.value))
    .sort((a, b) => b.year - a.year)
  if (!series.length) return null
  const name = String(rows[0]?.index_description ?? '')
  return { series, name }
}

/** เงินเฟ้อทั่วไปจาก World Bank — ใช้เมื่อ สนค. ล่ม */
async function fetchWorldBank(fromYear: number, toYear: number) {
  const res = await axios.get(WB_URL, {
    params: { format: 'json', per_page: 100, date: `${fromYear}:${toYear}` },
    timeout: TIMEOUT_MS,
  })
  const rows = Array.isArray(res.data) ? res.data[1] : null
  if (!Array.isArray(rows)) return null
  const series = rows
    .filter((r: any) => r?.value != null)
    .map((r: any) => ({ year: Number(r.date), value: Number(r.value) }))
    .filter(r => Number.isFinite(r.year) && Number.isFinite(r.value))
    .sort((a, b) => b.year - a.year)
  return series.length ? series : null
}

/** ดึงอัตราเงินเฟ้ออ้างอิงทุกหมวด — คืน null ถ้าดึงไม่ได้เลย (หน้าเว็บจะไม่แสดงบรรทัดอ้างอิง) */
export async function getThaiInflationRef(): Promise<InflationRef | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data

  const thisYear = new Date().getFullYear()
  const fromYear = thisYear - YEARS_BACK
  const categories: CategoryRef[] = []

  // สนค. จะตอบ 500 ถ้ายิงพร้อมกันหลายคำขอ — ยิงทีละหมวด เว้นจังหวะสั้น ๆ
  for (const cat of CPI_CATEGORIES) {
    try {
      const got = await fetchMocCategory(cat.indexId, fromYear, thisYear)
      if (got) {
        categories.push({
          key: cat.key, label: cat.label,
          seriesName: got.name || cat.mocLabel,
          latest: { year: got.series[0].year, value: round2(got.series[0].value) },
          averages: averagesOf(got.series),
        })
      }
    } catch { /* หมวดนี้ดึงไม่ได้ — ข้ามไป ไม่ให้กระทบหมวดอื่น */ }
    await sleep(300)
  }

  let source = 'สนค. กระทรวงพาณิชย์ (MOC Open Data)'
  let sourceUrl = 'https://data.moc.go.th/OpenData/CPIGIndexes'

  // สนค. ไม่ตอบเลย → ถอยไปใช้ World Bank (มีเฉพาะเงินเฟ้อทั่วไป)
  if (!categories.length) {
    try {
      const wb = await fetchWorldBank(fromYear, thisYear)
      if (wb) {
        categories.push({
          key: 'general', label: 'ทั่วไป',
          seriesName: 'Inflation, consumer prices (annual %) — Thailand',
          latest: { year: wb[0].year, value: round2(wb[0].value) },
          averages: averagesOf(wb),
        })
        source = 'World Bank'
        sourceUrl = 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG?locations=TH'
      }
    } catch { /* ไม่มีแหล่งไหนใช้ได้ */ }
  }

  if (!categories.length) return cache?.data ?? null

  const data: InflationRef = { source, sourceUrl, categories, fetchedAt: new Date().toISOString() }
  cache = { at: Date.now(), data }
  return data
}
